# Jitterbug Folk — motion study

Animated prototype of the two selected Figma frames, `1` (138:36) and `2` (139:55).
Geometry, type and colour come from the file; the only thing added is time.

    http://localhost:4321/         board 2 — the current version
    http://localhost:4321/?v=1     board 1 — the earlier board

Three ways to switch board:

* **press `1` or `2`** — or left/right arrow to toggle. No hover needed, and it
  leaves nothing on screen, so it is the safe route while screen recording.
* **move the pointer into the top-right corner** of the browser window (a
  360x150 patch) and the two buttons fade in.
* **edit the URL** — `?v=1` / `?v=2`.

Any of them reloads the page, so the timeline always replays from frame zero.

The switcher is invisible at rest by design. Note that it is anchored to the
top-right of the *window*, not of the artwork — on a wide window those are far
apart, which makes it easy to miss. The keys are the dependable route.

## Files

| file | what it holds |
|---|---|
| `data.js` | both boards as data — node geometry, copy, and the timeline arrays |
| `timeline.js` | the cue runner and the five effects (`fade`, `glyph`, `lines`, `type`, `cycler`) |
| `main.js` | builds the DOM from the data, fits the 1512x982 stage to the window, wires the switcher |
| `app.css` | the motion tokens, the frame's typography, the two cycler treatments |
| `assets/` | `j`, `b`, `f` and the mascot, exported from Figma as individual vectors |
| `assets/walk/` | the mascot's walk-in for board 2 — 89 matted WebP frames, `walk.json`, plus the source footage and a still |

## Retuning the motion

Every duration and easing lives in `:root` at the top of `app.css`:

    --ease-entry    entrances (no overshoot)
    --ease-cross    crossfades
    --ease-cycle    the phrase cycler's own easing
    --dur-glyph     1200ms  each letterform entrance
    --dur-fade      900ms   generic text fade
    --stagger-line  260ms   between consecutive lines
    --dur-cycle     1300ms  board 2: one row travelling one step
    --stack-bleed   22px    soft margin above/below board 2's three rows

Board 1's cycler, letter by letter:

    --dur-letter       700ms   one letter's exit, or its entry
    --stagger-letter   40ms    between consecutive letters, left to right
    --letter-rise      28px    how far a letter travels as it leaves
    --letter-dip       4px     the anticipation dip before it rises
    --cycle-in-from    -28px   where an arriving letter starts (negative = above)
    --cycle-gap        150ms   the beat between the last exit and the first entry
    --ease-letter-dip  into the dip
    --ease-letter-out  the rise, after the dip
    --ease-letter-in   settles past its mark, then back

Board 2's ramp:

    --ease-throw       the overshoot curve, shared by travel, colour and weight
    --grey-ramp        #6E6E6E  denser than the frame's flat grey
    --row-opacity-in   0.55     entering, below the centre
    --row-opacity-out  0.75     leaving, above the centre
    --row-wght-in      500      both grey rows carry the same weight;
    --row-wght-out     500      only opacity separates them

Cue times live in the `timeline` array of each board in `data.js`. A cue is
`{ kind, target, at, ... }`; `after: '<target>'` makes `at` relative to the end of
that target's cue instead of to the start of the board.

Board 2's headline reveal:

    --headline-dur    1400ms  one word of the headline fading up
    --headline-step   180ms   between words
    --walk-lead       0.35    how much of its own length earlier the mascot sets off
    --walk-fade       1600ms  the mascot crossfading in as it enters

Colour is **board-scoped**: `:root` holds board 1's values and `body.board-2`
overrides them, because the two boards now have different frames.

                     board 1      board 2
    --paper          #FFFFFF      #FFFAEB   the page
    --letter         #371117      #610809   the j/b/f fill
    --email          inherits ink #E2000E   the address

The j/b/f SVGs are filled with `currentColor` and inlined, so `--letter` is the
only place that colour is written down.

One knob is not in `:root` because it belongs to a single effect: the cycler
hold, `HOLD` at the top of `main.js` (3600ms at the centre). One full phrase
change therefore takes `HOLD + --dur-cycle` = 4.9s.

## Why the cycler is built the way it is

**Board 1 changes letter by letter, and the two phrases never overlap.** The old
phrase leaves one letter at a time — each dipping 4px, then rising 28px away as it
fades — and only once the last letter is gone, plus a 150ms beat, does the next
phrase start arriving. Two phrases crossfading in the same place read as a ghosted
double exposure rather than as a change; the gap is what removes it, so keep
`--cycle-gap` positive.

Board 1's phrase is also **not** clipped to a window. Kadwa's glyph box is 42px
taller than the frame's 62px leading at both top and bottom, so any
`overflow:hidden` box slices the ascenders and descenders. The only clipping
ancestor is `.viewport`, which is the whole page.

**Board 2 is a window**, because the frame shows exactly three lines. Its box is
extended by one row above and below, and a row's whole appearance is a function of
where it sits relative to the centre: faint and light below, black and bold at the
centre, easing back toward grey above. Opacity, colour and weight all transition on
`--ease-throw`, the same curve as the travel, so they land together — and because
that curve overshoots, the weight throws past 700 to about 715 before settling,
which is what makes the centre line catch the eye.

Note that this ramp is a **deliberate departure from the frame**, which draws the
top and bottom rows identically. The positions and the black centre still match:
three rows at frame y 787 / 809 / 831.

