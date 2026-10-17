/**
 * Utilitaires pour l'authentification par cookies HttpOnly.
 * Les jetons ne sont JAMAIS renvoyés dans le corps des réponses : ils vivent
 * uniquement dans des cookies inaccessibles au JavaScript (protection XSS).
 */

const IS_PROD = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_MAX_AGE_MS =
  parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7', 10) * 24 * 60 * 60 * 1000;

// Attributes de sécurité communs.
// - httpOnly : inaccessible au JS
// - secure   : uniquement en HTTPS (production)
// - sameSite : 'lax' (frontend et backend sur le même site ; protège du CSRF)
const baseCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax',
  maxAge,
});

const accessCookieOptions = () => baseCookieOptions(ACCESS_MAX_AGE_MS);

const refreshCookieOptions = () => ({
  ...baseCookieOptions(REFRESH_MAX_AGE_MS),
  path: '/api/auth',
});

/** Pose les cookies access + refresh après une connexion / un refresh réussi. */
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  if (accessToken) res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
  if (refreshToken) res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
};

/** Supprime les cookies d'authentification (déconnexion). */
const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/api/auth',
  });
};

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  IS_PROD,
};
