const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('../utils/apiResponse');

/**
 * Vérifie l'access token JWT.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Token d\'authentification manquant.');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
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
 * Optionnel : authentifie si le token est présent, ne bloque pas sinon.
 */
const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      req.user = null;
    }
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
