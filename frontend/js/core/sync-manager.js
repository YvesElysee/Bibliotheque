/**
 * Sync Manager - Synchronisation automatique hors-ligne
 * Rejoue les actions en file d'attente au retour du réseau
 */

import { queueGetPending, queueRemove, queueRetry, queueCount, cacheSet } from './offline-db.js';
import { API_BASE } from './api.js';

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.listeners = [];
  }

  init() {
    // Écouter le retour en ligne
    window.addEventListener('online', () => {
      console.log('[SyncManager] Réseau rétabli - démarrage synchronisation');
      this.sync();
    });

    // Écouter les changements de connexion
    window.addEventListener('offline', () => {
      console.log('[SyncManager] Mode hors-ligne');
      this.notify('offline');
    });

    // Tenter une synchro au démarrage si en ligne
    if (navigator.onLine) {
      setTimeout(() => this.sync(), 2000);
    }

    // Vérifier périodiquement
    setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.sync();
      }
    }, 30000);
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify(status, data = {}) {
    this.listeners.forEach(cb => {
      try { cb({ status, online: navigator.onLine, ...data }); } catch(e) {}
    });
    // Événement global
    window.dispatchEvent(new CustomEvent('sync:status', { detail: { status, online: navigator.onLine, ...data } }));
  }

  async sync() {
    if (this.isSyncing || !navigator.onLine) return;
    
    const pending = await queueGetPending();
    if (pending.length === 0) {
      this.notify('idle');
      return;
    }

    this.isSyncing = true;
    this.notify('syncing', { count: pending.length });

    let success = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        const body = item.body ? JSON.parse(item.body) : undefined;
        
        const res = await fetch(`${API_BASE}${item.url}`, {
          method: item.method,
          headers,
          credentials: 'include',
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        if (res.ok) {
          await queueRemove(item.id);
          success++;
          console.log('[SyncManager] Action synchronisée:', item.method, item.url);
        } else if (res.status === 401 || res.status === 403) {
          // Session expirée - arrêter et demander reconnexion
          console.warn('[SyncManager] Session expirée lors de la synchronisation');
          this.notify('auth-error');
          break;
        } else {
          // Autre erreur - incrémenter tentatives
          await queueRetry(item.id, item.tries);
          failed++;
          console.warn('[SyncManager] Échec synchronisation:', item.method, item.url, res.status);
        }
      } catch (e) {
        // Erreur réseau
        await queueRetry(item.id, item.tries);
        failed++;
        console.warn('[SyncManager] Erreur réseau:', e.message);
        // Si erreur réseau, on arrête et réessaiera plus tard
        if (e.name === 'TypeError') break;
      }
    }

    this.isSyncing = false;
    
    const remaining = await queueCount();
    
    if (success > 0) {
      this.notify('synced', { success, failed, remaining });
      // Rafraîchir les données après synchronisation
      window.dispatchEvent(new CustomEvent('data:refresh'));
    } else if (remaining > 0) {
      this.notify('pending', { remaining });
    } else {
      this.notify('idle');
    }
  }

  async getPendingCount() {
    return await queueCount();
  }
}

export const syncManager = new SyncManager();
export default syncManager;
