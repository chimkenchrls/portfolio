const test = require('node:test');
const assert = require('node:assert/strict');
const { CHIMKEN, createChimkenState, stepChimken, spawnGap } = require('../script.js');

const DT = 1 / 60;
const NONE = { jump: false, holding: false };
const JUMP = { jump: true, holding: true };
const never = () => 0.999; // random that pushes spawns far away
const run = (state, seconds, input = NONE, random = never) => {
  let s = state;
  for (let t = 0; t < seconds; t += DT) s = stepChimken(s, DT, input, random);
  return s;
};
const started = () => stepChimken(createChimkenState(), DT, { jump: true, holding: false }, never);

test('a new game waits for the first jump', () => {
  const s = createChimkenState(42);
  assert.equal(s.status, 'ready');
  assert.equal(s.score, 0);
  assert.equal(s.hi, 42);
  assert.deepEqual(s.obstacles, []);
  const idle = run(s, 1);
  assert.equal(idle.status, 'ready');
  assert.equal(idle.distance, 0);
});

test('jumping from ready starts the run and leaves the ground', () => {
  const s = started();
  assert.equal(s.status, 'running');
  assert.ok(s.chimken.y > 0);
  assert.equal(s.chimken.onGround, false);
});

test('a tap jump peaks around 100px and lands in about 0.6s', () => {
  let s = started();
  let peak = 0;
  let t = 0;
  while (!s.chimken.onGround && t < 2) {
    s = stepChimken(s, DT, NONE, never);
    peak = Math.max(peak, s.chimken.y);
    t += DT;
  }
  assert.ok(peak > 85 && peak < 120, `peak ${peak}`);
  assert.ok(t > 0.45 && t < 0.75, `airtime ${t}`);
  assert.equal(s.chimken.y, 0);
});

test('holding the jump key jumps higher than a tap', () => {
  const peakOf = (holding) => {
    let s = stepChimken(createChimkenState(), DT, { jump: true, holding }, never);
    let peak = 0;
    for (let i = 0; i < 90; i += 1) {
      s = stepChimken(s, DT, { jump: false, holding }, never);
      peak = Math.max(peak, s.chimken.y);
    }
    return peak;
  };
  assert.ok(peakOf(true) > peakOf(false) + 10);
});

test('no double jump in mid-air', () => {
  let s = run(started(), 0.1);
  const vy = s.chimken.vy;
  s = stepChimken(s, DT, JUMP, never);
  assert.ok(s.chimken.vy < vy, 'velocity keeps falling instead of resetting upward');
});

test('bugs scroll left at the current speed and are removed off-screen', () => {
  let s = started();
  s = { ...s, obstacles: [{ x: 100, w: 14, h: 12, kind: 'small' }] };
  const next = stepChimken(s, DT, NONE, never);
  assert.ok(Math.abs(next.obstacles[0].x - (100 - s.speed * DT)) < 1);
  const gone = stepChimken({ ...s, obstacles: [{ x: -20, w: 14, h: 12, kind: 'small' }] }, DT, NONE, never);
  assert.equal(gone.obstacles.length, 0);
});

test('hitting a bug ends the game and records the high score', () => {
  let s = run(started(), 1.2);
  s = { ...s, distance: 5000, score: 500, hi: 100, obstacles: [{ x: CHIMKEN.chimkenX, w: 14, h: 12, kind: 'small' }] };
  const over = stepChimken(s, DT, NONE, never);
  assert.equal(over.status, 'over');
  assert.equal(over.hi, 500);
});

test('clearing a bug in the air is not a collision', () => {
  let s = run(started(), 0.25); // near the top of the jump
  s = { ...s, obstacles: [{ x: CHIMKEN.chimkenX, w: 14, h: 12, kind: 'small' }] };
  assert.equal(stepChimken(s, DT, NONE, never).status, 'running');
});

