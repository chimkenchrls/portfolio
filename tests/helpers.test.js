const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SECTIONS, padCount, safeUrl, computeTiles, revealDelays,
  isTypingTarget, resolveShortcut, validateData,
} = require('../script.js');

const close = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !≈ ${expected}`);

test('SECTIONS lists the six nav targets in order', () => {
  assert.deepEqual(SECTIONS.map((s) => [s.id, s.key]), [
    ['home', '1'], ['about', '2'], ['projects', '3'], ['stack', '4'], ['certifications', '5'], ['contact', '6'],
  ]);
});

test('padCount zero-pads valid counts', () => {
  assert.equal(padCount(42), '0042');
  assert.equal(padCount('7'), '0007');
  assert.equal(padCount(123456), '123456');
  assert.equal(padCount(3.9), '0003');
});

test('padCount rejects junk from the counter API', () => {
  for (const bad of [null, undefined, '', '   ', 'abc', NaN, Infinity, {}, []]) {
    assert.equal(padCount(bad), null, `expected null for ${String(bad)}`);
  }
  assert.equal(padCount(-5), '0000');
});

test('safeUrl allows only http(s) and mailto', () => {
  assert.equal(safeUrl('https://github.com/chimkenchrls'), 'https://github.com/chimkenchrls');
  assert.equal(safeUrl('  https://x.dev  '), 'https://x.dev');
  assert.equal(safeUrl('mailto:a@b.c'), 'mailto:a@b.c');
  for (const bad of [null, undefined, '', 'null', 'javascript:alert(1)', 'www.site.com', 'https://', 'https://has space.com']) {
    assert.equal(safeUrl(bad), null, `expected null for ${String(bad)}`);
  }
});

test('computeTiles replicates object-fit: cover for a portrait image', () => {
  const tiles = computeTiles(8, 639, 780);
  assert.equal(tiles.length, 64);
  close(tiles[0].top, 0);
  close(tiles[0].left, 0);
  close(tiles[0].size, 12.5);
  close(tiles[0].bgSize[0], 800);
  close(tiles[0].bgSize[1], (780 / 639) * 800);
  close(tiles[0].bgPos[0], 0);
  const topEdge = -((780 / 639) - 1) / 2;
  close(tiles[0].bgPos[1], (topEdge / (0.125 - 780 / 639)) * 100);
  close(tiles[7].bgPos[0], 100);
  close(tiles[63].top, 87.5);
  close(tiles[63].left, 87.5);
});

test('computeTiles on a square image maps corners to 0% and 100%', () => {
  const tiles = computeTiles(2, 100, 100);
  assert.equal(tiles.length, 4);
  close(tiles[0].bgPos[0], 0);
  close(tiles[0].bgPos[1], 0);
  close(tiles[3].bgPos[0], 100);
  close(tiles[3].bgPos[1], 100);
  close(tiles[3].bgSize[0], 200);
});

test('revealDelays is a shuffled permutation of step multiples', () => {
  let seed = 1;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const delays = revealDelays(64, 6, rng);
  assert.equal(delays.length, 64);
  assert.deepEqual([...delays].sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i * 6));
  assert.notDeepEqual(delays, Array.from({ length: 64 }, (_, i) => i * 6));
  assert.deepEqual(revealDelays(4, 0, rng), [0, 0, 0, 0]);
});

test('isTypingTarget detects form fields and contenteditable', () => {
  assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTypingTarget({ tagName: 'SELECT' }), true);
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false);
  assert.equal(isTypingTarget(null), false);
});

test('resolveShortcut maps plain keys', () => {
  const k = (key, extra = {}) => ({ key, code: '', altKey: false, ctrlKey: false, metaKey: false, ...extra });
  assert.deepEqual(resolveShortcut(k('1')), { type: 'jump', id: 'home' });
  assert.deepEqual(resolveShortcut(k('5')), { type: 'jump', id: 'certifications' });
  assert.deepEqual(resolveShortcut(k('t')), { type: 'theme' });
  assert.deepEqual(resolveShortcut(k('T')), { type: 'theme' });
  assert.equal(resolveShortcut(k('/')), null);
  assert.deepEqual(resolveShortcut(k('Escape')), { type: 'close' });
  assert.deepEqual(resolveShortcut(k('6')), { type: 'jump', id: 'contact' });
  assert.equal(resolveShortcut(k('7')), null);
  assert.equal(resolveShortcut(k('x')), null);
});

test('resolveShortcut handles Alt+K on every layout, including macOS', () => {
  assert.deepEqual(resolveShortcut({ key: 'k', code: 'KeyK', altKey: true }), { type: 'game' });
  assert.deepEqual(resolveShortcut({ key: '˚', code: 'KeyK', altKey: true }), { type: 'game' });
  assert.deepEqual(resolveShortcut({ key: 'k', code: 'KeyK', altKey: true }, true), { type: 'game' });
});

test('resolveShortcut ignores keys while typing or with modifiers', () => {
  assert.equal(resolveShortcut({ key: 't' }, true), null);
  assert.equal(resolveShortcut({ key: '1' }, true), null);
  assert.equal(resolveShortcut({ key: '/' }, true), null);
  assert.equal(resolveShortcut({ key: '1', ctrlKey: true }), null);
  assert.equal(resolveShortcut({ key: '1', metaKey: true }), null);
  assert.equal(resolveShortcut({ key: 't', altKey: true }), null);
  assert.equal(resolveShortcut({ key: 'k', code: 'KeyK', altKey: true, ctrlKey: true }), null);
  assert.deepEqual(resolveShortcut({ key: 'Escape' }, true), { type: 'close' });
});

test('validateData flags the mistakes a later edit is likely to make', () => {
  const good = require('../assets/data.js');
  const bad = JSON.parse(JSON.stringify(good));
  bad.profile.linkedin = 'null';
  bad.projects[0].links.source = 'javascript:alert(1)';
  bad.projects[1].status = 'wip';
  bad.projects[2].description = '';
  bad.stack[0].items[0].name = '';
  bad.certifications.push({ title: 'AZ-900', issuer: '', date: '2027', link: null });
  const errors = validateData(bad);
  for (const fragment of ['profile.linkedin', 'projects[0].links.source', 'projects[1].status', 'projects[2].description', 'stack[0].items[0].name', 'certifications[0]']) {
    assert.ok(errors.some((e) => e.startsWith(fragment)), `no error for ${fragment}: ${errors.join(' | ')}`);
  }
  assert.deepEqual(validateData(null), ['data: missing']);
});

test('joinParts drops missing pieces instead of printing undefined', () => {
  const { joinParts } = require('../script.js');
  assert.equal(joinParts(['AWS', '2027']), 'AWS · 2027');
  assert.equal(joinParts([undefined, '2027']), '2027');
  assert.equal(joinParts([null, '', '  ']), '');
});

const day = (date, count, level) => ({ date, count, level });

test('parseContributions accepts the API payload and totals the year', () => {
  const { parseContributions } = require('../script.js');
  const parsed = parseContributions({
    total: { lastYear: 5 },
    contributions: [day('2026-09-27', 0, 0), day('2026-09-28', 5, 4)],
  });
  assert.equal(parsed.total, 5);
  assert.equal(parsed.days.length, 2);
  const summed = parseContributions({ contributions: [day('2026-09-27', 2, 1), day('2026-09-28', 3, 2)] });
  assert.equal(summed.total, 5);
});

test('parseContributions rejects junk', () => {
  const { parseContributions } = require('../script.js');
  for (const bad of [null, {}, { contributions: [] }, { contributions: 'x' },
    { contributions: [day('nope', 1, 1)] }, { contributions: [day('2026-09-28', 1, 7)] },
    { contributions: [{ date: '2026-09-28' }] }]) {
    assert.equal(parseContributions(bad), null, JSON.stringify(bad));
  }
});

test('buildContributionWeeks aligns days to Sunday-first weeks', () => {
  const { buildContributionWeeks } = require('../script.js');
  // 2026-09-30 is a Wednesday (index 3)
  const weeks = buildContributionWeeks([
    day('2026-09-30', 1, 1), day('2026-10-01', 0, 0), day('2026-10-02', 0, 0),
    day('2026-10-03', 0, 0), day('2026-10-04', 9, 4),
  ]);
  assert.equal(weeks.length, 2);
  assert.deepEqual(weeks[0].map((d) => d && d.date), [null, null, null, '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
  assert.equal(weeks[1][0].date, '2026-10-04');
  assert.equal(weeks[1].length, 1);
});

test('dotRadius grows with activity level like the React calendar', () => {
  const { dotRadius } = require('../script.js');
  assert.equal(dotRadius(0, 10), 1.5);
  assert.equal(dotRadius(4, 10), 5);
  assert.ok(dotRadius(2, 10) > dotRadius(1, 10));
  assert.equal(dotRadius(9, 10), 5);
});

test('monthLabels marks the first week of each month, skipping a cramped first label', () => {
  const { monthLabels, buildContributionWeeks } = require('../script.js');
  const days = [];
  const start = Date.UTC(2025, 8, 28); // Sun 2025-09-28
  for (let i = 0; i < 77; i += 1) { // through Sat 2025-12-13
    days.push({ date: new Date(start + i * 86400000).toISOString().slice(0, 10), count: 0, level: 0 });
  }
  const labels = monthLabels(buildContributionWeeks(days));
  // Sep only has week 0 before Oct starts in week 1 -> the Sep label is too cramped and dropped.
  assert.deepEqual(labels, [
    { col: 1, label: 'Oct' },
    { col: 5, label: 'Nov' },
    { col: 10, label: 'Dec' },
  ]);
});

test('monthLabels keeps a first label that has room', () => {
  const { monthLabels, buildContributionWeeks } = require('../script.js');
  const days = [];
  const start = Date.UTC(2026, 0, 4); // Sun 2026-01-04
  for (let i = 0; i < 40; i += 1) {
    days.push({ date: new Date(start + i * 86400000).toISOString().slice(0, 10), count: 0, level: 0 });
  }
  assert.deepEqual(monthLabels(buildContributionWeeks(days)).map((l) => l.label), ['Jan', 'Feb']);
});

test('projectShots returns the safe screenshots of a project, desktop first', () => {
  const { projectShots } = require('../script.js');
  assert.deepEqual(projectShots({ title: 'X', media: { mobile: './assets/projects/x-mobile.jpg', desktop: './assets/projects/x-desktop.jpg' } }), [
    { kind: 'desktop', src: './assets/projects/x-desktop.jpg', label: 'X on desktop' },
    { kind: 'mobile', src: './assets/projects/x-mobile.jpg', label: 'X on mobile' },
  ]);
  assert.deepEqual(projectShots({ title: 'X', media: { mobile: './assets/projects/x-mobile.jpg' } }).map((s) => s.kind), ['mobile']);
  assert.deepEqual(projectShots({ title: 'X', media: { desktop: 'javascript:alert(1)', mobile: 'https://evil.example/a.jpg' } }), []);
  assert.deepEqual(projectShots({ title: 'X' }), []);
  assert.deepEqual(projectShots({ title: 'X', media: null }), []);
});

test('skeletonDays is a full, empty 53-week grid ending this week (placeholder for the GitHub graph)', () => {
  const { skeletonDays, buildContributionWeeks } = require('../script.js');
  const days = skeletonDays(Date.UTC(2026, 9, 7)); // a Wednesday
  assert.equal(days.length, 53 * 7);
  assert.ok(days.every((d) => d.level === 0 && d.count === 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.date)));
  assert.equal(new Date(`${days[0].date}T00:00:00Z`).getUTCDay(), 0, 'starts on a Sunday');
  assert.equal(days[days.length - 1].date, '2026-10-10', 'ends on the Saturday of the current week');
  const weeks = buildContributionWeeks(days);
  assert.equal(weeks.length, 53);
  assert.ok(weeks.every((w) => w.length === 7 && w.every(Boolean)));
});
