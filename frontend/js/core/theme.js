// Système de thème Clair/Sombre
(function() {
  const storageKey = 'bibliotheque-theme';
  const root = document.documentElement;
  const apply = (theme) => {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(storageKey, theme); } catch(e) {}
  };
  const saved = (() => { try { return localStorage.getItem(storageKey); } catch(e) { return null; } })();
  apply(saved === 'light' ? 'light' : 'dark');

  function mount() {
    // Injecte bouton installer PWA dans navbar
    const navUser = document.getElementById('nav-user');
    if (navUser && !document.getElementById('pwa-install-btn')) {
      const installBtn = document.createElement('button');
      installBtn.id = 'pwa-install-btn';
      installBtn.type = 'button';
      installBtn.className = 'hidden ml-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors text-sm items-center gap-1.5';
      installBtn.title = "Installer l'application sur cet appareil";
      installBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg><span class="hidden md:inline">Installer l'app</span>`;
      if (navUser.parentElement) {
        navUser.parentElement.insertBefore(installBtn, navUser);
      }
    }

    // Injecte bouton dans navbar
    if (navUser && !document.getElementById('theme-toggle-btn')) {
      const btn = document.createElement('button');
      btn.id = 'theme-toggle-btn';
      btn.type = 'button';
      btn.className = 'ml-2 p-2 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors';
      btn.title = 'Basculer entre mode clair et sombre';
      btn.innerHTML = `<svg class="w-5 h-5 theme-icon-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg><svg class="w-5 h-5 theme-icon-light hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
      navUser.parentElement.insertBefore(btn, navUser);
      btn.addEventListener('click', () => {
        const cur = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        apply(cur === 'light' ? 'dark' : 'light');
        update();
      });
    }
    // Admin
    const adminSide = document.querySelector('.admin-sidebar');
    if (adminSide && !document.getElementById('theme-toggle-admin')) {
      const div = document.createElement('div');
      div.className = 'px-4 mb-3';
      div.innerHTML = `<button id="theme-toggle-admin" type="button" class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800/60"><svg class="w-4 h-4 theme-icon-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg><svg class="w-4 h-4 theme-icon-light hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg><span class="theme-label">Mode clair</span></button>`;
      const nav = adminSide.querySelector('nav');
      if (nav) nav.after(div);
      div.querySelector('button').addEventListener('click', () => {
        const cur = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        apply(cur === 'light' ? 'dark' : 'light');
        update();
      });
    }
    update();
  }
  function update() {
    const isLight = root.getAttribute('data-theme') === 'light';
    document.querySelectorAll('.theme-icon-dark').forEach((e) => e.classList.toggle('hidden', isLight));
    document.querySelectorAll('.theme-icon-light').forEach((e) => e.classList.toggle('hidden', !isLight));
    document.querySelectorAll('.theme-label').forEach((e) => e.textContent = isLight ? 'Mode sombre' : 'Mode clair');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