test('spawn gaps always leave room to land and jump again', () => {
  for (const speed of [CHIMKEN.startSpeed, 500, CHIMKEN.maxSpeed]) {
    const gap = spawnGap(speed, () => 0);
    assert.ok(gap >= speed * 0.75, `speed ${speed}: gap ${gap}`);
    assert.ok(spawnGap(speed, () => 0.999) > gap);
  }
});

test('bugs spawn while running', () => {
  const s = run(started(), 6, NONE, () => 0);
  assert.ok(s.obstacles.length > 0 || s.status === 'over');
});

test('speed ramps up and caps at the maximum', () => {
  assert.equal(createChimkenState().speed, CHIMKEN.startSpeed);
  const s = started();
  assert.ok(s.speed > CHIMKEN.startSpeed);
  const later = stepChimken({ ...s, speed: CHIMKEN.maxSpeed - 0.01 }, 1, NONE, never);
  assert.equal(later.speed, CHIMKEN.maxSpeed);
});

test('score grows with distance', () => {
  const s = run(started(), 2);
  assert.ok(s.score > 0);
  assert.equal(s.score, Math.floor(s.distance / 10));
});

test('restart needs a short cooldown and keeps the high score', () => {
  let s = run(started(), 1);
  s = stepChimken({ ...s, obstacles: [{ x: CHIMKEN.chimkenX, w: 14, h: 12, kind: 'small' }], distance: 770, score: 77 }, DT, NONE, never);
  assert.equal(s.status, 'over');
  const tooSoon = stepChimken(s, DT, JUMP, never);
  assert.equal(tooSoon.status, 'over');
  const waited = run(s, 0.6);
  const restarted = stepChimken(waited, DT, JUMP, never);
  assert.equal(restarted.status, 'running');
  assert.equal(restarted.score, 0);
  assert.equal(restarted.hi, 77);
  assert.deepEqual(restarted.obstacles, []);
});

const { chimkenView, buildSky, skyOffset, starAlpha } = require('../script.js');

test('desktop view keeps the 600x150 playfield', () => {
  const v = chimkenView(606, 151.5);
  assert.ok(Math.abs(v.width - 600) < 0.01 && Math.abs(v.height - 150) < 0.01, JSON.stringify(v));
  assert.ok(Math.abs(v.groundY - CHIMKEN.groundY) < 0.01);
});

test('phone view keeps pixel size, shows more sky, ground stays at the bottom', () => {
  const v = chimkenView(343, 640);
  assert.equal(v.scale, 1);
  assert.equal(v.width, 343);
  assert.equal(v.height, 640);
  assert.equal(v.groundY, 640 - (CHIMKEN.height - CHIMKEN.groundY));
});

test('sky fills the space above the ground, deterministically', () => {
  let seed = 3;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const small = buildSky(600, CHIMKEN.groundY, rng);
  seed = 3;
  const again = buildSky(600, CHIMKEN.groundY, rng);
  assert.deepEqual(small, again);
  const tall = buildSky(343, 618, () => 0.5);
  assert.ok(tall.stars.length > small.stars.length, 'taller sky has more stars');
  for (const sky of [small, tall]) {
    for (const star of sky.stars) {
      assert.ok(star.x >= 0 && star.x < sky.width && star.y >= 6 && star.y <= sky.groundY - 36, JSON.stringify(star));
    }
    for (const body of [sky.moon, sky.sun]) assert.ok(body.y >= 6 && body.y < sky.groundY - 36);
    assert.ok(sky.clouds.length >= 2);
  }
});

test('parallax offsets wrap into the layer width', () => {
  assert.equal(skyOffset(0, 0.1, 600), 0);
  assert.equal(skyOffset(1000, 0.1, 600), 100);
  assert.equal(skyOffset(7000, 0.1, 600), 100);
  const o = skyOffset(123456, 0.25, 343);
  assert.ok(o >= 0 && o < 343);
});

