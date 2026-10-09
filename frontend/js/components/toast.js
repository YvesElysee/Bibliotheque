/**
 * Système de notifications toast (UI).
 */

let _container = null;

const _getContainer = () => {
  if (!_container) {
    _container = document.createElement('div');
    _container.className = 'toast-container';
    _container.setAttribute('aria-live', 'polite');
    document.body.appendChild(_container);
  }
  return _container;
};

const ICONS = {
  success: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
  error: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
  info: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  warning: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
};

const show = (message, type = 'info', duration = 4000) => {
  const container = _getContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    ${ICONS[type] || ICONS.info}
    <p class="flex-1 text-sm leading-snug">${message}</p>
    <button class="shrink-0 opacity-60 hover:opacity-100 transition-opacity" aria-label="Fermer">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;

  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => toast.remove(), 200);
  };

  toast.querySelector('button').addEventListener('click', dismiss);
  container.appendChild(toast);

  if (duration > 0) setTimeout(dismiss, duration);

  return { dismiss };
};

export const toast = {
  success: (msg, d) => show(msg, 'success', d),
  error: (msg, d) => show(msg, 'error', d),
  info: (msg, d) => show(msg, 'info', d),
  warning: (msg, d) => show(msg, 'warning', d),
};

export default toast;
