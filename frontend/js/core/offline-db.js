/**
 * IndexedDB avec Dexie - Cache hors-ligne pour Bibliothèque SPP
 * Stocke les données déjà consultées + file d'attente des actions
 */

import Dexie from 'https://unpkg.com/dexie@3.2.4/dist/modern/dexie.mjs';

export const db = new Dexie('BibliothequeSPP_Offline');

db.version(1).stores({
  // Cache des données GET
  books: 'id, title, author, isbn, categoryId, availableCopies, totalCopies, createdAt',
  users: 'id, email, role, firstName, lastName, createdAt',
  loans: 'id, bookId, userId, status, dueDate, borrowedAt, returnedAt',
  reservations: 'id, bookId, userId, status, createdAt',
  categories: 'id, name',
  messages: 'id, status, createdAt',
  stats: 'key',
  // File d'attente pour actions hors-ligne
  syncQueue: '++id, uuid, method, url, body, headers, createdAt, tries, status',
  // Métadonnées
  meta: 'key'
});

// Sauvegarder dans le cache avec timestamp
export async function cacheSet(store, data, key = null) {
  try {
    if (!Array.isArray(data)) {
      // Si c'est un objet unique ou avec data imbriqué
      const toStore = data?.data || data;
      if (Array.isArray(toStore)) {
        data = toStore;
      } else if (toStore && typeof toStore === 'object') {
        // Pour les objets uniques, on peut les stocker avec un id
        if (toStore.id) {
          await db[store].put({ ...toStore, _cachedAt: Date.now() });
          return;
        } else if (key) {
          await db.meta.put({ key: `cache:${store}:${key}`, value: toStore, _cachedAt: Date.now() });
          return;
        }
      }
    }
    
    if (Array.isArray(data)) {
      const items = data.map(item => ({ ...item, _cachedAt: Date.now() }));
      await db[store].bulkPut(items);
    }
  } catch (e) {
    console.warn('[OfflineDB] Erreur cacheSet:', e);
  }
}

// Récupérer depuis le cache
export async function cacheGet(store, query = {}) {
  try {
    if (query.id) {
      return await db[store].get(query.id);
    }
    if (query.all) {
      return await db[store].toArray();
    }
    if (query.where) {
      return await db[store].where(query.where.field).equals(query.where.value).toArray();
    }
    return await db[store].toArray();
  } catch (e) {
    console.warn('[OfflineDB] Erreur cacheGet:', e);
    return null;
  }
}

// Vider le cache d'un store
export async function cacheClear(store) {
  try {
    await db[store].clear();
  } catch (e) {
    console.warn('[OfflineDB] Erreur cacheClear:', e);
  }
}

// Ajouter à la file d'attente
export async function queueAdd(method, url, body = null) {
  try {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
    const entry = {
      uuid,
      method: method.toUpperCase(),
      url,
      body: body ? JSON.stringify(body) : null,
      createdAt: Date.now(),
      tries: 0,
      status: 'pending'
    };
    const id = await db.syncQueue.add(entry);
    console.log('[OfflineDB] Action mise en file d\'attente:', method, url);
    return { id, uuid };
  } catch (e) {
    console.warn('[OfflineDB] Erreur queueAdd:', e);
    throw e;
  }
}

// Récupérer la file d'attente
export async function queueGetPending() {
  try {
    return await db.syncQueue.where('status').equals('pending').sortBy('createdAt');
  } catch (e) {
    console.warn('[OfflineDB] Erreur queueGetPending:', e);
    return [];
  }
}

// Compter les actions en attente
export async function queueCount() {
  try {
    return await db.syncQueue.where('status').equals('pending').count();
  } catch (e) {
    return 0;
  }
}

// Supprimer une entrée de la file
export async function queueRemove(id) {
  try {
    await db.syncQueue.delete(id);
  } catch (e) {
    console.warn('[OfflineDB] Erreur queueRemove:', e);
  }
}

// Incrémenter les tentatives
export async function queueRetry(id, tries) {
  try {
    await db.syncQueue.update(id, { tries: tries + 1, lastTryAt: Date.now() });
  } catch (e) {
    console.warn('[OfflineDB] Erreur queueRetry:', e);
  }
}

// Obtenir métadonnées
export async function metaGet(key) {
  try {
    const item = await db.meta.get(key);
    return item ? item.value : null;
  } catch (e) {
    return null;
  }
}

// Sauvegarder métadonnées
export async function metaSet(key, value) {
  try {
    await db.meta.put({ key, value, _cachedAt: Date.now() });
  } catch (e) {
    console.warn('[OfflineDB] Erreur metaSet:', e);
  }
}

export default db;
