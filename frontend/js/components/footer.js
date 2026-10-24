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
      <button type="button" id="footer-contact-btn" class="hover:text-white transition-colors">Contacter l'administration</button>
      <a href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">Contacter le développeur du site</a>
    </div>
  </div>
</footer>
<div id="contact-admin-modal" class="fixed inset-0 z-[70] hidden items-center justify-center">
  <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" id="contact-admin-backdrop"></div>
  <div class="relative w-[95%] max-w-lg bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
    <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
      <h3 class="text-base font-semibold text-white">Contacter l'administration</h3>
      <button type="button" id="contact-admin-close" class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <form id="contact-admin-form" class="p-5 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-xs text-slate-400 mb-1">Nom *</label><input name="lastName" required class="form-input w-full text-sm" /></div>
        <div><label class="block text-xs text-slate-400 mb-1">Prénom *</label><input name="firstName" required class="form-input w-full text-sm" /></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-xs text-slate-400 mb-1">Email *</label><input type="email" name="email" required class="form-input w-full text-sm" /></div>
        <div><label class="block text-xs text-slate-400 mb-1">Téléphone (facultatif)</label><input name="phone" class="form-input w-full text-sm" placeholder="+237..." /></div>
      </div>
      <div><label class="block text-xs text-slate-400 mb-1">Sujet *</label><input name="subject" required class="form-input w-full text-sm" placeholder="Problème de compréhension, question..." /></div>
      <div><label class="block text-xs text-slate-400 mb-1">Message *</label><textarea name="message" required rows="5" class="form-textarea w-full text-sm" placeholder="Décrivez votre problème ou votre question..."></textarea></div>
      <p class="text-[11px] text-slate-500">Les champs marqués * sont obligatoires.</p>
      <div class="flex items-center justify-end gap-2 pt-2">
        <button type="button" id="contact-admin-cancel" class="btn btn-secondary btn-sm">Annuler</button>
        <button type="submit" class="btn btn-primary btn-sm">Envoyer le message</button>
      </div>
    </form>
    <div id="contact-admin-success" class="hidden p-8 text-center">
      <div class="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
        <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      </div>
      <h4 class="text-white font-medium mb-1">Message envoyé</h4>
      <p class="text-sm text-slate-400 mb-4">Merci. L'administration a bien reçu votre message.</p>
      <button type="button" id="contact-admin-ok" class="btn btn-primary btn-sm">Fermer</button>
    </div>
  </div>
</div>
  `;
  const open = () => { const m = document.getElementById('contact-admin-modal'); m.classList.remove('hidden'); m.classList.add('flex'); document.getElementById('contact-admin-form').classList.remove('hidden'); document.getElementById('contact-admin-success').classList.add('hidden'); document.getElementById('contact-admin-form').reset(); };
  const close = () => { const m = document.getElementById('contact-admin-modal'); m.classList.add('hidden'); m.classList.remove('flex'); };
  document.getElementById('footer-contact-btn')?.addEventListener('click', open);
  document.getElementById('contact-admin-close')?.addEventListener('click', close);
  document.getElementById('contact-admin-cancel')?.addEventListener('click', close);
  document.getElementById('contact-admin-backdrop')?.addEventListener('click', close);
  document.getElementById('contact-admin-ok')?.addEventListener('click', close);
  document.getElementById('contact-admin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Envoi...';
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur lors de l'envoi");
      form.classList.add('hidden');
      document.getElementById('contact-admin-success').classList.remove('hidden');
    } catch (err) {
      alert(err.message || "Impossible d'envoyer le message");
    } finally {
      btn.disabled = false; btn.textContent = 'Envoyer le message';
    }
  });
}
mountFooter();
export default mountFooter;
