/**
 * HTTP Client — Wrapper fetch uniforme
 * Gère automatiquement : base URL, headers Authorization, refresh token, erreurs
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

const _getHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
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

const _request = async (method, path, body, attempt = 0) => {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: _getHeaders(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // Tentative de refresh si 401 et premier essai
    if (res.status === 401 && attempt === 0) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Session expirée.');
      }

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
          body: JSON.stringify({ refreshToken }),
        });
        const refreshData = await refreshRes.json();
        if (!refreshRes.ok) throw new Error('Refresh failed');

        localStorage.setItem('access_token', refreshData.data.accessToken);
        _processQueue(null);
        return _request(method, path, body, 1);
      } catch (refreshErr) {
        _processQueue(refreshErr);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      } finally {
        _isRefreshing = false;
      }
    }

    return _handleResponse(res);
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
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

  // Upload fichier
  upload: async (path, formData) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return _handleResponse(res);
  },

  // Télécharger un fichier (PDF, QR)
  download: async (path, filename) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Erreur lors du téléchargement.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};

export default api;
