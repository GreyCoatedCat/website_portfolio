(() => {
  'use strict';
  const P = window.Portfolio, state = P.state, reduceMQ = P.reduceMQ;

  /* ---------- Section entrances ----------
     Headings get the block that pops, stretches, uncovers the words and folds away; content rises in order,
     a beat after its heading when they arrive together. Anything that leaves the screen entirely resets, so
     scrolling back plays it again; content then comes down from above, the way you are travelling. */
  if (!state.motion || !('IntersectionObserver' in window)) return;
  const html = document.documentElement;
  html.classList.add('reveal-on');
  // if reduced motion is switched on later, just show whatever hasn't played yet
  reduceMQ.addEventListener('change', e => { if (e.matches) html.classList.remove('reveal-on'); });
  for (const h of document.querySelectorAll('.section .sec-head h2, .section .sec-head h1, .section .sub-h')) {
    const rv = document.createElement('span'), txt = document.createElement('span'), blk = document.createElement('span');
    rv.className = 'rv'; txt.className = 'rv-text'; blk.className = 'rv-block';
    blk.setAttribute('aria-hidden', 'true');
    while (h.firstChild) txt.append(h.firstChild);
    rv.append(txt, blk); h.append(rv);
  }
  const ups = [...document.querySelectorAll('.about-grid > *, .xp-item, .work .tile, .rows li, .legend, .skill-group, .cred-list li, .links li, .city-wrap, [data-reveal]')];
  ups.forEach(el => el.classList.add('rv-up'));
  let lastHead = -1e9;
  const shown = new Set();
  const io = new IntersectionObserver(entries => {
    const now = performance.now();
    const hits = entries.filter(e => e.isIntersecting && !shown.has(e.target)).map(e => e.target)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    let n = 0;
    for (const el of hits) {
      shown.add(el);
      if (el.classList.contains('rv')) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sq', Math.min(1, r.height / Math.max(1, r.width)).toFixed(4));
        el.classList.add('in'); lastHead = now;
        const head = el.closest('.sec-head');
        if (head) head.classList.add('in');
        continue;
      }
      const base = now - lastHead < 450 ? 0.4 : 0;
      el.style.setProperty('--rv-d', (base + Math.min(n++, 6) * 0.08).toFixed(2) + 's');
      el.classList.add('in');
      // once it has landed, drop the reveal styles so nothing lingers on the element
      el.addEventListener('transitionend', function done(e) {
        if (e.target !== el || e.propertyName !== 'transform') return;
        el.removeEventListener('transitionend', done);
        el.classList.remove('rv-up', 'in');
        el.style.removeProperty('--rv-d');
      });
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  // once something is fully off screen (with a margin, so nothing flickers at the edge), set it back
  const away = new IntersectionObserver(entries => {
    for (const e of entries) {
      const el = e.target;
      if (e.isIntersecting || !shown.has(el)) continue;
      shown.delete(el);
      if (el.classList.contains('rv')) {
        el.classList.remove('in');
        const head = el.closest('.sec-head');
        if (head) head.classList.remove('in');
      } else {
        // it comes back from the side it left by
        el.style.setProperty('--rv-y', e.boundingClientRect.bottom < 0 ? '-24px' : '24px');
        el.style.removeProperty('--rv-d');
        el.classList.remove('in');
        el.classList.add('rv-up');
      }
    }
  }, { threshold: 0, rootMargin: '80px 0px 80px 0px' });
  for (const el of [...document.querySelectorAll('.rv'), ...ups]) { io.observe(el); away.observe(el); }
})();
