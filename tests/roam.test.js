const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ROAM, createRoamState, roamStep, roamResize, roamFrame, placeCorn,
  CHIMKEN_SPRITE, CHIMKEN_WALK_B, CHIMKEN_AIR, CHIMKEN_PECK, CHIMKEN_INK,
} = require('../script.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const lcg = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// Runs the yard for `seconds` and returns every state along the way.
const simulate = (width, seconds, seed = 3) => {
  const rand = lcg(seed);
  let state = createRoamState(width, rand);
  const states = [state];
  for (let t = 0; t < seconds; t += 1 / 60) {
    state = roamStep(state, 1 / 60, rand);
    states.push(state);
  }
  return states;
};

test('every chimken frame is a 12x12 sprite', () => {
  for (const sprite of [CHIMKEN_SPRITE, CHIMKEN_WALK_B, CHIMKEN_AIR, CHIMKEN_PECK]) {
    assert.equal(sprite.length, 12);
    for (const row of sprite) assert.match(row, /^[KWSA.]{12}$/);
    const used = new Set(sprite.join('').replace(/\./g, ''));
    assert.deepEqual([...used].sort(), ['A', 'K', 'S', 'W'], 'outline, body, shade and accent are all used');
  }
  assert.notDeepEqual(CHIMKEN_PECK, CHIMKEN_SPRITE, 'pecking has its own head-down frame');
});

test('chimken stays inside the yard for a whole minute', () => {
  for (const width of [200, 343, 880]) {
    for (const s of simulate(width, 60)) {
      assert.ok(s.x >= 0 && s.x <= width - ROAM.size + 1e-6, `x=${s.x} in a ${width}px yard`);
      if (s.cornX !== null) assert.ok(s.cornX >= 0 && s.cornX <= width, `corn at ${s.cornX}`);
    }
  }
});

test('it roams both left and right, and keeps eating', () => {
  const states = simulate(880, 120);
  const walking = states.filter((s) => s.mode === 'walk');
  assert.ok(walking.some((s) => s.dir === 1), 'walks right');
  assert.ok(walking.some((s) => s.dir === -1), 'walks left');
  assert.ok(states.at(-1).eaten >= 5, `only ate ${states.at(-1).eaten} corn in two minutes`);
  const xs = states.map((s) => s.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 300, 'covers a good part of the yard');
});

test('it only pecks with its beak at the corn, and the corn is gone afterwards', () => {
  const states = simulate(600, 90, 11);
  let pecks = 0;
  states.forEach((s, i) => {
    if (s.mode !== 'peck') return;
    const beak = s.dir === 1 ? s.x + ROAM.size - ROAM.reach : s.x + ROAM.reach;
    assert.ok(Math.abs(beak - s.cornX) < 1, `beak ${beak} vs corn ${s.cornX}`);
    const after = states[i + 1];
    if (after && after.mode !== 'peck') {
      pecks += 1;
      assert.equal(after.mode, 'rest');
      assert.equal(after.cornX, null, 'the corn was eaten');
      assert.equal(after.eaten, s.eaten + 1);
    }
  });
  assert.ok(pecks >= 3);
});

test('new corn is never dropped right under chimken', () => {
  const rand = lcg(5);
  for (let i = 0; i < 300; i += 1) {
    const x = rand() * (880 - ROAM.size);
    const corn = placeCorn(x, 880, rand);
    assert.ok(Math.abs(corn - (x + ROAM.size / 2)) >= ROAM.minWalk, `corn ${corn} next to chimken at ${x}`);
    assert.ok(corn >= ROAM.size && corn <= 880 - ROAM.size);
  }
  assert.equal(placeCorn(0, ROAM.size * 2, rand), null, 'a yard too narrow to walk in gets no corn');
});

test('a huge frame gap cannot teleport chimken', () => {
  const rand = lcg(2);
  const state = createRoamState(880, rand);
  const next = roamStep(state, 30, rand);
  assert.ok(Math.abs(next.x - state.x) <= ROAM.speed * 0.1 + 1e-6);
});

test('resizing keeps chimken and the corn inside the yard', () => {
  const rand = lcg(9);
  let state = createRoamState(880, rand);
  for (let i = 0; i < 2000; i += 1) state = roamStep(state, 1 / 60, rand);
  const small = roamResize(state, 300);
  assert.equal(small.width, 300);
  assert.ok(small.x <= 300 - ROAM.size);
  assert.ok(small.cornX === null || small.cornX <= 300 - ROAM.size);
  assert.equal(roamResize(state, 880), state, 'same width changes nothing');
});

test('frames: two walking frames, head down while pecking, still while resting', () => {
  const base = { x: 0, dir: 1, timer: 0, walked: 0, cornX: 100, width: 300, eaten: 0 };
  const walk = new Set([0, 8, 16, 24].map((walked) => roamFrame({ ...base, mode: 'walk', walked })));
  assert.deepEqual([...walk].sort(), ['walkA', 'walkB']);
  const peck = new Set([1.5, 1.3, 1.1, 0.9].map((timer) => roamFrame({ ...base, mode: 'peck', timer })));
  assert.ok(peck.has('peck'));
  assert.equal(roamFrame({ ...base, mode: 'rest', timer: 0.5 }), 'walkA');
});

test('the hero has a yard: chimken is a button that opens the game, hidden without JS', () => {
  const html = read('index.html');
  const css = read('style.css');
  const js = read('script.js');
  const hero = html.slice(html.indexOf('id="home"'), html.indexOf('id="about"'));
  assert.match(hero, /<div class="hero-yard" hidden>/, 'hidden until the script starts it');
  assert.match(hero, /<button[^>]*class="yard-chimken"[^>]*type="button"[^>]*aria-label="Play chimken"/);
  assert.match(hero, /class="yard-corn" aria-hidden="true"/);
  assert.match(js, /\$\$\('\.game-trigger, \.yard-chimken, \.score-row'\)/, 'tapping it opens the game');
  assert.match(css, /\.hero-yard\s*\{[^}]*position:\s*absolute/, 'it sits in the hero padding and moves nothing');
  const yard = js.slice(js.indexOf('const heroYard'), js.indexOf('99. Boot'));
  assert.match(yard, /prefersReducedMotion\(\)/, 'no roaming under reduced motion');
  assert.match(yard, /IntersectionObserver/, 'paused while off screen');
  assert.match(yard, /document\.hidden/, 'paused in a background tab');
  assert.doesNotMatch(yard, /innerHTML/);
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

test('the hero chimken is small: 24px, two screen pixels per sprite pixel', () => {
  assert.equal(ROAM.size, 24);
  assert.match(read('style.css'), /\.yard-chimken \{[^}]*width:\s*24px;[^}]*height:\s*24px;/);
});
