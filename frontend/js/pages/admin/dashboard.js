import api, { resolveAssetUrl, API_ORIGIN } from '../../core/api.js';
import auth from '../../core/auth.js';
import toast from '../../components/toast.js';
import { createModal, closeModal } from '../../components/modal.js';

// ─── Sécurité : réservé au personnel (LIBRARIAN ou ADMIN) ────────────────────
if (!auth.isAuthenticated() || !auth.isStaff()) {
  toast.error('Accès restreint aux administrateurs.');
  setTimeout(() => { window.location.href = '../login.html'; }, 1000);
}

// ─── État global de l'interface admin ─────────────────────────────────────────
const state = {
  activeSection: 'dashboard',
  books: { page: 1, limit: 10, search: '', available: '', totalPages: 1 },
  loans: { page: 1, limit: 10, status: '', search: '', totalPages: 1 },
  requests: { page: 1, limit: 10, status: '', totalPages: 1 },
  users: { page: 1, limit: 10, search: '', role: '', totalPages: 1 },
  audit: { page: 1, limit: 15, totalPages: 1 },
  categories: [],
};

// ─── Initialisation ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupUserHeader();
  setupNavigation();
  setupGlobalActions();
  await loadCategoriesCache();

  // Navigation initiale selon hash (#books, #loans, etc.)
  const hash = window.location.hash.replace('#', '');
  if (['dashboard', 'books', 'categories', 'loans', 'requests', 'users', 'audit'].includes(hash)) {
    switchSection(hash);
  } else {
    switchSection('dashboard');
  }
});

function setupUserHeader() {
  const user = auth.getUser();
  if (user) {
    const avatarEl = document.getElementById('sidebar-avatar');
    const nameEl = document.getElementById('sidebar-name');
    const roleEl = document.getElementById('sidebar-role');
    if (avatarEl) avatarEl.textContent = (user.firstName[0] + user.lastName[0]).toUpperCase();
    if (nameEl) nameEl.textContent = `${user.firstName} ${user.lastName}`;
    if (roleEl) roleEl.textContent = user.role === 'ADMIN' ? 'Administrateur' : 'Bibliothécaire';
  }

  // Déconnexion
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const rt = localStorage.getItem('refresh_token');
      if (rt) await api.post('/auth/logout', { refreshToken: rt }).catch(() => {});
      auth.clearSession();
      window.location.href = '../login.html';
    });
  }
}

// ─── Navigation latérale ───────────────────────────────────────────────────────
function setupNavigation() {
  const navButtons = document.querySelectorAll('.sidebar-item[data-section]');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      switchSection(section);
      window.location.hash = section;
    });
  });

  window.addEventListener('hashchange', () => {
    const section = window.location.hash.replace('#', '');
    if (section && section !== state.activeSection) switchSection(section);
  });
}

