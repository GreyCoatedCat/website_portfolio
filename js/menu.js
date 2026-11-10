/* The menu overlay, on every page. Announces each open and close as a 'menu:toggle' event on document. */
(() => {
  'use strict';
  const root = document.documentElement;
  const menuBtn = document.querySelector('.menu-btn');
  const menuLabel = menuBtn.querySelector('.menu-label');
  const menu = document.getElementById('menu');
  const mainEl = document.querySelector('main');
  function setMenu(open, restoreFocus) {
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menuLabel.textContent = open ? 'Close' : 'Menu';
    mainEl.inert = open;
    root.style.overflow = open ? 'hidden' : '';
    // other scripts react to this: the home page pauses its scenes, the cursor cube shows or hides
    document.dispatchEvent(new CustomEvent('menu:toggle', { detail: { open } }));
    if (open) { const first = menu.querySelector('a'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 60); }
    else if (restoreFocus) menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', () => setMenu(!root.classList.contains('menu-open'), true));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false, false)));
  menu.addEventListener('click', e => { if (!e.target.closest('a')) setMenu(false, true); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('menu-open')) setMenu(false, true); });
  setMenu(false, false);
})();
