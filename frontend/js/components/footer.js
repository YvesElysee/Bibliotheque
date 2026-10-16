const WA_NUMBER = '237653814776';
const DEVELOPER = 'Mballa Yves Elysee';
const SITE_NAME = 'Bibliothèque Scolasticat Père Piariste';

function mountFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;
  const year = new Date().getFullYear();
  const isAdmin = window.location.pathname.includes('/admin/');
  const pagePrefix = isAdmin ? '../' : '';

  host.innerHTML = `
<footer class="w-full mt-16 border-t border-slate-800/60 bg-slate-950/60">
  <div class="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
    <div class="text-center md:text-left">
      <p class="text-xs text-slate-500">© ${year} ${SITE_NAME}. Tous droits réservés.</p>
    </div>
    <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-400">
      <a href="${pagePrefix}index.html" class="hover:text-white transition-colors">Catalogue</a>
      <a href="${pagePrefix}politique-utilisation.html" class="hover:text-white transition-colors">Politique d'utilisation</a>
      <a href="${pagePrefix}cgu.html" class="hover:text-white transition-colors">CGU</a>
      <a href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">
        Contacter le développeur du site
      </a>
    </div>
  </div>
</footer>
`;
}
mountFooter();
export default mountFooter;