test('stars twinkle within a gentle range, and hold still with reduced motion', () => {
  for (let t = 0; t < 10; t += 0.37) {
    const a = starAlpha(1.3, t, false);
    assert.ok(a >= 0.3 && a <= 0.75, String(a));
  }
  assert.equal(starAlpha(1.3, 0, true), starAlpha(0.2, 9, true));
});

const { gameOverSummary, passedRival, bragText, spawnSparks, stepSparks } = require('../script.js');
const RIVAL = { owner: 'ck', highScore: 3236 };

test('game over summary tells a loser the score to beat', () => {
  const s = gameOverSummary({ score: 102, hi: 1563 }, RIVAL, false);
  assert.equal(s.beat, false);
  assert.deepEqual(s.lines, [
    'GAME OVER',
    'score 00102 · best 01563',
    "you didn't beat ck's high score: 3236",
    'space / tap to retry',
  ]);
});

test('game over summary celebrates beating ck, mentioning a new crown once', () => {
  const first = gameOverSummary({ score: 4000, hi: 4000 }, RIVAL, true);
  assert.equal(first.beat, true);
  assert.equal(first.lines[2], "you beat ck's high score: 3236 · crown unlocked");
  const again = gameOverSummary({ score: 3500, hi: 4000 }, RIVAL, false);
  assert.equal(again.lines[2], "you beat ck's high score: 3236");
});

test('game over summary works without a rival configured', () => {
  const s = gameOverSummary({ score: 5, hi: 9 }, null, false);
  assert.equal(s.beat, false);
  assert.deepEqual(s.lines, ['GAME OVER', 'score 00005 · best 00009', 'space / tap to retry']);
});

test('passedRival fires exactly once, on the frame the score crosses it', () => {
  assert.equal(passedRival(3235, 3236, RIVAL), false);
  assert.equal(passedRival(3236, 3237, RIVAL), true);
  assert.equal(passedRival(3237, 3238, RIVAL), false);
  assert.equal(passedRival(10, 20, null), false);
});

test('bragText names the score, the rival, and the site', () => {
  assert.equal(
    bragText(6012, RIVAL, 'https://chimkenchrls.github.io/portfolio/'),
    "I scored 6012 on chimken and beat ck's 3236 🐔 https://chimkenchrls.github.io/portfolio/",
  );
});

test('fireworks sparks burst outward, fall, fade, and disappear', () => {
  let i = 0;
  const rng = () => { i += 1; return (i * 0.137) % 1; };
  const sparks = spawnSparks(300, 40, 24, rng);
  assert.equal(sparks.length, 24);
  assert.ok(sparks.every((s) => s.x === 300 && s.y === 40 && s.life > 0));
  assert.ok(new Set(sparks.map((s) => Math.sign(s.vx))).size > 1, 'sparks go both ways');
  const later = stepSparks(sparks, 0.2);
  assert.ok(later.every((s, k) => s.life < sparks[k].life));
  let t = stepSparks(sparks, 0.1);
  for (let n = 0; n < 40 && t.length; n += 1) t = stepSparks(t, 0.1);
  assert.equal(t.length, 0, 'all sparks gone within a few seconds');
});

const { obstaclePool, spawnObstacle, hitsObstacle, milestone } = require('../script.js');
// A running game with chimken standing on the ground (started() leaves it mid-jump).
const ground = (extra = {}) => ({ ...started(), chimken: { y: 0, vy: 0, onGround: true }, obstacles: [], pickups: [], ...extra });
const at = (kind, x = CHIMKEN.chimkenX) => ({ x, kind, ...CHIMKEN.obstacles[kind] });

test('obstacles unlock as the score climbs', () => {
  assert.deepEqual(obstaclePool(0), ['small']);
  assert.deepEqual(obstaclePool(149), ['small']);
  assert.deepEqual(obstaclePool(150), ['small', 'large', 'pair']);
  assert.deepEqual(obstaclePool(300), ['small', 'large', 'pair', 'hawkLow']);
  assert.deepEqual(obstaclePool(500), ['small', 'large', 'pair', 'hawkLow', 'hawkHigh', 'swarm']);
  assert.deepEqual(obstaclePool(99999), obstaclePool(500));
});

