/**
 * Bannière hors-ligne / synchronisation
 */

import { syncManager } from '../core/sync-manager.js';
import { queueCount } from '../core/offline-db.js';

export function initOfflineBanner() {
  // Créer la bannière si elle n'existe pas
  if (document.getElementById('offline-banner')) return;
  
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.className = 'fixed top-0 left-0 right-0 z-[9999] transform -translate-y-full transition-transform duration-300';
  banner.innerHTML = `
    <div class="bg-amber-600 text-white px-4 py-2 text-sm flex items-center justify-between gap-3 shadow-lg">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"/>
        </svg>
        <span id="offline-banner-text" class="truncate">Mode hors-ligne</span>
      </div>
      <div class="flex items-center gap-2">
        <span id="offline-banner-count" class="hidden px-2 py-0.5 bg-white/20 rounded-full text-xs"></span>
        <button id="offline-banner-sync" class="hidden text-xs underline hover:no-underline">Synchroniser</button>
      </div>
    </div>
  `;
  
  document.body.prepend(banner);
  
  const textEl = document.getElementById('offline-banner-text');
  const countEl = document.getElementById('offline-banner-count');
  const syncBtn = document.getElementById('offline-banner-sync');
  
  syncBtn.addEventListener('click', () => {
    syncManager.sync();
  });
  
  async function updateBanner() {
    const count = await queueCount();
    
    if (!navigator.onLine) {
      banner.classList.remove('-translate-y-full');
      textEl.textContent = 'Mode hors-ligne - Données depuis le cache';
      if (count > 0) {
        countEl.textContent = `${count} action${count > 1 ? 's' : ''} en attente`;
        countEl.classList.remove('hidden');
        syncBtn.classList.add('hidden');
      } else {
        countEl.classList.add('hidden');
        syncBtn.classList.add('hidden');
      }
    } else if (syncManager.isSyncing) {
      banner.classList.remove('-translate-y-full');
      banner.firstElementChild.className = 'bg-blue-600 text-white px-4 py-2 text-sm flex items-center justify-between gap-3 shadow-lg';
      textEl.textContent = 'Synchronisation en cours...';
      if (count > 0) {
        countEl.textContent = `${count} restan${count > 1 ? 'tes' : 'te'}`;
        countEl.classList.remove('hidden');
      }
      syncBtn.classList.add('hidden');
    } else if (count > 0) {
      banner.classList.remove('-translate-y-full');
      banner.firstElementChild.className = 'bg-amber-600 text-white px-4 py-2 text-sm flex items-center justify-between gap-3 shadow-lg';
      textEl.textContent = 'Actions en attente de synchronisation';
      countEl.textContent = `${count} action${count > 1 ? 's' : ''}`;
      countEl.classList.remove('hidden');
      syncBtn.classList.remove('hidden');
    } else {
      banner.classList.add('-translate-y-full');
    }
  }
  
  // Écouter les événements
  window.addEventListener('online', updateBanner);
  window.addEventListener('offline', updateBanner);
  window.addEventListener('sync:status', updateBanner);
  
  // Mettre à jour toutes les 5 secondes
  setInterval(updateBanner, 5000);
  updateBanner();
}

export default initOfflineBanner;
