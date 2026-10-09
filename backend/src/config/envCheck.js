const { logger } = require('../utils/logger');

function checkEnv(required = []) {
  const missing = required.filter((k) => process.env[k] === undefined || process.env[k] === '');
  if (missing.length > 0) {
    logger.warn(`⚠️  Variables d'environnement REQUISES manquantes : ${missing.join(', ')}`);
    logger.warn('   → Ajoute-les dans Render → ton service → Environment, puis redéploie.');
  } else {
    logger.info("✅ Variables d'environnement requises présentes (DATABASE_URL, JWT_SECRET).");
  }
  return missing;
}

module.exports = { checkEnv };