function switchSection(sectionId) {
  state.activeSection = sectionId;

  // Masquer toutes les sections
  document.querySelectorAll('main section').forEach((sec) => sec.classList.add('hidden'));

  // Activer le bouton de sidebar
  document.querySelectorAll('.sidebar-item[data-section]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === sectionId);
    if (btn.dataset.section === sectionId) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  // Afficher la section demandée
  const targetSec = document.getElementById(`section-${sectionId}`);
  if (targetSec) targetSec.classList.remove('hidden');

  // Mettre à jour le titre et l'action principale du header
  updateHeader(sectionId);

  // Charger les données de la section
  switch (sectionId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'books':
      loadBooks();
      break;
    case 'categories':
      loadCategories();
      break;
    case 'loans':
      loadLoans();
      break;
    case 'requests':
      loadRequests();
      break;
    case 'users':
      loadUsers();
      break;
    case 'audit':
      loadAuditLogs();
      break;
  }
}

function updateHeader(sectionId) {
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const actionBtn = document.getElementById('main-action-btn');
  const actionText = document.getElementById('main-action-text');

  actionBtn.classList.add('hidden');
  actionBtn.onclick = null;

  switch (sectionId) {
    case 'dashboard':
      pageTitle.textContent = 'Tableau de bord';
      pageSubtitle.textContent = "Vue d'ensemble de la bibliothèque et statistiques d'utilisation";
      break;
    case 'books':
      pageTitle.textContent = 'Gestion des Ouvrages';
      pageSubtitle.textContent = 'Ajout, modification, catalogage et inventaire des livres';
      actionBtn.classList.remove('hidden');
      actionText.textContent = 'Ajouter un livre';
      actionBtn.onclick = openAddBookModal;
      break;
    case 'categories':
      pageTitle.textContent = 'Catégories & Thématiques';
      pageSubtitle.textContent = 'Organisation thématique et classification théologique';
      actionBtn.classList.remove('hidden');
      actionText.textContent = 'Nouvelle catégorie';
      actionBtn.onclick = openAddCategoryModal;
      break;
    case 'loans':
      pageTitle.textContent = 'Gestion des Emprunts';
      pageSubtitle.textContent = 'Suivi des prêts en cours, retards, prolongations et retours';
      actionBtn.classList.remove('hidden');
      actionText.textContent = 'Enregistrer un prêt';
      actionBtn.onclick = openAddLoanModal;
      break;
    case 'requests':
      pageTitle.textContent = 'Livres Signalés & Souhaits';
      pageSubtitle.textContent = 'Livres recherchés mais indisponibles signalés par la communauté';
      break;
    case 'users':
      pageTitle.textContent = 'Membres de la Congrégation';
      pageSubtitle.textContent = 'Gestion des utilisateurs, des accès et des rôles';
      break;
    case 'audit':
      pageTitle.textContent = "Journal d'audit";
      pageSubtitle.textContent = 'Traçabilité complète des actions administratives';
      break;
  }
}

// ─── Actions globales ─────────────────────────────────────────────────────────
function setupGlobalActions() {
  // Export inventaire PDF
  const exportBtn = document.getElementById('export-inventory-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        toast.info('Génération de l’inventaire PDF en cours…');
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_ORIGIN}/api/exports/inventory`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Échec du téléchargement');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventaire_bibliotheque_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success('Inventaire téléchargé avec succès.');
      } catch (err) {
        toast.error('Erreur lors du téléchargement de l’inventaire PDF.');
      }
    });
  }

  // Bouton nouvel emprunt
  const newLoanBtn = document.getElementById('new-loan-btn');
  if (newLoanBtn) newLoanBtn.addEventListener('click', openAddLoanModal);

  // Filtres livres
  const booksSearch = document.getElementById('books-search');
  if (booksSearch) {
    let timer;
    booksSearch.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.books.search = e.target.value.trim();
        state.books.page = 1;
        loadBooks();
      }, 300);
    });
  }

  const booksFilterAvail = document.getElementById('books-filter-available');
  if (booksFilterAvail) {
    booksFilterAvail.addEventListener('change', (e) => {
      state.books.available = e.target.value;
      state.books.page = 1;
      loadBooks();
    });
  }

  // Filtres emprunts
  const loansFilterStatus = document.getElementById('loans-filter-status');
  if (loansFilterStatus) {
    loansFilterStatus.addEventListener('change', (e) => {
      state.loans.status = e.target.value;
      state.loans.page = 1;
      loadLoans();
    });
  }

  const loansSearchUser = document.getElementById('loans-search-user');
  if (loansSearchUser) {
    let timer;
    loansSearchUser.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.loans.search = e.target.value.trim();
        state.loans.page = 1;
        loadLoans();
      }, 350);
    });
  }

  // Filtres membres
  const usersSearch = document.getElementById('users-search');
  if (usersSearch) {
    let timer;
    usersSearch.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.users.search = e.target.value.trim();
        state.users.page = 1;
        loadUsers();
      }, 350);
    });
  }

  const usersFilterRole = document.getElementById('users-filter-role');
  if (usersFilterRole) {
    usersFilterRole.addEventListener('change', (e) => {
      state.users.role = e.target.value;
      state.users.page = 1;
      loadUsers();
    });
  }
}

// ─── Cache catégories ─────────────────────────────────────────────────────────
async function loadCategoriesCache() {
  try {
    const res = await api.get('/categories');
    state.categories = res.data || [];
  } catch (err) {
    console.error('Erreur chargement catégories:', err);
  }
}

// ─── SECTION 1 : TABLEAU DE BORD ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await api.get('/users/admin/stats');
    const data = res.data;

    document.getElementById('stat-total-books').textContent = data.totalBooks ?? '0';
    document.getElementById('stat-active-loans').textContent = data.activeLoans ?? '0';
    document.getElementById('stat-overdue').textContent = data.overdueLoans ?? '0';
    document.getElementById('stat-users').textContent = data.totalUsers ?? '0';

    // Badge retards dans la sidebar
    const overdueBadge = document.getElementById('overdue-badge');
    if (overdueBadge) {
      if (data.overdueLoans > 0) {
        overdueBadge.textContent = `${data.overdueLoans}`;
        overdueBadge.classList.remove('hidden');
      } else {
        overdueBadge.classList.add('hidden');
      }
    }

    // Badge livres signalés
    const requestsBadge = document.getElementById('requests-badge');
    if (requestsBadge) {
      if (data.openRequests > 0) {
        requestsBadge.textContent = `${data.openRequests}`;
        requestsBadge.classList.remove('hidden');
      } else {
        requestsBadge.classList.add('hidden');
      }
    }

    // Livres les plus empruntés
    const mostBorrowedContainer = document.getElementById('most-borrowed');
    if (data.mostBorrowedBooks && data.mostBorrowedBooks.length > 0) {
      mostBorrowedContainer.innerHTML = data.mostBorrowedBooks.map((b) => `
        <div class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition">
          <div class="w-10 h-14 rounded-lg bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
            ${b.coverUrl ? `<img src="${resolveAssetUrl(b.coverUrl)}" alt="" class="w-full h-full object-cover">` : `<svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13"/></svg>`}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-white truncate">${escapeHtml(b.title)}</p>
            <p class="text-xs text-slate-400 truncate">${escapeHtml(b.author)}</p>
          </div>
          <span class="badge badge-primary text-xs px-2 py-0.5">${b._count?.loans || 0} prêts</span>
        </div>
      `).join('');
    } else {
      mostBorrowedContainer.innerHTML = `<p class="text-sm text-slate-500 py-4 text-center">Aucun emprunt enregistré pour le moment.</p>`;
    }

    // Activité récente
    const recentLoansContainer = document.getElementById('recent-loans');
    if (data.recentLoans && data.recentLoans.length > 0) {
      recentLoansContainer.innerHTML = data.recentLoans.map((l) => `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div class="min-w-0 pr-3">
            <p class="text-sm font-medium text-white truncate">${escapeHtml(l.book?.title || 'Livre')}</p>
            <p class="text-xs text-slate-400">Emprunté par <span class="text-slate-300 font-medium">${escapeHtml(l.user?.firstName + ' ' + l.user?.lastName)}</span></p>
          </div>
          <span class="text-xs text-slate-500 shrink-0">${formatDate(l.borrowedAt)}</span>
        </div>
      `).join('');
    } else {
      recentLoansContainer.innerHTML = `<p class="text-sm text-slate-500 py-4 text-center">Aucune activité récente.</p>`;
    }

  } catch (err) {
    console.error('Erreur chargement dashboard:', err);
    toast.error('Impossible de charger les statistiques du tableau de bord.');
  }
}

// ─── SECTION 2 : LIVRES ───────────────────────────────────────────────────────
async function loadBooks() {
  const tbody = document.getElementById('books-tbody');
  tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500"><div class="inline-block animate-spin mr-2">⟳</div> Chargement du catalogue…</td></tr>`;

  try {
    const params = new URLSearchParams({
      page: state.books.page,
      limit: state.books.limit,
      sort: 'updatedAt',
      order: 'desc'
    });
    if (state.books.search) params.append('search', state.books.search);
    if (state.books.available) params.append('available', state.books.available);

    const res = await api.get(`/books?${params.toString()}`);
    const books = res.data;
    const meta = res.meta;
    state.books.totalPages = meta.totalPages || 1;

    if (!books || books.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-slate-500">Aucun livre trouvé correspondant aux critères.</td></tr>`;
      renderPagination('books-pagination', meta, (p) => { state.books.page = p; loadBooks(); });
      return;
    }

    tbody.innerHTML = books.map((book) => {
      const isAvailable = book.availableCopies > 0;
      const categoriesHtml = (book.categories || []).map((c) => {
        const cat = c.category;
        return `<span class="badge text-xs" style="background-color: ${cat.color}20; color: ${cat.color}; border: 1px solid ${cat.color}40;">${escapeHtml(cat.nameFr)}</span>`;
      }).join(' ');

      return `
        <tr class="hover:bg-slate-800/30 transition">
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-14 rounded-lg bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-700/50">
                ${book.coverUrl ? `<img src="${resolveAssetUrl(book.coverUrl)}" alt="" class="w-full h-full object-cover">` : `<svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13"/></svg>`}
              </div>
              <div class="min-w-0 max-w-xs md:max-w-md">
                <p class="font-medium text-white truncate text-sm" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</p>
                <p class="text-xs text-slate-400 truncate">${escapeHtml(book.author)} ${book.year ? `(${book.year})` : ''}</p>
                ${book.location ? `<p class="text-[11px] text-slate-500 mt-0.5">📍 ${escapeHtml(book.location)}</p>` : ''}
              </div>
            </div>
          </td>
          <td class="px-4 py-3 hidden md:table-cell">
            <div class="flex flex-wrap gap-1">${categoriesHtml || '<span class="text-xs text-slate-600">—</span>'}</div>
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <span class="text-sm font-medium ${isAvailable ? 'text-emerald-400' : 'text-amber-400'}">${book.availableCopies}</span>
            <span class="text-xs text-slate-500"> / ${book.totalCopies}</span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <span class="badge ${isAvailable ? 'badge-available' : 'badge-borrowed'} text-xs">
              ${isAvailable ? 'Disponible' : 'Emprunté'}
            </span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-right space-x-1">
            <button class="btn btn-secondary btn-sm p-1.5 edit-book-btn" data-id="${book.id}" title="Modifier">
              <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="btn btn-secondary btn-sm p-1.5 delete-book-btn text-red-400 hover:text-red-300" data-id="${book.id}" data-title="${escapeHtml(book.title)}" title="Supprimer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attacher événements d'édition / suppression
    tbody.querySelectorAll('.edit-book-btn').forEach((b) => {
      b.addEventListener('click', () => openEditBookModal(b.dataset.id));
    });
    tbody.querySelectorAll('.delete-book-btn').forEach((b) => {
      b.addEventListener('click', () => confirmDeleteBook(b.dataset.id, b.dataset.title));
    });

    renderPagination('books-pagination', meta, (p) => {
      state.books.page = p;
      loadBooks();
    });

  } catch (err) {
    console.error('Erreur chargement livres:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-red-400">Erreur de chargement des livres.</td></tr>`;
  }
}

// ─── MODAL : AJOUTER UN LIVRE (AVEC AUTO-COMPLÉTION ISBN MAGIQUE) ─────────────
function openAddBookModal() {
  const categoriesCheckboxes = state.categories.map((c) => `
    <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:border-slate-700 cursor-pointer">
      <input type="checkbox" name="categories" value="${c.id}" class="rounded text-primary-600 focus:ring-0">
      <span class="truncate">${escapeHtml(c.nameFr)}</span>
    </label>
  `).join('');

  const content = `
    <form id="add-book-form" class="space-y-4">
      <!-- Recherche rapide par ISBN pour simplifier la saisie -->
      <div class="p-3.5 rounded-xl bg-gradient-to-r from-primary-950/70 to-slate-900 border border-primary-500/40">
        <label class="block text-xs font-semibold text-primary-300 mb-1.5">⚡ Remplissage automatique par ISBN (Open Library & Google Books)</label>
        <div class="flex gap-2">
          <input type="text" id="isbn-lookup-input" class="form-input text-xs py-1.5 rounded-lg flex-1" placeholder="Ex: 9782204085441 (La Bible, Théologie, Saint Thomas…)" />
          <button type="button" id="isbn-lookup-btn" class="btn btn-primary btn-sm text-xs shrink-0 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Rechercher
          </button>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">Saisissez l'ISBN pour remplir instantanément le titre, l'auteur, l'éditeur, l'année, le résumé et la couverture.</p>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2">
          <label class="block text-xs font-medium text-slate-300 mb-1">Titre de l'ouvrage *</label>
          <input type="text" name="title" required class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Somme Théologique" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Auteur *</label>
          <input type="text" name="author" required class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Saint Thomas d'Aquin" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Maison d'édition</label>
          <input type="text" name="publishingHouse" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Éditions du Cerf" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Éditeur scientifique / Traducteur</label>
          <input type="text" name="publisher" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Abbé Drioux" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">ISBN</label>
          <input type="text" name="isbn" class="form-input text-sm py-2 rounded-xl w-full" placeholder="978-…" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Année d'édition</label>
          <input type="number" name="year" min="1000" max="2100" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: 2012" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Nombre de pages</label>
          <input type="number" name="pageCount" min="1" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: 452" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Nombre d'exemplaires *</label>
          <input type="number" name="totalCopies" min="1" max="100" value="1" required class="form-input text-sm py-2 rounded-xl w-full" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Emplacement / Cote</label>
          <input type="text" name="location" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Rayon B3, Étagère 2" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Langue</label>
          <select name="language" class="form-select text-sm py-2 rounded-xl w-full">
            <option value="FR">Français (FR)</option>
            <option value="LA">Latin (LA)</option>
            <option value="EN">Anglais (EN)</option>
            <option value="ES">Espagnol (ES)</option>
            <option value="IT">Italien (IT)</option>
            <option value="DE">Allemand (DE)</option>
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="block text-xs font-medium text-slate-300 mb-1">Couverture</label>
          <div class="flex items-start gap-3">
            <img id="cover-preview" class="hidden w-20 h-28 object-cover rounded-lg border border-slate-800 bg-slate-900 shrink-0" alt="Aperçu couverture" />
            <div class="flex-1 space-y-2">
              <input type="text" name="coverUrl" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Remplie automatiquement via l'ISBN, ou collez une URL d'image…" />
              <div class="flex flex-wrap items-center gap-2">
                <input type="file" id="cover-file-input" accept="image/*" class="hidden" />
                <button type="button" id="cover-upload-btn" class="btn btn-secondary btn-sm text-xs flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Téléverser une image
                </button>
                <button type="button" id="cover-clear-btn" class="btn btn-secondary btn-sm text-xs">Retirer</button>
              </div>
              <p class="text-[11px] text-slate-400">Si aucune couverture n'est trouvée automatiquement, ajoutez-la ici (JPEG, PNG, WEBP ou GIF — 5 Mo max).</p>
            </div>
          </div>
        </div>

        <div class="sm:col-span-2">
          <label class="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
            <span>Résumé / Description de l'ouvrage</span>
            <button type="button" id="ai-summary-btn" class="btn btn-secondary btn-sm text-xs flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              Résumé IA (gratuit)
            </button>
          </label>
          <textarea name="summary" rows="3" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Bref résumé permettant aux prêtres et étudiants de cerner le sujet du livre…"></textarea>
        </div>

        <div class="sm:col-span-2">
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Catégories & Thématiques</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-950/50 rounded-xl border border-slate-800">
            ${categoriesCheckboxes}
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
        <button type="button" class="btn btn-secondary btn-sm" id="cancel-add-book">Annuler</button>
        <button type="submit" class="btn btn-primary btn-sm flex items-center gap-2" id="submit-add-book">
          Enregistrer le livre
        </button>
      </div>
    </form>
  `;

  createModal({
    title: 'Ajouter un nouveau livre',
    content,
    size: 'lg'
  });

  document.getElementById('cancel-add-book').onclick = closeModal;

  // Handler auto-remplissage ISBN (via le serveur : Google Books + Open Library)
  const lookupBtn = document.getElementById('isbn-lookup-btn');
  const lookupInput = document.getElementById('isbn-lookup-input');
  lookupBtn.onclick = () => performIsbnLookup(lookupInput.value.trim());
  lookupInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); performIsbnLookup(lookupInput.value.trim()); } });

  // Form submit
  const form = document.getElementById('add-book-form');

  // Prévisualisation de la couverture dès que le champ change
  const coverInput = form?.querySelector('input[name="coverUrl"]');
  coverInput?.addEventListener('input', updateCoverPreview);
  updateCoverPreview();

  // Téléversement manuel d'une image de couverture
  setupCoverUpload({
    form,
    fileInputId: 'cover-file-input',
    uploadBtnId: 'cover-upload-btn',
    clearBtnId: 'cover-clear-btn',
    previewId: 'cover-preview',
  });

  // Résumé automatique via IA
  document.getElementById('ai-summary-btn')?.addEventListener('click', generateAiSummary);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const checkedCats = Array.from(form.querySelectorAll('input[name="categories"]:checked')).map((c) => c.value);

    const payload = {
      title: formData.get('title').trim(),
      author: formData.get('author').trim(),
      publishingHouse: formData.get('publishingHouse')?.trim() || null,
      publisher: formData.get('publisher')?.trim() || null,
      isbn: formData.get('isbn')?.trim() || null,
      year: formData.get('year') ? parseInt(formData.get('year'), 10) : null,
      pageCount: formData.get('pageCount') ? parseInt(formData.get('pageCount'), 10) : null,
      totalCopies: parseInt(formData.get('totalCopies'), 10) || 1,
      location: formData.get('location')?.trim() || null,
      language: formData.get('language') || 'FR',
      coverUrl: formData.get('coverUrl')?.trim() || null,
      summary: formData.get('summary')?.trim() || null,
      categoryIds: checkedCats,
    };

    try {
      const submitBtn = document.getElementById('submit-add-book');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enregistrement…';

      await api.post('/books', payload);
      toast.success('Livre ajouté au catalogue avec succès !');
      closeModal();
      loadBooks();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'ajout du livre.");
      const submitBtn = document.getElementById('submit-add-book');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer le livre';
      }
    }
  };
}

