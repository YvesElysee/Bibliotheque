require('dotenv').config();
const app = require('./src/app');
const { logger } = require('./src/utils/logger');
const { startScheduler } = require('./src/modules/notifications/scheduler');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST; // vide = toutes les interfaces (accessible sur le réseau local)

const server = app.listen(PORT, HOST, () => {
  logger.info(`✅ Serveur démarré sur http://${HOST || 'localhost'}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
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
