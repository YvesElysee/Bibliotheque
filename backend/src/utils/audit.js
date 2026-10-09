const prisma = require('../config/database');
const { logger } = require('./logger');

/**
 * Enregistre une action admin dans le journal d'audit.
 * @param {Object} params
 * @param {string} params.userId - ID de l'utilisateur
 * @param {string} params.action - Action effectuée (ex: CREATE_BOOK)
 * @param {string} params.entityType - Type d'entité (book, loan, user...)
 * @param {string} [params.entityId] - ID de l'entité concernée
 * @param {Object} [params.details] - Détails supplémentaires
 * @param {string} [params.ipAddress] - Adresse IP
 */
const auditLog = async ({ userId, action, entityType, entityId = null, details = null, ipAddress = null }) => {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entityType, entityId, details, ipAddress },
    });
  } catch (err) {
    // L'audit ne doit jamais bloquer l'opération principale
    logger.error('Erreur lors de l\'enregistrement de l\'audit:', err);
  }
};

module.exports = { auditLog };
