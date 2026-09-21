/* ---------------------------------------------------------------
   Bootstrap: build the requested board from data, fit it to the
   viewport, run the timeline, wire the hover-only switcher.
---------------------------------------------------------------- */

const HOLD = 3600;   // how long a phrase sits at the centre of the cycler

const px = v => v + 'px';
const stage = document.getElementById('stage');

const ROOT = getComputedStyle(document.documentElement);
const token = n => ROOT.getPropertyValue(n).trim();
const tokenMs = n => parseFloat(token(n));

/* ---------- element builders, one per node kind ---------------- */

const BUILD = {
  svg(node){
    const d = document.createElement('div');
    if (node._svg){                  // inlined so currentColor reaches the fill
      d.innerHTML = node._svg;
      d.classList.add('letter');
    } else {
      const img = document.createElement('img');
      img.src = node.src; img.alt = '';
      d.appendChild(img);
    }
    return d;
  },

  text(node){
    const p = document.createElement('p');
    p.className = node.cls;
    p.innerHTML = node.html;
    return p;
  },

  cycler(node){
    return node.mode === 'single' ? cyclerSingle(node) : cyclerStack(node);
  },

  walk(node){
    const c = document.createElement('canvas');
    c.className = 'walk';
    const man = node._manifest;
    const px  = node._frames.find(Boolean);    // backing store = the sprite's
    c.width   = px ? px.naturalWidth  : Math.round(man.width);   // own pixel size
    c.height  = px ? px.naturalHeight : Math.round(man.height);
    c._walk = { manifest: man, frames: node._frames };
    return c;
  }
};

/* the letterforms are fetched as text and inlined, so their currentColor fill
   picks up --letter and the colour lives in exactly one place */
async function loadTints(nodes){
  await Promise.all(nodes.filter(n => n.tint).map(async n => {
    n._svg = await fetch(n.src).then(r => r.text());
  }));
}

/* the footage, matted, as a frame sequence plus the geometry that lands its
   settled pose exactly on the mascot's Figma box */
async function loadWalk(base){
  const manifest = await fetch(base + 'walk.json').then(r => r.json());
  // decode() rather than onload: a frame that is loaded but not yet decoded
  // decodes on its first drawImage, which is exactly when the walk starts and
  // is what made its opening stutter
  const frames = await Promise.all(
    Array.from({ length: manifest.count }, async (_, i) => {
      const im = new Image();
      im.src = `${base}f${String(i).padStart(3, '0')}.webp`;
      try { await im.decode(); return im; } catch { return null; }
    }));
  return { manifest, frames };
}

/* board 1 — one phrase at a time, leaving and arriving letter by letter.
   The old phrase is fully gone before the new one starts: two phrases
   crossfading in the same place read as a ghosted double exposure, not
   as a change, so they are sequenced rather than blended. */
function cyclerSingle(node){
  const box = document.createElement('div');
  box.className = 'cycler-single';

  const phrases = node.phrases.map(text => {
    const el = document.createElement('div');
    el.className = 'phrase ' + node.cls;
    // the letters go inside one block child: .phrase is a flex container, so
    // splitting its text directly would turn every letter into a flex item
    // and collapse the two-line setting into a single row
    const inner = document.createElement('span');
    inner.className = 'phrase-text';
    inner.textContent = text;
    el.appendChild(inner);
    box.appendChild(el);
    return { el, chars: splitChars(inner) };   // splitChars() lives in timeline.js
  });

  const D     = tokenMs('--dur-letter');
  const STEP  = tokenMs('--stagger-letter');
  const RISE  = parseFloat(token('--letter-rise'));
  const DIP   = parseFloat(token('--letter-dip'));
  const FROM  = parseFloat(token('--cycle-in-from'));
  const GAP   = tokenMs('--cycle-gap');
  const EASE_OUT = token('--ease-letter-out');
  const EASE_DIP = token('--ease-letter-dip');
  const EASE_IN  = token('--ease-letter-in');
  const DIP_AT   = 0.22;    // where in the exit the dip bottoms out

  // both return how long the whole phrase takes, last letter included
  const span = p => (p.chars.length - 1) * STEP + D;

  // the dip is an explicit keyframe rather than a side effect of an
  // overshooting curve, so its depth is exact and tunable from :root
  const exit = p => {
    p.chars.forEach((c, i) => c.animate(
      [{ opacity: 1, transform: 'translateY(0px)',          easing: EASE_DIP },
       { opacity: 1, transform: `translateY(${DIP}px)`,     easing: EASE_OUT, offset: DIP_AT },
       { opacity: 0, transform: `translateY(${-RISE}px)` }],
      { fill: 'both', duration: D, delay: i * STEP }));
    return span(p);
  };

  const enter = p => {
    p.chars.forEach((c, i) => c.animate(
      [{ opacity: 0, transform: `translateY(${FROM}px)` },
       { opacity: 1, transform: 'translateY(0px)' }],
      { fill: 'both', duration: D, delay: i * STEP, easing: EASE_IN }));
    return span(p);
  };

  let i = 0;

  // phrase lengths differ, so each leg is scheduled off the previous one's
  // real duration rather than off a fixed interval
  function queue(afterEntry){
    setTimeout(() => {
      const out = exit(phrases[i]);
      setTimeout(() => {
        i = (i + 1) % phrases.length;
        queue(enter(phrases[i]));
      }, out + GAP);                  // the gap is what keeps the two apart
    }, afterEntry + HOLD);
  }

  box._start = delay => setTimeout(() => queue(enter(phrases[0])), delay);

  return box;
}

/* board 2 — three-line stack rolling up, centre line black */
function cyclerStack(node){
  const box = document.createElement('div');
  box.className = 'cycler-stack ' + node.cls;

  const track = document.createElement('div');
  track.className = 'track';
  box.appendChild(track);

  const n = node.phrases.length;
  const rows = [];
  for (let c = 0; c < 4; c++){                 // repeat the list so the roll never runs out
    for (const text of node.phrases){
      const r = document.createElement('div');
      r.className = 'row';
      r.textContent = text;
      track.appendChild(r);
      rows.push(r);
    }
  }

  const ease  = token('--ease-throw');
  const dur   = tokenMs('--dur-cycle');
  const STEP  = 22;                            // one line-height
  const BLEED = parseFloat(token('--stack-bleed'));   // the soft margin above row 1
  let step = 0;

  const slide = () => `translateY(${BLEED - STEP * step}px)`;
  track.style.transform = slide();

  // A row's whole appearance is a function of where it is relative to the
  // centre: faint and light below, black and bold at the centre, easing back
  // toward grey above. The classes only name the position — every value is a
  // token in app.css, and all three properties share --ease-throw with the
  // travel, so the ramp reads as one continuous move.
  const setActive = centre => rows.forEach((r, idx) => {
    const d = idx - centre;
    r.classList.toggle('pos-in',    d ===  1);   // below, arriving
    r.classList.toggle('is-active', d ===  0);   // the centre line
    r.classList.toggle('pos-out',   d === -1);   // above, leaving
  });
  setActive(1);                                // matches the frame: middle line is black

  box._start = delay => setTimeout(() => {
    setInterval(() => {
      step += 1;
      track.style.transition = `transform ${dur}ms ${ease}`;
      track.style.transform  = slide();
      setActive(step + 1);

      if (step === n){                         // after one full cycle, jump back invisibly
        setTimeout(() => {
          rows.forEach(r => r.style.transition = 'none');
          track.style.transition = 'none';
          step = 0;
          track.style.transform = slide();
          setActive(1);
          void track.offsetHeight;             // force reflow before re-enabling transitions
          rows.forEach(r => r.style.transition = '');
        }, dur);
      }
    }, HOLD + dur);
  }, delay);

  return box;
}

/* ---------- build + run ---------------------------------------- */

function buildBoard(key){
  const board = BOARDS[key];
  const els = {};

  for (const node of board.nodes){
    if (node.kind === 'walk'){                  // manifest supplies the box
      const m = node._manifest;
      node.x = m.x[0]; node.y = m.boardY; node.w = m.width; node.h = m.height;
    }
    const el = BUILD[node.kind](node);
    el.classList.add('node', 'anim');
    el.dataset.id = node.id;
    Object.assign(el.style, {
      left: px(node.x), top: px(node.y),
      width: px(node.w), height: px(node.h)
    });
    stage.appendChild(el);
    els[node.id] = el;
  }
  return { board, els };
}

function fit(){
  const s = Math.min(window.innerWidth / 1512, window.innerHeight / 982);
  stage.style.transform = `scale(${s})`;
}

function wireSwitcher(current){
  const nav = document.getElementById('switcher');

  // a real reload, so the whole timeline replays from frame zero
  const go = v => { if (v !== current) window.location.search = '?v=' + v; };

  for (const btn of nav.querySelectorAll('button')){
    const v = btn.dataset.v;
    btn.setAttribute('aria-current', String(v === current));
    btn.addEventListener('click', () => go(v));
  }

  // Reveal on pointer movement into the top-right corner, driven from JS
  // rather than left to :hover, which does not fire in every embedded browser.
  const zw = parseFloat(token('--switch-zone-w'));
  const zh = parseFloat(token('--switch-zone-h'));
  window.addEventListener('mousemove', e => {
    const inCorner = e.clientX > window.innerWidth - zw && e.clientY < zh;
    nav.classList.toggle('is-shown', inCorner);
  }, { passive: true });

  // Keys are the reliable route: they need no hover and leave no trace on a
  // screen recording. 1 and 2 pick a board, left/right step between them.
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '1' || e.key === '2') go(e.key);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') go(current === '1' ? '2' : '1');
  });
}

(async function init(){
  const v = new URLSearchParams(location.search).get('v') === '2' ? '2' : '1';
  document.title = `Jitterbug Folk — board ${v}`;
  document.body.classList.add('board-' + v);      // board-scoped colour tokens

  await loadTints(BOARDS[v].nodes);

  // the mascot's walk, if this board uses one
  for (const node of BOARDS[v].nodes){
    if (node.kind === 'walk'){
      const { manifest, frames } = await loadWalk(node.src);
      node._manifest = manifest; node._frames = frames;
    }
  }

  const { board, els } = buildBoard(v);
  fit();
  window.addEventListener('resize', fit);
  wireSwitcher(v);

  // elements revealed span-by-span must be visible themselves;
  // only whole-element entrances start from opacity 0
  for (const cue of board.timeline){
    const el = els[cue.target];
    if (cue.kind === 'lines' || cue.kind === 'words') el.classList.remove('anim');
    if (cue.kind === 'cycler' && el.classList.contains('cycler-single')) el.classList.remove('anim');
  }

  await document.fonts.ready;      // measure real lines, and never type into a fallback face
  requestAnimationFrame(() => runTimeline(board, els));
})();
