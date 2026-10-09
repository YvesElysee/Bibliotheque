const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

const prisma = new PrismaClient();

/**
 * Initialise la base au tout premier démarrage (si elle est vide).
 * Ne touche JAMAIS aux données existantes : si au moins un utilisateur existe, c'est ignoré.
 */
async function ensureSeed() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      logger.info('🌱 Base déjà initialisée — seed ignoré.');
      return;
    }
    logger.info('🌱 Base vide — initialisation automatique (catégories, comptes de démo, livres)...');
    await require('../../prisma/seed').main();
    logger.info('🌱 Seed initial terminé.');
  } catch (e) {
    logger.error('Erreur pendant le seed initial :', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { ensureSeed };