/* ---------------------------------------------------------------
   Board data. Both boards are described here; there is no
   board-specific code anywhere else in the prototype.
   All x/y/w/h are Figma frame coordinates (frame = 1512 x 982).
---------------------------------------------------------------- */

const COPY = {
  headline: 'Nine out of ten freelancers<b-end> we talked to found their last project ' +
            'through the good ol’ word of mouth - someone they know, knows someone who needed help.',
  reimagines: '<b>Jitterbug Folk </b>reimagines word of mouth, bridging the gap between founders ' +
              'and freelancers. Think of it as a potluck of vetted freelancers, brought together ' +
              'to form tailored teams for clients.',
  contact: 'Freelancer? Tell us what you do.<br>Building a brand? Tell us what you need<br>' +
           '<b>hello@jitterbugfolk.com</b>',
  // board 2's frame sets the address in red at medium weight, not bold black
  contactV2: 'Freelancer? Tell us what you do.<br>Building a brand? Tell us what you need<br>' +
             '<span class="email">hello@jitterbugfolk.com</span>',
  // the phone frame ends this line with a full stop; the desktop one does not
  contactM: 'Freelancer? Tell us what you do.<br>Building a brand? Tell us what you need.<br>' +
            '<span class="email">hello@jitterbugfolk.com</span>',
  // board 2's frame sets the brand name in the accent red, and the paragraph larger
  reimaginesV2: '<span class="brand">Jitterbug Folk</span> reimagines word of mouth, bridging the gap ' +
                'between founders and freelancers. Think of it as a potluck of vetted freelancers, ' +
                'brought together to form tailored teams for clients.'
};

/* The rolling phrase list. "Tailored Teams" is spelled as the Figma
   frame spells it; "Brand Bugs" and "Social Bugs" are additions that
   only exist in the motion, not in the static frames. */
const PHRASES = ['Trusted Talent', 'Tailored Teams', 'Non-Agency Setup',
                 'BrandBugs', 'SocialBugs', 'StoryBugs', 'DesignBugs'];

/* Board 1's slot is two lines tall and centred, so its phrases carry
   their own break to match the frame's "Trusted / Talent" setting. */
const PHRASES_BRUSH = ['Trusted\nTalent', 'Tailored\nTeams', 'Non-Agency\nSetup', 'Brand\nBugs', 'Social\nBugs'];

/* glyph entrances, shared by both boards ------------------------- */
const GLYPH_IN = [
  { id: 'j', at:   0, from: { x: -120 } },   // from the left
  { id: 'b', at: 180, from: { y: -140 } },   // from the top
  { id: 'f', at: 360, from: { x:  120 } }    // from the right
];
// when the last of the three starts, relative to the first
const GLYPH_LAST = Math.max(...GLYPH_IN.map(g => g.at));

// Board 2's lockup arrives more slowly than board 1's: the stagger is stretched
// by the same factor as --dur-glyph-2 is against --dur-glyph, so the rhythm
// between the three letters is unchanged, only its pace.
const GLYPH_SLOW  = 1.35;
const GLYPH_IN_2  = GLYPH_IN.map(g => ({ ...g, at: Math.round(g.at * GLYPH_SLOW) }));
const GLYPH_LAST_2 = Math.max(...GLYPH_IN_2.map(g => g.at));