## Board 2's headline reveal

It reveals **one word at a time, fading only** — `opacity` is the entire effect.

Getting here took several wrong turns, all of them chasing the same complaint:
that it looked jittery. The causes, in the order they were found and removed:

1. **`filter: blur()` per character** — re-rasterises every glyph every frame,
   and blurred edges shift sub-pixel as they sharpen.
2. **125 inline character spans animating opacity** — an inline box cannot be
   promoted to its own compositing layer, so all 125 repaints stayed on the main
   thread however cheap the property was.
3. **Movement.** This was the real one. Even at a full frame rate, two dozen
   words each starting their own small travel at a different moment reads as
   jitter. It was never the frame rate; it was the motion.

So nothing moves now. Each word is an `inline-block` span — which composites —
and it either has not arrived or is fading up in place. At 1400ms per word
against a 180ms beat, about eight are mid-fade at any moment, so the reveal is a
wash rather than a row of separate events. Total 6.26s.
`prefers-reduced-motion` collapses it to a 200ms fade.

## Board 2's running order

    headline reveal      0 - 6.26s
    mascot walks in   1.25 - 4.96s
    j, b, f           4.70 - 6.26s

The lockup is placed backwards from the headline's end by
`GLYPH_LAST + --dur-glyph`, so `f` — the last of the three — settles exactly as
the last word lands.

The mascot is placed backwards from that same end by its own length and then
**`--walk-lead` earlier again**: at 0.35 it sets off 35% of the walk sooner, so
it arrives about 1.3s before the headline finishes and stands while the letters
complete the lockup. Set `--walk-lead` to 0 to make all three converge instead.

Both offsets are functions of the tokens and of `walk.json`, so nothing is
hardcoded — a cue's `at` may be a function receiving `{ ms, walkMs }`.

`j`, `b` and `f` keep their own 0/180/360 stagger; only the group's start moves.
Board 1's cues are untouched.

Note the walk plus its lead (3.71s x 1.35 = 5.0s) has to fit inside the headline
reveal, which is 6.26s. Raising `--walk-lead` much further, or shortening the
reveal, would need the mascot to start before the board does.

## The mascot's walk-in (board 2 only)

On board 2 the mascot walks in from the right edge instead of fading in, and its
resting artwork is the settled frame of that walk — so board 2's mascot is in
**colour**, while board 1 keeps the black `creature.svg` and its fade.

* `assets/walk/source.mp4` — the original footage, 1280x720, 24fps, 121 frames
* `assets/walk/f000..f088.webp` — frames 32-120 of the footage, matted to alpha
  and un-premultiplied, exported at 1.5x the board size. 4.8MB total, ~55KB each
* `assets/walk/walk.json` — frame count, fps, the sprite's board box, and the
  board x for every frame
* `assets/walk/still.webp` — the settled frame on its own, not used by the page
  but handy if the coloured mascot is wanted as a static asset elsewhere

The matte was built from a **temporal median plate**: the creature never lingers
anywhere, so the median of each pixel across the footage is the clean background,
and every frame is keyed against it. A luminance key would not work — the
background is `#FBFBFB` with shading, and the creature's eyes are near-white.

`BUILD.walk` in `main.js` makes a `<canvas>` so the matte composites properly over
the `b` behind it, and `EFFECTS.walk` in `timeline.js` plays the frames while
moving the sprite to each frame's board x. The walk ends holding the settled
frame, so there is no handoff to a second element and nothing to cross-dissolve.

Three things keep its opening smooth:

* frames are preloaded with **`img.decode()`**, not `onload`. A loaded but
  undecoded frame decodes on its first `drawImage` — which is exactly when the
  walk starts, and is what made its first strides stutter.
* the sprite is positioned with **`transform: translateX()`**, not `left`, so
  moving it composites instead of asking the page for a layout on every frame.
* it **crossfades in over `--walk-fade`** as it enters, rather than appearing at
  full strength at the right edge.

Registration is driven off the settled frame. The new frame marks the mascot's
place with a reference PNG rather than a vector, and that PNG carries padding —
its box is `889,170 472x535` but the creature's ink inside it is only
`918.5,197.5 390.5x480`. **Register to the ink, not to the placeholder.** The
scale is uniform at **0.73507**, anchored on height so top and bottom align
exactly; the ink comes out 4.6px narrower than the reference box and is centred
in it, which is better than squashing a hand-painted creature by 1.2%.

The sprite carries 8px of padding around the creature, so the board x and y are
both offset by `PAD * scale` — get that wrong and the mascot lands beside its box
rather than on it.

The frames are **un-premultiplied**: the matte was keyed against a `#FBFBFB`
plate, which baked near-white into every semi-transparent edge pixel. That was
invisible on a white board and would have read as a halo on cream, so each frame
is reconstructed as `F = (observed - (1-a) * plate) / a`. Edge pixels carrying the
plate colour went from 9.6% to 0.4%.

## Display face on board 1

The frame sets "Trusted Talent" in **JejuHallasan**, which is not installed here and
is no longer served by Google — its early-access binary 404s. **Kadwa** is used
instead, by request. It is loaded from Google Fonts in both weights; the phrase
renders at 400, so switching to 700 is just `font-weight:700` on `.brush` in
`app.css`.

Instrument Sans is the frame's other face and is served from Google Fonts as-is.
