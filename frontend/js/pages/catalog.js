import api, { resolveAssetUrl } from '../core/api.js';
import auth from '../core/auth.js';
import toast from '../components/toast.js';
import { createBookCard, createSkeletonCards } from '../components/bookCard.js';
import { createModal } from '../components/modal.js';

// ─── État global de la page ────────────────────────────────────────────────────
const state = {
  page: 1,
  limit: 24,
  search: '',
  category: '',
  available: '',
  sort: 'createdAt',
  order: 'desc',
  total: 0,
  loading: false,
};

// ─── Éléments DOM ─────────────────────────────────────────────────────────────
const grid = document.getElementById('books-grid');
const emptyState = document.getElementById('books-empty');
const paginationEl = document.getElementById('pagination');
const resultsCount = document.getElementById('results-count');
const heroSearch = document.getElementById('hero-search');
const navbarSearch = document.getElementById('navbar-search');
const filterAvailable = document.getElementById('filter-available');
const filterSort = document.getElementById('filter-sort');
const filterOrder = document.getElementById('filter-order');
const categoriesFilter = document.getElementById('categories-filter');

// ─── Initialisation ────────────────────────────────────────────────────────────
(async function init() {
  await auth.ready();
  setupNavbar();
  await Promise.all([loadCategories(), loadStats(), loadFromHash()]);
  setupEventListeners();
})();

// ─── Ouverture directe d'une fiche (QR codes imprimés) ─────────────────────────
// Un QR code collé sur un livre pointe vers /pages/index.html#book/<id>.
async function loadFromHash() {
  const match = /^#book\/([A-Za-z0-9-]+)$/.exec(window.location.hash || '');
  if (!match) {
    await fetchBooks();
    return;
  }

  await openBookFromHash(match[1]);

  // On garde la liste chargée en arrière-plan pour que l'utilisateur
  // retrouve le catalogue en fermant la fiche.
  await fetchBooks();
}

async function openBookFromHash(bookId) {
  try {
    const res = await api.get(`/books/${bookId}`);
    if (res && res.data) await openBookDetail(res.data);
  } catch {
    toast.error('Ouvrage introuvable. Il a peut-être été retiré du catalogue.');
  }
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
function setupNavbar() {
  const user = auth.getUser();
  const navGuest = document.getElementById('nav-guest');
  const navUser = document.getElementById('nav-user');

  if (auth.isAuthenticated() && user) {
    navGuest.classList.add('hidden');
    navUser.classList.remove('hidden');
    navUser.classList.add('flex');
    document.getElementById('user-name').textContent = user.firstName;
    document.getElementById('user-avatar').textContent = (user.firstName[0] + user.lastName[0]).toUpperCase();

    if (auth.isStaff()) {
      document.getElementById('nav-admin-link').classList.remove('hidden');
    }

    // Dropdown menu
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

// ─── Chargement catégories ──────────────────────────────────────────────────────
async function loadCategories() {
  try {
    const res = await api.get('/categories');
    const categories = res.data || [];

    categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = 'category-btn shrink-0 btn btn-secondary btn-sm border';
      btn.style.setProperty('--cat-color', cat.color);
      btn.dataset.category = cat.slug;
      btn.textContent = cat.nameFr;
      btn.addEventListener('click', () => {
        setCategory(cat.slug, btn);
      });
      categoriesFilter.appendChild(btn);
    });
  } catch { /* silencieux */ }
}

function setCategory(slug, activeBtn) {
  state.category = slug;
  state.page = 1;
  document.querySelectorAll('.category-btn').forEach((b) => {
    b.classList.remove('btn-primary', 'active');
    b.classList.add('btn-secondary');
  });
  if (activeBtn) {
    activeBtn.classList.remove('btn-secondary');
    activeBtn.classList.add('btn-primary', 'active');
  }
  fetchBooks();
}

// ─── Chargement statistiques ────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await api.get('/books/stats');
    const s = res.data;
    document.getElementById('stat-books').textContent = s.total ?? '—';
    document.getElementById('stat-available').textContent = s.available ?? '—';
    document.getElementById('stat-borrowed').textContent = s.borrowed ?? '—';
  } catch { /* silencieux */ }
}

