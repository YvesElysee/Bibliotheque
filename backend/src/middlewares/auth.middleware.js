const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('../utils/apiResponse');
const { ACCESS_COOKIE } = require('../utils/cookies');

/**
 * Extrait l'access token depuis le cookie HttpOnly (méthode principale)
 * ou, en repli, depuis l'en-tête Authorization: Bearer (compatibilité).
 */
const extractToken = (req) => {
  if (req.cookies && req.cookies[ACCESS_COOKIE]) return req.cookies[ACCESS_COOKIE];
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return null;
};

/**
 * Vérifie l'access token JWT (cookie HttpOnly en priorité).
 */
const authenticate = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return unauthorized(res, 'Token d\'authentification manquant.');
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Vérifie que l'utilisateur a l'un des rôles requis.
 * @param {...string} roles - Rôles autorisés
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return unauthorized(res);
    if (!roles.includes(req.user.role)) {
      return forbidden(res, 'Vous n\'avez pas les permissions nécessaires.');
    }
    next();
  };
};

/**
 * Optionnel : authentifie si un token est présent, ne bloque pas sinon.
 */
const optionalAuth = (req, _res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      req.user = null;
    }
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
