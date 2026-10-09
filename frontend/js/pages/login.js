import api from '../core/api.js';
import auth from '../core/auth.js';
import toast from '../components/toast.js';

// Rediriger si déjà connecté
if (auth.isAuthenticated()) {
  window.location.href = '/pages/index.html';
}

// Vérifier message de succès dans l'URL
const params = new URLSearchParams(window.location.search);
if (params.get('verified') === 'true') {
  document.getElementById('login-info').classList.remove('hidden');
  document.getElementById('login-info').textContent = '✅ Email vérifié ! Vous pouvez maintenant vous connecter.';
}

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorDiv = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const loginBtnText = document.getElementById('login-btn-text');

// Toggle mot de passe
document.getElementById('toggle-password')?.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
});

// Validation inline
const validate = () => {
  let valid = true;

  const emailErr = document.getElementById('email-error');
  if (!emailInput.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
    emailErr.textContent = 'Adresse email invalide.';
    emailErr.classList.remove('hidden');
    emailInput.classList.add('border-red-500/60');
    valid = false;
  } else {
    emailErr.classList.add('hidden');
    emailInput.classList.remove('border-red-500/60');
  }

  const pwErr = document.getElementById('password-error');
  if (!passwordInput.value) {
    pwErr.textContent = 'Mot de passe requis.';
    pwErr.classList.remove('hidden');
    passwordInput.classList.add('border-red-500/60');
    valid = false;
  } else {
    pwErr.classList.add('hidden');
    passwordInput.classList.remove('border-red-500/60');
  }

  return valid;
};

// Soumission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorDiv.classList.add('hidden');
  if (!validate()) return;

  loginBtn.disabled = true;
  loginBtnText.textContent = 'Connexion en cours…';

  try {
    const res = await api.post('/auth/login', {
      email: emailInput.value.trim().toLowerCase(),
      password: passwordInput.value,
    });

    auth.saveSession(res.data);
    toast.success(`Bienvenue, ${res.data.user.firstName} !`);

    const redirect = params.get('redirect');
    setTimeout(() => {
      window.location.href = redirect
        ? decodeURIComponent(redirect)
        : (auth.isStaff() ? '/pages/admin/index.html' : '/pages/index.html');
    }, 500);

  } catch (err) {
    errorDiv.textContent = err.message || 'Email ou mot de passe incorrect.';
    errorDiv.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtnText.textContent = 'Se connecter';
    passwordInput.value = '';
    passwordInput.focus();
  }
});