// ─── Récupération des livres ───────────────────────────────────────────────────
async function fetchBooks() {
  if (state.loading) return;
  state.loading = true;

  // Skeletons
  grid.innerHTML = '';
  createSkeletonCards(12).forEach((el) => grid.appendChild(el));
  emptyState.classList.add('hidden');
  paginationEl.classList.add('hidden');

  try {
    const params = new URLSearchParams({
      page: state.page,
      limit: state.limit,
      sort: state.sort,
      order: state.order,
      ...(state.search && { search: state.search }),
      ...(state.category && { category: state.category }),
      ...(state.available && { available: state.available }),
    });

    const res = await api.get(`/books?${params}`);
    const books = res.data || [];
    const meta = res.meta || {};

    state.total = meta.total || 0;

    grid.innerHTML = '';

    if (books.length === 0) {
      emptyState.classList.remove('hidden');
      resultsCount.textContent = '';
      return;
    }

    books.forEach((book) => {
      const card = createBookCard(book, openBookDetail);
      grid.appendChild(card);
    });

    resultsCount.textContent = `${state.total} ouvrage${state.total > 1 ? 's' : ''}`;
    renderPagination(meta);

  } catch (err) {
    grid.innerHTML = '';
    toast.error(err.message || 'Erreur lors du chargement des livres.');
  } finally {
    state.loading = false;
  }
}

