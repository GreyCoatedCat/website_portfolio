(() => {
  'use strict';
  const { clamp, frameTime, frameDt } = Portfolio.util;
  const reduceMQ = Portfolio.reduceMQ;
  const hero = document.querySelector('.hero');

  /* ---------- Cursor cube ----------
     While the pointer moves, a wireframe cube follows it and the solid cube stays where it last rested.
     Once the pointer has been still for a moment, the solid cube stretches out to it as a beam, its tail
     catches up, and it closes back into a cube inside the wireframe, which fades.
     Over a menu item it docks onto the item as a level block.
     Over a work cover or a skill tile it slides in behind the card and becomes the body of a
     cube whose front face is the card: the card tips toward the pointer and the cube's sides
     show past its edges. */
  const cursor = document.querySelector('.cursor');
  const cursorDir = cursor.querySelector('.cursor-dir');
  const cursorCube = cursor.querySelector('.cursor-cube');
  const UNIT = 22, TILT_MAX = 22;
  const DOCK = '.menu-btn, .back, .menu-list a, .links a, .turn, .soc, .scroll-cue, .tile-link, .row-link, .cred-link';
  const BACK = '.cover, .skill';
  const C = {
    tx: 0, ty: 0, x: 0, y: 0, px: 0, py: 0,
    k: 1, kv: 0, sx: 1, sy: 1, sz: 1, a: -28, b: 40, th: 0, tz: 0,
    dock: null, back: false, raf: 0, last: 0, on: false, moveT: 0, anim: null,
  };
  const REST = 240; // ms the pointer must stay still before the cube moves
  // the wireframe that trails the pointer
  const wire = document.createElement('div');
  wire.className = 'cursor-wire'; wire.setAttribute('aria-hidden', 'true');
  wire.innerHTML = '<div class="cursor-wire-cube"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  cursor.after(wire);
  const wireCube = wire.firstChild;
  const W = { x: 0, y: 0, op: 0, r: 40 };
  const io = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
  // Text links get a block hugging their words; the mark and buttons get covered exactly;
  // cards get a cube body exactly their size, as deep as they are wide.
  function dockRect(el) {
    if (el.matches('.menu-list a, .links a, .tile-link, .row-link, .cred-link')) {
      const range = document.createRange();
      range.selectNodeContents(el.querySelector('.menu-word') || el);
      const r = range.getBoundingClientRect();
      if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width + 18, h: r.height + 10 };
    }
    const r = el.getBoundingClientRect();
    if (el.matches(BACK)) {
      // use the untransformed size: a tilted tile's bounding box grows a little
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: el.offsetWidth, h: el.offsetHeight, body: true };
    }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }
  // Card tilt, eased per card so a card you leave settles back while the next one tips.
  const TILT = new Map();
  function updateTilts(ease, cur, trx, tryy) {
    if (cur && !TILT.has(cur)) { TILT.set(cur, { rx: 0, ry: 0 }); cur.classList.add('is-lifted'); }
    const k = ease(14);
    let busy = false;
    for (const [el, t] of TILT) {
      const isCur = el === cur, gx = isCur ? trx : 0, gy = isCur ? tryy : 0;
      t.rx += (gx - t.rx) * k; t.ry += (gy - t.ry) * k;
      if (!isCur) {
        el.classList.remove('is-lifted');
        if (Math.abs(t.rx) < 0.02 && Math.abs(t.ry) < 0.02) {
          el.style.removeProperty('--rx'); el.style.removeProperty('--ry');
          TILT.delete(el); continue;
        }
      }
      el.style.setProperty('--rx', t.rx.toFixed(2) + 'deg');
      el.style.setProperty('--ry', t.ry.toFixed(2) + 'deg');
      if (!isCur || Math.abs(gx - t.rx) > 0.02 || Math.abs(gy - t.ry) > 0.02) busy = true;
    }
    return busy;
  }
  function cursorTick(now) {
    const t = frameTime(now), dt = C.last ? Math.max(frameDt(t, C.last), 0.001) : 0.016;
    C.last = t;
    const ease = r => 1 - Math.exp(-dt * r);
    const docked = !!(C.dock && C.dock.isConnected);
    const body = docked && C.back;
    let gx = C.tx, gy = C.ty, gsx, gsy, gsz, ga, gb, gth = C.th, gtz = 0, trx = 0, tryy = 0;
    if (docked) {
      const d = dockRect(C.dock);
      gx = d.x; gy = d.y;
      C.k += (1 - C.k) * ease(10); C.kv = 0;
      gth = Math.round(C.th / Math.PI) * Math.PI;
      C.th += (gth - C.th) * ease(16);
      if (d.body) {
        // tilt toward the pointer, the same way the card itself tilts
        trx = -clamp((C.ty - (d.y - d.h / 2)) / d.h - 0.5, -0.5, 0.5) * TILT_MAX;
        tryy = clamp((C.tx - (d.x - d.w / 2)) / d.w - 0.5, -0.5, 0.5) * TILT_MAX;
        gsx = (d.w - 2) / UNIT; gsy = (d.h - 2) / UNIT; gsz = Math.min(d.w, d.h) / UNIT;
        gtz = -(UNIT / 2) * gsz; // put the front face on the card's plane, the body behind it
      } else {
        gsx = d.w / UNIT; gsy = d.h / UNIT; gsz = 10 / UNIT; ga = -14; gb = 0;
      }
    }
    const tiltBusy = updateTilts(ease, body ? C.dock : null, trx, tryy);
    if (body) {
      // a half turn in the plane mirrors the tilt axes, so undo that
      const t0 = TILT.get(C.dock), sg = Math.cos(gth) >= 0 ? 1 : -1;
      ga = t0.rx * sg; gb = t0.ry * sg;
    }
    const free = !docked && !reduceMQ.matches, clock = performance.now();
    let beam = false;
    if (docked || !free) {
      C.anim = null;
      const kp = reduceMQ.matches && !docked ? 1 : ease(docked ? 18 : 12);
      C.x += (gx - C.x) * kp; C.y += (gy - C.y) * kp;
      if (!docked) { gsx = gsy = gsz = 1; ga = -28; gb = 40; }
    } else {
      // the pointer has rested away from the cube: stretch across to it
      const far = Math.hypot(C.tx - C.x, C.ty - C.y);
      if (!C.anim && far > 3 && clock - C.moveT > REST) {
        C.anim = { x0: C.x, y0: C.y, x1: C.tx, y1: C.ty, t0: clock, dur: clamp(240 + far * 0.45, 300, 620) };
      }
      if (C.anim) {
        const A = C.anim, p = clamp((clock - A.t0) / A.dur, 0, 1);
        // the head reaches out first, then the tail follows it in
        const hd = io(clamp(p / 0.55, 0, 1)), tl = io(clamp((p - 0.45) / 0.55, 0, 1));
        const dx = A.x1 - A.x0, dy = A.y1 - A.y0, len = Math.hypot(dx, dy) * (hd - tl), k = 1 + len / UNIT;
        C.x = A.x0 + dx * (hd + tl) / 2; C.y = A.y0 + dy * (hd + tl) / 2;
        C.sx = k; C.sy = C.sz = Math.max(0.5, Math.pow(k, -0.25)); C.k = k; C.kv = 0; // a block, a little slimmer as it stretches
        C.th = Math.atan2(dy, dx); C.a = -28; C.b = 40 / k;
        beam = true;
        if (p >= 1) { C.anim = null; C.x = A.x1; C.y = A.y1; beam = false; }
      }
      // at rest it turns back to the usual three-quarter view
      gsx = gsy = gsz = 1; ga = -28; gb = 40;
      if (!C.anim) { gth = Math.round(C.th / Math.PI) * Math.PI; C.th += (gth - C.th) * ease(12); }
      gx = C.x; gy = C.y;
    }
    C.px = C.x; C.py = C.y;
    if (!beam) {
      const km = ease(docked ? 16 : 30), ka = body ? ease(40) : km;
      C.sx += (gsx - C.sx) * km; C.sy += (gsy - C.sy) * km; C.sz += (gsz - C.sz) * km;
      C.a += (ga - C.a) * ka; C.b += (gb - C.b) * ka; C.tz += (gtz - C.tz) * km;
    }
    // the wireframe: close on the pointer, shown while the solid cube is elsewhere or on its way
    const showWire = free && C.on && !cursorHidden && (!!C.anim || Math.hypot(C.tx - C.x, C.ty - C.y) > 3);
    W.op += ((showWire ? 1 : 0) - W.op) * ease(showWire ? 20 : 9);
    const kw = ease(30);
    W.x += (C.tx - W.x) * kw; W.y += (C.ty - W.y) * kw;
    if (W.op > 0.01) W.r += dt * 50;
    wire.style.opacity = W.op.toFixed(3);
    wire.style.transform = 'translate3d(' + W.x.toFixed(1) + 'px,' + W.y.toFixed(1) + 'px,0)';
    wireCube.style.transform = 'rotateX(-28deg) rotateY(' + W.r.toFixed(1) + 'deg)';
    cursor.style.transform = 'translate3d(' + C.x.toFixed(1) + 'px,' + C.y.toFixed(1) + 'px,0)';
    cursorDir.style.transform = 'rotateZ(' + C.th.toFixed(4) + 'rad)';
    cursorCube.style.transform = 'rotateX(' + C.a.toFixed(2) + 'deg) rotateY(' + C.b.toFixed(2) + 'deg) translateZ(' +
      C.tz.toFixed(2) + 'px) scale3d(' + C.sx.toFixed(3) + ',' + C.sy.toFixed(3) + ',' + C.sz.toFixed(3) + ')';
    const settled = !tiltBusy && Math.abs(gx - C.x) < 0.15 && Math.abs(gy - C.y) < 0.15 &&
      Math.abs(gsx - C.sx) < 0.003 && Math.abs(gsy - C.sy) < 0.003 && Math.abs(gsz - C.sz) < 0.003 &&
      Math.abs(ga - C.a) < 0.05 && Math.abs(gb - C.b) < 0.05 && Math.abs(gth - C.th) < 0.001 &&
      Math.abs(gtz - C.tz) < 0.05 && Math.abs(C.kv) < 0.01 && (docked || Math.abs(C.k - 1) < 0.002) &&
      !C.anim && W.op < 0.01 && (!free || Math.hypot(C.tx - C.x, C.ty - C.y) <= 3);
    C.raf = settled || !C.on ? 0 : requestAnimationFrame(cursorTick);
  }
  function kickCursor() { if (C.on && !C.raf) { C.last = 0; C.raf = requestAnimationFrame(cursorTick); } }
  // The cube stays out of the opening corridor: it shows only once the pointer is below the hero
  // (or inside the open menu), and then appears right where the pointer is.
  let cursorHidden = true;
  function updateZone() {
    const menuOpen = document.documentElement.classList.contains('menu-open');
    const hide = !menuOpen && !!hero && C.ty < hero.getBoundingClientRect().bottom; // pages without the corridor never hide it
    if (hide !== cursorHidden) {
      cursorHidden = hide;
      cursor.classList.toggle('is-hidden', hide);
      if (!hide) {
        C.x = C.px = C.tx; C.y = C.py = C.ty;
        C.k = 1; C.kv = 0; C.sx = C.sy = C.sz = 1; C.th = 0; C.tz = 0; C.a = -28; C.b = 40;
        C.anim = null; W.x = C.tx; W.y = C.ty; W.op = 0;
      }
    }
    if (hide) { C.dock = null; C.back = false; C.anim = null; W.op = 0; wire.style.opacity = '0'; cursor.classList.remove('is-dock', 'is-back'); }
    kickCursor();
    return hide;
  }
  cursor.classList.add('is-hidden');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.documentElement.classList.add('has-cursor');
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      C.tx = e.clientX; C.ty = e.clientY; C.moveT = performance.now();
      if (!C.on) { C.on = true; C.x = C.px = C.tx; C.y = C.py = C.ty; W.x = C.tx; W.y = C.ty; cursor.classList.add('is-on'); }
      if (updateZone()) return;
      const el = e.target && e.target.closest ? e.target : null;
      const dock = el ? el.closest(DOCK) : null;
      const back = !dock && el ? el.closest(BACK) : null;
      C.dock = dock || back; C.back = !!back;
      cursor.classList.toggle('is-dock', !!dock);
      cursor.classList.toggle('is-back', !!back);
      kickCursor();
    }, { passive: true });
    // keep a docked block on its item while the page scrolls underneath
    window.addEventListener('scroll', () => { if (C.on) updateZone(); if (C.dock) kickCursor(); }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
      C.on = false; C.dock = null; C.back = false; C.anim = null; W.op = 0; wire.style.opacity = '0';
      cursor.classList.remove('is-on', 'is-dock', 'is-back');
      for (const [el] of TILT) { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.classList.remove('is-lifted'); }
      TILT.clear();
    });
    window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  }


  // the cube shows or hides with the menu
  document.addEventListener('menu:toggle', () => { if (C.on) updateZone(); });
})();
