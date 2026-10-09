const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  logger.error('Prisma Error:', e);
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma Warning:', e);
});

// Test de connexion au démarrage
prisma.$connect()
  .then(() => logger.info('✅ Connexion PostgreSQL établie via Prisma'))
  .catch((err) => {
    logger.error('❌ Échec connexion PostgreSQL:', err);
    process.exit(1);
  });

module.exports = prisma;