// ─── Pagination ────────────────────────────────────────────────────────────────
function renderPagination(meta) {
  if (meta.totalPages <= 1) { paginationEl.classList.add('hidden'); return; }

  paginationEl.classList.remove('hidden');
  paginationEl.innerHTML = '';

  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>`;
  prev.disabled = !meta.hasPreviousPage;
  prev.addEventListener('click', () => { state.page--; fetchBooks(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  paginationEl.appendChild(prev);

  // Boutons de pages
  const range = getPageRange(meta.page, meta.totalPages);
  range.forEach((p) => {
    const btn = document.createElement('button');
    if (p === '…') {
      btn.className = 'page-btn cursor-default';
      btn.textContent = '…';
      btn.disabled = true;
    } else {
      btn.className = `page-btn${p === meta.page ? ' active' : ''}`;
      btn.textContent = p;
      btn.addEventListener('click', () => { state.page = p; fetchBooks(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
    paginationEl.appendChild(btn);
  });

  const next = document.createElement('button');
  next.className = 'page-btn';
  next.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;
  next.disabled = !meta.hasNextPage;
  next.addEventListener('click', () => { state.page++; fetchBooks(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  paginationEl.appendChild(next);
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

// ─── Détail d'un livre ──────────────────────────────────────────────────────────
async function openBookDetail(book) {
  const { close, contentEl } = createModal({
    title: book.title,
    size: 'lg',
  });

  contentEl.innerHTML = `<div class="text-center py-8"><div class="skeleton w-12 h-12 rounded-full mx-auto"></div></div>`;

  try {
    const b = book.detail || (await api.get(`/books/${book.id}`)).data;

    const isAvailable = b.availableCopies > 0;
    const user = auth.getUser();
    const coverSrc = resolveAssetUrl(b.coverUrl);

    const starsHtml = Array.from({ length: 5 }, (_, i) =>
      `<svg class="w-4 h-4 ${i < Math.round(b.avgRating || 0) ? 'text-gold-400' : 'text-slate-700'}" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
      </svg>`
    ).join('');

    const categories = (b.categories || []).map((bc) =>
      `<span class="tag" style="background:${bc.category.color}22;color:${bc.category.color};border-color:${bc.category.color}44">${bc.category.nameFr}</span>`
    ).join('');

    const reviewsHtml = (b.reviews || []).slice(0, 5).map((r) => `
      <div class="flex gap-3 py-3 border-b border-slate-800/60 last:border-0">
        <div class="w-8 h-8 rounded-lg bg-primary-600/20 flex items-center justify-center text-primary-300 text-xs font-bold shrink-0">
          ${r.user.firstName[0]}${r.user.lastName[0]}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm font-medium text-white">${r.user.firstName} ${r.user.lastName}</span>
            <div class="flex">${Array.from({ length: 5 }, (_, i) =>
              `<svg class="w-3 h-3 ${i < r.rating ? 'text-gold-400' : 'text-slate-700'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`
            ).join('')}</div>
          </div>
          ${r.comment ? `<p class="text-sm text-slate-400 line-clamp-3">${r.comment}</p>` : ''}
        </div>
      </div>
    `).join('');

    contentEl.innerHTML = `
      <div class="flex flex-col md:flex-row gap-6">
        <!-- Couverture -->
        <div class="shrink-0 mx-auto md:mx-0">
          <div class="w-40 rounded-xl overflow-hidden" style="aspect-ratio:2/3;">
            ${coverSrc
              ? `<img src="${coverSrc}" alt="${b.title}" class="w-full h-full object-cover" />`
              : `<div class="w-full h-full bg-slate-800 flex items-center justify-center">
                  <svg class="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13..."/>
                  </svg>
                </div>`
            }
          </div>
        </div>

        <!-- Infos -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-3 mb-1">
            <h3 class="font-serif text-xl font-bold text-white leading-tight">${b.title}</h3>
            <span class="${isAvailable ? 'badge-available' : 'badge-unavailable'} badge shrink-0">
              ${isAvailable ? `✓ ${b.availableCopies} dispo.` : '✗ Emprunté'}
            </span>
          </div>
          <p class="text-slate-400 mb-3">${b.author}${b.year ? ` · ${b.year}` : ''}${b.edition ? ` · ${b.edition}` : ''}</p>

          ${b.avgRating ? `
            <div class="flex items-center gap-2 mb-3">
              <div class="flex">${starsHtml}</div>
              <span class="text-sm text-slate-400">${b.avgRating}/5 (${b._count?.reviews || 0} avis)</span>
            </div>` : ''
          }

          <div class="flex flex-wrap gap-1.5 mb-4">${categories}</div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
            ${b.publishingHouse ? `<div><dt class="text-slate-500">Maison d'édition</dt><dd class="text-white">${b.publishingHouse}</dd></div>` : ''}
            ${b.publisher ? `<div><dt class="text-slate-500">Éditeur</dt><dd class="text-white">${b.publisher}</dd></div>` : ''}
            ${b.isbn ? `<div><dt class="text-slate-500">ISBN</dt><dd class="text-white font-mono text-xs">${b.isbn}</dd></div>` : ''}
            ${b.pageCount ? `<div><dt class="text-slate-500">Pages</dt><dd class="text-white">${b.pageCount}</dd></div>` : ''}
            ${b.language ? `<div><dt class="text-slate-500">Langue</dt><dd class="text-white capitalize">${b.language}</dd></div>` : ''}
            ${b.location ? `<div><dt class="text-slate-500">Emplacement</dt><dd class="text-white">${b.location}</dd></div>` : ''}
          </dl>

          ${b.summary ? `
            <div class="mb-4">
              <h4 class="text-sm font-medium text-slate-300 mb-2">Résumé</h4>
              <p class="text-sm text-slate-400 leading-relaxed">${b.summary}</p>
            </div>` : ''}

          <!-- Actions -->
          ${user ? `
            <div class="flex flex-wrap gap-2 mb-4" id="detail-actions">
              ${isAvailable
                ? `<button class="btn-success btn-sm" id="detail-borrow-btn">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Emprunter
                   </button>`
                : `<button class="btn-secondary btn-sm" id="detail-reserve-btn">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Rejoindre la file d'attente
                   </button>`
              }
            </div>` : `
            <a href="/pages/login.html" class="btn-primary btn-sm mb-4 inline-flex">
              Connexion pour emprunter
            </a>`
          }
        </div>
      </div>

      <!-- Avis -->
      ${b.reviews?.length > 0 ? `
        <div class="mt-6 border-t border-slate-800/60 pt-4">
          <h4 class="text-sm font-semibold text-white mb-3">Avis (${b.reviews.length})</h4>
          <div>${reviewsHtml}</div>
        </div>` : ''}
    `;

    // Actions emprunt / réservation
    document.getElementById('detail-borrow-btn')?.addEventListener('click', () => {
      if (!auth.isAuthenticated()) { window.location.href = '/pages/login.html'; return; }
      if (!auth.isStaff()) {
        toast.info('Contactez le bibliothécaire pour enregistrer votre emprunt.');
        return;
      }
      // Personnel : enregistrer l'emprunt pour un membre (utile après scan du QR)
      openStaffBorrowPanel(b);
    });

    document.getElementById('detail-reserve-btn')?.addEventListener('click', async () => {
      try {
        await api.post('/reservations', { bookId: b.id });
        toast.success('Vous avez été ajouté à la file d\'attente. Vous serez notifié par email.');
        close();
      } catch (err) {
        toast.error(err.message);
      }
    });

  } catch (err) {
    if (!contentEl.isConnected) return;
    contentEl.innerHTML = `<p class="text-red-400 text-center py-8">${err.message}</p>`;
  }
}

// ─── Écouteurs d'événements ───────────────────────────────────────────────────
function setupEventListeners() {
  let searchTimeout;
  const handleSearch = (value) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = value.trim();
      state.page = 1;
      fetchBooks();
    }, 400);
  };

  heroSearch?.addEventListener('input', (e) => {
    navbarSearch.value = e.target.value;
    handleSearch(e.target.value);
  });

  navbarSearch?.addEventListener('input', (e) => {
    heroSearch.value = e.target.value;
    handleSearch(e.target.value);
  });

  filterAvailable?.addEventListener('change', (e) => {
    state.available = e.target.value;
    state.page = 1;
    fetchBooks();
  });

  filterSort?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    fetchBooks();
  });

  filterOrder?.addEventListener('change', (e) => {
    state.order = e.target.value;
    state.page = 1;
    fetchBooks();
  });

  document.getElementById('clear-search')?.addEventListener('click', () => {
    state.search = '';
    state.category = '';
    state.available = '';
    heroSearch.value = '';
    navbarSearch.value = '';
    filterAvailable.value = '';
    document.querySelectorAll('.category-btn').forEach((b, i) => {
      b.classList.remove('btn-primary', 'active');
      b.classList.add('btn-secondary');
      if (i === 0) { b.classList.add('btn-primary', 'active'); b.classList.remove('btn-secondary'); }
    });
    fetchBooks();
  });
}

// ─── Prêt par scan (personnel) ──────────────────────────────────────────────────
// Affiche un champ pour identifier le membre puis enregistre l'emprunt.
function openStaffBorrowPanel(book) {
  const actions = document.getElementById('detail-actions');
  if (!actions) return;
  if (document.getElementById('staff-borrow-panel')) return; // déjà ouvert

  const panel = document.createElement('div');
  panel.id = 'staff-borrow-panel';
  panel.className = 'w-full mt-2 p-3 rounded-xl bg-slate-900 border border-slate-800';
  panel.innerHTML = `
    <label class="block text-xs font-medium text-slate-300 mb-1">Emprunter cet ouvrage pour le membre :</label>
    <div class="relative">
      <input type="email" id="staff-borrow-email" class="form-input text-sm py-2 rounded-xl w-full"
             placeholder="Email du membre…" autocomplete="off" />
      <div id="staff-borrow-results" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-50 divide-y divide-slate-800"></div>
    </div>
    <div class="flex gap-2 mt-2">
      <button class="btn-primary btn-sm" id="staff-borrow-confirm" disabled>Enregistrer l'emprunt</button>
      <button class="btn-secondary btn-sm" id="staff-borrow-cancel">Annuler</button>
    </div>
  `;
  actions.after(panel);

  const emailInput = document.getElementById('staff-borrow-email');
  const results = document.getElementById('staff-borrow-results');
  const confirmBtn = document.getElementById('staff-borrow-confirm');
  let selectedUserId = null;
  let timer;

  const renderResults = (users) => {
    if (!users.length) {
      results.innerHTML = `<div class="px-3 py-2 text-xs text-slate-500">Aucun membre trouvé.</div>`;
      results.classList.remove('hidden');
      return;
    }
    results.innerHTML = users.map((u) => `
      <button type="button" class="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors"
              data-id="${u.id}" data-name="${escapeAttr(u.firstName + ' ' + u.lastName)}" data-email="${escapeAttr(u.email)}">
        <span class="block text-sm text-white">${escapeHtml(u.firstName + ' ' + u.lastName)}</span>
        <span class="block text-xs text-slate-400">${escapeHtml(u.email)}</span>
      </button>
    `).join('');
    results.classList.remove('hidden');
    results.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.onclick = () => {
        selectedUserId = btn.dataset.id;
        emailInput.value = `${btn.dataset.name} (${btn.dataset.email})`;
        confirmBtn.disabled = false;
        results.classList.add('hidden');
      };
    });
  };

  emailInput.addEventListener('input', () => {
    selectedUserId = null;
    confirmBtn.disabled = true;
    const q = emailInput.value.trim();
    if (q.length < 2) { results.classList.add('hidden'); return; }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users?search=${encodeURIComponent(q)}&limit=6`);
        renderResults(res.data || []);
      } catch { results.classList.add('hidden'); }
    }, 250);
  });

  confirmBtn.onclick = async () => {
    if (!selectedUserId) return;
    confirmBtn.disabled = true;
    try {
      await api.post('/loans', { userId: selectedUserId, bookId: book.id });
      toast.success('Emprunt enregistré avec succès.');
      panel.remove();
      fetchBooks();
    } catch (err) {
      toast.error(err.message || 'Impossible d\'enregistrer l\'emprunt.');
      confirmBtn.disabled = false;
    }
  };

  document.getElementById('staff-borrow-cancel').onclick = () => panel.remove();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}
