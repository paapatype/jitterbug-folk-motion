/* ---------------------------------------------------------------
   One declarative timeline runner, shared by both boards.
   Sequencing is expressed as data ({kind, target, at, dur, ...});
   nothing here knows which board it is animating.
---------------------------------------------------------------- */

const CSS = getComputedStyle(document.documentElement);
const tok = v => (typeof v === 'string' && v.startsWith('--')) ? CSS.getPropertyValue(v).trim() : v;
const ms  = v => { const s = tok(v); return typeof s === 'number' ? s : parseFloat(s); };

const FILL = { fill: 'both', easing: 'linear' };

/* ---------- text splitting -------------------------------------
   Words become inline-block spans (so they can be transformed);
   characters stay inline spans (so wrapping is untouched).      */

function textNodesOf(el){
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out = []; while (w.nextNode()) out.push(w.currentNode);
  return out;
}

function wrap(node, pattern, cls){
  const frag = document.createDocumentFragment();
  for (const part of node.nodeValue.split(pattern)){
    if (!part) continue;
    if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
    const s = document.createElement('span');
    s.className = cls; s.textContent = part;
    frag.appendChild(s);
  }
  node.parentNode.replaceChild(frag, node);
}

function splitWords(el){
  textNodesOf(el).forEach(n => wrap(n, /(\s+)/, 'w'));
  return [...el.querySelectorAll('.w')];
}

function splitChars(el){
  textNodesOf(el).forEach(n => wrap(n, /()/, 'ch'));
  return [...el.querySelectorAll('.ch')];
}

/* group word spans into their real, laid-out visual lines */
function linesOf(words){
  const lines = new Map();
  for (const w of words){
    const key = Math.round(w.offsetTop);
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(w);
  }
  return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
}

/* ---------- effects --------------------------------------------
   Each returns the time (ms, relative to t0) at which it ends.  */

