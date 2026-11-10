// The "polish pass": monochrome base, a touch of blue, real headings, card surfaces, stronger hero.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const css = read('style.css');
const html = read('index.html');

const block = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start > -1, `missing rule: ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};
const token = (rule, name) => {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(rule);
  assert.ok(m, `missing ${name}`);
  return m[1].trim();
};
const rgb = (value) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const fn = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);
  assert.ok(fn, `not a colour: ${value}`);
  return fn.slice(1).map(Number);
};
const luminance = (value) => {
  const [r, g, b] = rgb(value).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const light = block(':root');
const dark = block(':root[data-theme="dark"]');

test('the palette stays monochrome: no accent colour, only the green status dot', () => {
  assert.doesNotMatch(css, /--blue|#2563eb|#60a5fa/i, 'no blue anywhere');
  const hues = new Set();
  for (const [, hex] of css.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
    if (Math.max(r, g, b) - Math.min(r, g, b) > 24) hues.add(`#${hex.toLowerCase()}`);
  }
  assert.deepEqual([...hues].sort(), ['#2f9e5b', '#5fd08a'], 'the status greens are the only non-grey colours');
});

test('depth comes from surfaces: cards read as raised in both themes, and text stays readable on them', () => {
  for (const [name, theme] of [['light', light], ['dark', dark]]) {
    const surface = token(theme, '--surface');
    assert.notEqual(surface, token(theme, '--bg'), `${name}: the card surface differs from the page`);
    assert.ok(contrast(token(theme, '--fg'), surface) >= 12, `${name}: text on cards`);
    assert.ok(contrast(token(theme, '--fg-muted'), surface) >= 4.5, `${name}: muted text on cards is ${contrast(token(theme, '--fg-muted'), surface).toFixed(2)}:1`);
  }
  const noJs = css.slice(css.indexOf(':root:not([data-theme])'));
  assert.match(noJs.slice(0, noJs.indexOf('}')), /--surface:/, 'the no-JS dark fallback has the surface too');
});

test('More-page section headings keep the centered divider style', () => {
  // Home's sections have panel heads now (see the panel tests); the More page keeps the divider.
  const sections = [['outside', '06 //', 'Outside the IDE']];
  for (const [id, tag, title] of sections) {
    const start = html.indexOf(`id="${id}"`);
    const head = html.slice(start, start + 700);
    assert.match(head, /<div class="divider">/, `${id}: divider`);
    assert.match(head, new RegExp(`<h2 class="divider-label" id="${id}-heading">\\s*<span class="divider-index" aria-hidden="true">${tag.replace('/', '\\/')}</span>\\s*${title.replace(/ /g, '\\s+')}\\s*</h2>`), `${id}: label`);
  }
  assert.doesNotMatch(html + css, /section-head|section-title|section-tag|section-rule/, 'the large pixel headings were dropped');
  assert.match(block('.divider-label'), /font-family:\s*var\(--font-mono\)/);
});

test('cards are kept for projects and certifications; the other sections are ruled rows', () => {
  for (const name of ['--surface', '--shadow', '--radius-lg']) token(light, name);
  token(dark, '--surface'); token(dark, '--shadow');
  const js = read('script.js');
  assert.doesNotMatch(css, /\.card\b/, 'no generic card utility: each card styles itself');
  assert.doesNotMatch(html, /class="[^"]*\bcard\b/, 'no card classes in the markup');
  for (const name of ['.project', '.certification']) {
    assert.match(block(name), /background:\s*var\(--surface\)/, `${name} is a raised card`);
    assert.match(block(name), /box-shadow:\s*var\(--shadow\)/, `${name} has the soft shadow`);
    assert.match(block(name), /border-radius:\s*var\(--radius-lg\)/);
  }
  for (const name of ['.stack-group', '.timeline-block', '.github-panel']) {
    assert.doesNotMatch(block(name), /box-shadow|background:\s*var\(--surface\)/, `${name} is flat`);
  }
  assert.match(js, /el\('li', 'project'\)/);
});

test('the poster has one static button; the Résumé one comes from data.js', () => {
  const actions = between(html, 'class="poster-actions"', '</div>');
  assert.match(actions, /class="btn btn-primary"[^>]*href="mailto:/);
  assert.doesNotMatch(actions, /btn-secondary/, 'only "Email me" is static; a Résumé button is added from data.js');
});

test('new motion is switched off for reduced-motion users', () => {
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.doesNotMatch(css, /\.card:hover/, 'nothing lifts on hover any more');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.btn:active[^}]*\{\s*scale: none;/, 'press feedback is off too');
});

