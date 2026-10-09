import api from '../core/api.js';
import auth from '../core/auth.js';
import toast from '../components/toast.js';

if (auth.isAuthenticated()) window.location.href = '/pages/index.html';

const form = document.getElementById('register-form');
const errorDiv = document.getElementById('register-error');
const successDiv = document.getElementById('register-success');
const submitBtn = document.getElementById('register-btn');
const submitBtnText = document.getElementById('register-btn-text');
const passwordInput = document.getElementById('password');

// Toggle password
document.getElementById('toggle-password')?.addEventListener('click', () => {
  passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
});

// Indicateur de force du mot de passe
passwordInput.addEventListener('input', () => {
  const val = passwordInput.value;
  const bars = [
    document.getElementById('strength-1'),
    document.getElementById('strength-2'),
    document.getElementById('strength-3'),
    document.getElementById('strength-4'),
  ];
  const score = [val.length >= 8, /[A-Z]/.test(val), /[0-9]/.test(val), /[^a-zA-Z0-9]/.test(val)]
    .filter(Boolean).length;

  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  bars.forEach((bar, i) => {
    bar.className = 'h-1 rounded-full transition-colors duration-300';
    bar.classList.add(i < score ? colors[score - 1] : 'bg-slate-700');
  });
});

// Validation
const showError = (id, msg) => {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById(id.replace('-error', '')).classList.add('border-red-500/60');
};
const clearError = (id) => {
  document.getElementById(id).classList.add('hidden');
  document.getElementById(id.replace('-error', '')).classList.remove('border-red-500/60');
};

const validate = () => {
  let valid = true;
  const fields = ['firstName', 'lastName', 'email', 'password'];
  fields.forEach((f) => clearError(`${f}-error`));

  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (firstName.length < 2) { showError('firstName-error', 'Minimum 2 caractères.'); valid = false; }
  if (lastName.length < 2) { showError('lastName-error', 'Minimum 2 caractères.'); valid = false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('email-error', 'Email invalide.'); valid = false; }
  if (password.length < 8) { showError('password-error', 'Minimum 8 caractères.'); valid = false; }

  return valid;
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorDiv.classList.add('hidden');
  if (!validate()) return;

  submitBtn.disabled = true;
  submitBtnText.textContent = 'Création en cours…';

  try {
    const res = await api.post('/auth/register', {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim().toLowerCase(),
      password: document.getElementById('password').value,
      preferredLanguage: document.getElementById('language').value,
    });

    form.classList.add('hidden');
    const successText = document.getElementById('register-success-text');
    if (successText) {
      successText.textContent = res.data?.emailVerificationRequired
        ? 'Un email de vérification a été envoyé à votre adresse. Vérifiez vos emails (et vos spams) pour activer votre compte.'
        : 'Votre compte est activé. Vous pouvez maintenant vous connecter avec vos identifiants.';
    }
    successDiv.classList.remove('hidden');

  } catch (err) {
    errorDiv.textContent = err.message || 'Une erreur est survenue.';
    errorDiv.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtnText.textContent = 'Créer mon compte';
  }
});