test('spawnObstacle only picks unlocked kinds and enters from the right edge', () => {
  for (let r = 0; r < 1; r += 0.07) {
    assert.equal(spawnObstacle(() => r, 0).kind, 'small');
    assert.ok(obstaclePool(200).includes(spawnObstacle(() => r, 200).kind));
  }
  const seen = new Set();
  for (let r = 0; r < 1; r += 0.01) seen.add(spawnObstacle(() => r, 900).kind);
  assert.deepEqual([...seen].sort(), [...obstaclePool(900)].sort(), 'every unlocked kind can appear');
  const hawk = spawnObstacle(() => 0.99, 300);
  assert.equal(hawk.kind, 'hawkLow');
  assert.equal(hawk.x, CHIMKEN.width);
  assert.ok(hawk.y > 0 && hawk.w > 0 && hawk.h > 0);
});

test('ground obstacles: hit when running into them, cleared when above them', () => {
  for (const kind of ['small', 'large', 'pair', 'swarm']) {
    assert.equal(hitsObstacle({ y: 0 }, at(kind)), true, `${kind} on the ground`);
    assert.equal(hitsObstacle({ y: 40 }, at(kind)), false, `${kind} cleared in the air`);
    assert.equal(hitsObstacle({ y: 0 }, at(kind, CHIMKEN.chimkenX + 200)), false, `${kind} far away`);
  }
});

test('low hawk must be jumped; high hawk is only dangerous if you jump', () => {
  assert.equal(hitsObstacle({ y: 0 }, at('hawkLow')), true, 'running into a low hawk');
  assert.equal(hitsObstacle({ y: 60 }, at('hawkLow')), false, 'jumping over a low hawk');
  assert.equal(hitsObstacle({ y: 0 }, at('hawkHigh')), false, 'running under a high hawk');
  assert.equal(hitsObstacle({ y: 75 }, at('hawkHigh')), true, 'jumping into a high hawk near the top of the arc');
  assert.equal(hitsObstacle({ y: 30 }, at('hawkHigh')), false, 'still below it early in a jump');
  assert.equal(hitsObstacle({ y: 130 }, at('hawkHigh')), false, 'a held jump goes clean over it');
});

test('a full tap jump collides with a high hawk overhead, staying grounded does not', () => {
  const hawk = at('hawkHigh', CHIMKEN.chimkenX + 60);
  const stay = run(ground({ obstacles: [hawk] }), 0.6);
  assert.equal(stay.status, 'running');
  let jump = stepChimken(ground({ obstacles: [hawk] }), DT, JUMP, never);
  jump = run(jump, 0.6);
  assert.equal(jump.status, 'over');
});

test('swarm is three bugs wide and still clearable with one well-timed tap', () => {
  assert.equal(CHIMKEN.obstacles.swarm.w, 14 * 3 + 4 * 2);
  let s = ground({ obstacles: [at('swarm', CHIMKEN.chimkenX + 70)] });
  s = stepChimken(s, DT, { jump: true, holding: false }, never);
  s = run(s, 0.7);
  assert.equal(s.status, 'running');
});

test('corn: grabbed in the air for +25, ignored on the ground, and scrolls away', () => {
  const corn = { x: CHIMKEN.chimkenX + 4, ...{ y: CHIMKEN.corn.y, w: CHIMKEN.corn.w, h: CHIMKEN.corn.h } };
  const missed = stepChimken(ground({ pickups: [corn] }), DT, NONE, never);
  assert.equal(missed.bonus, 0);
  assert.equal(missed.pickups.length, 1);
  const inAir = ground({ pickups: [corn], chimken: { y: CHIMKEN.corn.y - 8, vy: 0, onGround: false } });
  const got = stepChimken(inAir, DT, NONE, never);
  assert.equal(got.bonus, 25);
  assert.equal(got.pickups.length, 0);
  assert.equal(got.score, Math.floor(got.distance / 10) + 25);
  const gone = stepChimken(ground({ pickups: [{ ...corn, x: -30 }] }), DT, NONE, never);
  assert.equal(gone.pickups.length, 0);
});