test('the cursor is one rounded arrowhead per theme: white on dark, black on light', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const icons = path.join(__dirname, '..', 'assets', 'icons');
  const fills = (file) => [...fs.readFileSync(path.join(icons, file), 'utf8').matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
  for (const name of ['on-light', 'on-dark']) {
    const svg = fs.readFileSync(path.join(icons, `cursor-${name}.svg`), 'utf8');
    assert.match(svg, /width="26" height="28"/, `${name}: explicit size, so every browser accepts it as a cursor`);
    assert.match(svg, /stroke-linejoin="round"/);
  }
  assert.equal(fills('cursor-on-dark.svg')[1], '#ececee', 'white arrow on the dark theme');
  assert.equal(fills('cursor-on-light.svg')[1], '#111113', 'black arrow on the light theme');
  assert.deepEqual(fs.readdirSync(icons).filter((f) => f.startsWith('cursor-')).sort(), ['cursor-on-dark.svg', 'cursor-on-light.svg'], 'no second colour for links');
  assert.match(token(light, '--cursor'), /cursor-on-light\.svg"\) 4 3, auto/);
  assert.match(token(dark, '--cursor-link'), /cursor-on-dark\.svg"\) 4 3, pointer/, 'the same arrow over links; only the fallback differs');
  assert.match(css, /html \{\s*cursor: var\(--cursor\);/);
  assert.doesNotMatch(css, /cursor:\s*(?:pointer|default);/, 'every clickable thing uses the themed cursor');
  assert.match(css, /cursor: crosshair;/, 'the photo keeps its crosshair');
  const js = read('script.js');
  const burst = js.slice(js.indexOf('const clickBurst'), js.indexOf('20. Scroll aids'));
  assert.match(burst, /event\.pointerType !== 'mouse'/, 'no burst on touch');
  assert.match(burst, /prefersReducedMotion\(\)/);
  assert.match(burst, /const RAYS = \[165, 205, 245, 285, 325\];/);
});

// Poster redesign: the frame, the notch and CK's panel replace the sidebar.
const between = (text, start, end) => {
  const a = text.indexOf(start);
  assert.ok(a > -1, `missing ${start}`);
  return text.slice(a, text.indexOf(end, a));
};

test('the sidebar, top bar, drawer and floating CK are gone', () => {
  for (const gone of ['class="sidebar"', 'class="topbar"', 'class="backdrop"', 'assistant-launcher', 'collapse-toggle', 'menu-toggle']) {
    assert.ok(!html.includes(gone), `index.html still has ${gone}`);
  }
  for (const gone of [/^\.sidebar \{/m, /^\.topbar \{/m, /body\.is-rail/, /\.assistant-launcher/]) assert.doesNotMatch(css, gone);
});

test('the notch holds four page links and CK, who is Home', () => {
  const notch = between(html, '<nav class="notch"', '</nav>');
  const order = [...notch.matchAll(/data-notch="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['projects', 'stack', 'home', 'resources', 'more']);
  assert.match(notch, /<a class="notch-ck" href="\.\/" data-notch="home"/);
});

test("the footer holds what CK's menu held", () => {
  const footer = between(html, '<footer class="footer"', '</footer>');
  for (const part of ['data-chat', 'game-trigger', 'score-row', 'poke-button', 'poke-value', 'theme-toggle', 'data-profile-link="github"', 'data-profile-link="linkedin"', 'data-copy=']) {
    assert.ok(footer.includes(part), `footer lacks ${part}`);
  }
  for (const view of ['resume', 'resources', 'links', 'guestbook']) assert.ok(footer.includes(`href="./?view=${view}"`), `footer lacks ${view}`);
  assert.doesNotMatch(html, /\b(ck-panel|ck-hint|sidebar-chat)\b/);
});

// Poster redesign: the opening screen.
const PLACEHOLDERS = ['Curious about how systems connect', "Things I've built and shipped", 'What I reach for', 'Building pipelines that ship on every push', "Hi, I'm Ken", 'Proof', 'PROOF'];

test('the poster has one h1 with the full name and real copy only', () => {
  const home = between(html, '<section class="section poster" id="home"', '</section>');
  const h1s = [...home.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)];
  assert.equal(h1s.length, 1);
  assert.equal(h1s[0][1].trim(), 'Kenneth Charles Valdez');
  assert.match(home, /class="poster-title"[^>]*>\s*Aspiring DevOps Engineer\s*</);
  assert.ok(!html.includes('Building. Learning. Shipping.'), 'the old tagline is gone');
  for (const text of PLACEHOLDERS) assert.ok(!html.includes(text), `placeholder "${text}" shipped`);
});

test('the poster name is one serif line', () => {
  const rule = block('.poster-name');
  assert.match(rule, /Instrument Serif/);
  assert.match(rule, /italic/);
  assert.match(rule, /white-space:\s*nowrap/);
});

test('the photo is black and white until colour is asked for', () => {
  assert.match(block('.poster-photo'), /grayscale\(1\)/);
  assert.match(css, /\.poster\.is-colour \.poster-photo[^{]*\{[^}]*filter:\s*none/);
});

test('the pixel photo is gone', () => {
  const js = read('script.js');
  for (const gone of ['pixel-tile', 'hero-photo', 'photo-glitch']) {
    assert.ok(!html.includes(gone) && !css.includes(gone), `${gone} still present`);
  }
  assert.doesNotMatch(js, /const pixelPhoto =|glitchSlices|computeTiles/);
});

// Poster redesign: the "lights on" intro.
test('the intro hides poster parts only while intro-play is set', () => {
  const intro = between(css, '/* 19b. Poster intro', '/* 20. Responsive').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selectors, body] of intro.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/opacity:\s*0\b|translate:\s*0 -100%|clip-path/.test(body)) {
      for (const selector of selectors.split(',')) assert.match(selector.trim(), /^html\.intro-play /, `"${selector.trim()}" hides outside the intro`);
    }
  }
  assert.match(intro, /html\.intro-play \.poster-light/);
  assert.match(intro, /html\.intro-play \.notch/);
});

test('the head marks Home and starts the intro only on a plain, motion-friendly load', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  assert.doesNotMatch(head, /at-cover|has-cover|data-cover/);
  assert.match(head, /root\.classList\.add\("is-home"\);\s*if \(!window\.location\.hash && !calm\) root\.classList\.add\("intro-play"\);/);
  assert.match(head, /getAttribute\("data-intro"\) !== "ready"\)\s*root\.classList\.remove\("intro-play"\)/, 'a failsafe if script.js never loads');
  assert.match(head, /history\.scrollRestoration = "manual";/, 'a reload still starts at the poster');
});

// Home in one tone: no ink and paper panels.
test('Home sections use the page tokens, not ink and paper tones', () => {
  assert.doesNotMatch(html, /panel-(paper|ink)/);
  assert.doesNotMatch(css, /--ink|--paper-|--paper:|panel-(paper|ink)/);
});

test('the frame is fixed to the window: a rounded hole the page scrolls under', () => {
  assert.match(css, /\.frame::after \{[^}]*position:\s*fixed/);
  assert.match(css, /\.frame::after \{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.frame::after \{[^}]*box-shadow:\s*0 0 0 100vmax var\(--frame\)/);
});

test('each Home panel is labelled by panelLabel and titled with its real name', () => {
  const { panelLabel } = require('../script.js');
  const titles = { about: 'About', projects: 'Projects', stack: 'Stack', certifications: 'Certifications', contact: 'Get in touch' };
  for (const [id, title] of Object.entries(titles)) {
    const section = between(html, `id="${id}"`, '</section>');
    assert.match(section, new RegExp(`class="panel-label divider-label"[^>]*>${panelLabel(id).replace('·', '&middot;')}<`), `${id} label`);
    assert.match(section, new RegExp(`class="panel-title" id="${id}-heading">${title}<`), `${id} title`);
  }
});

test('the frame colour exists in both themes', () => {
  for (const rule of [light, dark]) token(rule, '--frame');
});

test('only About stays pinned, so Projects slides over it; the rest scrolls normally', () => {
  assert.match(css, /html\.is-home #about \{[^}]*position:\s*sticky/);
  assert.doesNotMatch(css, /position:\s*sticky;[^}]*\}[^{]*html\.is-home :is\(\.poster/, 'the poster is not pinned');
  assert.doesNotMatch(css, /\.main > \.panel:not\(:last-of-type\)\) \{[^}]*position:\s*sticky/);
  assert.doesNotMatch(css, /margin:\s*-34px/);
});

test('CK holds still: the notch sides open to the same width around him', () => {
  const notch = between(html, '<nav class="notch"', '</nav>');
  assert.match(notch, /<span class="notch-side">[\s\S]*data-notch="projects"[\s\S]*data-notch="stack"[\s\S]*<\/span>\s*<a class="notch-ck"[\s\S]*<span class="notch-side">[\s\S]*data-notch="resources"[\s\S]*data-notch="more"/);
  assert.match(css, /\.notch-side \{[^}]*width:\s*0/);
  assert.match(css, /\.notch:is\(:hover, :has\(:focus-visible\)\) \.notch-side \{[^}]*width:\s*var\(--side-w\)/);
});

// Poster redesign: the other pages wear the poster headings.
test('every page title uses the poster heading style', () => {
  assert.match(css, /:is\(\.more-page-header, \.projects-page-header, \.stack-page-header, \.resume-page-header, \.links-page-header, \.guestbook-page-header, \.resources-page-header\) \.personal-title \{[^}]*text-transform:\s*uppercase[^}]*\}/);
});

test('404 keeps to itself and wears the frame', () => {
  const page = read('404.html');
  assert.doesNotMatch(page, /script\.js|data\.js/);
  assert.match(page, /class="frame"/);
  assert.match(page, /<nav class="notch"[^>]*>\s*<a class="notch-ck" href="https:\/\/kenchrls\.vercel\.app\/" aria-label="Home">/);
  assert.match(page, /text-transform: uppercase/);
});
