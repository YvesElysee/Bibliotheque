require('dotenv').config();
const { sendEmail } = require('../src/config/email');

(async () => {
  try {
    await sendEmail({
      to: process.env.SMTP_USER,
      subject: 'Test email — Bibliothèque de la Congrégation',
      html: '<h2>✅ La configuration email fonctionne !</h2><p>Cet email confirme que le serveur peut envoyer des messages.</p>',
      text: 'La configuration email fonctionne.',
    });
    console.log(`✅ Email de test envoyé à ${process.env.SMTP_USER}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Échec de l\'envoi :', e.message);
    console.error('   Vérifie SMTP_USER et SMTP_PASS dans backend/.env (mot de passe d\'application, pas ton mot de passe Gmail).');
    process.exit(1);
  }
})();
