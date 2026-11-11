/* The block city in Contact, drawn on a 2D canvas with an orthographic camera. Exposes Portfolio.City. */
(() => {
  'use strict';
  const { hex, css, mul, clamp, smooth, frameTime, frameDt } = Portfolio.util;
  const COARSE = Portfolio.COARSE;

  /* ---------- The block city ----------
     A small isometric town inside a cube: unit voxels plus a few odd-sized boxes and two
     pyramid roofs, drawn back to front with an orthographic camera. The jumper from the
     hero lives here too and walks a loop over its stairs, courtyard and bridge. */
  const CITY_MAT = {
    stone: ['#302125', '#3D2C2E'], deck: ['#302125', '#52312F'], trim: ['#D9C4A8', '#F1E6D6'],
    court: ['#3D2C2E', '#5C3A30'], tower: ['#2E4057', '#3B5573'], planter: ['#1F181E', '#302125'],
    trunk: ['#1F181E', '#1F181E'], leaf: ['#4E5E31', '#6B7A44'], leaf2: ['#7F4639', '#945C48'],
    roof: ['#C24E38', '#C24E38'], lamp: ['#F2C48A', '#FFE2B0'], body: ['#5B86C4', '#7AA0D4'],
    leg: ['#1F181E', '#1F181E'], float1: ['#2E4057', '#3B5573'], float2: ['#D9C4A8', '#F1E6D6'], float3: ['#C24E38', '#D98A48'],
  };
  const CITY_UNLIT = { lamp: true };
  const ROOM_RGB = { back: hex('#D98A48'), side: hex('#B86B3D'), floor: hex('#7F4639') };
  // Face corners in the order bottom-left, bottom-right, top-right, top-left, as seen from outside.
  const CITY_FACES = {
    px: { n: [1, 0, 0], c: b => [[b[3], b[1], b[5]], [b[3], b[1], b[2]], [b[3], b[4], b[2]], [b[3], b[4], b[5]]] },
    nx: { n: [-1, 0, 0], c: b => [[b[0], b[1], b[2]], [b[0], b[1], b[5]], [b[0], b[4], b[5]], [b[0], b[4], b[2]]] },
    pz: { n: [0, 0, 1], c: b => [[b[0], b[1], b[5]], [b[3], b[1], b[5]], [b[3], b[4], b[5]], [b[0], b[4], b[5]]] },
    nz: { n: [0, 0, -1], c: b => [[b[3], b[1], b[2]], [b[0], b[1], b[2]], [b[0], b[4], b[2]], [b[3], b[4], b[2]]] },
    py: { n: [0, 1, 0], c: b => [[b[0], b[4], b[5]], [b[3], b[4], b[5]], [b[3], b[4], b[2]], [b[0], b[4], b[2]]] },
  };
  const FACE_KEYS = ['px', 'nx', 'pz', 'nz', 'py'];
  const ALL_FACES = FACE_KEYS.map(f => ({ f, room: null, decal: null }));
  const FACE_STEP = { px: [1, 0, 0], nx: [-1, 0, 0], pz: [0, 0, 1], nz: [0, 0, -1], py: [0, 1, 0] };
  // Light is fixed to the camera, so the city always reads the same way however it is turned.
  const CITY_LIGHT = (() => { const v = [-0.6, 0.85, 0.35], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); })();
  const DECALS = {
    slit: [[0.38, 0.2, 0.62, 0.8, '#F2C48A']],
    door: [[0.26, 0, 0.74, 0.78, '#1F181E']],
    win: [[0.3, 0.35, 0.7, 0.75, '#1F181E']],
    dots: [[0.42, 0.14, 0.58, 0.3, '#1F181E'], [0.42, 0.42, 0.58, 0.58, '#1F181E'], [0.42, 0.7, 0.58, 0.86, '#1F181E']],
  };

  class City {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.yaw = Math.PI / 4; this.yawGoal = this.yaw;
      this.hx = 0; this.hy = 0; this.hxGoal = 0; this.hyGoal = 0;
      this.time = 0;
      this.mat = {};
      for (const k in CITY_MAT) this.mat[k] = CITY_MAT[k].map(hex);
      this.build();
      this.buildPath();
      this.W = { s: 0, i: 0, wait: 0, phase: 0, blink: 3 };
      this.running = false; this.raf = 0; this.prev = 0;
      this.loop = this.loop.bind(this);
      this.resize();
    }

    build() {
      const solid = new Map(), room = new Map(), decal = new Map(), boxes = [];
      const key = (x, y, z) => x + ',' + y + ',' + z;
      const put = (x, y, z, m) => solid.set(key(x, y, z), m);
      const box = (x0, y0, z0, x1, y1, z1, m) => boxes.push({ b: [x0, y0, z0, x1, y1, z1], m });
      const dec = (x, y, z, f, t) => decal.set(key(x, y, z) + f, t);
      // foundation with a cream cornice, a raised courtyard, a planter, a bridge and two towers
      for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) for (let y = 0; y < 4; y++) {
        const edge = x === 0 || x === 9 || z === 0 || z === 9;
        put(x, y, z, y === 3 ? (edge ? 'trim' : 'deck') : 'stone');
      }
      for (let x = 3; x < 7; x++) for (let z = 3; z < 7; z++) { put(x, 4, z, 'court'); put(x, 5, z, 'trim'); }
      for (let x = 4; x < 6; x++) for (let z = 4; z < 6; z++) put(x, 6, z, 'planter');
      for (let x = 2; x < 8; x++) for (let z = 0; z < 2; z++) put(x, 6, z, 'trim');
      for (const tx of [0, 8]) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) for (let y = 4; y < 10; y++) {
        put(tx + dx, y, dz, y === 9 ? 'trim' : 'tower');
      }
      // rooms carved into the foundation, each lit by a lamp at the back
      this.lamps = [];
      for (const [x0, z0, o] of [[1, 8, [0, 0, 1]], [7, 8, [0, 0, 1]], [8, 4, [1, 0, 0]], [0, 3, [-1, 0, 0]], [4, 0, [0, 0, -1]]]) {
        for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) for (let y = 1; y < 3; y++) {
          const k = key(x0 + dx, y, z0 + dz);
          solid.delete(k); room.set(k, o);
        }
        const lx = x0 + 1 - o[0] * 0.6, lz = z0 + 1 - o[2] * 0.6;
        box(lx - 0.15, 1, lz - 0.15, lx + 0.15, 1.34, lz + 0.15, 'lamp');
        this.lamps.push({ x: lx, y: 1.25, z: lz, o });
      }
      // stairs: front, from the walkway up to the courtyard; back, from the courtyard up to the bridge
      for (let i = 0; i < 4; i++) box(4, 4, 9 - 0.5 * (i + 1), 6, 4.5 + 0.5 * i, 9 - 0.5 * i, 'trim');
      box(4, 4, 2.5, 6, 6.5, 3, 'trim');
      box(4, 4, 2, 6, 7, 2.5, 'trim');
      // the courtyard tree
      box(4.88, 7, 4.88, 5.12, 8.2, 5.12, 'trunk');
      box(4.25, 8.05, 4.25, 5.75, 9.25, 5.75, 'leaf');
      box(4.55, 9.25, 4.55, 5.45, 9.9, 5.45, 'leaf2');
      // lamp posts beside the front stairs
      for (const px of [3.5, 6.5]) {
        box(px - 0.07, 4, 8.43, px + 0.07, 4.95, 8.57, 'trunk');
        box(px - 0.16, 4.95, 8.34, px + 0.16, 5.27, 8.66, 'lamp');
        this.lamps.push({ x: px, y: 5.1, z: 8.5, o: null });
      }
      // windows, doors and dot reliefs
      for (const tx of [0, 8]) for (const y of [6, 8]) for (let d = 0; d < 2; d++) {
        dec(tx + d, y, 1, 'pz', 'slit'); dec(tx + d, y, 0, 'nz', 'slit');
        dec(tx + 1, y, d, 'px', 'slit'); dec(tx, y, d, 'nx', 'slit');
      }
      dec(1, 4, 1, 'pz', 'door'); dec(8, 4, 1, 'pz', 'door');
      for (const [x, z, f] of [[4, 9, 'pz'], [5, 9, 'pz'], [9, 7, 'px'], [9, 8, 'px'], [0, 7, 'nx'], [0, 8, 'nx'], [2, 0, 'nz'], [7, 0, 'nz']]) dec(x, 1, z, f, 'dots');
      for (const [x, z, f] of [[3, 6, 'pz'], [6, 6, 'pz'], [6, 4, 'px'], [6, 5, 'px'], [3, 4, 'nx'], [3, 5, 'nx'], [3, 3, 'nz'], [6, 3, 'nz']]) dec(x, 4, z, f, 'win');

      this.items = [];
      for (const [k, m] of solid) {
        const [x, y, z] = k.split(',').map(Number);
        const faces = [];
        for (const f of FACE_KEYS) {
          const s = FACE_STEP[f], nk = key(x + s[0], y + s[1], z + s[2]);
          if (solid.has(nk)) continue; // hidden against a neighbour
          faces.push({ f, room: room.get(nk) || null, decal: decal.get(k + f) || null });
        }
        if (faces.length) this.items.push({ b: [x, y, z, x + 1, y + 1, z + 1], m, faces, cx: x + 0.5, cy: y + 0.5, cz: z + 0.5 });
      }
      for (const it of boxes) {
        const b = it.b;
        it.faces = ALL_FACES;
        it.cx = (b[0] + b[3]) / 2; it.cy = (b[1] + b[4]) / 2; it.cz = (b[2] + b[5]) / 2;
        this.items.push(it);
      }
      for (const tx of [1, 9]) this.items.push({ roof: true, x: tx, z: 1, y0: 10, h: 1.18, H: 2.3, cx: tx, cy: 10.6, cz: 1 });
      this.floats = [
        { p: [-2.6, 7.5, 6.2], s: 0.6, m: 'float1', ph: 0 },
        { p: [11.6, 5.6, 2.6], s: 0.5, m: 'float2', ph: 2.1 },
        { p: [7.4, 12.4, -1.8], s: 0.45, m: 'float3', ph: 4.2 },
      ];
    }

    // The walker's loop: [x, top-of-surface y, z, pause seconds, stair steps on the way here]
    buildPath() {
      const P = [
        [8.5, 4, 9.5], [5, 4, 9.5], [5, 4, 9], [5, 6, 7, 0, 4], [5, 6, 6.5], [6.5, 6, 6.5], [6.5, 6, 3.5],
        [5, 6, 3.5], [5, 6, 3], [5, 7, 2, 0, 2], [5, 7, 1], [2.6, 7, 1, 1.8], [7.4, 7, 1, 1.8], [5, 7, 1],
        [5, 7, 2], [5, 6, 3, 0, 2], [5, 6, 3.5], [3.5, 6, 3.5], [3.5, 6, 6.5], [5, 6, 6.5, 1.4], [5, 6, 7],
        [5, 4, 9, 0, 4], [5, 4, 9.5], [0.5, 4, 9.5], [0.5, 4, 2.5, 1.2], [2.5, 4, 2.5], [2.5, 4, 1],
        [7.5, 4, 1, 1.2], [7.5, 4, 2.5], [9.5, 4, 2.5], [9.5, 4, 9.5], [8.5, 4, 9.5],
      ];
      this.pts = P.map(p => ({ x: p[0], y: p[1], z: p[2], pause: p[3] || 0, steps: p[4] || 0 }));
      this.cum = [0];
      for (let i = 1; i < this.pts.length; i++) {
        const a = this.pts[i - 1], b = this.pts[i];
        this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z) + Math.abs(b.y - a.y) * 0.3);
      }
      this.total = this.cum[this.cum.length - 1];
    }

    walk(dt) {
      const W = this.W;
      W.blink -= dt;
      if (W.blink < -0.12) W.blink = 2.5 + Math.random() * 3;
      if (W.wait > 0) { W.wait -= dt; W.phase = 0; return; }
      W.s += 0.8 * dt;
      W.phase += dt * 10;
      while (W.s >= this.cum[W.i + 1]) {
        W.i++;
        if (W.i >= this.pts.length - 1) { W.i = 0; W.s -= this.total; }
        const p = this.pts[W.i];
        if (p.pause) { W.wait = p.pause; W.s = this.cum[W.i]; break; }
      }
    }

    walker() {
      const W = this.W, a = this.pts[W.i], b = this.pts[W.i + 1];
      const t = clamp((W.s - this.cum[W.i]) / ((this.cum[W.i + 1] - this.cum[W.i]) || 1), 0, 1);
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      let y = a.y + (b.y - a.y) * t;
      if (b.steps) {
        // climb or drop one step at a time instead of gliding up a ramp
        const k = t * b.steps, i = Math.min(Math.floor(k), b.steps), f = k - i;
        const e = b.y > a.y ? smooth(f / 0.3) : smooth((f - 0.7) / 0.3);
        y = a.y + (b.y - a.y) * (i + (i < b.steps ? e : 0)) / b.steps;
      }
      let face;
      if (W.wait > 0) {
        // when it stops, it turns to look at you
        let best = -2;
        for (const f of ['px', 'nx', 'pz', 'nz']) { const v = this.rotN(FACE_STEP[f])[2]; if (v > best) { best = v; face = f; } }
      } else {
        const dx = b.x - a.x, dz = b.z - a.z;
        face = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'px' : 'nx') : (dz > 0 ? 'pz' : 'nz');
      }
      const walking = W.wait <= 0, bob = walking ? Math.abs(Math.sin(W.phase)) * 0.05 : 0;
      const fd = FACE_STEP[face], latX = -fd[2], latZ = fd[0], legH = 0.13, hw = 0.25, bh = 0.48, by = y + legH + bob;
      const eyeV = W.blink < 0 ? [0.56, 0.62] : [0.5, 0.68];
      const items = [
        { shadow: true, x, y, z, cx: x, cy: y + 0.001, cz: z },
        { b: [x - hw, by, z - hw, x + hw, by + bh, z + hw], m: 'body', faces: ALL_FACES, cx: x, cy: by + bh / 2, cz: z,
          eye: { f: face, t: [[0.2, eyeV[0], 0.38, eyeV[1], '#F1E6D6'], [0.62, eyeV[0], 0.8, eyeV[1], '#F1E6D6']] } },
      ];
      for (const side of [-1, 1]) {
        const sw = walking ? Math.sin(W.phase) * 0.06 * side : 0;
        const lx = x + latX * 0.12 * side + fd[0] * sw, lz = z + latZ * 0.12 * side + fd[2] * sw;
        items.push({ b: [lx - 0.06, y, lz - 0.06, lx + 0.06, y + legH + bob * 0.5, lz + 0.06], m: 'leg', faces: ALL_FACES, cx: lx, cy: y + 0.06, cz: lz });
      }
      return items;
    }

    setView() {
      const yaw = this.yaw + this.hx * 0.12, pitch = 0.6 + this.hy * 0.05;
      this.cY = Math.cos(yaw); this.sY = Math.sin(yaw); this.cP = Math.cos(pitch); this.sP = Math.sin(pitch);
    }
    P(x, y, z) {
      const X = x - 5, Y = y - 6, Z = z - 5;
      const xr = X * this.cY - Z * this.sY, zr = X * this.sY + Z * this.cY;
      this.px = this.ox + xr * this.S;
      this.py = this.oy + (-Y * this.cP + zr * this.sP) * this.S;
    }
    depth(x, y, z) { const X = x - 5, Y = y - 6, Z = z - 5; return (X * this.sY + Z * this.cY) * this.cP + Y * this.sP; }
    rotN(n) { return [n[0] * this.cY - n[2] * this.sY, n[1], n[0] * this.sY + n[2] * this.cY]; }
    facing(nv) { return nv[1] * this.sP + nv[2] * this.cP > 0.001; }
    lit(nv) { return 0.42 + 0.72 * Math.max(0, nv[0] * CITY_LIGHT[0] + nv[1] * CITY_LIGHT[1] + nv[2] * CITY_LIGHT[2]); }

    faceColor(m, f, nv, room) {
      if (room) {
        if (f === 'py') return ROOM_RGB.floor;
        const n = FACE_STEP[f];
        return n[0] * room[0] + n[2] * room[2] > 0.5 ? ROOM_RGB.back : ROOM_RGB.side;
      }
      const base = this.mat[m][f === 'py' ? 1 : 0];
      return CITY_UNLIT[m] ? base : mul(base, this.lit(nv));
    }

    drawBox(it) {
      const ctx = this.ctx, b = it.b;
      for (const fc of it.faces) {
        const F = CITY_FACES[fc.f], nv = this.rotN(F.n);
        if (!this.facing(nv)) continue;
        const cs = F.c(b);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { this.P(cs[i][0], cs[i][1], cs[i][2]); if (i) ctx.lineTo(this.px, this.py); else ctx.moveTo(this.px, this.py); }
        ctx.closePath();
        const col = css(this.faceColor(it.m, fc.f, nv, fc.room));
        ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.stroke();
        if (fc.decal) this.decal(cs, DECALS[fc.decal]);
        if (it.eye && it.eye.f === fc.f) this.decal(cs, it.eye.t);
      }
    }

    decal(cs, rects) {
      const ctx = this.ctx, bl = cs[0], br = cs[1], tl = cs[3];
      const pt = (u, v) => this.P(
        bl[0] + u * (br[0] - bl[0]) + v * (tl[0] - bl[0]),
        bl[1] + u * (br[1] - bl[1]) + v * (tl[1] - bl[1]),
        bl[2] + u * (br[2] - bl[2]) + v * (tl[2] - bl[2]));
      for (const [u0, v0, u1, v1, col] of rects) {
        ctx.beginPath();
        pt(u0, v0); ctx.moveTo(this.px, this.py);
        pt(u1, v0); ctx.lineTo(this.px, this.py);
        pt(u1, v1); ctx.lineTo(this.px, this.py);
        pt(u0, v1); ctx.lineTo(this.px, this.py);
        ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      }
    }

    drawRoof(it) {
      const ctx = this.ctx, { x, z, y0, h, H } = it, roof = this.mat.roof[0];
      const base = [[x - h, y0, z + h], [x + h, y0, z + h], [x + h, y0, z - h], [x - h, y0, z - h]];
      for (const [a, c, n] of [[0, 1, [0, h, H]], [1, 2, [H, h, 0]], [2, 3, [0, h, -H]], [3, 0, [-H, h, 0]]]) {
        const l = Math.hypot(n[0], n[1], n[2]), nv = this.rotN([n[0] / l, n[1] / l, n[2] / l]);
        if (!this.facing(nv)) continue;
        ctx.beginPath();
        this.P(base[a][0], base[a][1], base[a][2]); ctx.moveTo(this.px, this.py);
        this.P(base[c][0], base[c][1], base[c][2]); ctx.lineTo(this.px, this.py);
        this.P(x, y0 + H, z); ctx.lineTo(this.px, this.py);
        ctx.closePath();
        const col = css(mul(roof, this.lit(nv)));
        ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }

    drawShadow(it) {
      const ctx = this.ctx, r = 0.3, y = it.y + 0.003;
      ctx.beginPath();
      this.P(it.x - r, y, it.z - r); ctx.moveTo(this.px, this.py);
      this.P(it.x + r, y, it.z - r); ctx.lineTo(this.px, this.py);
      this.P(it.x + r, y, it.z + r); ctx.lineTo(this.px, this.py);
      this.P(it.x - r, y, it.z + r); ctx.lineTo(this.px, this.py);
      ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
    }

    draw() {
      const ctx = this.ctx, w = this.w, h = this.h;
      if (!w || !h) return;
      for (const k of ['yaw', 'yawGoal', 'hx', 'hy', 'time']) if (!Number.isFinite(this[k])) this[k] = k.startsWith('yaw') ? Math.PI / 4 : 0;
      ctx.clearRect(0, 0, w, h);
      this.setView();
      // soft shadow under the whole block
      this.P(5, 0, 5);
      ctx.save();
      ctx.translate(this.px, this.py + this.S * 0.6); ctx.scale(1, 0.5);
      const R = this.S * 9, g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.restore();
      const list = this.items.slice();
      const t = this.time;
      for (const fl of this.floats) {
        const s = fl.s / 2, bob = Math.sin(t * 0.5 + fl.ph) * 0.18, [x, y, z] = fl.p;
        list.push({ b: [x - s, y - s + bob, z - s, x + s, y + s + bob, z + s], m: fl.m, faces: ALL_FACES, cx: x, cy: y + bob, cz: z });
      }
      for (const it of this.walker()) list.push(it);
      for (const it of list) it.d = this.depth(it.cx, it.cy, it.cz);
      list.sort((a, b) => a.d - b.d);
      for (const it of list) {
        if (it.roof) this.drawRoof(it);
        else if (it.shadow) this.drawShadow(it);
        else this.drawBox(it);
      }
      // warm light spilling from lamps and from rooms that face the camera
      ctx.globalCompositeOperation = 'screen';
      for (const L of this.lamps) {
        if (L.o && !(this.rotN(L.o)[2] > 0.05)) continue;
        this.P(L.x, L.y, L.z);
        const r = this.S * (L.o ? 1.3 : 0.9), lg = ctx.createRadialGradient(this.px, this.py, 0, this.px, this.py, r);
        lg.addColorStop(0, 'rgba(242,170,100,.45)'); lg.addColorStop(1, 'rgba(242,170,100,0)');
        ctx.fillStyle = lg; ctx.fillRect(this.px - r, this.py - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    resize() {
      const r = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2);
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.S = Math.min(this.w, this.h) / 19.5;
      this.ox = this.w / 2; this.oy = this.h / 2 - this.S * 0.2;
      this.draw();
    }

    snap(a) { const q = Math.PI / 2, o = Math.PI / 4; return o + Math.round((a - o) / q) * q; }
    turn(dir) { this.setYaw(this.snap(this.yawGoal) + dir * Math.PI / 2); }
    setYaw(a) { this.yawGoal = a; if (!this.running) { this.yaw = a; this.draw(); } }
    hover(nx, ny) {
      this.hxGoal = nx; this.hyGoal = ny;
      if (!this.running) { this.hx = nx; this.hy = ny; this.draw(); }
    }

    step(dt) {
      this.time += dt;
      const k = 1 - Math.exp(-dt * 6), kh = 1 - Math.exp(-dt * 4);
      this.yaw += (this.yawGoal - this.yaw) * k;
      this.hx += (this.hxGoal - this.hx) * kh; this.hy += (this.hyGoal - this.hy) * kh;
      this.walk(dt);
    }

    start() {
      if (this.running) return;
      this.running = true; this.prev = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
    stop() {
      if (!this.running) return;
      this.running = false; cancelAnimationFrame(this.raf);
      this.yaw = this.yawGoal; this.draw();
    }
    loop(now) {
      if (!this.running) return;
      const t = frameTime(now), dt = frameDt(t, this.prev);
      this.prev = t;
      this.step(dt); this.draw();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  Portfolio.City = City;
})();
