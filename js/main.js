/* Page controller: starts the two canvas scenes, the opening shot, the hero name and scroll, the About cube,
   the menu, the interface toggle and the loading screen. */
(() => {
  'use strict';
  const P = window.Portfolio, state = P.state, reduceMQ = P.reduceMQ;
  const { clamp, frameTime, frameDt } = P.util;
  const { Corridor, City } = P;

  /* ---------- Scenes ---------- */
  const hero = document.querySelector('.hero');
  const heroName = document.querySelector('.hero-name');
  const cue = document.querySelector('.scroll-cue');
  const scenes = [];

  const heroCanvas = hero.querySelector('.corridor');
  const heroC = new Corridor(heroCanvas, { seed: 3, vp: [0.5, 0.42], vignette: false, jumper: true, intro: state.motion });
  if (state.motion) document.documentElement.classList.add('intro-pre');
  scenes.push({ el: heroCanvas, c: heroC, visible: true });

  const cityEl = document.querySelector('.city');
  const cityCanvas = cityEl.querySelector('canvas');
  const city = new City(cityCanvas);
  scenes.push({ el: cityCanvas, c: city, visible: false });

  const cubeScene = document.querySelector('.cube-scene');
  let cubeVisible = false;

  function sync() {
    const covered = document.documentElement.classList.contains('menu-open');
    for (const s of scenes) {
      if (state.motion && s.visible && !document.hidden && !covered) s.c.start(); else s.c.stop();
    }
    if (state.motion && cubeVisible && !document.hidden) startCube(); else stopCube();
  }

  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const s = scenes.find(x => x.el === e.target);
      if (s) s.visible = e.isIntersecting;
      if (e.target === cubeScene) cubeVisible = e.isIntersecting;
    }
    sync();
  }, { rootMargin: '80px' });
  const ro = new ResizeObserver(entries => {
    for (const e of entries) { const s = scenes.find(x => x.el === e.target); if (s) s.c.resize(); }
  });
  scenes.forEach(s => { io.observe(s.el); ro.observe(s.el); });
  io.observe(cubeScene);
  document.addEventListener('visibilitychange', sync);

  function steer(el, c) {
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      c.pointer(px / r.width * 2 - 1, py / r.height * 2 - 1, px, py);
    });
  }
  steer(hero, heroC);

  /* The jumper can be picked up. With a mouse: click it and it floats after the pointer, click again anywhere
     and it hops back onto a block. On touch: tap it, tap where it should fly, tap it again to let go.
     The pointer turns into a hand over it, so it reads as something to grab. */
  const heroCanvasBox = () => heroCanvas.getBoundingClientRect();
  let pokedAt = -1e9;
  hero.addEventListener('pointerdown', e => {
    if (!state.motion || e.button > 0 || e.target.closest('a, button')) return;
    const r = heroCanvasBox();
    if (heroC.poke(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'touch')) {
      pokedAt = performance.now();
      hero.classList.toggle('is-carrying', heroC.carrying);
    }
  });
  hero.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !state.motion) return;
    const r = heroCanvasBox();
    hero.classList.toggle('can-grab', !heroC.carrying && heroC.over(e.clientX - r.left, e.clientY - r.top));
  });
  function dropJumper() {
    if (!heroC.carrying) return;
    heroC.letGo();
    hero.classList.remove('is-carrying');
  }

  /* City: drag sideways to turn it (it settles on the nearest corner view), or use the buttons */
  let cityDrag = null;
  cityEl.addEventListener('pointerdown', e => {
    cityDrag = { x: e.clientX, yaw: city.yawGoal };
    cityEl.setPointerCapture(e.pointerId);
    cityEl.classList.add('is-dragging');
  });
  cityEl.addEventListener('pointermove', e => {
    if (cityDrag) { city.setYaw(cityDrag.yaw + (e.clientX - cityDrag.x) * 0.012); return; }
    if (e.pointerType === 'touch') return;
    const r = cityEl.getBoundingClientRect();
    city.hover((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1);
  });
  const endCityDrag = () => {
    if (!cityDrag) return;
    cityDrag = null; cityEl.classList.remove('is-dragging');
    city.setYaw(city.snap(city.yawGoal));
  };
  cityEl.addEventListener('pointerup', endCityDrag);
  cityEl.addEventListener('pointercancel', endCityDrag);
  cityEl.addEventListener('pointerleave', () => { if (!cityDrag) city.hover(0, 0); });
  document.querySelectorAll('.turn').forEach(btn => btn.addEventListener('click', () => city.turn(Number(btn.dataset.turn))));

  /* The name runs edge to edge on one line on wider screens */
  const heroFit = heroName.querySelector('.hero-fit');
  // split into letters for the opening reveal; screen readers get the plain name
  (() => {
    const text = heroFit.textContent, chunks = text.split(' ');
    const total = text.replace(/[\s\u00a0]/g, '').length, mid = (total - 1) / 2;
    let n = 0;
    const sr = document.createElement('span');
    sr.className = 'sr-only'; sr.textContent = text.replace(/\u00a0/g, ' ');
    heroFit.textContent = '';
    heroFit.setAttribute('aria-hidden', 'true');
    chunks.forEach((chunk, ci) => {
      if (ci) heroFit.append(' ');
      const w = document.createElement('span');
      w.className = 'w';
      for (const c of chunk) {
        if (c === '\u00a0') { w.append('\u00a0'); continue; }
        const ch = document.createElement('span');
        ch.className = 'ch'; ch.textContent = c;
        ch.style.setProperty('--d', (Math.abs(n - mid) / mid * 0.9).toFixed(3) + 's');
        w.append(ch); n++;
      }
      heroFit.append(w);
    });
    heroName.insertBefore(sr, heroFit);
  })();
  function fitName() {
    if (window.innerWidth <= 520) { heroName.style.fontSize = ''; return; }
    heroName.style.fontSize = '100px';
    const avail = heroName.clientWidth, used = heroFit.offsetWidth;
    if (avail > 0 && used > 0) heroName.style.fontSize = Math.min(220, (100 * avail) / used * 0.99).toFixed(1) + 'px';
  }
  fitName();
  new ResizeObserver(fitName).observe(hero);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);

  /* Scroll: move a little deeper into the corridor and pass through the name */
  let ticking = false;
  function applyScroll() {
    ticking = false;
    const p = clamp(window.scrollY / hero.offsetHeight, 0, 1);
    if (p > 0.3) dropJumper(); // leaving the corridor puts it back
    cue.style.opacity = String(clamp(1 - p * 4, 0, 1));
    cue.style.visibility = p > 0.3 ? 'hidden' : 'visible';
    if (!state.motion) return;
    heroC.scroll(p);
    heroName.style.transform = 'scale(' + (1 + p * 0.45).toFixed(4) + ')';
    heroName.style.opacity = String(clamp(1 - p * 1.6, 0, 1));
    heroCanvas.style.opacity = String(clamp(1 - p * 0.95, 0.05, 1).toFixed(3));
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); } }, { passive: true });


  /* ---------- About cube ---------- */
  const cubeEl = cubeScene.querySelector('.cube');
  let rx = -22, ry = 38, drag = null, cubeRaf = 0, cubePrev = 0, cubeOn = false;
  const setCube = () => { cubeEl.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)'; };
  function cubeLoop(now) {
    const t = frameTime(now), dt = frameDt(t, cubePrev); cubePrev = t;
    if (!drag) { ry += dt * 9; setCube(); }
    cubeRaf = requestAnimationFrame(cubeLoop);
  }
  function startCube() { if (cubeOn) return; cubeOn = true; cubePrev = performance.now(); cubeRaf = requestAnimationFrame(cubeLoop); }
  function stopCube() { cubeOn = false; cancelAnimationFrame(cubeRaf); }
  cubeScene.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY };
    cubeScene.setPointerCapture(e.pointerId);
    cubeScene.classList.add('is-dragging');
  });
  cubeScene.addEventListener('pointermove', e => {
    if (!drag) return;
    ry += (e.clientX - drag.x) * 0.45;
    rx = clamp(rx - (e.clientY - drag.y) * 0.45, -85, 85);
    drag.x = e.clientX; drag.y = e.clientY;
    setCube();
  });
  const endDrag = () => { drag = null; cubeScene.classList.remove('is-dragging'); };
  cubeScene.addEventListener('pointerup', endDrag);
  cubeScene.addEventListener('pointercancel', endDrag);

  // nothing animates behind the open menu
  document.addEventListener('menu:toggle', sync);

  /* ---------- Work tiles: a cover whose project has a page opens it when clicked ---------- */
  document.querySelectorAll('.work .tile').forEach(tile => {
    const link = tile.querySelector('.tile-link'), cover = tile.querySelector('.cover');
    const href = link && link.getAttribute('href');
    if (!cover || !href || href === '#') return;
    cover.classList.add('is-link');
    cover.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) window.open(link.href, '_blank', 'noopener');
      else window.location.href = link.href;
    });
  });

  /* ---------- Hide HUD ----------
     The eye hides itself along with everything else. Click the corridor, press H or Escape,
     or scroll down to bring the interface back. */
  const hudBtn = document.querySelector('.hud-btn');
  const hudStatus = document.getElementById('hud-status');
  let hudOff = false;
  hero.setAttribute('tabindex', '-1');
  function setHud(off, how) {
    if (off === hudOff) return;
    hudOff = off;
    document.documentElement.classList.toggle('hud-off', off);
    hudStatus.textContent = off ? 'Interface hidden. Click the corridor, or press H or Escape, to show it again.' : 'Interface shown.';
    if (!heroC.running) heroC.draw();
    if (off && how === 'button') hero.focus({ preventScroll: true });
    if (!off && how === 'key') hudBtn.focus({ preventScroll: true });
  }
  hudBtn.addEventListener('click', () => setHud(true, 'button'));
  hero.addEventListener('click', e => {
    if (performance.now() - pokedAt < 600) return; // that click picked up or let go of the jumper
    if (hudOff && !e.target.closest('a, button')) setHud(false, 'click');
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.documentElement.classList.contains('menu-open')) return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'Escape' && heroC.carrying) { dropJumper(); return; }
    if (e.key === 'Escape' && hudOff) { setHud(false, 'key'); return; }
    if ((e.key === 'h' || e.key === 'H') && window.scrollY < hero.offsetHeight * 0.5) setHud(!hudOff, 'key');
  });
  function hudScroll() {
    const past = window.scrollY > hero.offsetHeight * 0.5;
    document.documentElement.classList.toggle('past-hero', past);
    if (hudOff && window.scrollY > hero.offsetHeight * 0.35) setHud(false, 'scroll'); // leaving the corridor brings it back
  }
  window.addEventListener('scroll', hudScroll, { passive: true });
  hudScroll();

  /* ---------- Loading screen: lift it once fonts, the page and the first corridor frames are ready ---------- */
  (() => {
    const loader = document.querySelector('.loader');
    const html = document.documentElement;
    const started = performance.now();
    const ready = Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve(),
      new Promise(r => { if (document.readyState === 'complete') r(); else window.addEventListener('load', r, { once: true }); }),
      new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
    ]);
    Promise.race([ready, new Promise(r => setTimeout(r, 5000))]).then(() => {
      // stay up long enough to read as a moment rather than a flicker
      setTimeout(() => {
        fitName();
        html.classList.add('is-loaded');
        html.classList.remove('is-loading');
        loader.setAttribute('aria-hidden', 'true');
        setTimeout(() => loader.remove(), 700);
        playOpening();
      }, Math.max(0, 650 - (performance.now() - started)));
    });
  })();

  /* ---------- Opening shot ----------
     Light comes up from the far end while the camera glides in, the jumper pops into the middle,
     the name resolves letter by letter from the centre, the film bars open, then the interface. */
  let opened = false;
  function endOpening() {
    opened = true;
    document.documentElement.classList.remove('intro-pre', 'name-in', 'bars-out', 'ui-in', 'intro-fast');
  }
  function playOpening() {
    if (opened) return;
    opened = true;
    const html = document.documentElement;
    if (!state.motion || !html.classList.contains('intro-pre') || window.scrollY > hero.offsetHeight * 0.3) {
      heroC.skipIntro(); endOpening(); return;
    }
    heroC.playIntro();
    const timers = [], at = (ms, fn) => timers.push(setTimeout(fn, ms));
    at(3500, () => html.classList.add('name-in'));
    at(5600, () => html.classList.add('bars-out'));
    at(6300, () => html.classList.add('ui-in'));
    at(8200, finish);
    // scrolling on wraps the opening up at once, so the menu is never missing further down
    function onScroll() {
      if (window.scrollY < 40) return;
      timers.forEach(clearTimeout);
      html.classList.add('intro-fast', 'name-in', 'bars-out', 'ui-in');
      setTimeout(finish, 800);
      window.removeEventListener('scroll', onScroll);
    }
    function finish() { window.removeEventListener('scroll', onScroll); endOpening(); }
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  // if anything holds the loading screen up for too long, never leave the hero dark
  setTimeout(() => { if (!opened) { heroC.skipIntro(); endOpening(); } }, 9000);

  /* ---------- Motion follows the system's reduced-motion setting ---------- */
  function setMotion(on) { state.motion = on; sync(); }
  reduceMQ.addEventListener('change', e => setMotion(!e.matches));
  setMotion(state.motion);
})();
