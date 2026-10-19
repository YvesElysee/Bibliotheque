require('dotenv').config();
const { logger } = require('./src/utils/logger');
const { checkEnv } = require('./src/config/envCheck');

// Journal d'aide au déploiement : on affiche ce qui manque avant tout crash.
const missing = checkEnv(['DATABASE_URL', 'JWT_SECRET']);
if (missing.length > 0) {
  logger.error('❌ Démarrage interrompu : variables manquantes → ' + missing.join(', '));
  logger.error('   → Ajoute-les dans Render : ton service → onglet « Environment » → « Add Environment Variable »,');
  logger.error('     puis « Save Changes » (Render redéploie automatiquement).');
  logger.error('   ⚠️  Le fichier backend/.env local n\'est PAS envoyé sur GitHub, donc Render ne le voit pas.');
  process.exit(1);
}

// Piège fréquent : une URL « localhost » ne fonctionne pas sur Render
// (le serveur est une machine distante). Il faut une base joignable sur Internet.
if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL || '')) {
  logger.error('❌ DATABASE_URL pointe vers « localhost » : cette base est introuvable depuis Render.');
  logger.error('   → Utilise l\'URL PUBLIQUE de ta base Neon, de la forme :');
  logger.error('     postgresql://utilisateur:motdepasse@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require');
  process.exit(1);
}

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
const { ensureBooks } = require('./src/utils/ensureBooks');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST; // vide = toutes les interfaces (accessible sur le réseau local)

const server = app.listen(PORT, HOST, async () => {
  logger.info(`✅ Serveur démarré sur http://${HOST || 'localhost'}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  await ensureSeed(); // une seule fois, seulement si la base est vide
  await ensureBooks(); // importe les 136 livres si la base n'en contient pas encore
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