import api from '../core/api.js';

const token = new URLSearchParams(window.location.search).get('token');
const loading = document.getElementById('verify-loading');
const result = document.getElementById('verify-result');
const icon = document.getElementById('verify-icon');
const message = document.getElementById('verify-message');

const showResult = (ok, text) => {
  loading.classList.add('hidden');
  result.classList.remove('hidden');
  icon.textContent = ok ? '✅' : '⚠️';
  message.textContent = text;
  message.className = ok ? 'text-sm text-emerald-400' : 'text-sm text-amber-400';
};

if (!token) {
  showResult(false, 'Lien de vérification invalide ou incomplet.');
} else {
  api.post('/auth/verify-email', { token })
    .then(() => showResult(true, 'Votre adresse email a été vérifiée avec succès. Vous pouvez maintenant vous connecter.'))
    .catch((err) => showResult(false, err.message || 'Ce lien est invalide ou a déjà été utilisé.'));
}
