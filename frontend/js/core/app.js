
// Initialisation mode hors-ligne
import('../components/offline-banner.js').then(m => {
  if (m.initOfflineBanner) m.initOfflineBanner();
}).catch(()=>{});

import('../core/sync-manager.js').then(m => {
  if (m.syncManager) m.syncManager.init();
}).catch(()=>{});
