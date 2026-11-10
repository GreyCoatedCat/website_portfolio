/* Selected text in the accent colour, drawn in rather than switched on. The highlight sweeps from where the
   selection started toward where it ends, and while dragging it trails the pointer with a short ease, the way
   the cursor cube follows the mouse. Uses the CSS Custom Highlight API: the native selection stays (copying
   works as usual) but is made transparent, and this script paints the orange over the part swept so far.
   Browsers without the API keep the plain orange ::selection from base.css. */
(() => {
  'use strict';
  if (!(window.CSS && CSS.highlights && window.Highlight && window.StaticRange)) return;
  const state = Portfolio.state;
  const hl = new Highlight();
  CSS.highlights.set('sel', hl);
  document.documentElement.classList.add('sel-drawn');

  let segs = [];          // the selected text as [text node, start, end] pieces in reading order
  let total = 0;          // characters selected
  let shown = 0;          // characters painted so far (eases toward total)
  let backward = false;   // selected from right to left: grow from the end instead
  let aNode = null, aOff = -1;
  let raf = 0, last = 0;

  function collect(range) {
    segs = []; total = 0;
    const push = (node, s, e) => {
      if (e <= s || !/\S/.test(node.data.slice(s, e))) return; // whitespace between tags has nothing to show
      segs.push([node, s, e]); total += e - s;
    };
    const top = range.commonAncestorContainer;
    if (top.nodeType === Node.TEXT_NODE) { push(top, range.startOffset, range.endOffset); return; }
    const walk = document.createTreeWalker(top, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (range.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      push(n, n === range.startContainer ? range.startOffset : 0, n === range.endContainer ? range.endOffset : n.length);
    }
  }

  // The first n characters counted from the side the selection was started on.
  function part(n) {
    if (!backward) {
      const [n0, s0] = segs[0];
      for (const [node, s, e] of segs) {
        if (n <= e - s) return new StaticRange({ startContainer: n0, startOffset: s0, endContainer: node, endOffset: s + n });
        n -= e - s;
      }
    } else {
      const [nz, , ez] = segs[segs.length - 1];
      for (let i = segs.length - 1; i >= 0; i--) {
        const [node, s, e] = segs[i];
        if (n <= e - s) return new StaticRange({ startContainer: node, startOffset: e - n, endContainer: nz, endOffset: ez });
        n -= e - s;
      }
    }
    const [n0, s0] = segs[0], [nz, , ez] = segs[segs.length - 1];
    return new StaticRange({ startContainer: n0, startOffset: s0, endContainer: nz, endOffset: ez });
  }

  function paint() {
    hl.clear();
    const n = Math.round(shown);
    if (n > 0 && segs.length) hl.add(part(n));
  }

  function tick(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const gap = total - shown;
    // eased, with a floor on speed: a word sweeps in well under a fifth of a second, a paragraph in about 0.4s
    const step = gap * (1 - Math.exp(-dt * 16)) + Math.sign(gap) * Math.min(Math.abs(gap), dt * 70);
    shown = Math.abs(gap) <= Math.abs(step) + 0.5 ? total : shown + step;
    paint();
    raf = shown !== total ? requestAnimationFrame(tick) : 0;
  }

  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      segs = []; total = shown = 0; aNode = null; hl.clear();
      return;
    }
    const range = sel.getRangeAt(0);
    // a new anchor means a new selection, which starts from nothing; otherwise it grows or shrinks from where it is
    if (sel.anchorNode !== aNode || sel.anchorOffset !== aOff) { aNode = sel.anchorNode; aOff = sel.anchorOffset; shown = 0; }
    backward = sel.anchorNode !== range.startContainer || sel.anchorOffset !== range.startOffset;
    collect(range);
    shown = Math.min(shown, total);
    if (!state.motion) { shown = total; paint(); return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  });
})();
