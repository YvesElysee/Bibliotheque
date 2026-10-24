require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { globalRateLimiter } = require('./middlewares/rateLimit.middleware');
const parseCookies = require('./middlewares/cookie.middleware');
const { logger } = require('./utils/logger');

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const booksRoutes = require('./modules/books/books.routes');
const loansRoutes = require('./modules/loans/loans.routes');
const reservationsRoutes = require('./modules/reservations/reservations.routes');
const messagesRoutes = require('./modules/messages/messages.routes');
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
const isProd = process.env.NODE_ENV === 'production';
const cspDirectives = {
  ...helmet.contentSecurityPolicy.getDefaultDirectives(),
  'img-src': ["'self'", 'data:', 'https://covers.openlibrary.org', 'https://*.openlibrary.org', 'https://books.google.com', 'https://*.google.com', 'https://*.googleusercontent.com', 'https://*.archive.org', 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
  'connect-src': ["'self'"],
};
// En développement (accès http local/LAN), on n'impose pas l'HTTPS forcé,
// sinon le navigateur réécrit les requêtes en https:// et casse l'appli locale.
if (!isProd) delete cspDirectives['upgrade-insecure-requests'];

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { useDefaults: false, directives: cspDirectives },
}));

// Autorisations navigateur minimales : on désactive ce dont l'appli n'a pas besoin.
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

// Application interne : le front est servi par ce même serveur (même origine).
// On reflète l'origine appelante pour permettre aussi l'accès via IP locale en LAN
// et le développement via Live Server (:5500). L'authentification utilise des
// cookies HttpOnly (SameSite=Lax), ce qui protège des attaques CSRF.
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Lecture des cookies (jetons d'authentification HttpOnly)
app.use(parseCookies);

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
app.use('/api/messages', messagesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/exports', exportsRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── Frontend statique (même origine → pas de CORS, API sur /api) ─────────────
// Requête automatique de Chrome DevTools : on répond 204 pour éviter un 404 inutile.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.status(204).end());

const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));
app.get('/', (_req, res) => res.sendFile(path.join(frontendPath, 'pages/index.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(frontendPath, 'pages/admin/index.html')));

// ─── Gestion des erreurs ──────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
