const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CHIMKEN_SPRITE, CHIMKEN_WALK_B, CHIMKEN_AIR, CHIMKEN_INK } = require('../script.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('every chimken frame is a 12x12 sprite', () => {
  for (const sprite of [CHIMKEN_SPRITE, CHIMKEN_WALK_B, CHIMKEN_AIR]) {
    assert.equal(sprite.length, 12);
    for (const row of sprite) assert.match(row, /^[KWSA.]{12}$/);
    const used = new Set(sprite.join('').replace(/\./g, ''));
    assert.deepEqual([...used].sort(), ['A', 'K', 'S', 'W'], 'outline, body, shade and accent are all used');
  }
});

test('chimken no longer roams under the hero; the game opens from the sidebar', () => {
  const all = read('index.html') + read('style.css') + read('script.js');
  assert.doesNotMatch(all, /hero-yard|yard-chimken|yard-corn|roamStep/);
  assert.match(read('script.js'), /\$\$\('\.game-trigger, \.score-row'\)/);
});

test('chimken is drawn in greys: every sprite letter has a colour token in both themes', () => {
  const css = read('style.css');
  assert.deepEqual(Object.keys(CHIMKEN_INK).sort(), ['A', 'K', 'S', 'W']);
  for (const name of Object.values(CHIMKEN_INK)) {
    const values = [...css.matchAll(new RegExp(`${name}:\\s*#([0-9a-f]{6});`, 'g'))].map((m) => m[1]);
    assert.equal(values.length, 3, `${name}: light, dark, and the no-JS dark fallback`);
    for (const hex of values) {
      const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `${name} #${hex} is not a grey`);
    }
  }
  const body = [...css.matchAll(/--chimken-body:\s*(#[0-9a-f]{6});/g)].map((m) => m[1]);
  assert.ok(body.every((hex) => parseInt(hex.slice(1, 3), 16) >= 250), 'a white chicken in both themes');
});

test('the sidebar icon is the silhouette of the same sprite', () => {
  const svg = read('assets/icons/chimken.svg');
  const filled = CHIMKEN_SPRITE.join('').replace(/\./g, '').length;
  const area = [...svg.matchAll(/width="(\d+)" height="1"/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  assert.equal(area, filled);
});

test('the sidebar button shows the full chimken, not the one-colour icon', () => {
  const js = read('script.js');
  assert.match(js, /\$\$\('\.game-trigger \.icon-chimken'\)[\s\S]{0,200}spriteSvg\(CHIMKEN_SPRITE\)[\s\S]{0,120}replaceWith/);
  assert.match(read('style.css'), /\.chimken-art\s*\{[^}]*width:\s*24px/, 'two screen pixels per sprite pixel');
});
