/**
 * HTTP Client — Wrapper fetch uniforme
 * Authentification par cookies HttpOnly (envoyés automatiquement par le navigateur).
 * Gère : base URL, credentials, refresh de session, erreurs.
 * + Mode hors-ligne : cache GET + file d'attente pour les actions
 */

// Le frontend est servi par le backend Express (même origine) → base relative.
// En développement via live-server (port 5500), on cible le backend local.
const API_BASE =
  window.location.port === '5500'
    ? `${window.location.protocol}//${window.location.hostname}:3000/api`
    : '/api';

// Origine du backend, utilisée pour résoudre les fichiers servis (/uploads/...)
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Transforme un chemin relatif d'asset en URL absolue utilisable dans <img src>
export const resolveAssetUrl = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${API_ORIGIN}${path}`;
};

// Les cookies HttpOnly transportent l'authentification : aucun header Authorization.
// On n'ajoute Content-Type que s'il y a un corps (évite des requêtes preflight inutiles).
const _getHeaders = (hasBody) => {
  const headers = {};
  if (hasBody) headers['Content-Type'] = 'application/json';
  return headers;
};

const _handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Erreur ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

let _isRefreshing = false;
let _failedQueue = [];

const _processQueue = (error) => {
  _failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  _failedQueue = [];
};

// Import dynamique pour éviter les erreurs si hors module
let offlineDb = null;
let syncManager = null;

const _loadOfflineModules = async () => {
  if (offlineDb) return;
  try {
    offlineDb = await import('./offline-db.js');
    syncManager = await import('./sync-manager.js');
  } catch (e) {
    // Ignorer si les modules ne sont pas disponibles
  }
};

// Déterminer quel store utiliser selon l'URL
const _getStoreFromUrl = (path) => {
  if (path.startsWith('/books')) return 'books';
  if (path.startsWith('/users')) return 'users';
  if (path.startsWith('/loans')) return 'loans';
  if (path.startsWith('/reservations')) return 'reservations';
  if (path.startsWith('/categories')) return 'categories';
  if (path.startsWith('/messages')) return 'messages';
  if (path.startsWith('/books/stats')) return 'stats';
  return null;
};

const _request = async (method, path, body, attempt = 0) => {
  await _loadOfflineModules();
  
  const isGet = method === 'GET';
  const isAdminRoute = path.includes('/loans') || path.includes('/users') || path.includes('/reservations') || path.includes('/messages') || path.includes('/admin');
  const store = _getStoreFromUrl(path);

  // Pour les GET, essayer d'abord le cache si hors-ligne
  if (isGet && !navigator.onLine && offlineDb) {
    try {
      const cached = await offlineDb.cacheGet(store || 'books', { all: true });
      if (cached && cached.length > 0) {
        console.log('[API] Données depuis le cache (hors-ligne):', path);
        // Formater comme la réponse API
        return { success: true, data: cached, fromCache: true };
      }
    } catch (e) {
      console.warn('[API] Erreur lecture cache:', e);
    }
    throw new Error('Hors-ligne - Aucune donnée en cache pour cette page. Connectez-vous au réseau pour la charger.');
  }

  // Pour les actions de modification hors-ligne
  if (!isGet && !navigator.onLine && offlineDb) {
    try {
      await offlineDb.queueAdd(method, path, body);
      // Mettre à jour le compteur
      window.dispatchEvent(new CustomEvent('sync:status', { detail: { status: 'pending' } }));
      if (typeof window !== 'undefined' && window.toast) {
        window.toast.info("Action enregistrée hors-ligne. Elle sera envoyée dès le retour de la connexion.");
      }
      // Simuler une réponse réussie
      return { success: true, data: { queued: true }, message: "Action enregistrée hors-ligne" };
    } catch (e) {
      console.warn('[API] Erreur mise en file d\'attente:', e);
    }
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: _getHeaders(body !== undefined),
      credentials: 'include',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // Tentative de refresh si 401 et premier essai.
    if (res.status === 401 && attempt === 0) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then(() => _request(method, path, body, 1));
      }

      _isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!refreshRes.ok) throw new Error('Refresh failed');

        _processQueue(null);
        return _request(method, path, body, 1);
      } catch (refreshErr) {
        _processQueue(refreshErr);
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      } finally {
        _isRefreshing = false;
      }
    }

    const data = await _handleResponse(res);
    
    // Mettre en cache les GET réussis
    if (isGet && res.ok && offlineDb && data.success && data.data) {
      try {
        if (store) {
          await offlineDb.cacheSet(store, data.data);
        }
        if (path.includes('/books/stats')) {
          await offlineDb.cacheSet('stats', data.data, 'dashboard');
        }
      } catch (e) {
        // Ignorer les erreurs de cache
      }
    }
    
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      // Erreur réseau - essayer le cache pour les GET
      if (isGet && offlineDb) {
        try {
          const cached = await offlineDb.cacheGet(store || 'books', { all: true });
          if (cached && cached.length > 0) {
            console.log('[API] Fallback cache après erreur réseau:', path);
            return { success: true, data: cached, fromCache: true };
          }
        } catch (e) {}
      }
      throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
    }
    throw err;
  }
};

const api = {
  get: (path) => _request('GET', path),
  post: (path, body) => _request('POST', path, body),
  put: (path, body) => _request('PUT', path, body),
  patch: (path, body) => _request('PATCH', path, body),
  delete: (path) => _request('DELETE', path),

  // Upload fichier (cookie envoyé automatiquement)
  upload: async (path, formData) => {
    if (!navigator.onLine) {
      throw new Error('Impossible de téléverser un fichier en mode hors-ligne. Veuillez vous connecter au réseau.');
    }
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return _handleResponse(res);
  },

  // Télécharger un fichier (PDF, QR) avec authentification par cookie
  download: async (path, filename) => {
    if (!navigator.onLine) {
      throw new Error('Impossible de télécharger un fichier en mode hors-ligne.');
    }
    const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erreur lors du téléchargement.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};

export default api;
