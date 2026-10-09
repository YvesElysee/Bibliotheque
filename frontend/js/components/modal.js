/**
 * Composant Modal réutilisable
 */

let _activeModal = null;

export function createModal({ title, content, size = 'md', onClose }) {
  // Ferme le modal précédent s'il existe
  if (_activeModal) closeModal();

  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay animate-fade-in';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const box = document.createElement('div');
  box.className = `modal-box ${sizes[size] || sizes.md}`;

  box.innerHTML = `
    <div class="modal-header">
      <h2 class="text-xl font-serif font-semibold text-white">${title}</h2>
      <button id="modal-close-btn" class="btn-icon btn bg-slate-800 text-slate-400 hover:text-white" aria-label="Fermer">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div id="modal-content"></div>
  `;

  const contentEl = box.querySelector('#modal-content');
  if (typeof content === 'string') {
    contentEl.innerHTML = content;
  } else if (content instanceof Node) {
    contentEl.appendChild(content);
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const close = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s';
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
      _activeModal = null;
      onClose?.();
    }, 200);
  };

  overlay.querySelector('#modal-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  _activeModal = { overlay, close };
  return { close, contentEl };
}

export function closeModal() {
  if (_activeModal) _activeModal.close();
}

export default { createModal, closeModal };
