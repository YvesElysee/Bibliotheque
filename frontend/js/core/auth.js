/**
 * Gestion de l'authentification côté client.
 * Stockage JWT dans localStorage, helpers de rôles.
 */

export const auth = {
  /** Retourne l'utilisateur connecté ou null */
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch { return null; }
  },

  /** Retourne l'access token */
  getToken() {
    return localStorage.getItem('access_token');
  },

  /** Vérifie si l'utilisateur est connecté */
  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  /** Vérifie le rôle de l'utilisateur connecté */
  hasRole(...roles) {
    const user = this.getUser();
    return user && roles.includes(user.role);
  },

  /** Est-il admin ou bibliothécaire ? */
  isStaff() {
    return this.hasRole('ADMIN', 'LIBRARIAN');
  },

  /** Est-il admin ? */
  isAdmin() {
    return this.hasRole('ADMIN');
  },

  /** Sauvegarde la session après login */
  saveSession({ accessToken, refreshToken, user }) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
  },

  /** Nettoyage de la session dans le stockage local */
  clearSession() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  /** Déconnexion volontaire */
  logout() {
    this.clearSession();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    if (!window.location.pathname.includes('login')) {
      window.location.href = '/pages/login.html';
    }
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

  /** Redirige vers accueil si non admin/librarian */
  requireStaff() {
    if (!this.isAuthenticated()) return this.requireAuth();
    if (!this.isStaff()) {
      window.location.href = '/pages/index.html';
      return false;
    }
    return true;
  },

  /** Nom complet de l'utilisateur */
  getFullName() {
    const user = this.getUser();
    return user ? `${user.firstName} ${user.lastName}` : '';
  },
};

// Écoute la déconnexion forcée (ex: token expiré)
window.addEventListener('auth:logout', () => {
  auth.clearSession();
  if (!window.location.pathname.includes('login')) {
    window.location.href = '/pages/login.html';
  }
});

export default auth;
