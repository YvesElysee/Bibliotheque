const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Vérification de la configuration SMTP
transporter.verify((error) => {
  if (error) {
    logger.warn('⚠️  SMTP non configuré ou inaccessible:', error.message);
  } else {
    logger.info('✅ Serveur SMTP prêt');
  }
});

/**
 * Envoie un email.
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Bibliothèque'}" <${process.env.SMTP_USER}>`,
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

module.exports = { sendEmail };
