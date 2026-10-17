import api from '../core/api.js';
import auth from '../core/auth.js';
import toast from '../components/toast.js';

// Redirection si non connecté
if (!auth.isAuthenticated()) {
  window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  await auth.ready();
  setupNavbar();
  checkUrlPrefill();
  loadMyRequests();
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

// Pré-remplissage éventuel depuis l'URL (?title=...&author=...)
function checkUrlPrefill() {
  const params = new URLSearchParams(window.location.search);
  const title = params.get('title');
  const author = params.get('author');
  if (title) {
    const titleInput = document.getElementById('req-title');
    if (titleInput) titleInput.value = title;
  }
  if (author) {
    const authorInput = document.querySelector('input[name="author"]');
    if (authorInput) authorInput.value = author;
  }
}

async function loadMyRequests() {
  const container = document.getElementById('my-requests-list');
  try {
    const res = await api.get('/requests/my');
    const requests = res.data || [];

    if (requests.length === 0) {
      container.innerHTML = `
        <div class="card py-10 text-center">
          <svg class="w-10 h-10 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p class="text-sm font-medium text-slate-400">Vous n'avez pas encore signalé de document manquant.</p>
          <p class="text-xs text-slate-500 mt-1">Utilisez le formulaire ci-dessus si vous recherchez un ouvrage particulier.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = requests.map((req) => {
      let statusBadge = '<span class="badge text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">En cours d’examen</span>';
      if (req.status === 'IN_PROGRESS') statusBadge = '<span class="badge text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">En cours (commande)</span>';
      else if (req.status === 'ACQUIRED') statusBadge = '<span class="badge text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">✓ Disponible à la bibliothèque</span>';
      else if (req.status === 'CLOSED') statusBadge = '<span class="badge text-xs bg-red-500/20 text-red-300 border-red-500/30">Non retenu</span>';

      return `
        <div class="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-serif font-semibold text-white text-base">${escapeHtml(req.title)}</h3>
              ${statusBadge}
            </div>
            ${req.author ? `<p class="text-xs text-slate-400">Auteur : <span class="text-slate-300 font-medium">${escapeHtml(req.author)}</span></p>` : ''}
            ${req.description ? `<p class="text-xs text-slate-500 italic mt-1">"${escapeHtml(req.description)}"</p>` : ''}
            ${req.adminNotes ? `
              <div class="mt-2 p-2.5 rounded-lg bg-primary-950/40 border border-primary-500/20 text-xs text-primary-300">
                <strong>Réponse du bibliothécaire :</strong> ${escapeHtml(req.adminNotes)}
              </div>
            ` : ''}
          </div>
          <div class="text-xs text-slate-500 shrink-0 sm:text-right">
            Signalé le ${new Date(req.createdAt).toLocaleDateString('fr-FR')}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="card py-6 text-center text-red-400 text-sm">Erreur lors de la récupération de vos demandes.</div>`;
  }
}

function setupForm() {
  const form = document.getElementById('request-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const title = formData.get('title').trim();
    const author = formData.get('author')?.trim() || null;
    let notes = formData.get('notes')?.trim() || '';
    const secondary = formData.get('notesSecondary')?.trim() || '';

    if (secondary) {
      notes = notes ? `${notes} (Édition/ISBN : ${secondary})` : `Édition/ISBN : ${secondary}`;
    }

    try {
      const btn = document.getElementById('submit-request-btn');
      btn.disabled = true;
      btn.textContent = 'Envoi…';

      await api.post('/requests', {
        title,
        author,
        description: notes || null,
      });

      toast.success('Votre signalement a été transmis au bibliothécaire !');
      form.reset();
      loadMyRequests();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de l’envoi.');
    } finally {
      const btn = document.getElementById('submit-request-btn');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg> Envoyer le signalement`;
      }
    }
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
