import api from '../core/api.js';
import auth from '../core/auth.js';
import toast from '../components/toast.js';

if (!auth.isAuthenticated()) {
  window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  await auth.ready();
  setupNavbar();
  loadProfile();
  setupForm();
});

function setupNavbar() {
  const user = auth.getUser();
  if (user) {
    document.getElementById('user-name').textContent = user.firstName;
    document.getElementById('user-avatar').textContent = (user.firstName[0] + user.lastName[0]).toUpperCase();

    if (auth.isStaff()) {
      document.getElementById('nav-admin-link').classList.remove('hidden');
    }

    const menuBtn = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');
    menuBtn.addEventListener('click', () => dropdown.classList.toggle('hidden'));
    document.addEventListener('click', (e) => {
      if (!menuBtn.contains(e.target)) dropdown.classList.add('hidden');
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      auth.logout();
    });
  }
}

async function loadProfile() {
  try {
    const res = await api.get('/users/me');
    const u = res.data;

    document.getElementById('profile-firstname').value = u.firstName || '';
    document.getElementById('profile-lastname').value = u.lastName || '';
    document.getElementById('profile-email').value = u.email || '';
    document.getElementById('profile-phone').value = u.phone || '';
    document.getElementById('profile-language').value = u.preferredLanguage || 'FR';

    const roleMap = { ADMIN: 'Administrateur', LIBRARIAN: 'Bibliothécaire', MEMBER: 'Prêtre / Membre' };
    document.getElementById('profile-role').value = roleMap[u.role] || u.role;
  } catch (err) {
    console.error(err);
    toast.error('Erreur chargement profil.');
  }
}

function setupForm() {
  const form = document.getElementById('profile-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const payload = {
      firstName: formData.get('firstName').trim(),
      lastName: formData.get('lastName').trim(),
      phone: (formData.get('phone') || '').trim(),
      preferredLanguage: formData.get('preferredLanguage'),
    };

    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');

    if (newPassword) {
      if (!currentPassword) {
        toast.error('Veuillez saisir votre mot de passe actuel pour le changer.');
        return;
      }
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      const btn = document.getElementById('save-profile-btn');
      btn.disabled = true;
      btn.textContent = 'Enregistrement…';

      const res = await api.put('/users/me', payload);
      const updatedUser = res.data;

      // Mettre à jour le profil en mémoire (aucune donnée sensible persistée)
      auth.updateUser(updatedUser);

      toast.success('Profil mis à jour avec succès.');
      setupNavbar();
      form.querySelector('input[name="currentPassword"]').value = '';
      form.querySelector('input[name="newPassword"]').value = '';
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      const btn = document.getElementById('save-profile-btn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Enregistrer les modifications';
      }
    }
  };
}
