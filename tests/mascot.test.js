const test = require('node:test');
const assert = require('node:assert/strict');
const { mascotDirection, mascotIdle } = require('../script.js');

test('pixel Kenneth looks toward the visitor across all eight directions', () => {
  for (const [x, y, cell] of [[-100, -100, 0], [0, -100, 1], [100, -100, 2], [-100, 0, 3], [100, 0, 5], [-100, 100, 6], [0, 100, 7], [100, 100, 8]]) {
    assert.equal(mascotDirection(x, y), cell);
  }
  assert.equal(mascotDirection(0, 0, 5), 4, 'the face rests at centre when the pointer is close');
  assert.equal(mascotDirection(NaN, 100), 4);
});

test('small pointer movements near a direction boundary do not make the head flicker', () => {
  const point = (angle) => [Math.cos(angle) * 200, Math.sin(angle) * 200];
  const boundary = Math.PI / 8;
  assert.equal(mascotDirection(...point(boundary + 0.03), 5), 5);
  assert.equal(mascotDirection(...point(boundary + 0.2), 5), 8);
  assert.equal(mascotDirection(...point(-Math.PI + 0.02), 3), 3, 'the left sector wraps continuously');
});

test('the standalone character blinks briefly and rests facing the visitor', () => {
  assert.deepEqual(mascotIdle(0), { direction: 4, reaction: null });
  assert.equal(mascotIdle(5799).reaction, null);
  assert.equal(mascotIdle(5900).reaction, 0);
  assert.equal(mascotIdle(6000).reaction, null);
  assert.deepEqual(mascotIdle(-100), mascotIdle(0));
  assert.deepEqual(mascotIdle(Infinity), mascotIdle(0));
});