// Aperçu de la couverture dans le formulaire d'ajout
function updateCoverPreview() {
  const value = document.getElementById('add-book-form')?.querySelector('input[name="coverUrl"]')?.value?.trim();
  setCoverPreview('cover-preview', value);
}

// Affiche/actualise l'aperçu d'une couverture dans un formulaire donné
function setCoverPreview(previewId, value) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  const v = (value || '').trim();
  if (v) {
    preview.src = resolveAssetUrl(v);
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
    preview.removeAttribute('src');
  }
}

// Branche le bouton « Téléverser une image » d'un formulaire de livre.
// L'image est envoyée au serveur (data-URL) qui la stocke dans /uploads/covers
// puis renvoie un chemin local. Aucune dépendance externe nécessaire.
function setupCoverUpload({ form, fileInputId, uploadBtnId, clearBtnId, previewId }) {
  const fileInput = document.getElementById(fileInputId);
  const uploadBtn = document.getElementById(uploadBtnId);
  const clearBtn = document.getElementById(clearBtnId);
  const input = form?.querySelector('input[name="coverUrl"]');
  if (!fileInput || !uploadBtn || !input) return;

  uploadBtn.addEventListener('click', () => fileInput.click());

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    setCoverPreview(previewId, '');
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPEG, PNG, WEBP ou GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop lourde (5 Mo maximum).');
      return;
    }

    const original = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<span class="animate-spin inline-block mr-1">⟳</span> Envoi…`;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post('/books/cover', { dataUrl });
      input.value = res.data.coverUrl;
      setCoverPreview(previewId, res.data.coverUrl);
      toast.success('Couverture téléversée avec succès.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Échec du téléversement de la couverture.');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = original;
    }
  });
}

// Helper auto-lookup ISBN — côté serveur (Google Books + Open Library),
// évite le blocage CORS/CSP du navigateur et télécharge la couverture en local.
async function performIsbnLookup(rawIsbn) {
  if (!rawIsbn) {
    toast.error('Veuillez entrer un numéro ISBN.');
    return;
  }
  const cleanIsbn = rawIsbn.replace(/[-\s]/g, '');
  const btn = document.getElementById('isbn-lookup-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin inline-block mr-1">⟳</span> Recherche…`;

  try {
    const res = await api.get(`/books/lookup?isbn=${encodeURIComponent(cleanIsbn)}`);
    const d = res.data;
    const form = document.getElementById('add-book-form');
    if (!form) return;

    if (d.title) form.querySelector('input[name="title"]').value = d.title;
    if (d.author) form.querySelector('input[name="author"]').value = d.author;
    if (d.publishingHouse) form.querySelector('input[name="publishingHouse"]').value = d.publishingHouse;
    if (d.year) form.querySelector('input[name="year"]').value = d.year;
    if (d.pageCount) form.querySelector('input[name="pageCount"]').value = d.pageCount;
    if (d.language) form.querySelector('select[name="language"]').value = d.language;
    form.querySelector('input[name="isbn"]').value = d.isbn;
    if (d.summary) form.querySelector('textarea[name="summary"]').value = d.summary;
    if (d.coverUrl) {
      form.querySelector('input[name="coverUrl"]').value = d.coverUrl;
      updateCoverPreview();
      toast.success('Ouvrage identifié : champs remplis automatiquement (photo comprise).');
    } else {
      toast.warning('Ouvrage identifié, mais aucune photo de couverture trouvée dans les bases gratuites. Vous pouvez coller une URL d\'image manuellement.');
    }
  } catch (err) {
    console.error(err);
    toast.error(err.message || 'ISBN non répertorié dans les bases en ligne.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Résumé automatique via IA gratuite (Google Gemini)
async function generateAiSummary() {
  const form = document.getElementById('add-book-form');
  if (!form) return;
  const title = form.querySelector('input[name="title"]')?.value?.trim();
  if (!title) {
    toast.error('Renseignez d\'abord le titre du livre.');
    return;
  }
  const btn = document.getElementById('ai-summary-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin inline-block mr-1">⟳</span> Génération…`;

  try {
    const formData = new FormData(form);
    const res = await api.post('/books/ai-summary', {
      title,
      author: formData.get('author')?.trim() || null,
      year: formData.get('year') ? parseInt(formData.get('year'), 10) : null,
      summary: formData.get('summary')?.trim() || null,
    });
    form.querySelector('textarea[name="summary"]').value = res.data.summary;
    toast.success('Résumé généré par l\'IA.');
  } catch (err) {
    console.error(err);
    toast.error(err.message || 'Impossible de générer le résumé.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// ─── MODAL : MODIFIER UN LIVRE ────────────────────────────────────────────────
async function openEditBookModal(bookId) {
  try {
    const res = await api.get(`/books/${bookId}`);
    const book = res.data;

    const existingCatIds = (book.categories || []).map(c => c.category?.id || c.categoryId);

    const categoriesCheckboxes = state.categories.map((c) => `
      <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:border-slate-700 cursor-pointer">
        <input type="checkbox" name="categories" value="${c.id}" ${existingCatIds.includes(c.id) ? 'checked' : ''} class="rounded text-primary-600 focus:ring-0">
        <span class="truncate">${escapeHtml(c.nameFr)}</span>
      </label>
    `).join('');

    const content = `
      <form id="edit-book-form" class="space-y-4">
        <div class="grid sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="block text-xs font-medium text-slate-300 mb-1">Titre de l'ouvrage *</label>
            <input type="text" name="title" required value="${escapeHtml(book.title)}" class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Auteur *</label>
            <input type="text" name="author" required value="${escapeHtml(book.author)}" class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Maison d'édition</label>
            <input type="text" name="publishingHouse" value="${escapeHtml(book.publishingHouse || '')}" class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Éditeur / Traducteur</label>
            <input type="text" name="publisher" value="${escapeHtml(book.publisher || '')}" class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">ISBN</label>
            <input type="text" name="isbn" value="${escapeHtml(book.isbn || '')}" class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Année</label>
            <input type="number" name="year" value="${book.year || ''}" class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Nombre de pages</label>
            <input type="number" name="pageCount" min="1" value="${book.pageCount || ''}" class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Nombre d'exemplaires total *</label>
            <input type="number" name="totalCopies" min="1" value="${book.totalCopies}" required class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Emplacement / Cote</label>
            <input type="text" name="location" value="${escapeHtml(book.location || '')}" class="form-input text-sm py-2 rounded-xl w-full" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Langue</label>
            <select name="language" class="form-select text-sm py-2 rounded-xl w-full">
              <option value="FR" ${book.language === 'FR' ? 'selected' : ''}>Français (FR)</option>
              <option value="LA" ${book.language === 'LA' ? 'selected' : ''}>Latin (LA)</option>
              <option value="EN" ${book.language === 'EN' ? 'selected' : ''}>Anglais (EN)</option>
              <option value="ES" ${book.language === 'ES' ? 'selected' : ''}>Espagnol (ES)</option>
              <option value="IT" ${book.language === 'IT' ? 'selected' : ''}>Italien (IT)</option>
              <option value="DE" ${book.language === 'DE' ? 'selected' : ''}>Allemand (DE)</option>
            </select>
          </div>

          <div class="sm:col-span-2">
            <label class="block text-xs font-medium text-slate-300 mb-1">Couverture</label>
            <div class="flex items-start gap-3">
              <img id="cover-preview-edit" class="${book.coverUrl ? '' : 'hidden'} w-20 h-28 object-cover rounded-lg border border-slate-800 bg-slate-900 shrink-0" src="${book.coverUrl ? resolveAssetUrl(book.coverUrl) : ''}" alt="Aperçu couverture" />
              <div class="flex-1 space-y-2">
                <input type="text" name="coverUrl" value="${escapeHtml(book.coverUrl || '')}" class="form-input text-sm py-2 rounded-xl w-full" placeholder="URL d'image ou couverture téléversée…" />
                <div class="flex flex-wrap items-center gap-2">
                  <input type="file" id="cover-file-input-edit" accept="image/*" class="hidden" />
                  <button type="button" id="cover-upload-btn-edit" class="btn btn-secondary btn-sm text-xs flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    Téléverser une image
                  </button>
                  <button type="button" id="cover-clear-btn-edit" class="btn btn-secondary btn-sm text-xs">Retirer</button>
                </div>
                <p class="text-[11px] text-slate-400">Remplacez la couverture manuellement (JPEG, PNG, WEBP ou GIF — 5 Mo max).</p>
              </div>
            </div>
          </div>

          <div class="sm:col-span-2">
            <label class="block text-xs font-medium text-slate-300 mb-1">Résumé / Description</label>
            <textarea name="summary" rows="3" class="form-input text-sm py-2 rounded-xl w-full">${escapeHtml(book.summary || '')}</textarea>
          </div>

          <div class="sm:col-span-2">
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Catégories & Thématiques</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-950/50 rounded-xl border border-slate-800">
              ${categoriesCheckboxes}
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" class="btn btn-secondary btn-sm" id="cancel-edit-book">Annuler</button>
          <button type="submit" class="btn btn-primary btn-sm flex items-center gap-2" id="submit-edit-book">
            Mettre à jour
          </button>
        </div>
      </form>
    `;

    createModal({
      title: `Modifier : ${book.title}`,
      content,
      size: 'lg'
    });

    document.getElementById('cancel-edit-book').onclick = closeModal;

    const form = document.getElementById('edit-book-form');

    setupCoverUpload({
      form,
      fileInputId: 'cover-file-input-edit',
      uploadBtnId: 'cover-upload-btn-edit',
      clearBtnId: 'cover-clear-btn-edit',
      previewId: 'cover-preview-edit',
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const checkedCats = Array.from(form.querySelectorAll('input[name="categories"]:checked')).map((c) => c.value);

      const payload = {
        title: formData.get('title').trim(),
        author: formData.get('author').trim(),
        publishingHouse: formData.get('publishingHouse')?.trim() || null,
        publisher: formData.get('publisher')?.trim() || null,
        isbn: formData.get('isbn')?.trim() || null,
        year: formData.get('year') ? parseInt(formData.get('year'), 10) : null,
        pageCount: formData.get('pageCount') ? parseInt(formData.get('pageCount'), 10) : null,
        totalCopies: parseInt(formData.get('totalCopies'), 10) || 1,
        location: formData.get('location')?.trim() || null,
        language: formData.get('language') || 'FR',
        coverUrl: formData.get('coverUrl')?.trim() || null,
        summary: formData.get('summary')?.trim() || null,
        categoryIds: checkedCats,
      };

      try {
        const btn = document.getElementById('submit-edit-book');
        btn.disabled = true;
        btn.textContent = 'Enregistrement…';

        await api.put(`/books/${bookId}`, payload);
        toast.success('Livre modifié avec succès.');
        closeModal();
        loadBooks();
      } catch (err) {
        console.error(err);
        toast.error(err.message || 'Erreur lors de la modification.');
        const btn = document.getElementById('submit-edit-book');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Mettre à jour';
        }
      }
    };

  } catch (err) {
    console.error(err);
    toast.error('Impossible de charger les données du livre.');
  }
}

// ─── SUPPRESSION LIVRE ────────────────────────────────────────────────────────
function confirmDeleteBook(bookId, bookTitle) {
  createModal({
    title: 'Confirmer la suppression',
    content: `
      <div class="space-y-4">
        <p class="text-sm text-slate-300">Êtes-vous certain de vouloir supprimer l'ouvrage suivant du catalogue ?</p>
        <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-white">
          ${escapeHtml(bookTitle)}
        </div>
        <p class="text-xs text-red-400">Le livre sera archivé et ne sera plus visible par les lecteurs.</p>
        <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" class="btn btn-secondary btn-sm" id="cancel-delete">Annuler</button>
          <button type="button" class="btn btn-danger btn-sm" id="confirm-delete-btn">Supprimer définitivement</button>
        </div>
      </div>
    `,
    size: 'sm'
  });

  document.getElementById('cancel-delete').onclick = closeModal;
  document.getElementById('confirm-delete-btn').onclick = async () => {
    try {
      await api.delete(`/books/${bookId}`);
      toast.success('Livre supprimé.');
      closeModal();
      loadBooks();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression.');
    }
  };
}

// ─── SECTION 3 : CATÉGORIES ───────────────────────────────────────────────────
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  grid.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500">Chargement des catégories…</div>`;

  try {
    const res = await api.get('/categories');
    state.categories = res.data || [];

    if (state.categories.length === 0) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500">Aucune catégorie définie.</div>`;
      return;
    }

    grid.innerHTML = state.categories.map((cat) => `
      <div class="card p-5 relative group flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style="background-color: ${cat.color}25; color: ${cat.color}; border: 1px solid ${cat.color}40;">
              <span class="w-2 h-2 rounded-full" style="background-color: ${cat.color};"></span>
              ${escapeHtml(cat.nameFr)}
            </span>
            <span class="text-xs text-slate-500 font-mono">${cat._count?.books || 0} livres</span>
          </div>
          <p class="text-xs text-slate-400 mt-2 line-clamp-2">${escapeHtml(cat.description || 'Thématique de la congrégation')}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <span class="text-[11px] text-slate-500 font-mono">${cat.slug}</span>
          <div class="flex items-center gap-1">
            <button class="btn btn-secondary btn-sm p-1 text-slate-400 hover:text-white edit-cat-btn" data-id="${cat.id}" title="Modifier">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="btn btn-secondary btn-sm p-1 text-red-400 hover:text-red-300 delete-cat-btn" data-id="${cat.id}" data-name="${escapeHtml(cat.nameFr)}" title="Supprimer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.edit-cat-btn').forEach((b) => {
      b.onclick = () => openEditCategoryModal(b.dataset.id);
    });
    grid.querySelectorAll('.delete-cat-btn').forEach((b) => {
      b.onclick = () => confirmDeleteCategory(b.dataset.id, b.dataset.name);
    });

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-red-400">Erreur lors du chargement des catégories.</div>`;
  }
}

function openAddCategoryModal() {
  const content = `
    <form id="add-cat-form" class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Nom (Français) *</label>
        <input type="text" name="nameFr" required class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Patristique & Pères de l'Église" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Nom (Anglais/Latin)</label>
        <input type="text" name="nameEn" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Patristics" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Couleur d'identification *</label>
        <div class="flex items-center gap-3">
          <input type="color" name="color" value="#4f46e5" class="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
          <span class="text-xs text-slate-400">Cliquez pour choisir la teinte thématique</span>
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Description</label>
        <textarea name="description" rows="2" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Brève note sur les types d'ouvrages regroupés…"></textarea>
      </div>
      <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
        <button type="button" class="btn btn-secondary btn-sm" id="cancel-cat">Annuler</button>
        <button type="submit" class="btn btn-primary btn-sm" id="submit-cat">Créer la catégorie</button>
      </div>
    </form>
  `;

  createModal({ title: 'Nouvelle Catégorie', content, size: 'sm' });
  document.getElementById('cancel-cat').onclick = closeModal;

  const form = document.getElementById('add-cat-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = {
      nameFr: formData.get('nameFr').trim(),
      nameEn: formData.get('nameEn')?.trim() || null,
      color: formData.get('color'),
      description: formData.get('description')?.trim() || null,
    };
    try {
      await api.post('/categories', payload);
      toast.success('Catégorie créée.');
      closeModal();
      await loadCategoriesCache();
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la création.');
    }
  };
}

async function openEditCategoryModal(catId) {
  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;

  const content = `
    <form id="edit-cat-form" class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Nom (Français) *</label>
        <input type="text" name="nameFr" required value="${escapeHtml(cat.nameFr)}" class="form-input text-sm py-2 rounded-xl w-full" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Nom (Anglais)</label>
        <input type="text" name="nameEn" value="${escapeHtml(cat.nameEn || '')}" class="form-input text-sm py-2 rounded-xl w-full" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Couleur *</label>
        <div class="flex items-center gap-3">
          <input type="color" name="color" value="${cat.color || '#4f46e5'}" class="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
          <span class="text-xs text-slate-400">Couleur d'accentuation</span>
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Description</label>
        <textarea name="description" rows="2" class="form-input text-sm py-2 rounded-xl w-full">${escapeHtml(cat.description || '')}</textarea>
      </div>
      <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
        <button type="button" class="btn btn-secondary btn-sm" id="cancel-edit-cat">Annuler</button>
        <button type="submit" class="btn btn-primary btn-sm" id="submit-edit-cat">Enregistrer</button>
      </div>
    </form>
  `;

  createModal({ title: `Modifier : ${cat.nameFr}`, content, size: 'sm' });
  document.getElementById('cancel-edit-cat').onclick = closeModal;

  const form = document.getElementById('edit-cat-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = {
      nameFr: formData.get('nameFr').trim(),
      nameEn: formData.get('nameEn')?.trim() || null,
      color: formData.get('color'),
      description: formData.get('description')?.trim() || null,
    };
    try {
      await api.put(`/categories/${catId}`, payload);
      toast.success('Catégorie mise à jour.');
      closeModal();
      await loadCategoriesCache();
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la mise à jour.');
    }
  };
}

function confirmDeleteCategory(catId, catName) {
  createModal({
    title: 'Supprimer la catégorie',
    content: `
      <div class="space-y-4">
        <p class="text-sm text-slate-300">Confirmez-vous la suppression de la catégorie <strong>${escapeHtml(catName)}</strong> ?</p>
        <p class="text-xs text-slate-500">Les livres qui y sont associés ne seront pas supprimés, mais ne feront plus partie de cette catégorie.</p>
        <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" class="btn btn-secondary btn-sm" id="cancel-del-cat">Annuler</button>
          <button type="button" class="btn btn-danger btn-sm" id="confirm-del-cat">Supprimer</button>
        </div>
      </div>
    `,
    size: 'sm'
  });
  document.getElementById('cancel-del-cat').onclick = closeModal;
  document.getElementById('confirm-del-cat').onclick = async () => {
    try {
      await api.delete(`/categories/${catId}`);
      toast.success('Catégorie supprimée.');
      closeModal();
      await loadCategoriesCache();
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression.');
    }
  };
}

// ─── SECTION 4 : EMPRUNTS (GESTION DES PRÊTS & RETOURS) ──────────────────────
async function loadLoans() {
  const tbody = document.getElementById('loans-tbody');
  tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Chargement des emprunts…</td></tr>`;

  try {
    const params = new URLSearchParams({
      page: state.loans.page,
      limit: state.loans.limit,
    });
    if (state.loans.status) params.append('status', state.loans.status);
    if (state.loans.search) params.append('search', state.loans.search);

    const res = await api.get(`/loans?${params.toString()}`);
    const loans = res.data;
    const meta = res.meta;
    state.loans.totalPages = meta.totalPages || 1;

    if (!loans || loans.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-12 text-center text-slate-500">Aucun emprunt trouvé.</td></tr>`;
      renderPagination('loans-pagination', meta, (p) => { state.loans.page = p; loadLoans(); });
      return;
    }

    tbody.innerHTML = loans.map((loan) => {
      const isOverdue = loan.status === 'OVERDUE' || (loan.status === 'ACTIVE' && new Date(loan.dueDate) < new Date());
      let statusBadge = '<span class="badge badge-active text-xs">Actif</span>';
      if (loan.status === 'RETURNED') statusBadge = '<span class="badge text-xs bg-slate-800 text-slate-400">Retourné</span>';
      else if (isOverdue) statusBadge = '<span class="badge badge-overdue text-xs">En retard</span>';
      else if (loan.status === 'RENEWED') statusBadge = '<span class="badge text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">Prolongé</span>';

      const canReturn = loan.status === 'ACTIVE' || loan.status === 'OVERDUE' || loan.status === 'RENEWED';

      return `
        <tr class="hover:bg-slate-800/30 transition">
          <td class="px-4 py-3">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-primary-600/30 border border-primary-500/30 text-primary-300 font-bold text-xs flex items-center justify-center shrink-0">
                ${(loan.user?.firstName?.[0] || 'U') + (loan.user?.lastName?.[0] || '')}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-white truncate">${escapeHtml(loan.user?.firstName + ' ' + loan.user?.lastName)}</p>
                <p class="text-xs text-slate-500 truncate">${escapeHtml(loan.user?.email || '')}</p>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <p class="text-sm font-medium text-white truncate max-w-xs" title="${escapeHtml(loan.book?.title || '')}">${escapeHtml(loan.book?.title || 'Ouvrage')}</p>
            <p class="text-xs text-slate-400 truncate">${escapeHtml(loan.book?.author || '')}</p>
          </td>
          <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-400 whitespace-nowrap">
            ${formatDate(loan.borrowedAt)}
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <span class="text-xs ${isOverdue ? 'text-red-400 font-semibold' : 'text-slate-300'}">
              ${formatDate(loan.dueDate)}
            </span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            ${statusBadge}
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-right space-x-1">
            ${canReturn ? `
              <button class="btn btn-success btn-sm text-xs py-1 px-2.5 return-loan-btn" data-id="${loan.id}" data-book="${escapeHtml(loan.book?.title || '')}" data-user="${escapeHtml(loan.user?.firstName + ' ' + loan.user?.lastName)}">
                Valider le retour
              </button>
              <button class="btn btn-secondary btn-sm text-xs py-1 px-2 renew-loan-btn" data-id="${loan.id}" title="Prolonger de 14 jours">
                +14j
              </button>
            ` : `
              <span class="text-xs text-slate-500">Retourné le ${formatDate(loan.returnedAt)}</span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.return-loan-btn').forEach((b) => {
      b.onclick = () => confirmReturnLoan(b.dataset.id, b.dataset.book, b.dataset.user);
    });
    tbody.querySelectorAll('.renew-loan-btn').forEach((b) => {
      b.onclick = () => renewLoan(b.dataset.id);
    });

    renderPagination('loans-pagination', meta, (p) => {
      state.loans.page = p;
      loadLoans();
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">Erreur chargement des emprunts.</td></tr>`;
  }
}

// Validation de retour d'un livre
function confirmReturnLoan(loanId, bookTitle, userName) {
  createModal({
    title: 'Enregistrer le retour de livre',
    content: `
      <div class="space-y-4">
        <p class="text-sm text-slate-300">Confirmez-vous la restitution du document emprunté par <strong>${escapeHtml(userName)}</strong> ?</p>
        <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-white">
          📖 ${escapeHtml(bookTitle)}
        </div>
        <p class="text-xs text-emerald-400">L'exemplaire redeviendra immédiatement disponible pour les autres prêtres et membres.</p>
        <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" class="btn btn-secondary btn-sm" id="cancel-return">Annuler</button>
          <button type="button" class="btn btn-success btn-sm" id="confirm-return-btn">Valider la restitution</button>
        </div>
      </div>
    `,
    size: 'sm'
  });

  document.getElementById('cancel-return').onclick = closeModal;
  document.getElementById('confirm-return-btn').onclick = async () => {
    try {
      await api.put(`/loans/${loanId}/return`);
      toast.success('Restitution enregistrée avec succès !');
      closeModal();
      loadLoans();
    } catch (err) {
      toast.error(err.message || 'Erreur lors du retour.');
    }
  };
}

async function renewLoan(loanId) {
  try {
    await api.put(`/loans/${loanId}/renew`);
    toast.success('Prêt prolongé de 14 jours.');
    loadLoans();
  } catch (err) {
    toast.error(err.message || 'Impossible de prolonger ce prêt.');
  }
}

// Modal Nouvel Emprunt
async function openAddLoanModal() {
  // Calcul date de retour recommandée (+14 jours)
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);
  const formattedDueDate = defaultDueDate.toISOString().slice(0, 10);

  const content = `
    <form id="add-loan-form" class="space-y-4">
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Sélectionner le membre emprunteur *</label>
        <div class="relative">
          <input type="text" id="loan-user-search" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Rechercher par nom ou email…" autocomplete="off" />
          <input type="hidden" name="userId" id="loan-selected-user-id" required />
          <div id="loan-user-results" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-800"></div>
        </div>
        <div id="loan-selected-user-badge" class="hidden mt-2 p-2 rounded-lg bg-primary-950/60 border border-primary-500/30 text-xs text-primary-200 flex items-center justify-between">
          <span id="loan-selected-user-name"></span>
          <button type="button" id="clear-selected-user" class="text-slate-400 hover:text-white">✕</button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Sélectionner l'ouvrage *</label>
        <div class="relative">
          <input type="text" id="loan-book-search" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Rechercher par titre, auteur ou ISBN…" autocomplete="off" />
          <input type="hidden" name="bookId" id="loan-selected-book-id" required />
          <div id="loan-book-results" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-800"></div>
        </div>
        <div id="loan-selected-book-badge" class="hidden mt-2 p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between">
          <span id="loan-selected-book-name"></span>
          <button type="button" id="clear-selected-book" class="text-slate-400 hover:text-white">✕</button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Date d'échéance de retour *</label>
        <input type="date" name="dueDate" value="${formattedDueDate}" required class="form-input text-sm py-2 rounded-xl w-full" />
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Notes / Observation (optionnel)</label>
        <input type="text" name="notes" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Emprunt pour session d'études ou retraite spirituelle" />
      </div>

      <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
        <button type="button" class="btn btn-secondary btn-sm" id="cancel-add-loan">Annuler</button>
        <button type="submit" class="btn btn-primary btn-sm" id="submit-add-loan">Valider l'emprunt</button>
      </div>
    </form>
  `;

  createModal({ title: 'Enregistrer un nouvel emprunt', content, size: 'md' });
  document.getElementById('cancel-add-loan').onclick = closeModal;

  // Recherche dynamique des utilisateurs
  const userInput = document.getElementById('loan-user-search');
  const userResults = document.getElementById('loan-user-results');
  let userTimer;
  userInput.oninput = () => {
    clearTimeout(userTimer);
    userTimer = setTimeout(async () => {
      const q = userInput.value.trim();
      if (!q) { userResults.classList.add('hidden'); return; }
      try {
        const res = await api.get(`/users?search=${encodeURIComponent(q)}&limit=6`);
        const users = res.data || [];
        if (users.length === 0) {
          userResults.innerHTML = `<div class="p-3 text-xs text-slate-500">Aucun membre trouvé</div>`;
        } else {
          userResults.innerHTML = users.map(u => `
            <div class="p-2.5 hover:bg-slate-800 cursor-pointer text-xs flex items-center justify-between user-item" data-id="${u.id}" data-name="${escapeHtml(u.firstName + ' ' + u.lastName)}">
              <div>
                <p class="font-medium text-white">${escapeHtml(u.firstName + ' ' + u.lastName)}</p>
                <p class="text-slate-400">${escapeHtml(u.email)}</p>
              </div>
              <span class="badge text-[10px] ${u.role === 'ADMIN' ? 'badge-primary' : 'bg-slate-800 text-slate-400'}">${u.role}</span>
            </div>
          `).join('');
          userResults.querySelectorAll('.user-item').forEach(item => {
            item.onclick = () => {
              document.getElementById('loan-selected-user-id').value = item.dataset.id;
              document.getElementById('loan-selected-user-name').textContent = `Membre : ${item.dataset.name}`;
              document.getElementById('loan-selected-user-badge').classList.remove('hidden');
              userResults.classList.add('hidden');
              userInput.value = '';
            };
          });
        }
        userResults.classList.remove('hidden');
      } catch (err) {
        console.error(err);
      }
    }, 250);
  };

  document.getElementById('clear-selected-user').onclick = () => {
    document.getElementById('loan-selected-user-id').value = '';
    document.getElementById('loan-selected-user-badge').classList.add('hidden');
  };

  // Recherche dynamique des livres disponibles
  const bookInput = document.getElementById('loan-book-search');
  const bookResults = document.getElementById('loan-book-results');
  let bookTimer;
  bookInput.oninput = () => {
    clearTimeout(bookTimer);
    bookTimer = setTimeout(async () => {
      const q = bookInput.value.trim();
      if (!q) { bookResults.classList.add('hidden'); return; }
      try {
        const res = await api.get(`/books?search=${encodeURIComponent(q)}&available=true&limit=6`);
        const books = res.data || [];
        if (books.length === 0) {
          bookResults.innerHTML = `<div class="p-3 text-xs text-slate-500">Aucun livre disponible trouvé</div>`;
        } else {
          bookResults.innerHTML = books.map(b => `
            <div class="p-2.5 hover:bg-slate-800 cursor-pointer text-xs flex items-center gap-2.5 book-item" data-id="${b.id}" data-title="${escapeHtml(b.title)}">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-white truncate">${escapeHtml(b.title)}</p>
                <p class="text-slate-400 truncate">${escapeHtml(b.author)} • Dispo: ${b.availableCopies}/${b.totalCopies}</p>
              </div>
            </div>
          `).join('');
          bookResults.querySelectorAll('.book-item').forEach(item => {
            item.onclick = () => {
              document.getElementById('loan-selected-book-id').value = item.dataset.id;
              document.getElementById('loan-selected-book-name').textContent = `Livre : ${item.dataset.title}`;
              document.getElementById('loan-selected-book-badge').classList.remove('hidden');
              bookResults.classList.add('hidden');
              bookInput.value = '';
            };
          });
        }
        bookResults.classList.remove('hidden');
      } catch (err) {
        console.error(err);
      }
    }, 250);
  };

  document.getElementById('clear-selected-book').onclick = () => {
    document.getElementById('loan-selected-book-id').value = '';
    document.getElementById('loan-selected-book-badge').classList.add('hidden');
  };

  // Soumission
  const form = document.getElementById('add-loan-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const userId = document.getElementById('loan-selected-user-id').value;
    const bookId = document.getElementById('loan-selected-book-id').value;
    const formData = new FormData(form);

    if (!userId) { toast.error('Veuillez sélectionner un membre.'); return; }
    if (!bookId) { toast.error('Veuillez sélectionner un livre.'); return; }

    const payload = {
      userId,
      bookId,
      dueDate: formData.get('dueDate'),
      notes: formData.get('notes')?.trim() || null,
    };

    try {
      const btn = document.getElementById('submit-add-loan');
      btn.disabled = true;
      btn.textContent = 'Enregistrement…';

      await api.post('/loans', payload);
      toast.success('Prêt enregistré avec succès !');
      closeModal();
      loadLoans();
      loadDashboard();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'enregistrement du prêt.");
      const btn = document.getElementById('submit-add-loan');
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Valider l'emprunt";
      }
    }
  };
}

// ─── SECTION 5 : LIVRES SIGNALÉS / SOUHAITS ──────────────────────────────────
async function loadRequests() {
  const tbody = document.getElementById('requests-tbody');
  tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Chargement des signalements…</td></tr>`;

  try {
    const res = await api.get('/requests');
    const requests = res.data || [];

    if (!requests || requests.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-12 text-center text-slate-500">Aucun livre signalé comme indisponible pour le moment.</td></tr>`;
      return;
    }

    tbody.innerHTML = requests.map((req) => {
      let statusBadge = '<span class="badge text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">En attente</span>';
      if (req.status === 'IN_PROGRESS') statusBadge = '<span class="badge text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">En cours</span>';
      else if (req.status === 'ACQUIRED') statusBadge = '<span class="badge text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Acquis</span>';
      else if (req.status === 'CLOSED') statusBadge = '<span class="badge text-xs bg-red-500/20 text-red-300 border-red-500/30">Clôturé</span>';

      return `
        <tr class="hover:bg-slate-800/30 transition">
          <td class="px-4 py-3">
            <p class="text-sm font-medium text-white">${escapeHtml(req.user?.firstName + ' ' + req.user?.lastName)}</p>
            <p class="text-xs text-slate-500">${escapeHtml(req.user?.email || '')}</p>
          </td>
          <td class="px-4 py-3">
            <p class="text-sm font-medium text-white">${escapeHtml(req.title)}</p>
            ${req.description ? `<p class="text-xs text-slate-400 mt-0.5 italic">"${escapeHtml(req.description)}"</p>` : ''}
          </td>
          <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-400">
            ${escapeHtml(req.author || '—')}
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            ${statusBadge}
          </td>
          <td class="px-4 py-3 hidden lg:table-cell text-xs text-slate-500 whitespace-nowrap">
            ${formatDate(req.createdAt)}
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-right">
            <button class="btn btn-secondary btn-sm text-xs py-1 px-2.5 update-request-btn" data-id="${req.id}" data-title="${escapeHtml(req.title)}" data-status="${req.status}">
              Gérer
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.update-request-btn').forEach((b) => {
      b.onclick = () => openUpdateRequestModal(b.dataset.id, b.dataset.title, b.dataset.status);
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">Erreur lors du chargement des requêtes.</td></tr>`;
  }
}

function openUpdateRequestModal(reqId, title, currentStatus) {
  const content = `
    <form id="update-req-form" class="space-y-4">
      <p class="text-sm text-slate-300">Modifier le statut de la demande pour :</p>
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-white">
        ${escapeHtml(title)}
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Nouveau statut *</label>
        <select name="status" class="form-select text-sm py-2 rounded-xl w-full">
          <option value="OPEN" ${currentStatus === 'OPEN' ? 'selected' : ''}>En attente d'examen</option>
          <option value="IN_PROGRESS" ${currentStatus === 'IN_PROGRESS' ? 'selected' : ''}>En cours (recherche / commande)</option>
          <option value="ACQUIRED" ${currentStatus === 'ACQUIRED' ? 'selected' : ''}>Acquis (livre ajouté à la bibliothèque)</option>
          <option value="CLOSED" ${currentStatus === 'CLOSED' ? 'selected' : ''}>Clôturé / Non disponible</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Note administrative pour le demandeur</label>
        <textarea name="adminNotes" rows="2" class="form-input text-sm py-2 rounded-xl w-full" placeholder="Ex: Commandé auprès de la librairie religieuse, disponible la semaine prochaine."></textarea>
      </div>

      <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
        <button type="button" class="btn btn-secondary btn-sm" id="cancel-req-update">Annuler</button>
        <button type="submit" class="btn btn-primary btn-sm" id="confirm-req-update">Enregistrer</button>
      </div>
    </form>
  `;

  createModal({ title: 'Traiter le livre signalé', content, size: 'sm' });
  document.getElementById('cancel-req-update').onclick = closeModal;

  const form = document.getElementById('update-req-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    try {
      await api.put(`/requests/${reqId}`, {
        status: formData.get('status'),
        adminNotes: formData.get('adminNotes')?.trim() || null,
      });
      toast.success('Statut de la demande mis à jour.');
      closeModal();
      loadRequests();
    } catch (err) {
      toast.error(err.message || 'Erreur mise à jour requête.');
    }
  };
}

