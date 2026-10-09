import api from '../core/api.js';

const token = new URLSearchParams(window.location.search).get('token');
const form = document.getElementById('reset-form');
const errorDiv = document.getElementById('reset-error');
const infoDiv = document.getElementById('reset-info');
const passwordInput = document.getElementById('password');
const btn = document.getElementById('reset-btn');
const btnText = document.getElementById('reset-btn-text');

if (!token) {
  errorDiv.textContent = 'Lien invalide ou incomplet. Veuillez refaire une demande de réinitialisation.';
  errorDiv.classList.remove('hidden');
  form.classList.add('hidden');
}

document.getElementById('toggle-password')?.addEventListener('click', () => {
  passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorDiv.classList.add('hidden');
  infoDiv.classList.add('hidden');

  const password = passwordInput.value;
  const confirm = document.getElementById('confirm').value;

  if (password.length < 8) {
    errorDiv.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
    errorDiv.classList.remove('hidden');
    return;
  }
  if (password !== confirm) {
    errorDiv.textContent = 'Les deux mots de passe ne correspondent pas.';
    errorDiv.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Enregistrement…';

  try {
    await api.post('/auth/reset-password', { token, password });
    form.classList.add('hidden');
    infoDiv.textContent = 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.';
    infoDiv.classList.remove('hidden');
    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
  } catch (err) {
    errorDiv.textContent = err.message || 'Une erreur est survenue.';
    errorDiv.classList.remove('hidden');
    btn.disabled = false;
    btnText.textContent = 'Réinitialiser';
  }
});
