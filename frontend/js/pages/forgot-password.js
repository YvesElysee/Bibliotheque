import api from '../core/api.js';

const form = document.getElementById('forgot-form');
const errorDiv = document.getElementById('forgot-error');
const infoDiv = document.getElementById('forgot-info');
const btn = document.getElementById('forgot-btn');
const btnText = document.getElementById('forgot-btn-text');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorDiv.classList.add('hidden');
  infoDiv.classList.add('hidden');

  const email = document.getElementById('email').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorDiv.textContent = 'Adresse email invalide.';
    errorDiv.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Envoi en cours…';

  try {
    await api.post('/auth/forgot-password', { email });
    infoDiv.textContent = 'Si cet email existe, un lien de réinitialisation vient d\'être envoyé. Vérifiez votre boîte de réception.';
    infoDiv.classList.remove('hidden');
    form.reset();
  } catch (err) {
    errorDiv.textContent = err.message || 'Une erreur est survenue.';
    errorDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Envoyer le lien';
  }
});