test('corn sometimes spawns with an obstacle, between it and the next one', () => {
  let s = { ...ground(), nextSpawnIn: 1 };
  s = stepChimken(s, DT, NONE, () => 0);   // random 0 -> corn chance hits
  assert.equal(s.obstacles.length, 1);
  assert.equal(s.pickups.length, 1);
  assert.ok(s.pickups[0].x > CHIMKEN.width, 'corn sits after the obstacle');
  assert.ok(s.pickups[0].y > CHIMKEN.chimkenSize, 'only reachable by jumping');
  let t = { ...ground(), nextSpawnIn: 1 };
  t = stepChimken(t, DT, NONE, never);     // random ~1 -> no corn
  assert.equal(t.pickups.length, 0);
});

test('a new game starts with no bonus and no pickups, and restart clears them', () => {
  const fresh = createChimkenState();
  assert.equal(fresh.bonus, 0);
  assert.deepEqual(fresh.pickups, []);
  let over = { ...ground({ bonus: 75, pickups: [{ x: 300, y: CHIMKEN.corn.y, w: 10, h: 10 }] }), status: 'over', overFor: 1 };
  const again = stepChimken(over, DT, JUMP, never);
  assert.equal(again.bonus, 0);
  assert.deepEqual(again.pickups, []);
});

test('milestone fires each time the score crosses a multiple of 100', () => {
  assert.equal(milestone(98, 99), false);
  assert.equal(milestone(99, 100), true);
  assert.equal(milestone(100, 101), false);
  assert.equal(milestone(180, 205), true, 'a corn bonus can jump past the line');
  assert.equal(milestone(0, 0), false);
});

test('corn floats near the top of a tap jump, so a normal jump can grab it', () => {
  // Height range in which chimken overlaps the corn:
  const low = CHIMKEN.corn.y + 2 - (CHIMKEN.chimkenSize - 4);
  const high = CHIMKEN.corn.y + CHIMKEN.corn.h - 2;
  let s = stepChimken(ground(), DT, { jump: true, holding: false }, never);
  let inBand = 0;
  for (let t = 0; t < 1 && !s.chimken.onGround; t += DT) {
    if (s.chimken.y > low && s.chimken.y < high) inBand += DT;
    s = stepChimken(s, DT, NONE, never);
  }
  assert.ok(inBand > 0.25, `a tap jump only spends ${inBand.toFixed(3)}s at corn height`);
  assert.ok(low > 0, 'still unreachable from the ground');
});

test('scoreRow: the sidebar line shows the score to beat, then your best against it', () => {
  const { scoreRow } = require('../script.js');
  const rival = { owner: 'ck', highScore: 3236 };
  assert.equal(scoreRow(120, null), null, 'nothing to show without a score to beat');
  assert.deepEqual([scoreRow(0, rival).label, scoreRow(0, rival).value], ['beat ck', '03236']);
  assert.deepEqual(scoreRow(NaN, rival).value, '03236', 'no saved score yet');
  assert.deepEqual([scoreRow(120.7, rival).label, scoreRow(120.7, rival).value], ['you / ck', '00120 / 03236']);
  assert.equal(scoreRow(3236, rival).label, 'you / ck', 'a tie is not a win');
  assert.deepEqual([scoreRow(4000, rival).label, scoreRow(4000, rival).value], ['you beat ck', '04000 / 03236']);
  assert.match(scoreRow(120, rival).hint, /Play chimken/);
});
