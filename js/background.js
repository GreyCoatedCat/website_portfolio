(() => {
  'use strict';
  const P = window.Portfolio, state = P.state, reduceMQ = P.reduceMQ;
  const { clamp } = P.util;

  /* ---------- Background field ----------
     Each section under the cover gets the cube lattice and a few lit cubes on its sides (always in the same
     places for a given layout), and the lattice drifts at a fraction of the scroll speed. */
  const LIT = '<svg viewBox="0 0 52 60" width="52" height="60"><path d="M26 0L52 15L26 30L0 15Z" fill-opacity=".42"/><path d="M0 15L26 30V60L0 45Z" fill-opacity=".24"/><path d="M26 30L52 15V45L26 60Z" fill-opacity=".12"/></svg>';
  const fields = [...document.querySelectorAll('.section')].map((sec, si) => {
    const f = document.createElement('div'), inner = document.createElement('div');
    f.className = 'bg-field'; f.setAttribute('aria-hidden', 'true');
    inner.className = 'bg-field-in';
    f.append(inner); sec.prepend(f);
    return { sec, inner, si, lit: [], w: 0, h: 0 };
  });
  function place(F) {
    const W = F.sec.clientWidth, H = F.sec.clientHeight;
    if (W === F.w && H === F.h) return;
    F.w = W; F.h = H;
    F.lit.forEach(n => n.remove()); F.lit = [];
    let seed = (F.si + 1) * 7919;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const n = Math.max(2, Math.min(5, Math.round(H / 520))), zone = Math.max(60, W * 0.12);
    for (let k = 0; k < n; k++) {
      // lattice cells: centres at (i * 52 + (row odd ? 26 : 0), row * 45), the field starting 260px above the section
      const row = Math.round((340 + rnd() * Math.max(0, H - 160)) / 45), off = row % 2 ? 26 : 0;
      const x = k % 2 === 0 ? rnd() * zone : W - rnd() * zone, col = Math.round((x - off) / 52);
      const el = document.createElement('div');
      el.className = 'bg-lit';
      el.style.left = (col * 52 + off - 26) + 'px';
      el.style.top = (row * 45 - 30) + 'px';
      el.style.animationDelay = (-rnd() * 9).toFixed(2) + 's';
      el.innerHTML = LIT;
      F.inner.append(el); F.lit.push(el);
    }
  }
  // drifting is a desktop nicety; on phones the field stays still and costs nothing while scrolling
  const canDrift = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  document.documentElement.classList.toggle('has-drift', canDrift);
  let queued = false;
  function drift() {
    queued = false;
    if (!canDrift) return;
    const vh = window.innerHeight;
    for (const F of fields) {
      const r = F.sec.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      const y = state.motion ? clamp(-(r.top + r.height / 2 - vh / 2) * 0.12, -230, 230) : 0;
      F.inner.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    }
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(drift); } };
  const sro = new ResizeObserver(entries => {
    for (const e of entries) { const F = fields.find(x => x.sec === e.target); if (F) place(F); }
    queue();
  });
  fields.forEach(F => { place(F); sro.observe(F.sec); });
  window.addEventListener('scroll', queue, { passive: true });
  reduceMQ.addEventListener('change', queue);
  queue();
})();
