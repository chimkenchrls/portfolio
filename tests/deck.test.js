const test = require('node:test');
const assert = require('node:assert/strict');
const { cardDepth, cardStyle, cardTilt, fanCardStyle, deckStep, gestureAction } = require('../script.js');

test('cardDepth puts the current card on top and the rest behind in order', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => cardDepth(i, 0, 4)), [0, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 3].map((i) => cardDepth(i, 1, 4)), [3, 0, 1, 2]);
  assert.deepEqual([0, 1, 2, 3].map((i) => cardDepth(i, 3, 4)), [1, 2, 3, 0]);
});

test('deckStep wraps around both ways', () => {
  assert.equal(deckStep(0, 4, 1), 1);
  assert.equal(deckStep(3, 4, 1), 0);
  assert.equal(deckStep(0, 4, -1), 3);
  assert.equal(deckStep(0, 1, 1), 0);
});

test('cardTilt is a small, stable, per-card rotation', () => {
  const tilts = Array.from({ length: 8 }, (_, i) => cardTilt(i));
  assert.deepEqual(tilts, Array.from({ length: 8 }, (_, i) => cardTilt(i)), 'deterministic');
  assert.ok(tilts.every((t) => Math.abs(t) <= 5), String(tilts));
  assert.ok(new Set(tilts).size > 2, 'cards are not all tilted the same');
});

test('cardStyle: top card is straight and in front; deeper cards tilt, shrink, sit lower', () => {
  const top = cardStyle(0, 2);
  assert.deepEqual(top, { rotate: 0, y: 0, scale: 1, z: 100, visible: true });
  const second = cardStyle(1, 2);
  assert.equal(second.rotate, cardTilt(2));
  assert.ok(second.y > 0 && second.scale < 1 && second.z < 100 && second.visible);
  const third = cardStyle(2, 5);
  assert.ok(third.y > second.y && third.scale < second.scale && third.z < second.z);
  assert.equal(cardStyle(3, 1).visible, false, 'only the top three cards are visible');
});

test('gestureAction tells a tap from a swipe from a scroll', () => {
  assert.equal(gestureAction(2, 3), 'tap');
  assert.equal(gestureAction(-80, 10), 'next');
  assert.equal(gestureAction(80, -12), 'prev');
  assert.equal(gestureAction(30, 5), null, 'too short for a swipe, too long for a tap');
  assert.equal(gestureAction(50, 120), null, 'mostly vertical = page scroll');
});

test('the fan centers the active photo and shows three neighbors on either side', () => {
  const styles = Array.from({ length: 8 }, (_, i) => fanCardStyle(i, 0, 8));
  assert.deepEqual(styles[0], { x: 0, y: 0, rotate: 0, scale: 1, z: 100, visible: true });
  assert.equal(styles.filter((style) => style.visible).length, 7);
  for (let i = 1; i <= 3; i += 1) {
    const right = styles[i];
    const left = styles[8 - i];
    assert.equal(right.x, -left.x);
    assert.equal(right.rotate, -left.rotate);
    assert.equal(right.y, left.y);
    assert.equal(right.scale, left.scale);
    assert.equal(right.z, left.z);
    assert.ok(right.z < styles[i - 1].z && right.scale < styles[i - 1].scale);
  }
});

test('the fan wraps at both ends and handles a short photo list', () => {
  assert.equal(fanCardStyle(0, 7, 8).x, 17);
  assert.equal(fanCardStyle(7, 0, 8).x, -17);
  assert.equal(fanCardStyle(0, 0, 1).z, 100);
  assert.equal(fanCardStyle(1, 0, 2).visible, true);
});