const EFFECTS = {
  fade(el, cue, t0){
    const d = ms(cue.dur || '--dur-fade');
    el.animate([{ opacity: 0 }, { opacity: 1 }],
      { ...FILL, delay: t0, duration: d, easing: tok(cue.ease || '--ease-cross') });
    return t0 + d;
  },

  glyph(el, cue, t0){
    const d  = ms(cue.dur || '--dur-glyph');
    const dx = (cue.from && cue.from.x) || 0;
    const dy = (cue.from && cue.from.y) || 0;
    el.animate(
      [{ opacity: 0, transform: `translate(${dx}px, ${dy}px)` },
       { opacity: 1, transform: 'translate(0px, 0px)' }],
      { ...FILL, delay: t0, duration: d, easing: tok(cue.ease || '--ease-entry') });
    return t0 + d;
  },

  /* fade in one real visual line at a time, with a 12px upward drift */
  lines(el, cue, t0){
    const d    = ms(cue.dur || '--dur-fade');
    const step = ms(cue.stagger || '--stagger-line');
    const ease = tok(cue.ease || '--ease-cross');
    const rows = linesOf(splitWords(el));
    rows.forEach((row, i) => row.forEach(w => w.animate(
      [{ opacity: 0, transform: 'translateY(12px)' },
       { opacity: 1, transform: 'translateY(0px)' }],
      { ...FILL, delay: t0 + i * step, duration: d, easing: ease })));
    return t0 + (rows.length - 1) * step + d;
  },

  /* plays the matted footage as a frame sequence while translating the
     sprite leftward; it ends holding the settled frame, which is the mascot's
     resting artwork, so there is no handoff to a second element */
  /* The headline, one word at a time, fading only.

     No movement at all: opacity is the whole effect. Earlier versions lifted
     each word a few pixels as it arrived, and two dozen words each starting
     their own little travel at a different moment is what read as jitter —
     it was the movement, not the frame rate. A word either is not there yet
     or is fading up in place. */
  words(el, cue, t0){
    const dur  = ms(cue.dur     || '--headline-dur');
    const step = ms(cue.stagger || '--headline-step');
    const ease = tok(cue.ease   || '--ease-cross');
    const ws   = splitWords(el);
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    ws.forEach((w, i) => w.animate([{ opacity: 0 }, { opacity: 1 }],
      { ...FILL, delay: calm ? t0 : t0 + i * step,
        duration: calm ? 200 : dur, easing: ease }));
    return calm ? t0 + 200 : t0 + (ws.length - 1) * step + dur;
  },

  walk(el, cue, t0){
    const { frames, manifest } = el._walk;
    const spf  = 1000 / manifest.fps;
    const last = manifest.count - 1;
    el._t0 = t0; el._tEnd = t0 + manifest.count * spf;   // for verification
    const ctx = el.getContext('2d');
    const x0  = manifest.x[0];
    let shown = -1;                       // the frame currently on the canvas

    const draw = i => {
      // frames arrive progressively; if this one has not landed yet, hold the
      // most recent one that has rather than blanking the mascot
      let f = frames[i], from = i;
      for (; !f && from >= 0; from--) f = frames[from];
      ctx.clearRect(0, 0, el.width, el.height);
      if (f) ctx.drawImage(f, 0, 0, el.width, el.height);
      // transform rather than `left`: it composites, and it never asks the
      // page for a layout on a frame the mascot is mid-stride
      el.style.transform = `translateX(${(manifest.x[i] - x0).toFixed(2)}px)`;
      shown = i;
      return f === frames[i];            // false if we had to fall back
    };
    draw(0);
    // it fades up as it enters, instead of arriving at full strength
    el.animate([{ opacity: 0 }, { opacity: 1 }],
      { ...FILL, delay: t0, duration: ms(cue.fade || '--walk-fade'),
        easing: tok(cue.ease || '--ease-cross') });

    // driven from the timeline's own origin, so an imprecise setTimeout cannot
    // leave the mascot walking after the moment it was supposed to arrive
    const startAt = ORIGIN + t0;
    const tick = now => {
      const i = Math.min(last, Math.max(0, Math.floor((now - startAt) / spf)));
      // only repaint when the frame actually changes: at 24fps against a 120Hz
      // display this was clearing and redrawing the sprite five times per frame
      if (i !== shown){
        const exact = draw(i);
        // if the final frame had not arrived yet, come back for it
        if (i === last && !exact) frames[last] ? draw(last) : setTimeout(() => draw(last), 250);
      }
      if (i < last) requestAnimationFrame(tick);
    };
    setTimeout(() => requestAnimationFrame(tick), t0);
    return t0 + manifest.count * spf;
  },

  cycler(el, cue, t0){
    const d = ms(cue.dur || '--dur-fade');
    // the stacked cycler fades in as a block; the single one is carried
    // in by its first phrase, so fading the box too would double up
    if (el.classList.contains('cycler-stack') || el.classList.contains('cycler-slide')){
      el.animate([{ opacity: 0 }, { opacity: 1 }],
        { ...FILL, delay: t0, duration: d, easing: tok(cue.ease || '--ease-cross') });
    }
    el._start(t0);
    return t0 + d;
  }
};

/* ---------- runner ---------------------------------------------
   Two passes: resolve every cue's absolute start time (cues may be
   anchored to the end of another cue), then fire them all at once.
---------------------------------------------------------------- */

let ORIGIN = 0;

function runTimeline(board, els){
  ORIGIN = performance.now();     // every cue is measured from this instant
  const ends = {};

  // a cue's offset may be a function of the tokens and of an asset's own
  // natural length, so nothing about the sequencing has to be hardcoded
  const ctx = {
    ms,
    walkMs: id => {
      const el = els[id];
      return el && el._walk ? el._walk.manifest.count * 1000 / el._walk.manifest.fps : 0;
    }
  };
  const offsetOf = cue => typeof cue.at === 'function' ? cue.at(ctx) : (cue.at || 0);

  // pass 1 — cues with no anchor, in declaration order
  const pending = [];
  for (const cue of board.timeline){
    if (cue.after){ pending.push(cue); continue; }
    const el = els[cue.target];
    ends[cue.target] = Math.max(ends[cue.target] || 0, EFFECTS[cue.kind](el, cue, offsetOf(cue)));
  }

  // pass 2 — cues anchored to the end of an earlier cue
  for (const cue of pending){
    const base = ends[cue.after] || 0;
    const el = els[cue.target];
    ends[cue.target] = Math.max(ends[cue.target] || 0,
                                EFFECTS[cue.kind](el, cue, base + offsetOf(cue)));
  }

  return ends;
}
