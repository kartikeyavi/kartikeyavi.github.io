/* ==========================================================================
   Resume site: a 3D neural network you fly through
   --------------------------------------------------------------------------
   Everything you see is read from content.md at runtime. Nothing from the
   resume is written in this file or in index.html (except the social preview
   tags in index.html, which crawlers need as plain HTML).

   File map
     1. CONFIG ............ network layout, camera, scroll tuning   <- adjust here
     2. SECTIONS .......... which content.md sections sit at which node  <- and here
     3. Helpers
     4. content.md parser
     5. HTML rendering (hero, section cards, contact)
     6. Mini map
     7. Scroll logic (GSAP + ScrollTrigger)
     8. 3D network (Three.js)
     9. Start-up

   Handy URL switches for testing:
     ?motion=full    always fly the camera
     ?motion=fade    low-power mode: camera cuts between nodes with a fade
     ?motion=static  what visitors with "reduce motion" switched on will see
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. CONFIG
     ------------------------------------------------------------------------ */
  const CONFIG = {
    contentFile: 'content.md',

    cdn: {
      // Three.js is an ES module, so it is imported from here instead of a <script> tag.
      three: 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js',
    },

    colors: {
      background: 0x050816,
      node: 0x00fffe,
      sectionCore: 0xc8ffff, // section nodes get a lighter fill so they read as brighter
    },

    /* NETWORK LAYOUT
       A feed-forward diagram: n layers side by side, m neurons in each, joined
       to the neurons of the next layer. One row of neurons per layer; nothing
       is stacked.

         layer 0     layer 1      layer 2     ...   last layer
         (input,     (1st         (2nd              (Contact)
          hero)       section)     section)
            o           o            o                  o
            o           O            o                  o        O = section node
            o           o            o                  O
            o           o            O                  o
         ------------------------------------------------> direction of travel

       - n (layers) is automatic: one per visible section, plus the input
         layer for the hero. Hide a section in content.md and a layer goes.
       - m (neurons per layer) is `neurons` below. The same for every layer.
       - The diagram above is only the starting grid. `irregular` (below) then
         pushes every neuron off it, sideways, forwards/backwards and up/down,
         arches and tilts each layer, varies neuron sizes and leaves out some
         connections, so the result looks grown rather than ruled on paper.
         Set every value in `irregular` to 0 to get the perfect flat grid back. */
    network: {
      layerSpacing: 16,   // distance between layers
      desktop: {
        neurons: 6,       // m: neurons in each layer
        neuronSpacing: 5.5,
        signals: 24,      // little pulses travelling along edges
        maxPixelRatio: 2, antialias: true,
      },
      // Phones: fewer neurons per layer and lower resolution.
      mobile: {
        neurons: 4,
        neuronSpacing: 6,
        signals: 8,
        maxPixelRatio: 1.25, antialias: false,
      },
      irregular: {
        seed: 11,            // change this number for a different (but repeatable) arrangement
        scatter: 0.34,       // sideways shift of each neuron, as a fraction of neuronSpacing
        depth: 0.24,         // forwards/backwards shift, as a fraction of layerSpacing
        height: 3.4,         // random lift or drop of each neuron
        bow: 4.5,            // how far a whole layer may arch up or sag in the middle
        tilt: 0.2,           // how much a whole layer may slope from one side to the other
        sway: 0.5,           // sideways shift of a whole layer, as a fraction of neuronSpacing
        sizeVariation: 0.45, // neuron sizes vary by up to this fraction
        dropout: 0.3,        // fraction of connections left out
        edgeVariation: 0.65, // how much connection brightness varies (0 = all equal)
      },
      nodeRadius: 0.26,
      sectionNodeRadius: 0.46,
      edgeOpacity: 0.42,
      pathEdgeOpacity: 0.9, // the edges the camera travels along, section to section
    },

    camera: {
      fov: 55, fovPortrait: 70,

      // Hero flyover: an endless oval loop above the network (see flyPoint()).
      flyHeight: 18,       // altitude above the network
      flyHeightWave: 2,    // gentle climb and descent
      flySide: 0.6,        // half-width of the loop, as a fraction of the network half-width
      flyInset: 14,        // the loop turns around this far inside each end of the network
      flySpeed: 0.07,      // radians per second around the loop (lower = slower)
      flyLookAhead: 0.75,  // how far ahead on the loop the camera looks
      flyLookInward: 0.5,  // 0 = look straight along the path, 1 = always look at the middle of the network
      flyBank: 0.1,        // how hard it banks into turns
      flyMaxBank: 0.3,     // steepest bank, in radians
      flyStart: 0.6,       // where on the loop the flight begins (0 = near end, turning; ~0.6 = near end, heading forward)

      // Docked at a section node: the camera hovers in front of and above it,
      // looking down, so the network spreads out behind the card.
      dockDistance: 8,     // how far in front of the node
      dockHeight: 5.5,     // how far above the node
      driftAmount: 1,      // gentle sway while reading (0 = perfectly still)

      // While a card is being read, its neuron sits beside the card instead of
      // hiding behind it. If the screen is too narrow for that (phones), it
      // sits above the card instead.
      nodeSide: 'left',    // 'left' or 'right' of the card
      nodeSideRoom: 170,   // px of free space needed beside the card to use the side position
      nodeSideGap: 130,    // px from the card's edge to the centre of the neuron (at most half the free space)
      nodeAbove: 0.4,      // narrow screens: how far above the middle of the screen, as a fraction of its height

      // Travelling between two section nodes.
      riseHeight: 4.5,     // how high the camera climbs before swooping down
      hopDuration: 1.1,    // seconds the camera takes to fly from one node to the next (scroll.mode 'auto')
      follow: 5,           // how quickly the camera catches up with the scroll (scroll.mode 'scrub'; higher = snappier)

      // While the hero is on screen the view is shifted so the network sits
      // beside the photo (desktop) or below it (phone). Fractions of the screen.
      heroShiftX: 0.21,
      heroShiftY: 0.2,
    },

    scroll: {
      /* How scrolling drives the camera between sections:
           'auto'  -> as soon as you scroll out of a section, the camera flies to
                      the next node by itself, at its own fixed speed (hopDuration).
                      Scroll back before reaching the next section and it returns.
           'scrub' -> the flight is tied to the scroll: scroll halfway through the
                      gap and the camera is halfway along the edge.                */
      mode: 'auto',
      leaveAt: 0.1,     // 'auto': how far into the gap after a section counts as having left it (0..1)
      leaveHeroAt: 0.4, // 'auto': same for the hero; later, so the flyover stays while the hero is still on screen
      arriveAt: 0.3,   // camera is fully docked once the card's top edge reaches 30% of the screen height
      departAt: 0.6,   // camera starts leaving once the card's bottom edge rises above 60% of the screen height
      jumpOffset: 0.14, // mini map jumps place the card's top edge 14% from the top of the screen
      jumpOffsetNarrow: 0.22, // same, on narrow screens, leaving room for the neuron above the card
    },

    mobileQuery: '(max-width: 800px)', // keep in sync with the media query in style.css

    // If the frame rate stays below this, quality is reduced step by step
    // (first lower resolution, then fades instead of camera swoops).
    minFps: 28,
  };

  /* ------------------------------------------------------------------------
     2. SECTIONS  (section-to-node mapping)
     ------------------------------------------------------------------------
     Order here = order on the page = order of the layers in the network.

       id ...... used for the #anchor and the element id
       sources . the "## Heading" names in content.md that feed this node.
                 If none of them exist (or all are empty) the node is skipped
                 and the network is built with one layer fewer.
       title ... 'first'  -> card title is the first source heading ("About"),
                             later sources become sub-headings ("News")
                 'joined' -> card title is all present headings joined
                             ("Courses, Conferences & Awards")
       slot .... where the section node sits in its layer, in neurons left (-)
                 or right (+) of the centre. Alternating values make the camera
                 zig-zag across the network as it travels.
       render .. which renderer in part 5 turns the markdown into HTML.

     Any "## Heading" in content.md that is not listed here still gets its own
     node, added just before Contact, using the generic renderer.              */
  const SECTIONS = [
    { id: 'about',        sources: ['About', 'News'],                     title: 'first',  slot: -1, render: 'about' },
    { id: 'skills',       sources: ['Skills'],                            title: 'first',  slot:  1, render: 'skills' },
    { id: 'experience',   sources: ['Experience'],                        title: 'first',  slot: -2, render: 'experience' },
    { id: 'education',    sources: ['Education'],                         title: 'first',  slot:  1, render: 'education' },
    { id: 'publications', sources: ['Publications'],                      title: 'first',  slot:  2, render: 'publications' },
    { id: 'projects',     sources: ['Projects'],                          title: 'first',  slot: -1, render: 'projects' },
    { id: 'more',         sources: ['Courses', 'Conferences', 'Awards'],  title: 'joined', slot:  1, render: 'more' },
    // Contact always exists: links come from the front matter, the optional text from "## Contact".
    { id: 'contact',      sources: ['Contact'], label: 'Contact', always: true, slot: 0, render: 'contact' },
  ];
  const EXTRA_SECTION_SLOTS = [-1, 1, 0, 2, -2]; // slots handed to unlisted "## Headings", in turn

  /* Profile links. `key` is the front matter field in content.md. A link is
     only shown when its field has a value. `hero: true` puts it in the hero row. */
  const LINKS = [
    { key: 'email',    label: 'Email',          hero: true },
    { key: 'linkedin', label: 'LinkedIn',       hero: true },
    { key: 'github',   label: 'GitHub',         hero: true,  base: 'https://github.com/' },
    { key: 'scholar',  label: 'Google Scholar', hero: true },
    { key: 'orcid',    label: 'ORCID',          hero: false, base: 'https://orcid.org/' },
    { key: 'website',  label: 'Website',        hero: false },
  ];

  /* Simple line icons (24 x 24, drawn with strokes). Swap any path to change an icon. */
  const ICONS = {
    email:    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7.5l8.5 6 8.5-6"/>',
    linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="12" cy="10" r="2.6"/><path d="M7.2 17c.9-2.1 2.7-3.2 4.8-3.2s3.9 1.1 4.8 3.2"/>',
    github:   '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.3 5.5l-2.6 13"/>',
    scholar:  '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6v4.2C8 17.3 9.9 18 12 18s4-.7 5.5-2.2v-4.2M21.5 9.5v5"/>',
    orcid:    '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="1.8"/><path d="M5.8 15.6c.5-1.2 1.5-1.8 2.7-1.8s2.2.6 2.7 1.8M14 10h4M14 13.5h4"/>',
    website:  '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5S14.4 17.9 12 20.5C9.6 17.9 8.4 15.1 8.4 12S9.6 6.1 12 3.5z"/>',
    location: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 00-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    cv:       '<path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/>',
  };

  /* ------------------------------------------------------------------------
     3. Helpers
     ------------------------------------------------------------------------ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smoothstep = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const smoother = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Inline markdown (bold, italics, links, code) -> HTML, via marked.
  const inline = (s) => (window.marked && window.marked.parseInline ? window.marked.parseInline(String(s)) : esc(s));
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.website}</svg>`;

  const root = document.documentElement;
  const mqMobile = window.matchMedia(CONFIG.mobileQuery);
  const isPhone = mqMobile.matches || (window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820);

  /* Motion mode
       full   -> camera flies and swoops with the scroll
       fade   -> camera cuts from node to node behind a quick fade (slow devices)
       static -> one still view of the network, cards simply fade in (reduced motion) */
  const forcedMotion = new URLSearchParams(location.search).get('motion');
  const motionLocked = ['full', 'fade', 'static'].includes(forcedMotion);
  let motionMode = motionLocked ? forcedMotion
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'static' : 'full';
  function setMotionMode(mode) { motionMode = mode; root.dataset.motion = mode; }
  setMotionMode(motionMode);

  /* State shared between the scroll logic (part 7) and the 3D network (part 8). */
  const site = {
    stops: [],     // the visible sections, in order: { id, label, slot, el, card }
    target: 0,     // where the scroll says the camera should be: 0 = hero, 1 = first section, 1.5 = halfway to the second...
    active: 0,     // nearest stop (0 = hero)
    onActive: [],  // callbacks run when `active` changes
  };

  if (new URLSearchParams(location.search).has('debug')) window.__site = site;

  /* Where the current section's neuron should sit on screen while its card is
     being read, in px from the middle of the screen. Worked out from the real
     width of the cards, so it follows any change to --card-width in style.css. */
  function nodePlacement() {
    const C = CONFIG.camera;
    const W = window.innerWidth, H = window.innerHeight;
    const card = site.stops[0] && site.stops[0].card;
    const cardW = card ? card.offsetWidth : W;
    const room = (W - cardW) / 2;
    if (room >= C.nodeSideRoom) {
      const x = cardW / 2 + Math.min(room / 2, C.nodeSideGap);
      return { x: C.nodeSide === 'right' ? x : -x, y: 0, above: false };
    }
    return { x: 0, y: -H * C.nodeAbove, above: true };
  }

  /* ------------------------------------------------------------------------
     4. content.md parser
     ------------------------------------------------------------------------
     Format understood:
       ---                      front matter: simple "key: value" lines
       name: ...
       ---
       ## Section               one node (or part of one) per section
       Free paragraph text.
       - bullet                 list items
       ### A | B | C            an entry; parts are split on "|"
       - bullet                 bullets under an entry belong to it
     HTML comments are ignored, so a section holding only a comment counts as empty. */
  function parseContent(raw) {
    raw = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

    const meta = {};
    let body = raw;
    const fm = raw.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
    if (fm) {
      body = raw.slice(fm[0].length);
      fm[1].split('\n').forEach((line) => {
        const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
        if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
      });
    }

    body = body.replace(/<!--[\s\S]*?-->/g, '');

    const sections = {}; // keyed by lower-case heading
    const order = [];
    const parts = body.split(/^##[ \t]+(.+?)[ \t]*$/m); // [before, name, text, name, text, ...]
    for (let i = 1; i < parts.length; i += 2) {
      const sec = parseSection(parts[i].trim(), parts[i + 1] || '');
      const empty = !sec.paragraphs.length && !sec.items.length && !sec.entries.length;
      if (empty) continue; // empty sections are dropped here, which is what hides their node
      sections[sec.name.toLowerCase()] = sec;
      order.push(sec.name.toLowerCase());
    }
    return { meta, sections, order };
  }

  function parseSection(name, text) {
    const sec = { name, paragraphs: [], items: [], entries: [] };
    let entry = null;
    const addEntry = (heading) => {
      entry = { parts: heading.split('|').map((p) => p.trim()).filter(Boolean), paragraphs: [], items: [] };
      if (entry.parts.length) sec.entries.push(entry); else entry = null;
    };
    const bucket = () => entry || sec;

    if (window.marked && window.marked.lexer) {
      // Preferred: let marked split the text into blocks.
      window.marked.lexer(text).forEach((tok) => {
        if (tok.type === 'heading') addEntry(tok.text);
        else if (tok.type === 'list') tok.items.forEach((it) => { const t = it.text.trim(); if (t) bucket().items.push(t); });
        else if (tok.type === 'paragraph' || tok.type === 'text') { const t = tok.text.trim(); if (t) bucket().paragraphs.push(t); }
      });
    } else {
      // Fallback if the markdown library could not be loaded: a small line reader.
      let para = [];
      const flush = () => { if (para.length) { bucket().paragraphs.push(para.join(' ')); para = []; } };
      text.split('\n').forEach((line) => {
        let m;
        if ((m = line.match(/^#{3,}\s+(.*)$/))) { flush(); addEntry(m[1]); }
        else if ((m = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/))) { flush(); if (m[1].trim()) bucket().items.push(m[1].trim()); }
        else if (!line.trim()) flush();
        else para.push(line.trim());
      });
      flush();
    }
    return sec;
  }

  /* ------------------------------------------------------------------------
     5. HTML rendering
     ------------------------------------------------------------------------ */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DATE_PREFIX = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?\s*:\s*(.*)$/; // "2026-09: text" or "2019: text"
  const LOOKS_LIKE_DATE = /\b(19|20)\d{2}\b|present|ongoing/i;
  const LAB_LINE = /\b(advisor|adviser|supervisor|mentor|lab|group)\s*:/i; // first bullet with e.g. "Advisor:" becomes the lab line

  const paragraphs = (list) => list.map((p) => `<p>${inline(p)}</p>`).join('');
  const bullets = (list, cls) => (list.length ? `<ul class="${cls || 'bullets'}">${list.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` : '');

  function niceDate(y, m) {
    const mi = parseInt(m, 10);
    return (mi >= 1 && mi <= 12 ? MONTHS[mi - 1] + ' ' : '') + y;
  }

  // "2026-09: Started..." -> a dated row. Items without a date prefix still line up.
  function datedList(items) {
    const rows = items.map((t) => {
      const m = t.match(DATE_PREFIX);
      if (!m) return `<li><span class="when"></span><span class="what">${inline(t)}</span></li>`;
      const iso = m[1] + (m[2] ? '-' + m[2].padStart(2, '0') : '');
      return `<li><time class="when" datetime="${iso}">${niceDate(m[1], m[2])}</time><span class="what">${inline(m[4])}</span></li>`;
    });
    return `<ol class="dated">${rows.join('')}</ol>`;
  }

  // A "### Head | Organisation | Period" entry with its bullets.
  function entryHTML(entry, level, opts) {
    opts = opts || {};
    const head = entry.parts[0];
    const rest = entry.parts.slice(1);
    let org = '', period = '';
    if (rest.length >= 2) { period = rest[rest.length - 1]; org = rest.slice(0, -1).join(', '); }
    else if (rest.length === 1) { if (LOOKS_LIKE_DATE.test(rest[0])) period = rest[0]; else org = rest[0]; }

    const items = entry.items.slice();
    let lab = '';
    if (opts.labLine && items.length && LAB_LINE.test(items[0])) lab = items.shift();

    return `<article class="entry">
      <div class="entry-head">
        <h${level} class="entry-title">${inline(head)}</h${level}>
        ${period ? `<p class="entry-period">${inline(period)}</p>` : ''}
      </div>
      ${org ? `<p class="entry-org">${inline(org)}</p>` : ''}
      ${lab ? `<p class="entry-lab">${inline(lab)}</p>` : ''}
      ${paragraphs(entry.paragraphs)}
      ${bullets(items)}
    </article>`;
  }

  // Anything: paragraphs, then loose bullets, then entries.
  function genericHTML(sec, level, opts) {
    return paragraphs(sec.paragraphs)
      + bullets(sec.items)
      + (sec.entries.length ? `<div class="entries">${sec.entries.map((e) => entryHTML(e, level, opts)).join('')}</div>` : '');
  }

  // Split "A, B (x, y), C" on commas that are not inside brackets.
  function splitList(text) {
    const out = []; let depth = 0, cur = '';
    for (const ch of text) {
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /* Publications. Expected bullet format (see the comment in content.md):
       **Singh, K.**, Coauthor, A. "Paper Title." *Venue*, Year. [PDF](url) [arXiv](url) [Code](url) [BibTeX](url)
     Bullets that do not match are shown as written. */
  function publicationHTML(text) {
    const links = [];
    const rest = text.replace(/\[([^\]]+)\]\(([^)\s]*)\)/g, (_, label, url) => { links.push({ label, url }); return ''; }).trim();
    const m = rest.match(/^(.*?)["“](.+?)["”]\s*(.*)$/);
    let main;
    if (m) {
      const authors = m[1].replace(/[\s,.]+$/, (tail) => (tail.includes('.') ? '.' : '')).trim();
      const title = m[2].replace(/[.,]$/, '');
      let tail = m[3];
      let venue = '';
      const v = tail.match(/\*([^*]+)\*/);
      if (v) { venue = v[1]; tail = tail.replace(v[0], ''); }
      const y = tail.match(/\b(?:19|20)\d{2}\b/);
      const year = y ? y[0] : '';
      if (!venue) venue = tail.replace(year, '').replace(/^[\s,.]+|[\s,.]+$/g, '');
      main = `${authors ? `<p class="pub-authors">${inline(authors)}</p>` : ''}
        <h3 class="pub-title">${inline(title)}</h3>
        ${venue || year ? `<p class="pub-venue">${[venue && `<em>${inline(venue)}</em>`, year && esc(year)].filter(Boolean).join(', ')}</p>` : ''}`;
    } else {
      main = `<p class="pub-authors">${inline(rest)}</p>`;
    }
    const buttons = links.length
      ? `<p class="pub-links">${links.map((l) => `<a class="chip-link" href="${esc(l.url)}">${esc(l.label)}</a>`).join('')}</p>` : '';
    return `<li class="pub">${main}${buttons}</li>`;
  }

  /* Turn a front matter value into a usable link. */
  function linkFor(def, meta) {
    const value = (meta[def.key] || '').trim();
    if (!value) return null;
    if (def.key === 'email') return { def, href: 'mailto:' + value, text: value };
    let href = value;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      const bare = !/[/.]/.test(href); // just a username or an ORCID iD, e.g. "kartikeyavi"
      href = (def.base && bare ? def.base : 'https://') + href;
    }
    const text = href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    return { def, href, text };
  }

  /* One renderer per SECTIONS[].render value. Each receives the parsed
     sections that exist (in `sources` order) and returns HTML for the card body. */
  const RENDER = {
    // About paragraph(s), then News as a dated list.
    about(secs) {
      return secs.map((sec, i) => {
        const isNews = /news/i.test(sec.name);
        const head = i > 0 ? `<h3 class="sub-title">${esc(sec.name)}</h3>` : '';
        const body = isNews ? paragraphs(sec.paragraphs) + datedList(sec.items) : `<div class="prose">${genericHTML(sec, 3)}</div>`;
        return head + body;
      }).join('');
    },

    // "- Category: a, b, c" bullets -> one group per category.
    skills(secs) {
      const sec = secs[0];
      const groups = sec.items.map((item) => {
        const m = item.match(/^([^:]{1,60}):\s*(.+)$/);
        if (!m) return `<div class="skill-group"><ul class="tags">${splitList(item).map((t) => `<li>${inline(t)}</li>`).join('')}</ul></div>`;
        return `<div class="skill-group">
          <h3 class="skill-name">${inline(m[1])}</h3>
          <ul class="tags">${splitList(m[2]).map((t) => `<li>${inline(t)}</li>`).join('')}</ul>
        </div>`;
      });
      return paragraphs(sec.paragraphs) + `<div class="skill-groups">${groups.join('')}</div>`
        + (sec.entries.length ? `<div class="entries">${sec.entries.map((e) => entryHTML(e, 3)).join('')}</div>` : '');
    },

    // ### Position | Organisation | Period, optional advisor/lab line, bullets.
    experience(secs) { return genericHTML(secs[0], 3, { labLine: true }).replace('class="entries"', 'class="entries timeline"'); },

    // ### Degree | University | Period, bullets.
    education(secs) { return genericHTML(secs[0], 3, { labLine: true }).replace('class="entries"', 'class="entries timeline"'); },

    publications(secs) {
      const sec = secs[0];
      return paragraphs(sec.paragraphs)
        + (sec.items.length ? `<ol class="pubs">${sec.items.map(publicationHTML).join('')}</ol>` : '')
        + (sec.entries.length ? `<div class="entries">${sec.entries.map((e) => entryHTML(e, 3)).join('')}</div>` : '');
    },

    // ### Project title (optionally "| link or note"), bullets.
    projects(secs) { return genericHTML(secs[0], 3); },

    // Courses, Conferences and Awards: one short block each.
    more(secs) {
      return `<div class="blocks">${secs.map((sec) => `<section class="block">
          <h3 class="sub-title">${esc(sec.name)}</h3>
          ${paragraphs(sec.paragraphs)}
          ${bullets(sec.items)}
          ${sec.entries.length ? `<div class="entries">${sec.entries.map((e) => entryHTML(e, 4)).join('')}</div>` : ''}
        </section>`).join('')}</div>`;
    },

    generic(secs) { return genericHTML(secs[0], 3, { labLine: true }); },

    // The final node: the "## Contact" text (if any), email, location, every profile link, CV, footer.
    contact(secs, data) {
      const meta = data.meta;
      const rows = [];
      LINKS.forEach((def) => {
        const l = linkFor(def, meta);
        if (l) rows.push(`<li>${icon(def.key)}<span class="contact-label">${esc(def.label)}</span><a href="${esc(l.href)}">${esc(l.text)}</a></li>`);
      });
      if (meta.location) rows.push(`<li>${icon('location')}<span class="contact-label">Location</span><span>${esc(meta.location)}</span></li>`);
      const intro = secs.length ? `<div class="prose contact-intro">${genericHTML(secs[0], 3)}</div>` : '';
      if (!rows.length && !meta.cv && !intro) return '';
      const cv = meta.cv ? `<p><a class="btn" href="${esc(meta.cv)}" download>${icon('cv')}<span>Download CV</span></a></p>` : '';
      const year = new Date().getFullYear();
      return `${intro}${rows.length ? `<ul class="contact-list">${rows.join('')}</ul>` : ''}${cv}
        <footer class="site-footer">
          <p>&copy; ${year}${meta.name ? ' ' + esc(meta.name) : ''}</p>
        </footer>`;
    },
  };

  function joinNames(names) {
    if (names.length < 2) return names.join('');
    return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
  }

  /* Hero: photo, name, title, subtitle, icon links, CV button. */
  function renderHero(meta) {
    const name = meta.name || '';
    $('#hero-name').textContent = name;
    $('#hero-title').textContent = meta.title || '';
    $('#hero-subtitle').textContent = meta.subtitle || '';
    ['#hero-name', '#hero-title', '#hero-subtitle'].forEach((sel) => { const el = $(sel); el.hidden = !el.textContent; });

    // Page title and description follow content.md too.
    const role = (meta.title || '').split(/\s[·|]\s/)[0];
    if (name) document.title = role ? `${name} | ${role}` : name;
    const desc = [meta.title, meta.subtitle].filter(Boolean).join('. ');
    const descTag = $('meta[name="description"]');
    if (desc && descTag) descTag.setAttribute('content', `${name ? name + ': ' : ''}${desc}`);

    const fig = $('#hero-photo');
    const img = $('#hero-img');
    const noPhoto = () => { fig.hidden = true; root.classList.add('no-photo'); };
    if (meta.photo) {
      img.alt = name ? `Portrait of ${name}` : 'Portrait';
      img.addEventListener('error', noPhoto);
      img.src = meta.photo;
      fig.hidden = false;
    } else noPhoto();

    const links = LINKS.filter((d) => d.hero).map((d) => linkFor(d, meta)).filter(Boolean);
    const ul = $('#hero-links');
    ul.innerHTML = links.map((l) => `<li><a href="${esc(l.href)}" aria-label="${esc(l.def.label)}" title="${esc(l.def.label)}">${icon(l.def.key)}</a></li>`).join('');
    ul.hidden = !links.length;

    const cv = $('#hero-cv');
    if (meta.cv) { cv.href = meta.cv; cv.hidden = false; }
  }

  /* Build one <section> per node and fill site.stops. */
  function renderSections(data) {
    const main = $('#sections');
    const listed = new Set();
    const plan = [];

    SECTIONS.forEach((def) => {
      def.sources.forEach((s) => listed.add(s.toLowerCase()));
      const secs = def.sources.map((s) => data.sections[s.toLowerCase()]).filter(Boolean);
      if (def.sources.length && !secs.length && !def.always) return; // missing or empty in content.md -> no card, no node
      const names = secs.map((s) => s.name);
      plan.push({
        def, secs,
        label: def.label || joinNames(names),
        heading: def.label || (def.title === 'joined' ? joinNames(names) : names[0]),
      });
    });

    // Sections in content.md that SECTIONS does not mention: add them before Contact.
    let extra = 0;
    data.order.filter((key) => !listed.has(key)).forEach((key) => {
      const sec = data.sections[key];
      const id = 'x-' + key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const item = { def: { id, slot: EXTRA_SECTION_SLOTS[extra++ % EXTRA_SECTION_SLOTS.length], render: 'generic' }, secs: [sec], label: sec.name, heading: sec.name };
      const contactAt = plan.findIndex((p) => p.def.id === 'contact');
      plan.splice(contactAt < 0 ? plan.length : contactAt, 0, item);
    });

    plan.forEach((p) => {
      const body = RENDER[p.def.render](p.secs, data);
      if (!body || !body.trim()) return;
      const el = document.createElement('section');
      el.className = 'node-section';
      el.id = p.def.id;
      el.setAttribute('aria-labelledby', p.def.id + '-title');
      el.innerHTML = `<div class="card">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <h2 class="card-title" id="${p.def.id}-title">${esc(p.heading)}</h2>
          <div class="card-body">${body}</div>
        </div>`;
      // Links that leave the site open in a new tab.
      el.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
      main.appendChild(el);
      site.stops.push({ id: p.def.id, label: p.label, slot: p.def.slot || 0, el, card: el.firstElementChild });
    });
  }

  /* ------------------------------------------------------------------------
     6. Mini map
     ------------------------------------------------------------------------
     A flat drawing of the same network: one column per layer, three dots per
     column. The section node of each layer is a link; the first column's
     middle dot leads back to the top. */
  function buildMinimap() {
    const nav = $('#minimap');
    const stops = [{ id: 'top', label: 'Top', slot: 0 }].concat(site.stops);
    if (stops.length < 2) return;
    const COL = 22, ROW = 12, PAD = 13;
    const W = PAD * 2 + (stops.length - 1) * COL, H = PAD * 2 + ROW * 2;
    const rowOf = (slot) => (slot < 0 ? 0 : slot > 0 ? 2 : 1);
    const xy = (i, r) => [PAD + i * COL, PAD + r * ROW];

    let edges = '', path = '', dots = '', links = '';
    stops.forEach((s, i) => {
      const sr = rowOf(s.slot);
      for (let r = 0; r < 3; r++) {
        const [x, y] = xy(i, r);
        if (i < stops.length - 1) for (let r2 = 0; r2 < 3; r2++) { const [x2, y2] = xy(i + 1, r2); edges += `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}"/>`; }
        if (r !== sr) dots += `<circle cx="${x}" cy="${y}" r="1.5"/>`;
      }
      const [x, y] = xy(i, sr);
      if (i < stops.length - 1) { const [x2, y2] = xy(i + 1, rowOf(stops[i + 1].slot)); path += `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}"/>`; }
      links += `<a class="mm-stop" href="#${s.id}" data-i="${i}" aria-label="${esc(s.label)}">
          <title>${esc(s.label)}</title>
          <circle class="mm-hit" cx="${x}" cy="${y}" r="11"/>
          <circle class="mm-halo" cx="${x}" cy="${y}" r="6.5"/>
          <circle class="mm-core" cx="${x}" cy="${y}" r="${i === 0 ? 2.4 : 3.2}"/>
        </a>`;
    });

    nav.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group">
        <g class="mm-edges">${edges}</g><g class="mm-path">${path}</g><g class="mm-dots">${dots}</g>${links}
      </svg>
      <p class="mm-label" id="mm-label" aria-hidden="true"></p>`;
    nav.hidden = false;

    nav.addEventListener('click', (ev) => {
      const a = ev.target.closest('.mm-stop');
      if (!a) return;
      ev.preventDefault();
      jumpTo(parseInt(a.dataset.i, 10));
    });

    const label = $('#mm-label');
    const anchors = Array.from(nav.querySelectorAll('.mm-stop'));
    const update = (i) => {
      anchors.forEach((a, k) => {
        a.classList.toggle('is-active', k === i);
        a.classList.toggle('is-visited', k < i);
        if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      label.textContent = i === 0 ? '' : stops[i].label;
    };
    site.onActive.push(update);
    update(site.active);
  }

  /* ------------------------------------------------------------------------
     7. Scroll logic
     ------------------------------------------------------------------------
     The page scrolls normally. From the scroll position we work out a single
     number (see targetFromScroll):

        0 ............ hero (camera flies its loop above the network)
        1 ............ docked at the first section's node
        1.0 - 2.0 .... travelling along the edge to the second node
        2 ............ docked at the second node, and so on.

     While a card is being read (between its "arrive" and "depart" scroll
     positions) the number stays put, so the camera only drifts gently.

     In CONFIG.scroll.mode 'scrub' the camera follows that number directly. In
     'auto' (the default) it is rounded to a whole node by stopFromScroll(), and
     the camera flies there by itself.                                         */
  let marks = [];      // per stop: { arrive, depart, jump } scroll positions in px
  let heroDepart = 0;

  function measure() {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    heroDepart = Math.min(vh * 0.08, max);
    const jumpOffset = nodePlacement().above ? CONFIG.scroll.jumpOffsetNarrow : CONFIG.scroll.jumpOffset;
    let prev = heroDepart;
    marks = site.stops.map((s) => {
      // offsetTop/offsetHeight ignore the reveal animation's scale, unlike getBoundingClientRect
      let top = 0;
      for (let el = s.card; el; el = el.offsetParent) top += el.offsetTop;
      const bottom = top + s.card.offsetHeight;
      const arrive = clamp(top - vh * CONFIG.scroll.arriveAt, prev, max);
      const depart = clamp(bottom - vh * CONFIG.scroll.departAt, arrive, max);
      const jump = clamp(top - vh * jumpOffset, arrive, depart);
      prev = depart;
      return { arrive, depart, jump };
    });
    site.marks = marks; // for ?debug
  }

  function targetFromScroll(y) {
    let prev = heroDepart;
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      if (y < m.arrive) { const span = m.arrive - prev; return i + (span > 0 ? clamp((y - prev) / span, 0, 1) : 1); }
      if (y <= m.depart) return i + 1;
      prev = m.depart;
    }
    return marks.length;
  }

  /* 'auto' mode: turn the continuous scroll value into "which node should the
     camera be at". `home` is the section last docked at. In the gap after it,
     the camera stays at home until the scroll has moved `leaveAt` of the way
     out, then switches to the neighbouring node in one go. A slightly lower
     threshold applies for switching back, so it cannot flicker at the edge. */
  let home = 0, stop = 0;
  function stopFromScroll(c) {
    const lo = Math.floor(c), f = c - lo;
    if (f === 0) { home = stop = lo; return stop; }   // inside a section's reading range
    const hi = lo + 1;
    const S = CONFIG.scroll;
    if (home <= lo) {                                 // leaving `lo` downwards
      const leave = lo === 0 ? S.leaveHeroAt : S.leaveAt;
      stop = f > (stop === hi ? leave * 0.5 : leave) ? hi : lo;
    } else {                                          // leaving `hi` upwards
      const g = 1 - f;
      stop = g > (stop === lo ? S.leaveAt * 0.5 : S.leaveAt) ? lo : hi;
    }
    return stop;
  }

  function updateTarget() {
    const c = targetFromScroll(window.scrollY);
    site.target = CONFIG.scroll.mode === 'scrub' ? c : stopFromScroll(c);
    const active = Math.round(site.target);
    root.classList.toggle('past-hero', c > 0.15);
    if (active !== site.active) {
      site.active = active;
      root.dataset.node = String(active);
      site.onActive.forEach((fn) => fn(active));
    }
  }

  // Scroll to a stop (0 = top). Used by the mini map and #anchors.
  function jumpTo(i) {
    const top = i <= 0 ? 0 : marks[i - 1] ? marks[i - 1].jump : 0;
    window.scrollTo({ top, behavior: motionMode === 'static' ? 'auto' : 'smooth' });
    const id = i <= 0 ? '' : '#' + site.stops[i - 1].id;
    try { history.replaceState(null, '', id || location.pathname + location.search); } catch (e) { /* file:// */ }
  }

  function setupScroll() {
    const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    const refresh = () => { measure(); updateTarget(); };

    if (gsap && ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });

      site.stops.forEach((s) => {
        if (motionMode === 'full') {
          // The card grows out of its node while the camera swoops in (tied to the scroll).
          gsap.fromTo(s.card, { opacity: 0, scale: 0.92 }, {
            opacity: 1, scale: 1, ease: 'power2.out',
            scrollTrigger: { trigger: s.card, start: 'top 96%', end: 'top 58%', scrub: 0.4 },
          });
        } else {
          // Reduced motion and low-power mode: a plain fade.
          gsap.fromTo(s.card, { opacity: 0 }, {
            opacity: 1, duration: 0.5, ease: 'none',
            scrollTrigger: { trigger: s.card, start: 'top 88%', toggleActions: 'play none none reverse' },
          });
        }
      });

      // One trigger spanning the page keeps site.target in step with the scroll.
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: updateTarget });
      ScrollTrigger.addEventListener('refresh', refresh);
      window.addEventListener('load', () => ScrollTrigger.refresh());
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
      ScrollTrigger.refresh();
    } else {
      // GSAP did not load: the page still works, just without the reveal animation.
      window.addEventListener('scroll', updateTarget, { passive: true });
      window.addEventListener('resize', refresh);
      window.addEventListener('load', refresh);
    }
    refresh();

    // In-page links (#skills etc.) dock the camera properly instead of jumping to the raw anchor.
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest('a[href^="#"]');
      if (!a || a.closest('.minimap')) return;
      const i = site.stops.findIndex((s) => '#' + s.id === a.getAttribute('href'));
      if (i >= 0) { ev.preventDefault(); jumpTo(i + 1); site.stops[i].card.setAttribute('tabindex', '-1'); site.stops[i].card.focus({ preventScroll: true }); }
    });
    if (location.hash) {
      const i = site.stops.findIndex((s) => '#' + s.id === location.hash);
      if (i >= 0) requestAnimationFrame(() => { measure(); window.scrollTo(0, marks[i].jump); updateTarget(); });
    }
  }

  /* ------------------------------------------------------------------------
     8. 3D network (Three.js)
     ------------------------------------------------------------------------ */
  async function initNetwork() {
    const canvas = $('#net-canvas');
    const THREE = await import(CONFIG.cdn.three);
    const N = CONFIG.network;
    const P = isPhone ? N.mobile : N.desktop; // layout profile
    const C = CONFIG.camera;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: P.antialias, powerPreference: 'high-performance' });
    } catch (err) {
      root.classList.add('no-webgl');
      return;
    }
    let pixelRatio = Math.min(window.devicePixelRatio || 1, P.maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(CONFIG.colors.background, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(CONFIG.colors.background, 0.011);
    const camera = new THREE.PerspectiveCamera(C.fov, 1, 0.1, 500);

    /* ---- Build the layers --------------------------------------------- */
    const layerCount = site.stops.length + 1; // input layer + one per section
    const layers = [];
    const length = (layerCount - 1) * N.layerSpacing;
    const halfWidth = (P.neurons - 1) / 2 * P.neuronSpacing;
    const IR = N.irregular;
    const rand = makeRandom(IR.seed);            // repeatable: the same arrangement on every visit
    const spread = () => rand() * 2 - 1;         // -1 .. 1
    for (let i = 0; i < layerCount; i++) {
      // Each layer gets its own arch, slope and sideways shift...
      const bow = spread() * IR.bow, tilt = spread() * IR.tilt, sway = spread() * IR.sway * P.neuronSpacing;
      const lean = spread() * IR.depth * N.layerSpacing; // ...and its ends lean forwards or backwards
      const nodes = [];
      for (let c = 0; c < P.neurons; c++) {
        const gridX = (c - (P.neurons - 1) / 2) * P.neuronSpacing;
        const u = halfWidth ? gridX / halfWidth : 0; // -1 (left end) .. 1 (right end)
        // ...and each neuron is then nudged off its place in all three directions.
        nodes.push(new THREE.Vector3(
          gridX + sway + spread() * IR.scatter * P.neuronSpacing,
          bow * (1 - u * u) + tilt * gridX + spread() * IR.height,
          i * N.layerSpacing + lean * u * u + spread() * IR.depth * N.layerSpacing));
      }
      layers.push({ cols: P.neurons, nodes });
    }

    /* ---- Pick the section node in each layer (SECTIONS[].slot) --------- */
    const sectionIndex = new Set();
    const docks = site.stops.map((stop, k) => {
      const layer = layers[k + 1];
      const idx = clamp(Math.round((layer.cols - 1) / 2 + stop.slot), 0, layer.cols - 1);
      sectionIndex.add((k + 1) + ':' + idx);
      const node = layer.nodes[idx];
      return {
        node,
        cam: new THREE.Vector3(node.x, node.y + C.dockHeight, node.z - C.dockDistance), // camera position when docked
      };
    });

    /* ---- Nodes: flat circles ------------------------------------------- */
    // Every neuron is a plain 2D disc that always faces the camera. No glow, no shading.
    const plain = [];
    layers.forEach((layer, i) => layer.nodes.forEach((p, j) => { if (!sectionIndex.has(i + ':' + j)) plain.push(p); }));

    const discGeo = new THREE.PlaneGeometry(2, 2); // a square; the shader cuts the circle out of it
    const nodeMesh = new THREE.InstancedMesh(discGeo, makeDiscMaterial(THREE, CONFIG.colors.node, scene.fog.density), plain.length);
    const mtx = new THREE.Matrix4();
    plain.forEach((p, i) => {
      const r = N.nodeRadius * (1 + spread() * IR.sizeVariation);
      mtx.makeScale(r, r, r).setPosition(p);
      nodeMesh.setMatrixAt(i, mtx);
    });
    nodeMesh.frustumCulled = false; // the discs are placed in the shader, so skip the bounding test
    nodeMesh.renderOrder = 2;       // drawn after the edges, so lines end neatly underneath
    scene.add(nodeMesh);

    // Section nodes: larger circles with a lighter fill. The current one also gets a thin ring.
    const sectionNodes = docks.map((d) => {
      const core = new THREE.Mesh(discGeo, makeDiscMaterial(THREE, CONFIG.colors.sectionCore, scene.fog.density));
      core.scale.setScalar(N.sectionNodeRadius);
      core.position.copy(d.node);
      core.frustumCulled = false;
      core.renderOrder = 3;
      scene.add(core);
      return { core, glow: 0 };
    });

    /* ---- Edges: thin straight lines between adjacent layers ------------ */
    const edgePts = [];
    const edgeShade = [];
    const edgeList = []; // [from, to] pairs, reused by the travelling signals
    for (let i = 0; i < layers.length - 1; i++) {
      const A = layers[i].nodes, B = layers[i + 1].nodes;
      // Start fully connected, then leave out a share of the connections at random...
      const keep = A.map(() => B.map(() => rand() >= IR.dropout));
      // ...but never leave a neuron with nothing coming in or going out.
      A.forEach((a, ai) => { if (!keep[ai].some(Boolean)) keep[ai][(rand() * B.length) | 0] = true; });
      B.forEach((b, bi) => { if (!keep.some((row) => row[bi])) keep[(rand() * A.length) | 0][bi] = true; });
      A.forEach((a, ai) => B.forEach((b, bi) => {
        if (!keep[ai][bi]) return;
        edgePts.push(a, b); edgeList.push([a, b]);
        const shade = 1 - rand() * IR.edgeVariation; // some connections fainter than others
        edgeShade.push(shade, shade, shade, shade, shade, shade);
      }));
    }
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
    edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(edgeShade, 3));
    scene.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
      color: CONFIG.colors.node, vertexColors: true, transparent: true, opacity: N.edgeOpacity,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })));

    // The route the camera follows, section node to section node, drawn brighter.
    if (docks.length > 1) {
      const pathPts = [];
      for (let i = 0; i < docks.length - 1; i++) pathPts.push(docks[i].node, docks[i + 1].node);
      scene.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(pathPts),
        new THREE.LineBasicMaterial({ color: CONFIG.colors.node, transparent: true, opacity: N.pathEdgeOpacity, depthWrite: false, blending: THREE.AdditiveBlending })));
    }

    /* ---- Signals: pulses travelling forward along random edges --------- */
    const signalCount = motionMode === 'static' ? 0 : Math.min(P.signals, edgeList.length);
    const signals = [];
    let signalGeo = null;
    if (signalCount) {
      for (let i = 0; i < signalCount; i++) signals.push({ edge: edgeList[(Math.random() * edgeList.length) | 0], p: Math.random(), speed: 0.25 + Math.random() * 0.35 });
      signalGeo = new THREE.BufferGeometry();
      signalGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(signalCount * 3), 3));
      const pts = new THREE.Points(signalGeo, new THREE.PointsMaterial({
        map: makeDotTexture(THREE), color: 0xffffff, size: 0.28, sizeAttenuation: true,
        transparent: true, opacity: 0.9, depthWrite: false,
      }));
      pts.frustumCulled = false;
      scene.add(pts);
    }
    function updateSignals(dt) {
      const arr = signalGeo.attributes.position.array;
      signals.forEach((s, i) => {
        s.p += s.speed * dt;
        if (s.p >= 1) { s.p = 0; s.edge = edgeList[(Math.random() * edgeList.length) | 0]; }
        const a = s.edge[0], b = s.edge[1];
        arr[i * 3] = a.x + (b.x - a.x) * s.p;
        arr[i * 3 + 1] = a.y + (b.y - a.y) * s.p;
        arr[i * 3 + 2] = a.z + (b.z - a.z) * s.p;
      });
      signalGeo.attributes.position.needsUpdate = true;
    }

    /* ---- Camera rig ---------------------------------------------------- */
    const UP = new THREE.Vector3(0, 1, 0), AXIS_Z = new THREE.Vector3(0, 0, 1);
    const lookMtx = new THREE.Matrix4(), qRoll = new THREE.Quaternion();
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vLook = new THREE.Vector3();
    const qA = new THREE.Quaternion(), qB = new THREE.Quaternion();

    // Orientation for "stand at pos, look at target, roll (bank) by this angle".
    function lookQuat(pos, target, roll, out) {
      lookMtx.lookAt(pos, target, UP);
      out.setFromRotationMatrix(lookMtx);
      if (roll) out.multiply(qRoll.setFromAxisAngle(AXIS_Z, roll));
      return out;
    }

    /* Hero flyover. The path is an oval stretched over the whole network:
       out along one side, a banking turn past the last layer, back along the
       other side, another turn, forever. `u` is the angle around the oval.
       Both turns happen above the network and the camera looks slightly
       inward, so there are always nodes in view. */
    const fly = { u: C.flyStart };
    site.fly = fly; // exposed for tuning: open the page with ?debug and inspect window.__site in the console
    const flyHalfLength = Math.max(10, length / 2 - C.flyInset);
    const flySide = Math.max(8, halfWidth * C.flySide);
    function flyPoint(u, out) {
      return out.set(
        flySide * Math.sin(u),
        C.flyHeight + C.flyHeightWave * Math.sin(u * 2 + 0.6),
        length / 2 - flyHalfLength * Math.cos(u));
    }
    const heading = (u) => { flyPoint(u + 0.01, vA); flyPoint(u - 0.01, vB); return Math.atan2(vA.x - vB.x, vA.z - vB.z); };
    function flyPose(pos, quat) {
      flyPoint(fly.u, pos);
      flyPoint(fly.u + C.flyLookAhead, vLook);
      vLook.x *= 1 - C.flyLookInward;            // look ahead, a little inward...
      vLook.z += (length / 2 - vLook.z) * 0.15;  // and a touch towards the middle, so the turns stay full of nodes
      vLook.y = 0;                               // ...and down at the network
      let turn = heading(fly.u + 0.05) - heading(fly.u - 0.05);
      turn = Math.atan2(Math.sin(turn), Math.cos(turn)) / 0.1; // turn rate, unwrapped
      lookQuat(pos, vLook, clamp(turn * C.flyBank, -C.flyMaxBank, C.flyMaxBank), quat);
    }

    // Docked: hover in front of the node with a slow sway.
    function dockPose(i, time, pos, quat) {
      const d = docks[i], k = C.driftAmount;
      pos.copy(d.cam);
      pos.x += Math.sin(time * 0.31 + i) * 0.4 * k;
      pos.y += Math.sin(time * 0.23 + 1.3) * 0.22 * k;
      pos.z += Math.sin(time * 0.17) * 0.3 * k;
      lookQuat(pos, d.node, 0, quat);
    }

    /* Where the camera is for a given journey value t (see part 7):
         0 .. 1      blend from the flyover down to the first node (the first swoop)
         k           docked at node k
         k .. k+1    rise, glide above the edge to the next node, swoop in       */
    function poseAt(t, time, pos, quat) {
      const n = docks.length;
      if (n === 0 || t <= 0) return flyPose(pos, quat);
      if (t < 1) {
        flyPose(vA, qA);
        dockPose(0, time, vB, qB);
        const e = smoother(t);
        pos.lerpVectors(vA, vB, e);
        quat.slerpQuaternions(qA, qB, e);
        return;
      }
      const i = Math.min(Math.floor(t), n); // docked at (or leaving) section number i
      const f = t - i;
      if (f < 0.0005 || i >= n) return dockPose(i - 1, time, pos, quat);

      const a = docks[i - 1], b = docks[i];
      const e = smoother(f);
      dockPose(i - 1, time, vA, qA);
      dockPose(i, time, vB, qB);
      pos.lerpVectors(vA, vB, e);
      pos.y += C.riseHeight * Math.sin(Math.PI * e);                 // rise, then swoop
      vLook.lerpVectors(a.node, b.node, smoothstep(0, 0.6, f));      // eyes move to the next node early
      const bank = clamp((b.cam.x - a.cam.x) / 24, -0.3, 0.3) * Math.sin(Math.PI * e);
      lookQuat(pos, vLook, bank, quat);
    }

    // Reduced motion: one still, three-quarter view of the whole network.
    function staticPose(pos, quat) {
      pos.set(-halfWidth * 1.1, 20, -16);
      vLook.set(0, 0, length * 0.3);
      lookQuat(pos, vLook, 0, quat);
    }

    /* ---- Sizing --------------------------------------------------------- */
    let W = 1, H = 1;
    let place = { x: 0, y: 0 }; // on-screen position of the docked neuron, see nodePlacement()
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      place = nodePlacement();
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.fov = W < H ? C.fovPortrait : C.fov;
      camera.updateProjectionMatrix();
      if (motionMode === 'static') renderStill();
    }

    /* Slide the whole picture sideways or up/down on screen.
         hero (0..1): the network sits beside (or below) the hero photo.
         dock (0..1): the section's neuron sits beside (or above) its card. */
    function applyViewShift(hero, dock) {
      const hasPhoto = !root.classList.contains('no-photo');
      const sx = (hasPhoto && !mqMobile.matches ? W * C.heroShiftX * hero : 0) + place.x * dock;
      const sy = (hasPhoto && mqMobile.matches ? H * C.heroShiftY * hero : 0) + place.y * dock;
      if (Math.abs(sx) > 0.5 || Math.abs(sy) > 0.5) camera.setViewOffset(W, H, -sx, -sy, W, H);
      else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    }

    // The node of the section on screen grows a little and shows its ring.
    function updateSectionGlow(dt) {
      sectionNodes.forEach((s, k) => {
        const on = site.active === k + 1 ? 1 : 0;
        s.glow += (on - s.glow) * (dt > 0 ? 1 - Math.exp(-dt * 4) : 1);
        s.core.material.uniforms.uRing.value = s.glow;
        s.core.scale.setScalar(N.sectionNodeRadius * (1 + s.glow * 0.25));
      });
    }

    function renderStill() {
      staticPose(camera.position, camera.quaternion);
      applyViewShift(site.active === 0 ? 1 : 0, 0); // beside the photo on the hero, centred behind the cards
      updateSectionGlow(0);
      renderer.render(scene, camera);
    }

    /* ---- Frame loop ------------------------------------------------------ */
    let t = site.target;           // smoothed journey value
    let cut = Math.round(t);       // fade mode: the node currently shown
    let cutting = false;
    let last = performance.now(), time = 0;
    let perfTime = 0, perfFrames = 0, warmup = 45, slowFrame = false;

    function frame(now) {
      if (motionMode === 'static') return; // loop ends; still frames are drawn on demand
      requestAnimationFrame(frame);
      const rawDt = (now - last) / 1000;
      last = now;
      const dt = Math.min(rawDt, 0.1);
      time += dt;

      if (motionMode === 'fade') {
        // Low-power mode: no flight. Fade the canvas out, cut to the node, fade back in.
        const want = Math.round(site.target);
        if (want !== cut && !cutting) {
          cutting = true;
          canvas.style.opacity = '0';
          setTimeout(() => { cut = Math.round(site.target); canvas.style.opacity = ''; cutting = false; }, 280);
        }
        t = cut;
        slowFrame = !slowFrame;
        if (slowFrame) return; // draw every other frame
      } else {
        if (CONFIG.scroll.mode === 'scrub') {
          t += (site.target - t) * (1 - Math.exp(-dt * C.follow));   // trail the scroll smoothly
        } else {
          // Fly towards the chosen node at a fixed pace, whatever the scroll is doing.
          // (poseAt eases each hop in and out; several hops in a row go a little faster.)
          const gap = site.target - t, far = Math.abs(gap);
          const step = dt / C.hopDuration * Math.max(1, Math.pow(far, 0.6));
          t = far <= step ? site.target : t + Math.sign(gap) * step;
        }
      }

      if (t < 1) fly.u += dt * C.flySpeed;
      poseAt(t, time, camera.position, camera.quaternion);
      applyViewShift(1 - smoothstep(0.05, 0.8, t), smoothstep(0.2, 1, t));
      if (signalGeo) updateSignals(dt);
      updateSectionGlow(dt);
      renderer.render(scene, camera);

      /* Performance watchdog: average the frame time over ~2 seconds. */
      if (motionLocked || motionMode !== 'full' || rawDt > 0.25 || document.hidden) return;
      if (warmup > 0) { warmup--; return; }
      perfTime += rawDt; perfFrames++;
      if (perfFrames >= 110) {
        const fps = perfFrames / perfTime;
        perfTime = 0; perfFrames = 0;
        if (fps < CONFIG.minFps) {
          if (pixelRatio > 1) { pixelRatio = 1; resize(); warmup = 30; }       // step 1: lower resolution
          else { cut = Math.round(site.target); setMotionMode('fade'); root.classList.add('lite'); } // step 2: fades instead of swoops
        }
      }
    }

    window.addEventListener('resize', resize);
    let stillTimer = 0;
    site.onActive.push(() => {
      if (motionMode !== 'static') return;
      // Reduced motion: no flight, just a quick fade while the still picture updates.
      canvas.style.opacity = '0';
      clearTimeout(stillTimer);
      stillTimer = setTimeout(() => { renderStill(); canvas.style.opacity = ''; }, 280);
    });
    canvas.addEventListener('webglcontextlost', (ev) => ev.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => { if (motionMode === 'static') renderStill(); });

    resize();
    root.classList.add('has-network');
    if (motionMode === 'static') renderStill(); else requestAnimationFrame(frame);
  }

  /* Material for the neurons: a flat, single-colour circle that always faces
     the camera (a "billboard"). The circle is cut out of a square in the
     fragment shader, with a one-pixel soft edge so it stays crisp at any size.
     uRing (0..1) fades in a thin outline ring, used to mark the current section.
     Distance fog is applied by hand to match the scene fog. */
  function makeDiscMaterial(THREE, hex, fogDensity) {
    const rgb = (h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
    return new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uColor: { value: rgb(hex) },
        uFog: { value: rgb(CONFIG.colors.background) },
        uDensity: { value: fogDensity },
        uRing: { value: 0 },
      },
      vertexShader: `
        varying vec2 vPos;
        varying float vDist;
        const float EXTENT = 1.9;   // the square is a bit bigger than the circle, to leave room for the ring
        void main() {
          vec4 centre = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            centre = instanceMatrix * centre;
            float radius = length(instanceMatrix[0].xyz);
          #else
            float radius = length(modelMatrix[0].xyz);
          #endif
          vec4 mv = modelViewMatrix * centre;
          mv.xy += position.xy * radius * EXTENT;   // spread the corners in screen space = always facing the camera
          vPos = position.xy * EXTENT;
          vDist = length(mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uFog;
        uniform float uDensity;
        uniform float uRing;
        varying vec2 vPos;
        varying float vDist;
        void main() {
          float d = length(vPos);
          float aa = fwidth(d);
          float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
          float ring = uRing * (smoothstep(1.5 - aa, 1.5 + aa, d) - smoothstep(1.62 - aa, 1.62 + aa, d));
          float alpha = max(disc, ring);
          if (alpha < 0.01) discard;
          float f = vDist * uDensity;
          gl_FragColor = vec4(mix(uFog, uColor, exp(-f * f)), alpha);
        }`,
    });
  }

  // Small repeatable random number generator (mulberry32): same seed, same network.
  function makeRandom(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A small hard-edged dot, used for the signals travelling along the edges.
  function makeDotTexture(THREE) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ------------------------------------------------------------------------
     9. Start-up
     ------------------------------------------------------------------------ */
  function showNotice(html) {
    const box = $('#notice');
    box.innerHTML = html;
    box.hidden = false;
    root.classList.add('is-ready');
  }

  async function start() {
    let raw;
    try {
      const res = await fetch(CONFIG.contentFile, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      raw = await res.text();
    } catch (err) {
      const local = location.protocol === 'file:';
      showNotice(local
        ? '<strong>content.md could not be loaded.</strong> Browsers block this when index.html is opened straight from a folder. Start a local server instead (see “Preview locally” in README.md), then open http://localhost:8000.'
        : '<strong>content.md could not be loaded.</strong> Check that content.md and the empty .nojekyll file are both in the top folder of the repository.');
      return;
    }

    const data = parseContent(raw);
    renderHero(data.meta);
    renderSections(data);
    buildMinimap();
    setupScroll();
    root.classList.add('is-ready');

    // The network is decoration: if Three.js or WebGL is unavailable the page still reads fine.
    initNetwork().catch((err) => {
      root.classList.add('no-webgl');
      if (window.console) console.warn('3D network disabled:', err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
