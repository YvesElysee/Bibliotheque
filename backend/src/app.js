require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { globalRateLimiter } = require('./middlewares/rateLimit.middleware');
const { logger } = require('./utils/logger');

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const booksRoutes = require('./modules/books/books.routes');
const loansRoutes = require('./modules/loans/loans.routes');
const reservationsRoutes = require('./modules/reservations/reservations.routes');
const reviewsRoutes = require('./modules/reviews/reviews.routes');
const requestsRoutes = require('./modules/requests/requests.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const exportsRoutes = require('./modules/exports/exports.routes');

const app = express();

// Derrière un proxy (Render, Railway…) : nécessaire pour que req.ip reflète
// l'adresse réelle du client et non celle du proxy (rate limiting correct).
app.set('trust proxy', 1);

// ─── Sécurité ────────────────────────────────────────────────────────────────
// img-src : on autorise en plus les couvertures hébergées chez les fournisseurs
// (Google Books, Open Library). Les couvertures téléchargées en local (/uploads)
// restent servies en même origine ('self') et sont donc toujours autorisées.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https://covers.openlibrary.org', 'https://books.google.com', 'https://lh3.googleusercontent.com'],
    },
  },
}));

// Application interne : le front est servi par ce même serveur (même origine).
// On reflète l'origine appelante pour permettre aussi l'accès via IP locale en LAN
// et le développement via Live Server (:5500). L'authentification utilise un
// jeton Bearer (localStorage), non des cookies, ce qui limite le risque CSRF.
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Fichiers statiques (couvertures de livres) ──────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Rate Limiting global ─────────────────────────────────────────────────────
app.use('/api', globalRateLimiter);

// ─── Logging des requêtes ─────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl} — ${req.ip}`);
  next();
});

// ─── Routes API ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/exports', exportsRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── Frontend statique (même origine → pas de CORS, API sur /api) ─────────────
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));
app.get('/', (_req, res) => res.sendFile(path.join(frontendPath, 'pages/index.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(frontendPath, 'pages/admin/index.html')));

// ─── Gestion des erreurs ──────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
