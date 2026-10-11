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
  assert.match(block('.nav-link.is-active'), /background:\s*var\(--bg-alt\)/, 'the active nav item has a distinct background');
});

test('section headings keep the original centered divider style', () => {
  const sections = [['about', '02 //', 'About'], ['projects', '03 //', 'Projects'], ['stack', '04 //', 'Stack'],
    ['certifications', '05 //', 'Certifications'], ['outside', '06 //', 'Outside the IDE'], ['contact', '07 //', 'Get in touch']];
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
  for (const name of ['.project-list', '.certification']) {
    assert.match(block(name), /background:\s*var\(--surface\)/, `${name} is a raised card`);
    assert.match(block(name), /box-shadow:\s*var\(--shadow\)/, `${name} has the soft shadow`);
    assert.match(block(name), /border-radius:\s*var\(--radius-lg\)/);
  }
  for (const name of ['.stack-group', '.timeline-block', '.github-panel']) {
    assert.doesNotMatch(block(name), /box-shadow|background:\s*var\(--surface\)/, `${name} is flat`);
  }
  assert.match(block('.sidebar'), /background:\s*var\(--surface\)/, 'the sidebar is still a surface');
  assert.match(js, /el\('li', 'project'\)/);
});

test('the hero keeps its original size and its one static button', () => {
  assert.match(block('.hero-name'), /font-size:\s*clamp\(2\.25rem, 4\.6vw, 3\.75rem\)/);
  assert.match(block('.hero'), /min-height:\s*min\(620px, calc\(100vh - 96px\)\)/);
  const actions = html.slice(html.indexOf('class="hero-actions"'), html.indexOf('class="social"'));
  assert.match(actions, /class="btn btn-primary"[^>]*href="mailto:/);
  assert.doesNotMatch(actions, /btn-secondary/, 'only "Email me" is static; a Resume button is added from data.js');
  assert.doesNotMatch(html + css, /hero-scroll|scroll-cue/);
});

test('new motion is switched off for reduced-motion users', () => {
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.doesNotMatch(css, /\.card:hover/, 'nothing lifts on hover any more');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.btn:active[^}]*\{\s*scale: none;/, 'press feedback is off too');
});

test('on phones the hero fills the first screen, so About starts below the fold', () => {
  const phone = css.slice(css.indexOf('@media (max-width: 639.98px)'));
  const hero = /\n  \.hero \{([^}]*)\}/.exec(phone);
  assert.ok(hero, 'a phone-only hero rule exists');
  assert.match(hero[1], /min-height:\s*calc\(100svh - var\(--topbar-h\) - 28px\)/);
  assert.match(hero[1], /justify-content:\s*center/);
});
