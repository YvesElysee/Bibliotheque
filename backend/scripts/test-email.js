require('dotenv').config();
const { sendEmail } = require('../src/config/email');

// Destinataire du test : EMAIL_TEST_TO, sinon EMAIL_FROM (adresse expéditrice,
// qui est une vraie boîte), sinon SMTP_USER.
const TO = process.env.EMAIL_TEST_TO || process.env.EMAIL_FROM || process.env.SMTP_USER;

(async () => {
  try {
    await sendEmail({
      to: TO,
      subject: 'Test email — Bibliothèque Scolasticat Père Piariste',
      html: '<h2>✅ La configuration email fonctionne !</h2><p>Cet email confirme que le serveur peut envoyer des messages.</p>',
      text: 'La configuration email fonctionne.',
    });
    console.log(`✅ Email de test envoyé à ${TO}`);
    process.exit(0);
  } catch (e) {
    console.error("❌ Échec de l'envoi :", e.message);
    console.error('   Vérifie SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS dans backend/.env.');
    console.error('   Avec Gmail : SMTP_PASS = mot de passe d\'application (pas ton mot de passe Gmail).');
    console.error('   Avec Brevo : SMTP_USER = xxx@smtp-brevo.com, SMTP_PASS = clé SMTP (xsmtpsib-…),');
    console.error('                et EMAIL_FROM = ton adresse d\'expéditeur validée.');
    process.exit(1);
  }
})();