// ─── SECTION 6 : UTILISATEURS (40 PRÊTRES & MEMBRES) ─────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Chargement des membres…</td></tr>`;

  try {
    const params = new URLSearchParams({
      page: state.users.page,
      limit: state.users.limit,
    });
    if (state.users.search) params.append('search', state.users.search);
    if (state.users.role) params.append('role', state.users.role);

    const res = await api.get(`/users?${params.toString()}`);
    const users = res.data;
    const meta = res.meta;
    state.users.totalPages = meta.totalPages || 1;

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-12 text-center text-slate-500">Aucun membre trouvé.</td></tr>`;
      renderPagination('users-pagination', meta, (p) => { state.users.page = p; loadUsers(); });
      return;
    }

    tbody.innerHTML = users.map((u) => {
      let roleBadge = '<span class="badge text-xs bg-slate-800 text-slate-300">Membre</span>';
      if (u.role === 'LIBRARIAN') roleBadge = '<span class="badge text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">Bibliothécaire</span>';
      else if (u.role === 'ADMIN') roleBadge = '<span class="badge badge-primary text-xs">Admin</span>';

      return `
        <tr class="hover:bg-slate-800/30 transition">
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                ${(u.firstName?.[0] || 'U') + (u.lastName?.[0] || '')}
              </div>
              <p class="font-medium text-white text-sm">${escapeHtml(u.firstName + ' ' + u.lastName)}</p>
            </div>
          </td>
          <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-400">
            ${escapeHtml(u.email)}
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            ${roleBadge}
          </td>
          <td class="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">
            ${u._count?.loans || 0} prêts
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <span class="badge text-xs ${u.isActive ? 'badge-available' : 'badge-overdue'}">
              ${u.isActive ? 'Actif' : 'Désactivé'}
            </span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-right space-x-1">
            <button class="btn btn-secondary btn-sm p-1.5 change-role-btn" data-id="${u.id}" data-role="${u.role}" data-name="${escapeHtml(u.firstName + ' ' + u.lastName)}" title="Modifier le rôle">
              <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>
            </button>
            <button class="btn btn-secondary btn-sm p-1.5 toggle-active-btn ${u.isActive ? 'text-amber-400' : 'text-emerald-400'}" data-id="${u.id}" data-active="${u.isActive}" data-name="${escapeHtml(u.firstName + ' ' + u.lastName)}" title="${u.isActive ? 'Désactiver' : 'Activer'}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.change-role-btn').forEach((b) => {
      b.onclick = () => openChangeRoleModal(b.dataset.id, b.dataset.name, b.dataset.role);
    });
    tbody.querySelectorAll('.toggle-active-btn').forEach((b) => {
      b.onclick = () => toggleUserActive(b.dataset.id, b.dataset.name, b.dataset.active === 'true');
    });

    renderPagination('users-pagination', meta, (p) => {
      state.users.page = p;
      loadUsers();
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">Erreur chargement membres.</td></tr>`;
  }
}

