const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_CONFIGURED = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = SMTP_CONFIGURED
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

// Vérification de la configuration SMTP (non bloquante)
if (!SMTP_CONFIGURED) {
  logger.warn(
    '✉️  Email désactivé : SMTP_HOST / SMTP_USER / SMTP_PASS non renseignés.'
  );
} else {
  transporter.verify((error) => {
    if (error) {
      logger.warn(`⚠️  SMTP inaccessible (${SMTP_HOST}:${SMTP_PORT}) : ${error.message}`);
      if (process.env.NODE_ENV === 'production') {
        logger.warn('   Rappel : Render (plan gratuit) BLOQUE les ports SMTP 25, 465 et 587.');
        logger.warn('   Solution gratuite : un relais en port 2525, ex. Brevo :');
        logger.warn('     SMTP_HOST=smtp-relay.brevo.com');
        logger.warn('     SMTP_PORT=2525');
        logger.warn('     SMTP_SECURE=false');
        logger.warn('     SMTP_USER=xxxxxxx@smtp-brevo.com');
        logger.warn('     SMTP_PASS=<clé SMTP Brevo>');
      }
    } else {
      logger.info('✅ Serveur SMTP prêt');
    }
  });
}

/**
 * Envoie un email.
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!transporter) {
    throw new Error(
      'Email non configuré : renseigne SMTP_HOST / SMTP_USER / SMTP_PASS.'
    );
  }
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Bibliothèque'}" <${SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email envoyé à ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Erreur envoi email à ${to}:`, error);
    throw error;
  }
};

module.exports = { sendEmail, isEmailConfigured: SMTP_CONFIGURED };
