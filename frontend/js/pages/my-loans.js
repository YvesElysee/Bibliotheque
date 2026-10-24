import api, { resolveAssetUrl } from '../core/api.js';
import auth from '../core/auth.js';
import toast from '../components/toast.js';

if (!auth.isAuthenticated()) {
  window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  await auth.ready();
  setupNavbar();
  loadLoans();
  loadReservations();
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

async function loadLoans() {
  const activeContainer = document.getElementById('active-loans-list');
  const historyContainer = document.getElementById('history-loans-list');

  try {
    const res = await api.get('/loans/my');
    const loans = res.data || [];

    const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'RENEWED');
    const historyLoans = loans.filter((l) => l.status === 'RETURNED');

    document.getElementById('active-count').textContent = activeLoans.length;

    // 1. Emprunts en cours
    if (activeLoans.length === 0) {
      activeContainer.innerHTML = `
        <div class="card py-10 text-center">
          <p class="text-sm font-medium text-slate-400">Aucun emprunt en cours actuellement.</p>
          <a href="index.html" class="inline-block mt-3 btn btn-primary btn-sm">Parcourir le catalogue</a>
        </div>
      `;
    } else {
      activeContainer.innerHTML = activeLoans.map((loan) => {
        const dueDate = new Date(loan.dueDate);
        const now = new Date();
        const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0;

        let statusNotice = '';
        if (isOverdue) {
          statusNotice = `<span class="badge badge-overdue text-xs">⚠️ En retard de ${Math.abs(diffDays)} jour(s)</span>`;
        } else if (diffDays <= 3) {
          statusNotice = `<span class="badge text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">À rendre dans ${diffDays} jour(s)</span>`;
        } else {
          statusNotice = `<span class="badge text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Valide (${diffDays} jours restants)</span>`;
        }

        return `
          <div class="card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="w-14 h-20 rounded-xl bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-700/60">
                ${loan.book?.coverUrl ? `<img src="${resolveAssetUrl(loan.book.coverUrl)}" alt="" class="w-full h-full object-cover">` : `<svg class="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13"/></svg>`}
              </div>
              <div class="min-w-0">
                <h3 class="font-serif font-semibold text-white text-base truncate max-w-sm sm:max-w-md">${escapeHtml(loan.book?.title || 'Livre')}</h3>
                <p class="text-xs text-slate-400">${escapeHtml(loan.book?.author || 'Auteur inconnu')}</p>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <span class="text-xs text-slate-400">Emprunté le : <strong class="text-slate-300">${formatDate(loan.borrowedAt)}</strong></span>
                  <span class="text-xs text-slate-400">• À rendre avant le : <strong class="${isOverdue ? 'text-red-400' : 'text-slate-200'}">${formatDate(loan.dueDate)}</strong></span>
                </div>
              </div>
            </div>

            <div class="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0">
              ${statusNotice}
              <button class="btn btn-secondary btn-sm text-xs renew-btn" data-id="${loan.id}" title="Demander 14 jours supplémentaires">
                Prolonger (+14j)
              </button>
            </div>
          </div>
        `;
      }).join('');

      activeContainer.querySelectorAll('.renew-btn').forEach((b) => {
        b.onclick = () => renewUserLoan(b.dataset.id);
      });
    }

    // 2. Historique
    if (historyLoans.length === 0) {
      historyContainer.innerHTML = `<div class="card py-6 text-center text-sm text-slate-500">Aucun emprunt passé archivé.</div>`;
    } else {
      historyContainer.innerHTML = historyLoans.map((loan) => `
        <div class="card p-3.5 flex items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm font-medium text-white truncate">${escapeHtml(loan.book?.title || 'Livre')}</p>
            <p class="text-xs text-slate-400 truncate">${escapeHtml(loan.book?.author || '')}</p>
          </div>
          <div class="text-right text-xs text-slate-500 shrink-0">
            <span>Rendu le ${formatDate(loan.returnedAt)}</span>
          </div>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error(err);
    activeContainer.innerHTML = `<div class="card py-6 text-center text-red-400 text-sm">Erreur de chargement.</div>`;
  }
}

async function renewUserLoan(loanId) {
  try {
    await api.put(`/loans/${loanId}/renew`);
    toast.success('Emprunt prolongé de 14 jours avec succès.');
    loadLoans();
  } catch (err) {
    toast.error(err.message || 'Impossible de prolonger ce prêt.');
  }
}

// ─── Liste d'attente (réservations) ─────────────────────────────────────────────
// ─── Liste d'attente (reservations) ─────────────────────────────────────────────
async function loadReservations() {
  const container = document.getElementById('reservations-list');
  const countEl = document.getElementById('reservations-count');
  if (!container) return;
  try {
    const res = await api.get('/reservations/my');
    const all = res.data || [];
    const active = all.filter((r) => r.status === 'PENDING' || r.status === 'NOTIFIED');
    if (countEl) countEl.textContent = active.length;
    if (active.length === 0) {
      container.innerHTML = '<div class="card py-6 text-center text-sm text-slate-500">Vous n\'etes inscrit a aucune liste d\'attente.</div>';
      return;
    }
    container.innerHTML = active.map((r) => {
      let msg = '';
      if (r.status === 'NOTIFIED') msg = 'Disponible - passez le retirer';
      else if (r.queueRank && r.queueTotal) {
        if (r.queueRank === 1) msg = "C'est votre tour ! Vous pouvez venir emprunter ce livre.";
        else msg = 'Vous etes n\u00B0' + r.queueRank + ' sur ' + r.queueTotal + ' dans la liste d\u2019attente';
      } else {
        msg = 'Position ' + (r.queueRank || r.position || '?') + ' dans la file d\u2019attente';
      }
      const cls = r.status === 'NOTIFIED' ? 'text-emerald-400' : (r.queueRank === 1 ? 'text-emerald-400' : 'text-amber-400');
      const cover = (r.book && r.book.coverUrl) ? '<img src="' + resolveAssetUrl(r.book.coverUrl) + '" alt="" class="w-full h-full object-cover">' : '<svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13"/></svg>';
      return '<div class="card p-4 flex items-center justify-between gap-4"><div class="flex items-center gap-4 min-w-0"><div class="w-12 h-16 rounded-lg bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-700/60">' + cover + '</div><div class="min-w-0"><p class="text-sm font-medium text-white truncate">' + escapeHtml(r.book && r.book.title ? r.book.title : 'Livre') + '</p><p class="text-xs text-slate-400 truncate">' + escapeHtml(r.book && r.book.author ? r.book.author : '') + '</p><p class="text-xs mt-1 ' + cls + '">' + escapeHtml(msg) + '</p></div></div><button class="btn btn-secondary btn-sm text-xs cancel-res-btn shrink-0" data-id="' + r.id + '">Annuler</button></div>';
    }).join('');
    container.querySelectorAll('.cancel-res-btn').forEach((b) => { b.onclick = () => cancelReservation(b.dataset.id); });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="card py-6 text-center text-sm text-slate-500">Aucune reservation a afficher.</div>';
  }
}


async function cancelReservation(id) {
  try {
    await api.delete(`/reservations/${id}`);
    toast.success('Réservation annulée.');
    loadReservations();
  } catch (err) {
    toast.error(err.message || 'Impossible d\'annuler cette réservation.');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

async function showLoanReminders() {
  try {
    const res = await api.get('/loans/my');
    const loans = res.data || [];
    const active = loans.filter(l => !l.returnedAt);
    if (!active.length) return;
    const now = new Date();
    let closest = null;
    for (const l of active) {
      if (!l.dueDate) continue;
      const due = new Date(l.dueDate);
      if (!closest || due < new Date(closest.dueDate)) closest = l;
    }
    if (!closest) return;
    const due = new Date(closest.dueDate);
    const diffMs = due.setHours(23,59,59,999) - new Date().setHours(0,0,0,0);
    const daysLeft = Math.ceil(diffMs / 86400000);
    const banner = document.getElementById('loans-reminder-banner');
    const text = document.getElementById('loans-reminder-text');
    if (!banner || !text) return;
    if (daysLeft < 0) {
      const late = Math.abs(daysLeft);
      banner.className = 'rounded-2xl border px-4 py-3 flex items-start gap-3 bg-red-500/10 border-red-500/40 text-red-200';
      text.innerHTML = '<span class="font-medium">Vous avez ' + active.length + ' emprunt' + (active.length>1?'s':'') + ' en cours.</span> Le plus urgent : <strong>' + escapeHtml(closest.book?.title||'') + '</strong> — <span class="font-semibold">EN RETARD depuis ' + late + ' jour' + (late>1?'s':'') + '.</span> Veuillez le rapporter dès que possible.';
    } else if (daysLeft <= 3) {
      banner.className = 'rounded-2xl border px-4 py-3 flex items-start gap-3 bg-amber-500/10 border-amber-500/40 text-amber-100';
      text.innerHTML = '<span class="font-medium">Vous avez ' + active.length + ' emprunt' + (active.length>1?'s':'') + ' à rendre.</span> Le plus urgent : <strong>' + escapeHtml(closest.book?.title||'') + '</strong> — À rendre le <strong>' + due.toLocaleDateString('fr-FR') + '</strong>' + (daysLeft === 0 ? ' <span class="font-semibold">(aujourd\'hui)</span>' : ' dans <span class="font-semibold">' + daysLeft + ' jour' + (daysLeft>1?'s':'') + '</span>') + '.';
    } else {
      banner.className = 'rounded-2xl border px-4 py-3 flex items-start gap-3 bg-blue-500/10 border-blue-500/40 text-blue-100';
      text.innerHTML = '<span class="font-medium">Rappel :</span> <strong>' + escapeHtml(closest.book?.title||'') + '</strong> — À rendre le <strong>' + due.toLocaleDateString('fr-FR') + '</strong>.';
    }
    banner.classList.remove('hidden');
  } catch(e) {}
}
showLoanReminders();
