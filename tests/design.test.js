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
  assert.deepEqual([...hues].sort(), ['#16a34a', '#22c55e'], 'the status greens are the only non-grey colours');
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
  assert.match(block('.nav-link.is-active'), /box-shadow:\s*inset 3px 0 0 var\(--fg\)/, 'the active nav item gets a solid marker');
});

test('every section has a real heading: a small tag above a large title', () => {
  const sections = [['about', '02 //', 'About'], ['stack', '03 //', 'Stack'], ['projects', '04 //', 'Projects'],
    ['certifications', '05 //', 'Certifications'], ['outside', '06 //', 'Outside the IDE'], ['contact', '07 //', 'Get in touch']];
  for (const [id, tag, title] of sections) {
    const start = html.indexOf(`id="${id}"`);
    const head = html.slice(start, start + 700);
    assert.match(head, /<header class="section-head">/, `${id}: section-head`);
    assert.match(head, new RegExp(`class="section-tag" aria-hidden="true">\\s*${tag.replace('/', '\\/')}\\s*<`), `${id}: tag`);
    assert.match(head, new RegExp(`<h2 class="section-title" id="${id}-heading">\\s*${title}\\s*</h2>`), `${id}: title`);
  }
  assert.doesNotMatch(html, /class="divider/, 'old centered dividers are gone');
  assert.doesNotMatch(css, /\.divider\b/);
  const size = /font-size:\s*clamp\(([\d.]+)rem,[^,]+,\s*([\d.]+)rem\)/.exec(block('.section-title'));
  assert.ok(size && Number(size[2]) >= 2, 'section titles are large (2rem or more)');
});

test('content sits on soft cards instead of hairline tables', () => {
  for (const name of ['--surface', '--shadow', '--shadow-lift', '--radius-lg']) token(light, name);
  token(dark, '--surface'); token(dark, '--shadow');
  const card = block('.card');
  assert.match(card, /background:\s*var\(--surface\)/);
  assert.match(card, /border-radius:\s*var\(--radius-lg\)/);
  assert.match(card, /box-shadow:\s*var\(--shadow\)/);
  assert.match(css, /\.card:hover\s*\{[^}]*box-shadow:\s*var\(--shadow-lift\)/, 'cards lift on hover');
  assert.doesNotMatch(block('.stack-grid'), /background:\s*var\(--border\)/, 'stack is no longer one bordered table');
  for (const cls of ['timeline-block card', 'github-panel card']) assert.ok(html.includes(`class="${cls}"`), `${cls} in the markup`);
  const js = read('script.js');
  assert.match(js, /'stack-group card'/);
  assert.match(js, /'project card'/);
});

test('the hero is a stronger first screen', () => {
  const name = /font-size:\s*clamp\(([\d.]+)rem,[^,]+,\s*([\d.]+)rem\)/.exec(block('.hero-name'));
  assert.ok(name && Number(name[2]) >= 5, 'the name grows to 5rem or more on desktop');
  const actions = html.slice(html.indexOf('class="hero-actions"'), html.indexOf('class="social"'));
  assert.match(actions, /class="btn btn-primary"[^>]*href="mailto:/);
  assert.match(actions, /class="btn btn-secondary"\s+href="#projects"\s*>\s*View projects\s*</);
  assert.match(html, /class="hero-scroll"[^>]*href="#about"/, 'a scroll cue points to About');
});

test('new motion is switched off for reduced-motion users', () => {
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.card/, 'cards do not lift');
  assert.match(reduced, /\.hero-scroll/, 'the scroll cue does not bob');
});