function openChangeRoleModal(userId, userName, currentRole) {
  const content = `
    <form id="change-role-form" class="space-y-4">
      <p class="text-sm text-slate-300">Modifier les permissions pour <strong>${escapeHtml(userName)}</strong> :</p>
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1">Rôle dans la bibliothèque *</label>
        <select name="role" class="form-select text-sm py-2 rounded-xl w-full">
          <option value="MEMBER" ${currentRole === 'MEMBER' ? 'selected' : ''}>Membre (Lecture, recherche, emprunt, signalement)</option>
          <option value="LIBRARIAN" ${currentRole === 'LIBRARIAN' ? 'selected' : ''}>Bibliothécaire (Ajout & gestion des livres, gestion des prêts)</option>
          <option value="ADMIN" ${currentRole === 'ADMIN' ? 'selected' : ''}>Administrateur (Gestion intégrale, utilisateurs, audit)</option>
        </select>
      </div>
      <div class="flex justify-end gap-3 pt-3 border-t border-slate-800">
        <button type="button" class="btn btn-secondary btn-sm" id="cancel-role">Annuler</button>
        <button type="submit" class="btn btn-primary btn-sm" id="confirm-role">Appliquer le rôle</button>
      </div>
    </form>
  `;

  createModal({ title: 'Attribution du Rôle', content, size: 'sm' });
  document.getElementById('cancel-role').onclick = closeModal;

  const form = document.getElementById('change-role-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const role = new FormData(form).get('role');
    try {
      await api.put(`/users/${userId}/role`, { role });
      toast.success('Rôle mis à jour.');
      closeModal();
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Erreur mise à jour rôle.');
    }
  };
}

