/**
 * Gestion de l'authentification côté client.
 *
 * Les jetons (access_token / refresh_token) sont stockés par le serveur dans des
 * cookies HttpOnly : le JavaScript ne peut pas les lire (protection XSS).
 * Seul un indicateur non sensible ("has_session") reste dans localStorage pour
 * savoir, de façon synchrone, si une session est probablement active.
 * Le profil (nom, rôle…) est récupéré via /users/me et gardé EN MÉMOIRE uniquement.
 */
import api from './api.js';

const SESSION_FLAG = 'has_session';

let _user = null; // profil en mémoire — jamais persisté
let _readyPromise = null;
let _redirecting = false;

const _goToLogin = () => {
  if (_redirecting) return;
  _redirecting = true;
  if (!window.location.pathname.includes('login')) {
    window.location.href = '/pages/login.html';
  }
};

export const auth = {
  /** Retourne l'utilisateur connecté (profil en mémoire) ou null */
  getUser() {
    return _user;
  },

  /** Une session est-elle probablement active ? (drapeau non sensible) */
  isAuthenticated() {
    return localStorage.getItem(SESSION_FLAG) === '1';
  },

  /**
   * Charge le profil depuis l'API une seule fois et le met en cache en mémoire.
   * À appeler (await) au démarrage des pages qui ont besoin du rôle / du nom.
   */
  async ready() {
    if (_readyPromise) return _readyPromise;
    if (!this.isAuthenticated()) return null;

    _readyPromise = api
      .get('/users/me')
      .then((res) => {
        _user = res.data;
        window.dispatchEvent(new CustomEvent('auth:user', { detail: _user }));
        return _user;
      })
      .catch(() => {
        this.clearSession();
        return null;
      });
    return _readyPromise;
  },

  /** Vérifie le rôle de l'utilisateur connecté */
  hasRole(...roles) {
    return !!_user && roles.includes(_user.role);
  },

  /** Est-il admin ou bibliothécaire ? */
  isStaff() {
    return this.hasRole('ADMIN', 'LIBRARIAN');
  },

  /** Est-il admin ? */
  isAdmin() {
    return this.hasRole('ADMIN');
  },

  /**
   * Sauvegarde la session après login.
   * Aucun jeton n'est stocké : le serveur a déjà posé les cookies HttpOnly.
   */
  saveSession({ user } = {}) {
    localStorage.setItem(SESSION_FLAG, '1');
    _user = user || null;
    _readyPromise = user ? Promise.resolve(user) : null;
    window.dispatchEvent(new CustomEvent('auth:login', { detail: _user }));
  },

  /** Met à jour le profil en mémoire (après édition) */
  updateUser(partial) {
    if (!partial) return;
    _user = { ...(_user || {}), ...partial };
    _readyPromise = Promise.resolve(_user);
  },

  /**
   * Nettoyage local de la session (drapeau + profil mémoire + anciennes clés).
   * Ne supprime pas les cookies : pour cela, appeler logout().
   */
  clearSession() {
    localStorage.removeItem(SESSION_FLAG);
    // Nettoyage des anciennes clés (migration depuis l'ancien stockage localStorage)
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    _user = null;
    _readyPromise = null;
  },

  /** Déconnexion volontaire : supprime les cookies côté serveur puis redirige */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      /* on déconnecte quand même */
    }
    this.clearSession();
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: { redirect: false } }));
    _goToLogin();
  },

  /** Redirige vers /login si non connecté */
  requireAuth(redirectTo = null) {
    if (!this.isAuthenticated()) {
      const current = redirectTo || window.location.pathname + window.location.hash;
      window.location.href = `/pages/login.html?redirect=${encodeURIComponent(current)}`;
      return false;
    }
    return true;
  },

  /** Redirige vers l'accueil si non admin/bibliothécaire */
  async requireStaff() {
    if (!this.isAuthenticated()) return this.requireAuth();
    await this.ready();
    if (!this.isStaff()) {
      window.location.href = '/pages/index.html';
      return false;
    }
    return true;
  },

  /** Nom complet de l'utilisateur */
  getFullName() {
    return _user ? `${_user.firstName} ${_user.lastName}` : '';
  },
};

// Écoute la déconnexion forcée (ex: session expirée, refresh échoué)
window.addEventListener('auth:logout', () => {
  auth.clearSession();
  _goToLogin();
});

export default auth;