const BOARDS = {
  /* =============================== BOARD 1 =============================== */
  '1': {
    nodes: [
      // paint order matches the Figma layer order: b, creature, j, f
      { id:'b',        kind:'svg',  src:'assets/b.svg',        x:349, y:129, w:168, h:254, tint:true },
      { id:'creature', kind:'svg',  src:'assets/creature.svg', x:246, y:201, w:375, h:465 },
      { id:'j',        kind:'svg',  src:'assets/j.svg',        x:213, y:150, w: 85, h:438, tint:true },
      { id:'f',        kind:'svg',  src:'assets/f.svg',        x:496, y:180, w:129, h:276, tint:true },

      // the frame's box is 301x121 (sized for "Trusted / Talent"); the slot is
      // widened around the same centre line so the longer motion-only phrases
      // neither wrap nor clip. "Trusted / Talent" still lands exactly as drawn.
      { id:'cycler',   kind:'cycler', mode:'single', phrases:PHRASES_BRUSH,
                       cls:'brush', x:83.5, y:740, w:700, h:124 },

      { id:'intro',    kind:'text', cls:'t', html:COPY.headline.replace('<b-end>',''),
                       x:935, y:221, w:335, h:105 },
      { id:'about',    kind:'text', cls:'t', html:COPY.reimagines,
                       x:935, y:363, w:335, h:127 },
      { id:'contact',  kind:'text', cls:'t', html:COPY.contact,
                       x:935, y:609, w:385, h:81 }
    ],

    timeline: [
      ...GLYPH_IN.map(g => ({ kind:'glyph', target:g.id, at:g.at, dur:'--dur-glyph',
                              from:g.from, ease:'--ease-entry' })),
      // the mascot completes the lockup once the three letters have settled
      { kind:'fade', target:'creature', at: 1250, dur:'--dur-glyph', ease:'--ease-entry' },
      { kind:'cycler', target:'cycler', at: 2700 },
      // right-hand column, line by line, only after the lockup is at rest.
      // Each block picks up where the previous one finished, so the whole
      // column reads as one continuous cascade instead of three overlaps.
      { kind:'lines', target:'intro',   at: 2900 },
      { kind:'lines', target:'about',   after:'intro', at: 0 },
      { kind:'lines', target:'contact', after:'about', at: 0 }
    ]
  },

  /* =============================== BOARD 2 =============================== */
  '2': {
    nodes: [
      { id:'b',        kind:'svg',  src:'assets/b.svg',        x:1022.78, y:149.00, w:165.42, h:249.49, tint:true },
      // the mascot walks in from the right edge and comes to rest on the
      // footage's own settled pose; geometry comes from assets/walk/walk.json
      { id:'creature', kind:'walk', src:'assets/walk/' },
      { id:'j',        kind:'svg',  src:'assets/j.svg',        x: 889.00, y:169.79, w: 84.07, h:429.37, tint:true },
      { id:'f',        kind:'svg',  src:'assets/f.svg',        x:1167.42, y:197.81, w:126.55, h:272.09, tint:true },

      { id:'headline', kind:'text', cls:'t lead',
                       html:'<b>' + COPY.headline.replace('<b-end> ','</b><br>'),
                       x:116, y:149, w:620, h:321 },

      { id:'about',    kind:'text', cls:'t lg', html:COPY.reimaginesV2,
                       x:116, y:782, w:619, h:127 },

      // the frame's three rows live at y 787-853; the box is extended by one
      // row above and below as soft margin for the rows entering and leaving
      { id:'cycler',   kind:'cycler', mode:'stack', phrases:PHRASES,
                       cls:'t', x:846, y:756, w:210, h:130 },

      { id:'contact',  kind:'text', cls:'t loose', html:COPY.contactV2,
                       x:1052, y:782, w:345, h:78 }
    ],

    timeline: [
      // a slow fade, one word at a time, with no movement at all
      { kind:'words', target:'headline', at: 0 },
      // The three openings converge. The mascot sets off while the headline is
      // still revealing, timed backwards from the headline's end by the walk's
      // own length, so it arrives exactly as the last words land.
      // The mascot sets off a fixed time before the headline ends, so lengthening
      // its settle extends the ending rather than moving the start earlier.
      { kind:'walk',   target:'creature', after:'headline',
                       at: c => -c.ms('--walk-start-before') },
      // and the lockup lands on the headline's last word: the group spans
      // GLYPH_LAST_2 + --dur-glyph-2, so f, the last of the three, settles with it.
      ...GLYPH_IN_2.map(g => ({ kind:'glyph', target:g.id, after:'headline',
                              at: c => g.at - (GLYPH_LAST_2 + c.ms('--dur-glyph-2')),
                              dur:'--dur-glyph-2', from:g.from, ease:'--ease-entry' })),
      { kind:'lines',  target:'about',    after:'headline', at: 0 },
      { kind:'cycler', target:'cycler',   after:'headline', at: 300 },
      // "Freelancer? ..." then "Building a brand? ..." land after the
      // left-hand paragraph has finished, continuing the same cascade
      { kind:'lines',  target:'contact',  after:'about',    at: 0 }
    ],

    /* The phone layout of the same board — node ids and the timeline above are
       shared, so every cue applies unchanged. Only the geometry differs, plus
       the ticker, which is a horizontal slide here rather than a vertical
       selector. Frame 161:314, "iPhone 16 & 17 Pro", 402x874. */
    phone: {
      w: 402, h: 874,
      nodes: [
        // paint order as in the frame: b, creature, j, f
        { id:'b',        kind:'svg',  src:'assets/b.svg', x:149.91, y:226.00, w: 83.38, h:125.59, tint:true },
        { id:'creature', kind:'walk', src:'assets/walk-m/' },
        { id:'j',        kind:'svg',  src:'assets/j.svg', x: 83.00, y:236.29, w: 42.21, h:216.18, tint:true },
        { id:'f',        kind:'svg',  src:'assets/f.svg', x:223.00, y:250.71, w: 63.82, h:136.91, tint:true },

        { id:'headline', kind:'text', cls:'t m-head',
                         html:'<b>' + COPY.headline.replace('<b-end> ','</b><br>'),
                         x:40, y:40, w:322, h:129 },

        // sits just inside the headline's column: 4px in from its left edge, and
        // ending ~18px short of its right, which is how the reference lines the
        // two blocks up
        { id:'about',    kind:'text', cls:'t m-body', html:COPY.reimaginesV2,
                         x:44, y:540, w:300, h:124 },

        // a full-width strip: the entries slide through it and run off both edges
        { id:'cycler',   kind:'cycler', mode:'slide', phrases:PHRASES,
                         cls:'t', x:0, y:690, w:402, h:29 },

        // the frame centres this block on x192, so a 384-wide box at x0 lands it
        { id:'contact',  kind:'text', cls:'t m-contact', html:COPY.contactM,
                         x:0, y:753, w:384, h:69 }
      ]
    }
  }
};
