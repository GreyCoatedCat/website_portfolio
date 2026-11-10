/* The opening corridor: an endless tunnel of lit blocks on a 2D canvas, with the jumper hopping between them,
   the opening shot (light, push-in, pop) and an automatic quality step-down for slow devices.
   Exposes Portfolio.Corridor. */
(() => {
  'use strict';
  const { hex, css, mix, mul, clamp, smooth, hits, TAU, frameTime, frameDt, rand } = Portfolio.util;
  const COARSE = Portfolio.COARSE;

  // Opening shot, in seconds from the moment the loading screen lifts
  const INTRO = { dolly: 5.6, back: 1.8, light: 0.55, reveal: 3.0, pop: 2.6, end: 6.2 };
  const CHIPS = ['#FF6A2B', '#E9E4D8', '#7F9BB5'];


  const THEME = {
    dark: ['#0D121A', '#141C27', '#0A0D12'],
    light: ['#3A4859', '#4A5B70', '#D6CEBB'],
    accent: ['#FF6A2B', '#F2B544', '#7F93A3'],
    box: ['#5A6B80', '#D6CEBB', '#2B3646', '#7F93A3', '#FF6A2B'],
    cube: ['#D6CEBB', '#7F93A3'], wire: ['#F2B544', '#D6CEBB'],
    lo: '#0D121A', hi: '#D6CEBB',
    haze: '#3A1C0E', glowCore: '255,222,170', glow: '255,106,43',
    char: ['#7F9BB5', '#0D121A', '#E9E4D8'],
  };
  // The light sits at the far end; walls facing it differently pick up different amounts: ceiling, right, floor, left.
  const WALL = [0.6, 0.82, 1.0, 0.72];
  const EDGES = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const x = i ^ j; if (x === 1 || x === 2 || x === 4) EDGES.push(i, j); }
  const FACES = [[0, 2, 6, 4, -1, 0, 0], [1, 3, 7, 5, 1, 0, 0], [0, 1, 5, 4, 0, -1, 0], [2, 3, 7, 6, 0, 1, 0], [0, 1, 3, 2, 0, 0, -1], [4, 5, 7, 6, 0, 0, 1]];
  const NORM = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const LIGHT = (() => { const v = [0.18, -0.3, 0.94], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); })();

  class Corridor {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.o = Object.assign({
        seg: 0.34, near: 0.05, far: 16, fov: 0.62, vp: [0.5, 0.5],
        accentP: 0.1, patternP: 0.3, boxP: 0.52, cubes: 22, ribEvery: 7,
        glowSize: 0.5, roll: 0, speed: 0.38, seed: 1, scrollDepth: 3.5,
        lightNear: 0.36, vignette: false, jumper: false, intro: false,
      }, opts);
      const o = this.o, T = this.t = {};
      // quality: 0 full, 1 lighter, 2 lightest. Phones start at 1; any device steps down if frames run long.
      this.q = -1; this.slowFor = 0; this.ema = 1 / 60;
      this.setQuality(COARSE || window.innerWidth < 700 ? 1 : 0, true);
      for (const k of ['dark', 'light', 'accent', 'box', 'cube', 'wire']) T[k] = THEME[k].map(hex);
      T.lo = hex(THEME.lo); T.hi = hex(THEME.hi); T.haze = hex(THEME.haze);
      T.char = THEME.char.map(hex);
      this.camZ = 0; this.scrollZ = 0;
      this.cx = 0; this.cy = 0; this.tx = 0; this.ty = 0;
      this.vx = 0; this.vy = 0; this.tvx = 0; this.tvy = 0;
      this.time = 0; this.lastPointer = -1e9; this.pX = -1; this.pY = -1;
      this.range = o.far * 0.8;
      this.cubes = [];
      for (let i = 0; i < o.cubes; i++) {
        const s = o.seed * 97 + i;
        let x = 0, y = 0;
        for (let tries = 0; tries < 16; tries++) {
          const ang = rand(s, 1, tries) * TAU, rad = 0.6 + rand(s, 2, tries) * 0.2;
          x = Math.cos(ang) * rad; y = Math.sin(ang) * rad;
          break;
        }
        this.cubes.push({
          x, y, z0: rand(s, 3, 1) * this.range, z: 0,
          size: 0.035 + rand(s, 4, 1) * 0.05, ax: rand(s, 5, 1) * TAU, ay: rand(s, 7, 1) * TAU,
          sx: (rand(s, 8, 1) - 0.5) * 0.5, sy: (rand(s, 9, 1) - 0.5) * 0.5,
          wire: rand(s, 6, 1) < 0.5, ci: Math.floor(rand(s, 10, 1) * 6),
        });
      }
      this.X = new Float64Array(8); this.Y = new Float64Array(8); this.Z = new Float64Array(8);
      this.SX = new Float64Array(8); this.SY = new Float64Array(8);
      this.buckets = new Map(); this.items = [];
      this.j = { mode: o.intro ? 'hold' : 'idle', from: null, to: null, s: 0, dur: 0.6, wait: 0, blink: 2, flip: 0 };
      this.introT = o.intro ? -1 : 99; // -1 waits in the dark behind the loading screen
      this.running = false; this.raf = 0; this.prev = 0;
      this.loop = this.loop.bind(this);
      this.resize();
      if (o.jumper) { this.updateJumper(0); this.draw(); }
    }

    setQuality(q, initial) {
      if (q === this.q) return;
      this.q = q;
      const far = this.o.far;
      this.dprCap = [1.75, 1.25, 1][q];
      this.boxFar = far * [0.75, 0.55, 0.42][q];  // blocks further out than this are left to the haze (they fade in)
      this.mergeFar = [99, 7, 5][q];              // past this a wall slice is one plain plane plus its accent tiles
      this.shadowFar = [99, 7, 5][q];
      this.patFar = [9, 6, 4][q];                 // wall stripes only up close
      this.seamFar = [8, 5, 0][q];
      this.rimFar = [99, 6, 3.5][q];               // the bright top edge on blocks
      this.drawFar = far * [1, 0.85, 0.75][q];     // the last stretch is almost pure haze under the glow
      if (!initial) this.resize();
    }
    // Watches real frame times; if the scene keeps running under ~40fps it drops a quality step (never back up).
    govern(raw) {
      if (!(raw > 0) || raw > 0.25) return;
      this.ema += (raw - this.ema) * 0.08;
      if (this.q >= 2 || this.introT < 0) return;
      this.slowFor = this.ema > 1 / 40 ? this.slowFor + raw : 0;
      if (this.slowFor > 1.2) { this.slowFor = 0; this.ema = 1 / 60; this.setQuality(this.q + 1); }
    }
    playIntro() { this.introT = 0; this.j.mode = 'hold'; }
    skipIntro() { this.introT = 99; if (this.j.mode === 'hold') this.j.mode = 'idle'; if (!this.running) this.draw(); }
    // The opening push-in: the camera starts a little way back and glides forward, slowing to its usual pace.
    introZ() {
      const t = this.introT;
      if (t >= INTRO.dolly) return 0;
      const e = t <= 0 ? 0 : 0.5 - 0.5 * Math.cos((Math.PI * t) / INTRO.dolly);
      return -INTRO.back * (1 - e);
    }

    // Brightness from the light at the far end, and the warm haze that swallows distant tiles.
    lightAt(rel) { return this.o.lightNear + (1 - this.o.lightNear) * smooth((rel - 0.3) / (this.o.far * 0.45)); }
    hazeAt(rel) { return smooth((rel - this.o.far * 0.3) / (this.o.far * 0.7)); }
    shade(col, f, hz) { return mix(mul(col, f), this.t.haze, hz); }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap || 1.75);
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.f = Math.min(this.w, this.h) * this.o.fov;
      this.vg = null;
      this.draw();
    }

    pointer(nx, ny, px, py) {
      this.tx = nx * 0.26; this.ty = ny * 0.18;
      this.tvx = -nx * 0.04; this.tvy = -ny * 0.03;
      this.pX = px; this.pY = py;
      this.lastPointer = this.time;
      if (!this.running) this.draw();
    }

    scroll(p) { this.scrollZ = p * this.o.scrollDepth; }

    step(dt) {
      this.time += dt * 1000;
      // with no pointer for a while, ease back to the centre and hold still
      if (this.time - this.lastPointer > 4000) { this.tx = 0; this.ty = 0; this.tvx = 0; this.tvy = 0; }
      const k = 1 - Math.exp(-dt * 2.2);
      this.cx += (this.tx - this.cx) * k; this.cy += (this.ty - this.cy) * k;
      this.vx += (this.tvx - this.vx) * k; this.vy += (this.tvy - this.vy) * k;
      this.camZ += this.o.speed * dt;
      if (this.introT >= 0 && this.introT < 99) { this.introT += dt; if (this.introT > INTRO.end) this.introT = 99; }
      if (this.o.jumper) this.updateJumper(dt);
    }

    proj(x, y, z) {
      const s = this.f / (z - this.cz);
      const px = (x - this.cx) * s, py = (y - this.cy) * s;
      this.px = this.ox + px * this.cr - py * this.sr;
      this.py = this.oy + px * this.sr + py * this.cr;
    }

    wallXY(w, u, d) { return w === 0 ? [u, -1 + d] : w === 1 ? [1 - d, u] : w === 2 ? [-u, 1 - d] : [-1 + d, -u]; }

    pt(w, u, d, z) {
      if (w === 0) this.proj(u, -1 + d, z);
      else if (w === 1) this.proj(1 - d, u, z);
      else if (w === 2) this.proj(-u, 1 - d, z);
      else this.proj(-1 + d, -u, z);
    }

    poly(w, a, col, seam) {
      const ctx = this.ctx;
      ctx.beginPath();
      for (let i = 0; i < a.length; i += 3) {
        this.pt(w, a[i], a[i + 1], a[i + 2]);
        if (i) ctx.lineTo(this.px, this.py); else ctx.moveTo(this.px, this.py);
      }
      ctx.closePath();
      if (col) {
        const c = css(col);
        ctx.fillStyle = c; ctx.fill();
        if (seam) { ctx.strokeStyle = c; ctx.lineWidth = 0.8; ctx.stroke(); }
      } else ctx.fill();
    }

    tiles(k, w) { return 2 + Math.floor(rand(k, 10 + w, this.o.seed) * 3); }

    // Boxes slowly breathe in and out of the wall and drift along it, each on its own clock.
    boxAt(k, w, i, m) {
      const o = this.o, seed = o.seed, L = o.seg, id = k * 16 + w * 4 + i;
      if (rand(id, 30, seed) >= o.boxP) return null;
      const span = 2 / m, u0 = -1 + i * span;
      const t = this.time / 1000, ph = rand(id, 33, seed) * TAU, sp = 0.25 + rand(id, 34, seed) * 0.45;
      // mostly low blocks, a few tall pillars reaching into the corridor
      const tall = rand(id, 35, seed) < 0.07;
      const d0 = tall ? 0.45 + rand(id, 31, seed) * 0.25 : 0.06 + rand(id, 31, seed) * 0.3;
      const d = d0 * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * sp + ph)));
      const wf = 0.2 + rand(id, 36, seed) * 0.22, zf = 0.2 + rand(id, 37, seed) * 0.24;
      const uc = u0 + span / 2 + Math.sin(t * sp * 0.63 + ph * 1.7) * span * (0.5 - wf) * 0.7;
      const zc = k * L + L / 2 + Math.sin(t * sp * 0.81 + ph * 0.6) * L * (0.5 - zf) * 0.7;
      const hw = span * wf, hz = L * zf;
      // some carry a smaller block stacked on top
      const st = rand(id, 50, seed) < 0.5 ? { f: 0.4 + rand(id, 51, seed) * 0.3, dd: 0.04 + rand(id, 52, seed) * 0.14 } : null;
      return {
        a0: uc - hw, a1: uc + hw, z0: zc - hz, z1: zc + hz, d, uc, zc, hw, hz, st, id, w, key: zc,
        // how far it can ever drift, so the jumper only picks spots that stay clear
        um: u0 + span / 2, du: span * (0.5 - wf) * 0.7, zm: k * L + L / 2, dz: L * (0.5 - zf) * 0.7, d0,
      };
    }

    // World-space bounds [x0, x1, y0, y1, z0, z1] of a block on wall w.
    wallAABB(w, a0, a1, d0, d1, z0, z1) {
      if (w === 0) return [a0, a1, -1 + d0, -1 + d1, z0, z1];
      if (w === 1) return [1 - d1, 1 - d0, a0, a1, z0, z1];
      if (w === 2) return [-a1, -a0, 1 - d1, 1 - d0, z0, z1];
      return [-1 + d0, -1 + d1, -a1, -a0, z0, z1];
    }

    // Everything a box can fill while it breathes and drifts.
    envOf(b, pad = 0) {
      return this.wallAABB(b.w, b.um - b.du - b.hw - pad, b.um + b.du + b.hw + pad, 0, b.d0 + (b.st ? b.st.dd : 0) + pad,
        b.zm - b.dz - b.hz - pad, b.zm + b.dz + b.hz + pad);
    }

    segment(k, zA, zB, rel, extra) {
      const o = this.o, T = this.t, seed = o.seed, L = o.seg, zS = k * L;
      const lf = this.lightAt(rel), hz = this.hazeAt(rel);
      this.segRel = rel;
      const groupDark = rand(Math.floor(k / 3), 1, seed) < 0.55;
      const dark = rand(k, 2, seed) < 0.72 ? groupDark : !groupDark;
      const pal = dark ? T.dark : T.light;
      const base = pal[Math.floor(rand(k, 3, seed) * pal.length)];
      const patterns = rel < this.patFar, items = this.items;
      items.length = 0;
      const merge = rel > this.mergeFar;
      for (let w = 0; w < 4; w++) {
        const m = this.tiles(k, w), f = lf * WALL[w];
        if (merge) this.poly(w, [-1, 0, zA, 1, 0, zA, 1, 0, zB, -1, 0, zB], this.shade(base, f, hz), false);
        for (let i = 0; i < m; i++) {
          const u0 = -1 + (2 * i) / m, u1 = -1 + (2 * (i + 1)) / m;
          const id = k * 16 + w * 4 + i;
          const r = rand(id, 20, seed);
          const col = r < o.accentP ? T.accent[Math.floor((r / o.accentP) * T.accent.length)] : base;
          if (!merge || col !== base) this.poly(w, [u0, 0, zA, u1, 0, zA, u1, 0, zB, u0, 0, zB], this.shade(col, f, hz), rel < this.seamFar);
          if (patterns && rand(id, 40, seed) < o.patternP) this.pattern(w, id, u0, u1, zS, zA, zB, col, f, hz);
          const b = this.boxAt(k, w, i, m);
          if (b && rel < this.boxFar) items.push(b);
        }
      }
      // contact shadows go down first, so none of them lands on a neighbouring block
      if (rel < this.shadowFar) for (const b of items) this.shadow(b, zA, zB, hz);
      // every few metres a square frame runs round all four walls, like the rings in the reference posters
      if (o.ribEvery && k % o.ribEvery === 0 && rel < o.far * 0.8 && zS + L * 0.32 > zA) items.push({ key: zS + L * 0.16, rib: true });
      if (extra) for (const it of extra) items.push(it);
      // far to near, so whatever is in front is painted last (the jumper sorts just after the block it stands on)
      items.sort((a, b) => b.key - a.key);
      for (const it of items) {
        if (it.rib) { const r1 = zS + L * 0.32; for (let w = 0; w < 4; w++) this.slab(w, -1, 1, Math.max(zA, zS), r1, 0, 0.055, T.light[2], lf * WALL[w], hz); }
        else if (it.pose) this.drawJumper(it.pose);
        else if (it.ax !== undefined) this.cube(it);
        else {
          const fade = clamp((this.boxFar - rel) / 1.4, 0, 1);
          if (fade < 1) this.ctx.globalAlpha = fade;
          this.box(it.w, it, zA, zB, lf * WALL[it.w], hz);
          this.ctx.globalAlpha = 1;
        }
      }
    }

    // A few wide stripes in 3D, kept to nearby tiles so nothing shimmers in the distance.
    pattern(w, id, u0, u1, zS, zA, zB, col, f, hz) {
      const T = this.t, seed = this.o.seed, L = this.o.seg;
      const lum = col[0] * 0.299 + col[1] * 0.587 + col[2] * 0.114;
      const fg = this.shade(lum > 110 ? T.lo : T.hi, f, hz);
      const kind = rand(id, 41, seed);
      if (kind < 0.35) {
        const n = rand(id, 42, seed) < 0.5 ? 3 : 5, du = (u1 - u0) / n;
        for (let j = 1; j < n; j += 2) this.poly(w, [u0 + j * du, 0, zA, u0 + (j + 1) * du, 0, zA, u0 + (j + 1) * du, 0, zB, u0 + j * du, 0, zB], fg, false);
      } else if (kind < 0.62) {
        // an inset panel, a half step lighter or darker than its tile
        const iu = (u1 - u0) * 0.14, z0 = Math.max(zA, zS + L * 0.14), z1 = zS + L * 0.86;
        if (z1 > z0) this.poly(w, [u0 + iu, 0, z0, u1 - iu, 0, z0, u1 - iu, 0, z1, u0 + iu, 0, z1], this.shade(mix(col, lum > 110 ? T.lo : T.hi, 0.3), f, hz), false);
      } else {
        const dz = L / 4;
        for (let j = 1; j < 4; j += 2) {
          const z0 = Math.max(zA, zS + j * dz), z1 = Math.min(zB, zS + (j + 1) * dz);
          if (z1 > z0) this.poly(w, [u0, 0, z0, u1, 0, z0, u1, 0, z1, u0, 0, z1], fg, false);
        }
      }
    }

    // contact shadow on the wall around a block's base
    shadow(b, zA, zB, hz) {
      if (Math.max(b.z0, zA) >= b.z1) return;
      const ctx = this.ctx;
      const s0 = Math.max(-1, b.a0 - 0.035), s1 = Math.min(1, b.a1 + 0.035);
      const sz0 = Math.max(zA, b.z0 - 0.06), sz1 = Math.min(zB, b.z1 + 0.02);
      ctx.globalAlpha = 0.5 * (1 - hz);
      ctx.fillStyle = '#000';
      this.poly(b.w, [s0, 0, sz0, s1, 0, sz0, s1, 0, sz1, s0, 0, sz1], null);
      ctx.globalAlpha = 1;
    }

    box(w, b, zA, zB, f, hz) {
      const T = this.t, seed = this.o.seed;
      const z0 = Math.max(b.z0, zA), z1 = b.z1;
      if (z1 <= z0) return;
      const { a0, a1, d } = b;
      const col = T.box[Math.floor(rand(b.id, 32, seed) * T.box.length)];
      this.slab(w, a0, a1, z0, z1, 0, d, col, f, hz);
      if (b.st) {
        const sa0 = b.uc - b.hw * b.st.f, sa1 = b.uc + b.hw * b.st.f;
        const sz0b = Math.max(b.zc - b.hz * b.st.f, zA), sz1b = b.zc + b.hz * b.st.f;
        if (sz1b > sz0b) this.slab(w, sa0, sa1, sz0b, sz1b, d, d + b.st.dd, T.box[Math.floor(rand(b.id, 53, seed) * T.box.length)], f, hz);
      }
    }

    // One block standing out of wall w, from depth d0 to d1: faces turned away from the light are
    // darker, the face toward the camera is in shadow, and its far top edge catches the light.
    slab(w, a0, a1, z0, z1, d0, d1, col, f, hz) {
      const ctx = this.ctx;
      const camU = w === 0 ? this.cx : w === 1 ? this.cy : w === 2 ? -this.cx : -this.cy;
      if (camU < a0) this.poly(w, [a0, d0, z0, a0, d1, z0, a0, d1, z1, a0, d0, z1], this.shade(col, f * 0.6, hz));
      if (camU > a1) this.poly(w, [a1, d0, z0, a1, d1, z0, a1, d1, z1, a1, d0, z1], this.shade(col, f * 0.6, hz));
      this.poly(w, [a0, d0, z0, a1, d0, z0, a1, d1, z0, a0, d1, z0], this.shade(col, f * 0.4, hz));
      this.poly(w, [a0, d1, z0, a1, d1, z0, a1, d1, z1, a0, d1, z1], this.shade(col, f, hz));
      if (hz > 0.45 || this.segRel > this.rimFar) return; // the rim of light is lost in the haze further out
      this.pt(w, a0, d1, z1); const x0 = this.px, y0 = this.py;
      this.pt(w, a1, d1, z1);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(this.px, this.py);
      ctx.strokeStyle = css(this.shade(mix(col, [255, 220, 170], 0.5), Math.min(1.25, f * 1.25), hz));
      ctx.lineWidth = 1.2; ctx.stroke();
    }

    cube(c) {
      const ctx = this.ctx, o = this.o, T = this.t, t = this.time / 1000;
      const rel = c.z - this.cz, lf = this.lightAt(rel), hz = this.hazeAt(rel);
      const ax = c.ax + t * c.sx, ay = c.ay + t * c.sy;
      const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay);
      const { X, Y, Z, SX, SY } = this, s = c.size;
      for (let i = 0; i < 8; i++) {
        const x = i & 1 ? s : -s, y = i & 2 ? s : -s, z = i & 4 ? s : -s;
        const y1 = y * ca - z * sa, z1 = y * sa + z * ca;
        X[i] = c.x + x * cb + z1 * sb; Y[i] = c.y + y1; Z[i] = c.z - x * sb + z1 * cb;
        if (Z[i] - this.cz < o.near) return;
        this.proj(X[i], Y[i], Z[i]); SX[i] = this.px; SY[i] = this.py;
      }
      const pal = c.wire ? T.wire : T.cube, col = pal[c.ci % pal.length];
      if (c.wire) {
        ctx.beginPath();
        for (let e = 0; e < EDGES.length; e += 2) {
          const a = EDGES[e], b = EDGES[e + 1];
          ctx.moveTo(SX[a], SY[a]); ctx.lineTo(SX[b], SY[b]);
        }
        ctx.strokeStyle = css(this.shade(col, lf, hz));
        ctx.lineWidth = clamp((this.f * 0.006) / rel, 0.6, 3);
        ctx.stroke();
        return;
      }
      for (const F of FACES) {
        const ny1 = F[5] * ca - F[6] * sa, nz1 = F[5] * sa + F[6] * ca;
        const nx = F[4] * cb + nz1 * sb, nz = -F[4] * sb + nz1 * cb;
        const mx = (X[F[0]] + X[F[2]]) / 2, my = (Y[F[0]] + Y[F[2]]) / 2, mz = (Z[F[0]] + Z[F[2]]) / 2;
        if (nx * (mx - this.cx) + ny1 * (my - this.cy) + nz * (mz - this.cz) >= 0) continue;
        const dl = 0.5 + 0.5 * (nx * LIGHT[0] + ny1 * LIGHT[1] + nz * LIGHT[2]);
        const light = 0.26 + 0.74 * Math.pow(clamp(dl, 0, 1), 1.4);
        ctx.beginPath();
        ctx.moveTo(SX[F[0]], SY[F[0]]); ctx.lineTo(SX[F[1]], SY[F[1]]);
        ctx.lineTo(SX[F[2]], SY[F[2]]); ctx.lineTo(SX[F[3]], SY[F[3]]);
        ctx.closePath();
        ctx.fillStyle = css(this.shade(col, light * lf, hz));
        ctx.fill();
      }
    }

    /* ---- The jumper: a small cube creature hopping between wall boxes.
       Its "down" is whichever wall it stands on, so it walks the ceiling too. ---- */
    anchor(ref) {
      // floats along just ahead of the camera until it leaps, then that spot stays put
      if (ref.center) return { x: 0, y: 0.16, z: ref.rel != null ? this.cz + ref.rel : ref.z, nx: 0, ny: -1 };
      if (ref.free) return { x: ref.x, y: ref.y, z: ref.z, nx: 0, ny: -1 };
      const b = this.boxAt(ref.k, ref.w, ref.i, ref.m);
      if (!b) return null;
      const p = this.wallXY(ref.w, b.uc, b.d + (b.st ? b.st.dd : 0)); // stand on the stacked block if there is one
      return { x: p[0], y: p[1], z: b.zc, nx: NORM[ref.w][0], ny: NORM[ref.w][1] };
    }

    // A spot is usable only if the top is big enough to stand on and nothing (a block on the
    // next wall, a rib, a floating cube) can ever reach into the space the jumper fills there.
    spotFree(ref) {
      const o = this.o, L = o.seg, b = this.boxAt(ref.k, ref.w, ref.i, ref.m);
      if (!b) return false;
      const f = b.st ? b.st.f : 1, dd = b.st ? b.st.dd : 0;
      if (b.hw * f < 0.09 || b.hz * f < 0.05) return false;
      const S = this.wallAABB(b.w, b.um - b.du - 0.1, b.um + b.du + 0.1, b.d0 * 0.55 + dd + 0.004, b.d0 + dd + 0.24,
        b.zm - b.dz - 0.08, b.zm + b.dz + 0.08);
      for (let k = ref.k - 1; k <= ref.k + 1; k++) {
        if (o.ribEvery && k % o.ribEvery === 0) {
          for (let w = 0; w < 4; w++) if (hits(S, this.wallAABB(w, -1, 1, 0, 0.07, k * L, k * L + L * 0.32))) return false;
        }
        for (let w = 0; w < 4; w++) {
          const m = this.tiles(k, w);
          for (let i = 0; i < m; i++) {
            if (k === ref.k && w === ref.w && i === ref.i) continue;
            const n = this.boxAt(k, w, i, m);
            if (n && hits(S, this.envOf(n, 0.01))) return false;
          }
        }
      }
      for (const c of this.cubes) {
        const base = c.z0 + o.near + 0.4, z = base + Math.round((b.zm - base) / this.range) * this.range, r = c.size * 1.8;
        if (hits(S, [c.x - r, c.x + r, c.y - r, c.y + r, z - r, z + r])) return false;
      }
      return true;
    }

    // The hop itself must not pass through another block on the way.
    arcClear(from, to) {
      const a = this.anchor(from), b = this.anchor(to);
      if (!a || !b) return false;
      const L = this.o.seg, same = from.w === to.w;
      for (let s = 0.15; s < 0.9; s += 0.14) {
        const p = this.arcPoint(a, b, same, s), k0 = Math.floor(p.z / L), r = 0.07;
        const P = [p.x - r, p.x + r, p.y - r, p.y + r, p.z - r, p.z + r];
        for (let k = k0 - 1; k <= k0 + 1; k++) for (let w = 0; w < 4; w++) {
          const m = this.tiles(k, w);
          for (let i = 0; i < m; i++) {
            if ((k === from.k && w === from.w && i === from.i) || (k === to.k && w === to.w && i === to.i)) continue;
            const n = this.boxAt(k, w, i, m);
            if (n && hits(P, this.envOf(n))) return false;
          }
        }
      }
      return true;
    }

    arcPoint(a, b, same, s) {
      const q = 1 - s;
      let mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (same) { mx += a.nx * 0.6; my += a.ny * 0.6; } else { mx *= 0.2; my *= 0.2; }
      return { x: q * q * a.x + 2 * q * s * mx + s * s * b.x, y: q * q * a.y + 2 * q * s * my + s * s * b.y, z: a.z + (b.z - a.z) * s };
    }

    pickBox(minRel, maxRel, avoidW, from) {
      const L = this.o.seg, cz = this.cz, list = [];
      for (let k = Math.floor((cz + minRel) / L), kEnd = Math.floor((cz + maxRel) / L); k <= kEnd; k++) {
        for (let w = 0; w < 4; w++) {
          const m = this.tiles(k, w);
          for (let i = 0; i < m; i++) {
            const r = { k, w, i, m };
            if (this.boxAt(k, w, i, m) && this.spotFree(r)) list.push(r);
          }
        }
      }
      if (!list.length) return null;
      let pool = list;
      if (avoidW != null && Math.random() < 0.65) { const other = pool.filter(r => r.w !== avoidW); if (other.length) pool = other; }
      if (Math.random() < 0.6) { const notFloor = pool.filter(r => r.w !== 2); if (notFloor.length) pool = notFloor; }
      // try them in random order until one has a clear flight path
      for (let n = pool.length; n > 0; n--) {
        const j = Math.floor(Math.random() * n), r = pool[j];
        pool[j] = pool[n - 1]; pool[n - 1] = r;
        if (!from || this.arcClear(from, r)) return r;
      }
      return null;
    }

    updateJumper(dt) {
      const J = this.j;
      this.cz = this.camZ + this.scrollZ + this.introZ();
      J.blink -= dt;
      if (J.blink < -0.12) J.blink = 2 + Math.random() * 3;
      if (J.mode === 'hold') {
        // it pops into being in the middle of the corridor, just as the light comes up
        if (this.introT >= INTRO.pop) { J.from = { center: true, rel: 1.8, z: 0 }; J.mode = 'pop'; J.s = 0; }
        return;
      }
      if (J.mode === 'pop') {
        J.s += dt / 0.8;
        if (J.s >= 1) { J.mode = 'stand'; J.wait = 1.3; J.blink = 2.5; }
        return;
      }
      if (J.mode === 'carry') {
        J.g += dt;
        const C = J.c, R = 1.5;
        // the pointer, taken back from the screen into the corridor at that distance, kept inside the walls
        const [px, py] = this.tgt || (this.pX >= 0 ? [this.pX, this.pY] : [this.ox, this.oy]);
        const s = this.f / R, ux = px - this.ox, uy = py - this.oy;
        const wx = clamp((ux * this.cr + uy * this.sr) / s + this.cx, -0.78, 0.78);
        const wy = clamp((-ux * this.sr + uy * this.cr) / s + this.cy, -0.78, 0.78);
        const k = 1 - Math.exp(-dt * 7), nx = C.x + (wx - C.x) * k, ny = C.y + (wy - C.y) * k;
        const ivx = (nx - C.x) / Math.max(dt, 1e-3), ivy = (ny - C.y) / Math.max(dt, 1e-3);
        C.vx += (ivx - C.vx) * Math.min(1, dt * 10); C.vy += (ivy - C.vy) * Math.min(1, dt * 10);
        C.x = nx; C.y = ny;
        C.rel += (R - C.rel) * (1 - Math.exp(-dt * 4));
        return;
      }
      if (J.mode === 'idle') {
        const r = this.pickBox(2.2, 4.6);
        if (r) { J.from = r; J.mode = 'stand'; J.wait = 0.6 + Math.random(); }
        return;
      }
      const a = this.anchor(J.from);
      const rel = a ? a.z - this.cz : -1;
      if (J.mode === 'stand') {
        if (rel < 0.7) { J.mode = 'idle'; return; }
        J.wait -= dt;
        // Hop only a little way ahead, so on average it keeps pace with the camera instead of racing it.
        if (J.wait <= 0 || (!J.from.center && rel < 1.9)) {
          const lo = Math.max(rel + 0.3, 2.3);
          let r = this.pickBox(lo, lo + 1.3, J.from.w, J.from);
          // let go in a corner, it may find no block with a clear path: look further, then take any block
          if (!r && J.from.free) r = this.pickBox(lo, lo + 2.6, null, J.from) || this.pickBox(lo, lo + 2.6);
          if (r) { J.to = r; J.mode = 'crouch'; J.s = 0; } else J.wait = 0.4;
        }
      } else if (J.mode === 'crouch') {
        J.s += dt / 0.24;
        if (J.s >= 1) {
          if (J.from.center && J.from.rel != null) { J.from.z = this.cz + J.from.rel; J.from.rel = null; }
          const b = this.anchor(J.to);
          J.dur = 1.0 + Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 0.22;
          J.flip = J.from.w === J.to.w && Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0;
          J.mode = 'jump'; J.s = 0;
        }
      } else if (J.mode === 'jump') {
        J.s += dt / J.dur;
        const b = this.anchor(J.to);
        if (b.z - this.cz < 0.5) { J.mode = 'idle'; return; }
        if (J.s >= 1) { J.from = J.to; J.mode = 'land'; J.s = 0; }
      } else if (J.mode === 'land') {
        J.s += dt / 0.26;
        if (J.s >= 1) { J.mode = 'stand'; J.wait = 1.6 + Math.random() * 1.8; }
      }
    }

    // Picking it up: a click on the jumper starts a carry; while carried, a mouse click anywhere lets it go,
    // and on touch a tap elsewhere sends it there while a tap on it lets it go. Returns whether it was used.
    poke(x, y, touch) {
      const J = this.j, hit = this.over(x, y);
      if (J.mode === 'carry') {
        if (touch && !hit) { this.tgt = [x, y]; return true; }
        this.letGo();
        return true;
      }
      if (!hit) return false;
      const P = this.jumperPose();
      if (!P) return false;
      J.c = { x: P.x, y: P.y, rel: P.z - this.cz, vx: 0, vy: 0 };
      J.mode = 'carry'; J.g = 0; J.blink = 1.5;
      this.tgt = touch ? [x, y] : null;
      return true;
    }
    over(x, y) { const H = this.jHit; return !!H && Math.hypot(x - H.x, y - H.y) < H.r; }
    get carrying() { return this.j.mode === 'carry'; }
    // Let go: it stays where it is for a moment, then hops onto a block further down the corridor.
    letGo() {
      const J = this.j;
      if (J.mode !== 'carry') return;
      J.from = { free: true, x: J.c.x, y: J.c.y, z: this.cz + J.c.rel };
      J.mode = 'stand'; J.wait = 0; this.tgt = null;
    }

    jumperPose() {
      const J = this.j;
      if (J.mode === 'carry') {
        const C = J.c, sp = Math.hypot(C.vx, C.vy);
        return {
          x: C.x, y: C.y + Math.sin(this.time / 380) * 0.01, z: this.cz + C.rel,
          ang: -Math.PI / 2 + clamp(C.vx * 0.5, -0.45, 0.45), // leans into the way it is flying
          sq: 1 + Math.min(0.12, sp * 0.05), air: true, pop: J.g < 0.5 ? J.g / 0.5 : null,
        };
      }
      if (J.mode === 'idle' || J.mode === 'hold' || !J.from) return null;
      const a = this.anchor(J.from);
      const ang0 = Math.atan2(a.ny, a.nx);
      if (J.mode === 'pop') {
        // springs up from nothing, overshoots a touch and settles
        const s = J.s, c = 2.2, e = 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2);
        return { x: a.x, y: a.y, z: a.z, ang: ang0, sq: 1, air: true, scale: Math.max(0, e), pop: s };
      }
      if (J.mode !== 'jump') {
        const sq = J.mode === 'crouch' ? 1 - 0.3 * J.s : J.mode === 'land' ? 0.76 + 0.24 * J.s : 1 + 0.03 * Math.sin(this.time / 260);
        const floating = !!(J.from.center || J.from.free);
        const bob = floating ? Math.sin(this.time / 420) * 0.012 : 0;
        return { x: a.x, y: a.y + bob, z: a.z, ang: ang0, sq, air: floating };
      }
      const b = this.anchor(J.to), s = J.s, q = 1 - s;
      const p = this.arcPoint(a, b, J.from.w === J.to.w, s);
      let da = Math.atan2(b.ny, b.nx) - ang0;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      da += J.flip * TAU;
      const e = s < 0.5 ? 2 * s * s : 1 - 2 * q * q;
      return {
        x: p.x, y: p.y, z: p.z,
        ang: ang0 + da * e, sq: 1.14 - 0.28 * Math.abs(0.5 - s), air: true,
      };
    }

    drawJumper(P, alpha = 1) {
      const rel = P.z - this.cz;
      if (rel < this.o.near * 6 || alpha <= 0.001) return;
      const ctx = this.ctx, T = this.t, sc = P.scale == null ? 1 : P.scale;
      const lf = Math.max(0.75, this.lightAt(rel)), hz = this.hazeAt(rel) * 0.6;
      this.proj(P.x, P.y, P.z);
      const sx = this.px, sy = this.py;
      this.proj(P.x + Math.cos(P.ang) * 0.05, P.y + Math.sin(P.ang) * 0.05, P.z);
      const rot = Math.atan2(this.px - sx, -(this.py - sy));
      const S0 = (this.f * 0.17) / rel, S = S0 * sc;
      const bw = S * (1 + (1 - P.sq) * 0.5), bh = S * P.sq * 0.86;
      const legH = S * (P.air ? 0.1 : 0.2 * P.sq), legW = S * 0.17;
      const body = css(this.shade(T.char[0], lf, hz)), line = css(T.char[1]), eye = css(T.char[2]);
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(rot);
      if (P.pop != null && P.pop < 1) this.popFx(P.pop, S0, -S0 * 0.52, alpha);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = line;
      ctx.fillRect(-bw * 0.27 - legW / 2, -legH - 1, legW, legH + 1);
      ctx.fillRect(bw * 0.27 - legW / 2, -legH - 1, legW, legH + 1);
      const top = -legH - bh;
      ctx.fillStyle = body; ctx.fillRect(-bw / 2, top, bw, bh);
      ctx.lineWidth = Math.max(1, S * 0.08); ctx.strokeStyle = line; ctx.strokeRect(-bw / 2, top, bw, bh);
      if (alpha > 0.5) {
        const ly = top + bh / 2; // body centre, turned with the body
        this.jHit = { x: sx - ly * Math.sin(rot), y: sy + ly * Math.cos(rot), r: Math.max(bw, bh) * 0.75 + 8 };
      }
      const J = this.j;
      let tx = this.pX >= 0 ? this.pX : this.ox, ty = this.pX >= 0 ? this.pY : this.oy;
      if (J.mode === 'carry') { tx = sx + J.c.vx * 300; ty = sy + J.c.vy * 300; }
      const dx = tx - sx, dy = ty - sy, dl = Math.hypot(dx, dy) || 1;
      const c = Math.cos(-rot), sn = Math.sin(-rot);
      const es = Math.max(1.5, bw * 0.16);
      const lx = ((dx * c - dy * sn) / dl) * es * 0.4, ly = ((dx * sn + dy * c) / dl) * es * 0.4;
      const shut = this.j.blink < 0 || (P.pop != null && P.pop < 0.7);
      const eh = shut ? es * 0.2 : es, ey = top + bh * 0.4;
      ctx.fillStyle = eye;
      ctx.fillRect(-bw * 0.2 - es / 2 + lx, ey - eh / 2 + ly, es, eh);
      ctx.fillRect(bw * 0.2 - es / 2 + lx, ey - eh / 2 + ly, es, eh);
      ctx.restore();
    }

    // The pop: a square ring opens out and a few chips fly off, gone within half a second.
    popFx(s, S, cy, alpha) {
      const ctx = this.ctx, e = 1 - Math.pow(1 - s, 3), fade = (1 - s) * alpha;
      const r = S * (0.5 + 2.4 * e);
      ctx.globalAlpha = fade * 0.85;
      ctx.strokeStyle = CHIPS[1]; ctx.lineWidth = Math.max(1, S * 0.06 * (1 - s));
      ctx.strokeRect(-r, cy - r, r * 2, r * 2);
      for (let i = 0; i < 8; i++) {
        const ang = (i * TAU) / 8 + 0.39, d = S * (0.45 + 2.1 * e), q = S * 0.15 * (1 - 0.6 * s);
        ctx.globalAlpha = fade;
        ctx.fillStyle = CHIPS[i % 3];
        ctx.fillRect(Math.cos(ang) * d - q / 2, cy + Math.sin(ang) * d - q / 2, q, q);
      }
      ctx.globalAlpha = 1;
    }

    draw() {
      const o = this.o, ctx = this.ctx, w = this.w, h = this.h, T = this.t;
      if (!w || !h) return;
      this.sane();
      if (this.introT < 0) { ctx.globalAlpha = 1; ctx.fillStyle = '#05070A'; ctx.fillRect(0, 0, w, h); return; }
      const cz = this.cz = this.camZ + this.scrollZ + this.introZ();
      this.cr = Math.cos(o.roll); this.sr = Math.sin(o.roll);
      this.jHit = null;
      this.ox = w * o.vp[0] + this.vx * w; this.oy = h * o.vp[1] + this.vy * h;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = css(T.haze); ctx.fillRect(0, 0, w, h);
      const L = o.seg, zNear = cz + o.near;
      const k0 = Math.floor(zNear / L), k1 = Math.floor((cz + (this.drawFar || o.far)) / L);
      const buckets = this.buckets; buckets.clear();
      const add = (z, item) => { const kk = Math.floor(z / L); let arr = buckets.get(kk); if (!arr) { arr = []; buckets.set(kk, arr); } arr.push(item); };
      for (const c of this.cubes) {
        c.z = c.key = cz + o.near + 0.4 + ((((c.z0 - cz) % this.range) + this.range) % this.range);
        add(c.z, c);
      }
      const pose = o.jumper ? this.jumperPose() : null;
      if (pose) add(pose.z, { key: pose.z - (pose.air ? 0 : 0.002), pose });
      for (let k = k1; k >= k0; k--) {
        let zA = k * L; const zB = zA + L;
        if (zB <= zNear) continue;
        if (zA < zNear) zA = zNear;
        this.segment(k, zA, zB, (zA + zB) / 2 - cz, buckets.get(k));
      }
      const it = this.introT;
      if (it < INTRO.reveal + 0.3) this.reveal(it);
      // the far light swells up out of the dark and flares once as the jumper appears
      this.glow(it >= 99 ? 1 : 0.05 + 0.95 * smooth((it - INTRO.light) / 2.2) + 0.22 * Math.exp(-Math.pow((it - INTRO.pop - 0.12) / 0.38, 2)));
      // in the middle of the corridor it stands in front of the light, so it is drawn over the glow
      if (pose && (this.j.mode === 'carry' || (this.j.from && this.j.from.center))) {
        const J = this.j, a = J.mode === 'jump' ? 1 - smooth(J.s / 0.6) : 1;
        this.drawJumper(pose, a);
      }
      if (o.vignette) this.vignette();
    }

    // Darkness drawn back from the light at the far end, so the corridor lights up toward the camera.
    reveal(t) {
      const ctx = this.ctx, w = this.w, h = this.h;
      const p = smooth((t - INTRO.light - 0.2) / INTRO.reveal);
      if (p >= 1 || !Number.isFinite(this.ox)) return;
      const R = 1 + p * Math.hypot(w, h) * 1.25;
      const g = ctx.createRadialGradient(this.ox, this.oy, 0, this.ox, this.oy, R);
      g.addColorStop(0, 'rgba(5,7,10,' + (0.7 * (1 - p)).toFixed(3) + ')');
      g.addColorStop(0.5, 'rgba(5,7,10,' + (0.85 * (1 - p)).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(5,7,10,1)');
      ctx.globalAlpha = 1 - smooth((p - 0.55) / 0.45);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    glow(scale = 1) {
      const ctx = this.ctx, o = this.o, R = Math.min(this.w, this.h) * o.glowSize * scale;
      if (!Number.isFinite(this.ox) || !Number.isFinite(this.oy) || !(R > 0)) return;
      const g = ctx.createRadialGradient(this.ox, this.oy, 0, this.ox, this.oy, R);
      g.addColorStop(0, 'rgba(' + THEME.glowCore + ',.95)');
      g.addColorStop(0.07, 'rgba(' + THEME.glowCore + ',.6)');
      g.addColorStop(0.2, 'rgba(' + THEME.glow + ',.35)');
      g.addColorStop(0.55, 'rgba(' + THEME.glow + ',.08)');
      g.addColorStop(1, 'rgba(' + THEME.glow + ',0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.fillRect(this.ox - R, this.oy - R, R * 2, R * 2);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Darkens the top and bottom edges so the header and the name stay readable.
    vignette() {
      const ctx = this.ctx, h = this.h;
      if (!this.vg) {
        const b = ctx.createLinearGradient(0, 0, 0, h);
        b.addColorStop(0, 'rgba(0,0,0,.85)'); b.addColorStop(0.075, 'rgba(0,0,0,.6)'); b.addColorStop(0.17, 'rgba(0,0,0,0)');
        b.addColorStop(0.5, 'rgba(0,0,0,0)'); b.addColorStop(0.75, 'rgba(0,0,0,.45)'); b.addColorStop(1, 'rgba(0,0,0,.8)');
        this.vg = b;
      }
      ctx.fillStyle = this.vg; ctx.fillRect(0, 0, this.w, h);
    }

    start() {
      if (this.running) return;
      this.running = true; this.prev = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }

    stop() {
      if (!this.running) return;
      this.running = false; cancelAnimationFrame(this.raf); this.draw();
    }

    loop(now) {
      if (!this.running) return;
      const t = frameTime(now), dt = frameDt(t, this.prev);
      this.govern((t - this.prev) / 1000);
      this.prev = t;
      this.step(dt); this.draw();
      this.raf = requestAnimationFrame(this.loop);
    }

    // Last line of defence: if any camera value ever stops being a finite number, recentre it.
    sane() {
      for (const k of ['cx', 'cy', 'tx', 'ty', 'vx', 'vy', 'tvx', 'tvy', 'scrollZ']) if (!Number.isFinite(this[k])) this[k] = 0;
      if (!Number.isFinite(this.camZ)) this.camZ = 0;
      if (!Number.isFinite(this.time)) this.time = 0;
    }
  }

  Portfolio.Corridor = Corridor;
})();
