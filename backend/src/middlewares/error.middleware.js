const { logger } = require('../utils/logger');

/**
 * Middleware de gestion centralisée des erreurs.
 */
const errorHandler = (err, req, res, _next) => {
  logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, { stack: err.stack });

  // Erreurs Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Une ressource avec ces données existe déjà.',
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Ressource introuvable.',
    });
  }

  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expiré.' });
  }

  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Erreur interne du serveur.' : err.message,
  });
};

/**
 * Middleware 404 — route non trouvée.
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée : ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFoundHandler };
