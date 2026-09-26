/* ---------------------------------------------------------------
   Bootstrap: build the requested board from data, fit it to the
   viewport, run the timeline.
---------------------------------------------------------------- */

const HOLD = 3130;   // how long a phrase sits at the centre of the cycler (15% faster)

const px = v => v + 'px';
const stage = document.getElementById('stage');

/* The build stamp index.html carries on its own assets, reused for everything
   fetched at run time — the frames and the letterforms are on the same
   ten-minute cache as the code, and a new build must not be served old art. */
const BUILD_ID = (() => {
  const s = [...document.querySelectorAll('script[src]')].map(e => e.src).find(u => u.includes('main.js'));
  const m = s && s.match(/[?&]b=([^&]+)/);
  return m ? m[1] : '';
})();
const bust = url => BUILD_ID ? url + (url.includes('?') ? '&' : '?') + 'b=' + BUILD_ID : url;

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
    if (node.mode === 'slide')  return cyclerSlide(node);
    return cyclerStack(node);
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
    n._svg = await fetch(bust(n.src)).then(r => r.text());
  }));
}

/* the footage, matted, as a frame sequence plus the geometry that lands its
   settled pose exactly on the mascot's Figma box */
async function loadWalk(base){
  const manifest = await fetch(bust(base + 'walk.json')).then(r => r.json());
  // The frames are ~5MB in total. Awaiting all of them before building the
  // board left the page blank for as long as the download took — invisible on
  // localhost, ten to forty seconds over the network. So: take a head start of
  // frames, hand the board back, and let the rest arrive in the background.
  //
  // decode() rather than onload, because a frame that is loaded but not yet
  // decoded decodes on its first drawImage — which is exactly when the walk
  // starts, and is what made its opening stutter.
  const frames = new Array(manifest.count).fill(null);
  const load = i => new Promise(res => {
    const im = new Image();
    // onload, not decode(), as the readiness signal: decode() does not settle
    // in a backgrounded document, which would leave the board blank. decode()
    // is still called, but only as a hint, so the first drawImage of a frame
    // does not have to decode it mid-walk.
    im.onload  = () => { frames[i] = im; im.decode && im.decode().catch(() => {}); res(); };
    im.onerror = () => res();
    im.src = bust(`${base}f${String(i).padStart(3, '0')}.webp`);
  });

  // A head start means the walk opens smoothly, but it must never be a
  // precondition for the board appearing — a stalled or slow image would
  // otherwise hold the whole page blank. Whichever comes first wins.
  const HEAD_START = Math.min(24, manifest.count);          // ~1s of walking
  const started = Promise.all(Array.from({ length: HEAD_START }, (_, i) => load(i)));
  for (let i = HEAD_START; i < manifest.count; i++) load(i);
  await Promise.race([started, new Promise(r => setTimeout(r, 1500))]);

  return { manifest, frames };
}

/* phone — a horizontal slide carrying the whole list.
   No window, no ramp, no highlighted centre: the phone frame shows every entry
   the same. The track holds the list twice and travels exactly one list-width,
   so the wrap lands on an identical arrangement and cannot be seen. */
function cyclerSlide(node){
  const box = document.createElement('div');
  box.className = 'cycler-slide';
  const track = document.createElement('div');
  track.className = 'track';
  box.appendChild(track);

  for (let copy = 0; copy < 2; copy++){
    for (const text of node.phrases){
      const s = document.createElement('span');
      s.className = 'item';
      s.textContent = text;
      track.appendChild(s);
    }
  }

  const gap   = parseFloat(token('--m-ticker-gap'));
  const speed = parseFloat(token('--m-ticker-speed'));   // board px per second

  box._start = delay => {
    const n = node.phrases.length;
    const items = [...track.children];
    // offsetWidth is the untransformed layout width, so this is in board px
    let period = gap * n;
    for (let i = 0; i < n; i++) period += items[i].offsetWidth;
    track.animate(
      [{ transform: 'translateX(0px)' },
       { transform: `translateX(${-period}px)` }],
      { duration: period / speed * 1000, iterations: Infinity,
        easing: 'linear', delay });
  };

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
  const STEP  = parseFloat(token('--row-h'));  // one line-height, from the token
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

const PHONE_MAX = 700;      // viewport width at or below which phone applies
let FRAME_W = 1512, FRAME_H = 982;

function layoutFor(v){
  const board = BOARDS[v];
  // ?m=1 forces the phone layout at any width, for previewing it on a desktop
  const forced = new URLSearchParams(location.search).get('m') === '1';
  const onPhone = !!board.phone && (forced || window.innerWidth <= PHONE_MAX);
  return onPhone
    ? { board, nodes: board.phone.nodes, w: board.phone.w, h: board.phone.h, phone: true }
    : { board, nodes: board.nodes, w: 1512, h: 982, phone: false };
}

function buildBoard(board, nodes){
  const els = {};

  for (const node of nodes){
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
  const s = Math.min(window.innerWidth / FRAME_W, window.innerHeight / FRAME_H);
  stage.style.transform = `scale(${s})`;
}

(async function init(){
  // One board now: the earlier variation and its switcher went when the client
  // settled on this one. The token stays because app.css hangs the board-scoped
  // custom properties off `body.board-2`.
  const v = '2';
  document.body.classList.add('board-' + v);      // board-scoped colour tokens

  const view = layoutFor(v);
  FRAME_W = view.w; FRAME_H = view.h;
  stage.style.width  = FRAME_W + 'px';
  stage.style.height = FRAME_H + 'px';
  if (view.phone) document.body.classList.add('phone');

  await loadTints(view.nodes);

  // the mascot's walk, if this layout uses one
  for (const node of view.nodes){
    if (node.kind === 'walk'){
      const { manifest, frames } = await loadWalk(node.src);
      node._manifest = manifest; node._frames = frames;
    }
  }

  const { board, els } = buildBoard(view.board, view.nodes);
  fit();
  window.addEventListener('resize', fit);

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
