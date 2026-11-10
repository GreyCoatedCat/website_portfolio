/* Shared helpers and page-wide state. Loaded first; the other scripts read everything from window.Portfolio. */
(() => {
  'use strict';
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const css = c => 'rgb(' + Math.min(255, c[0] | 0) + ',' + Math.min(255, c[1] | 0) + ',' + Math.min(255, c[2] | 0) + ')';
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const hits = (A, B) => A[0] < B[1] && A[1] > B[0] && A[2] < B[3] && A[3] > B[2] && A[4] < B[5] && A[5] > B[4];
  const TAU = Math.PI * 2;
  // Some hosts call animation frames without a timestamp (or with a different clock).
  // Normalise it so a missing value can never turn the scene state into NaN.
  const frameTime = now => (Number.isFinite(now) ? now : performance.now());
  const frameDt = (t, prev) => { const d = (t - prev) / 1000; return d > 0 ? Math.min(d, 0.05) : 0; };
  // Stable hash: the same tile always gets the same colour, so the corridor can be endless without storing it.
  function rand(a, b, c) {
    let h = (Math.imul(a | 0, 0x27d4eb2d) + Math.imul(b | 0, 0x165667b1) + Math.imul(c | 0, 0x2545f491) + 0x9e3779b9) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  window.Portfolio = {
    reduceMQ,
    // whether to animate; follows the system's reduced-motion setting (kept current by main.js)
    state: { motion: !reduceMQ.matches },
    COARSE: window.matchMedia('(pointer: coarse)').matches,
    util: { hex, css, mix, mul, clamp, smooth, hits, TAU, frameTime, frameDt, rand },
  };
})();
