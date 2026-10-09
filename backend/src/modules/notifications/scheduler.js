const cron = require('node-cron');
const { logger } = require('../../utils/logger');
const notificationsService = require('./notifications.service');
const loansService = require('../loans/loans.service');

let isSchedulerStarted = false;

const startScheduler = () => {
  if (isSchedulerStarted) return;
  isSchedulerStarted = true;

  // Rappels emprunt J-3 — tous les jours à 8h00
  cron.schedule('0 8 * * *', async () => {
    logger.info('[CRON] Exécution rappels J-3...');
    try {
      const count = await notificationsService.sendLoanReminders(3);
      logger.info(`[CRON] ${count} rappels J-3 envoyés.`);
    } catch (err) {
      logger.error('[CRON] Erreur rappels J-3:', err);
    }
  }, { timezone: 'Africa/Lagos' }); // UTC+1 — adapté selon le fuseau

  // Rappels emprunt J-1 — tous les jours à 9h00
  cron.schedule('0 9 * * *', async () => {
    logger.info('[CRON] Exécution rappels J-1...');
    try {
      const count = await notificationsService.sendLoanReminders(1);
      logger.info(`[CRON] ${count} rappels J-1 envoyés.`);
    } catch (err) {
      logger.error('[CRON] Erreur rappels J-1:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Marquage des emprunts en retard — tous les jours à 0h05
  cron.schedule('5 0 * * *', async () => {
    logger.info('[CRON] Mise à jour emprunts en retard...');
    try {
      const count = await loansService.markOverdueLoans();
      logger.info(`[CRON] ${count} emprunt(s) marqué(s) en retard.`);
    } catch (err) {
      logger.error('[CRON] Erreur marquage retards:', err);
    }
  }, { timezone: 'Africa/Lagos' });

  logger.info('✅ Scheduler CRON démarré (rappels J-3, J-1, retards).');
};

module.exports = { startScheduler };