async function toggleUserActive(userId, userName, isCurrentlyActive) {
  try {
    await api.put(`/users/${userId}/toggle-active`);
    toast.success(`Compte de ${userName} ${isCurrentlyActive ? 'désactivé' : 'réactivé'}.`);
    loadUsers();
  } catch (err) {
    toast.error(err.message || 'Erreur lors du changement de statut.');
  }
}

// ─── SECTION 7 : AUDIT ────────────────────────────────────────────────────────
async function loadAuditLogs() {
  const tbody = document.getElementById('audit-tbody');
  tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Chargement du journal d'activité…</td></tr>`;

  try {
    const params = new URLSearchParams({
      page: state.audit.page,
      limit: state.audit.limit,
    });
    const res = await api.get(`/users/admin/audit?${params.toString()}`);
    const logs = res.data;
    const meta = res.meta;
    state.audit.totalPages = meta.totalPages || 1;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-slate-500">Aucune action enregistrée.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map((log) => `
      <tr class="hover:bg-slate-800/30 transition text-xs">
        <td class="px-4 py-3 whitespace-nowrap text-slate-400 font-mono">
          ${formatDateTime(log.createdAt)}
        </td>
        <td class="px-4 py-3 whitespace-nowrap font-medium text-white">
          ${escapeHtml(log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système')}
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <span class="badge text-[10px] bg-slate-800 text-slate-300 font-mono">${escapeHtml(log.action)}</span>
        </td>
        <td class="px-4 py-3 text-slate-400 truncate max-w-xs">
          ${escapeHtml(log.entityType || '—')} ${log.entityId ? `<span class="font-mono text-slate-600">(${log.entityId.slice(0, 8)}…)</span>` : ''}
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-slate-500 font-mono hidden lg:table-cell">
          ${escapeHtml(log.ipAddress || '127.0.0.1')}
        </td>
      </tr>
    `).join('');

    renderPagination('audit-pagination', meta, (p) => {
      state.audit.page = p;
      loadAuditLogs();
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-red-400">Erreur lors du chargement des journaux d'audit.</td></tr>`;
  }
}

// ─── HELPERS PAGINATION ET FORMATAGE ──────────────────────────────────────────
function renderPagination(elementId, meta, onPageClick) {
  const container = document.getElementById(elementId);
  if (!container || !meta || meta.totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = `
    <button class="pagination__btn" ${meta.page <= 1 ? 'disabled' : ''} data-page="${meta.page - 1}">
      ‹ Précédent
    </button>
    <span class="text-xs text-slate-400 px-3">Page ${meta.page} sur ${meta.totalPages}</span>
    <button class="pagination__btn" ${meta.page >= meta.totalPages ? 'disabled' : ''} data-page="${meta.page + 1}">
      Suivant ›
    </button>
  `;

  container.innerHTML = html;
  container.querySelectorAll('button[data-page]').forEach((b) => {
    b.onclick = () => {
      const p = parseInt(b.dataset.page, 10);
      if (p >= 1 && p <= meta.totalPages) onPageClick(p);
    };
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateStr; }
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
