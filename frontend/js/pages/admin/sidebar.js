/**
 * Menu latéral de l'administration — comportement « tiroir » sur mobile.
 * Sur PC (≥ 1024px), la sidebar reste fixe et ce script ne fait rien de visible.
 */
function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !toggle) return;

  const isMobile = () => window.innerWidth < 1024;

  const open = () => {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
    toggle.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => (sidebar.classList.contains('open') ? close() : open()));
  if (backdrop) backdrop.addEventListener('click', close);

  // Fermer le tiroir après avoir choisi une section (mobile uniquement)
  sidebar.addEventListener('click', (e) => {
    if (isMobile() && e.target.closest('.sidebar-item')) close();
  });

  // Revenir à l'état normal si on repasse sur grand écran
  window.addEventListener('resize', () => {
    if (!isMobile()) close();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}
