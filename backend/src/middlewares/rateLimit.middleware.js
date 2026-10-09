const rateLimit = require('express-rate-limit');

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health', // le ping de réveil ne doit jamais être bloqué
  message: { success: false, message: 'Trop de requêtes. Veuillez réessayer dans 15 minutes.' },
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives de connexion. Veuillez patienter 15 minutes.' },
  skipSuccessfulRequests: true,
});

const emailRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: { success: false, message: 'Trop de demandes d\'email. Veuillez patienter 1 heure.' },
});

module.exports = { globalRateLimiter, authRateLimiter, emailRateLimiter };
