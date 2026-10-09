require('dotenv').config();
const { logger } = require('./src/utils/logger');
const { checkEnv } = require('./src/config/envCheck');

// Journal d'aide au déploiement : on affiche ce qui manque avant tout crash.
checkEnv(['DATABASE_URL', 'JWT_SECRET']);

let app;
try {
  app = require('./src/app');
} catch (err) {
  logger.error('❌ ERREUR CRITIQUE au démarrage :', err.message.split('\n')[0]);
  logger.error('   Cause la plus fréquente : DATABASE_URL absente ou mal renseignée dans Render → Environment.');
  process.exit(1);
}

const { startScheduler } = require('./src/modules/notifications/scheduler');
const { ensureSeed } = require('./src/utils/ensureSeed');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST; // vide = toutes les interfaces (accessible sur le réseau local)

const server = app.listen(PORT, HOST, async () => {
  logger.info(`✅ Serveur démarré sur http://${HOST || 'localhost'}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  await ensureSeed(); // une seule fois, seulement si la base est vide
  startScheduler();
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} reçu. Arrêt propre du serveur...`);
  server.close(() => {
    logger.info('Serveur HTTP fermé.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});