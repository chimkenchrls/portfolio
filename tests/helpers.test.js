const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SECTIONS, padCount, safeUrl, computeTiles, revealDelays,
  isTypingTarget, resolveShortcut, validateData,
} = require('../script.js');

const close = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !≈ ${expected}`);

test('in-place routes stay in this document and preserve relative deployment paths', () => {
  const { portfolioRoute } = require('../script.js');
  const data = require('../assets/data.js');
  const base = 'https://example.com/portfolio/?view=more';
  assert.deepEqual(portfolioRoute('./?view=stack', base, data), { view: 'stack', slug: null, hash: '', url: 'https://example.com/portfolio/?view=stack' });
  assert.equal(portfolioRoute('./#contact', base, data).view, 'home');
  assert.equal(portfolioRoute('./?view=case&p=ambiancy', base, data).slug, 'ambiancy');
  assert.equal(portfolioRoute('./?view=case&p=unknown', base, data).view, 'projects');
  assert.equal(portfolioRoute('./?view=post&p=unknown', base, data).view, 'blog');
  for (const href of ['https://elsewhere.example/', './assets/resume.pdf', '../', './?view=unknown', 'mailto:a@example.com', 'javascript:alert(1)']) assert.equal(portfolioRoute(href, base, data), null, href);
  assert.equal(portfolioRoute('./index.html?view=links', base, data).view, 'links');
  assert.equal(portfolioRoute('./?view=resume', base, data).view, 'resume');
});

test('project previews follow below the pointer and flip clear of viewport edges', () => {
  const { projectPreviewPosition } = require('../script.js');
  const size = { width: 320, height: 236, viewportWidth: 1280, viewportHeight: 900 };
  assert.deepEqual(projectPreviewPosition({ ...size, x: 400, y: 300 }), { x: 420, y: 324 });
  assert.deepEqual(projectPreviewPosition({ ...size, x: 1250, y: 870 }), { x: 910, y: 610 });
  const narrow = projectPreviewPosition({ ...size, width: 296, viewportWidth: 320, x: 300, y: 10 });
  assert.deepEqual(narrow, { x: 12, y: 34 });
});

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
  bad.certifications = [{ title: 'AZ-900', issuer: '', status: 'completed', date: '2027', logo: null, photo: null, link: null }];
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

test('night sky: a sparse, repeatable field of pixel stars sized to the window', () => {
  const { skyStars } = require('../script.js');
  const stars = skyStars(1440, 900);
  assert.equal(stars.length, 144, 'about one star per 9,000 square pixels');
  assert.deepEqual(skyStars(1440, 900), stars, 'the same sky on every visit');
  assert.equal(skyStars(8000, 8000).length, 240, 'capped on huge screens');
  assert.deepEqual(skyStars(0, 900), []);
  assert.deepEqual(skyStars(NaN, 900), []);
  for (const star of stars) {
    assert.ok(star.x >= 0 && star.x < 1440 && star.y >= 0 && star.y < 900);
    assert.ok([1, 2, 3].includes(star.size), 'whole pixels only');
  }
  const small = stars.filter((s) => s.size === 1).length;
  assert.ok(small > stars.length / 2, 'most stars are small and far');
  assert.ok(stars.some((s) => s.twinkle) && stars.some((s) => !s.twinkle));
});

test('night sky: stars drift slowly, shift with scroll by depth, and wrap at the edges', () => {
  const { skyPosition, skyAlpha } = require('../script.js');
  const near = { x: 100, y: 100, size: 3, depth: 1, twinkle: false, phase: 0 };
  const far = { ...near, size: 1, depth: 0.3 };
  assert.deepEqual(skyPosition(near, 1000, 800, 0, 0), { x: 100, y: 100 });
  assert.deepEqual(skyPosition(near, 1000, 800, 10, 0), { x: 60, y: 100 }, '4px a second for the nearest stars');
  assert.equal(skyPosition(far, 1000, 800, 10, 0).x, 88, 'far stars move less');
  assert.equal(skyPosition(near, 1000, 800, 0, 1000).y, 40);
  assert.equal(skyPosition(far, 1000, 800, 0, 1000).y, 82);
  assert.deepEqual(skyPosition(near, 1000, 800, 30, 5000), { x: 980, y: 600 }, 'wraps instead of leaving the screen');
  assert.deepEqual(skyPosition(near, 0, 0, 5, 5), { x: 0, y: 0 });
  assert.ok(skyAlpha(near, 0) > skyAlpha(far, 0), 'near stars are brighter');
  assert.equal(skyAlpha(near, 0), skyAlpha(near, 99), 'steady stars do not flicker');
  const twinkler = { ...near, twinkle: true };
  const levels = [0, 1, 2, 3].map((t) => skyAlpha(twinkler, t));
  assert.ok(Math.max(...levels) - Math.min(...levels) > 0.1);
  assert.ok(levels.every((a) => a > 0.2 && a <= 0.8), 'a twinkle dims a star but never hides it');
});

test('the dotted grid is gone and the sky canvas is decorative', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.doesNotMatch(css, /--dot\b/);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<canvas class="sky" aria-hidden="true" hidden><\/canvas>/);
  assert.match(css, /\.sky \{[^}]*pointer-events:\s*none/);
});

test('intro timeline: tiles, then the name, then the rest, all inside about two seconds', () => {
  const { introTimeline } = require('../script.js');
  const time = introTimeline(20, 5);
  assert.equal(time.nameStart, 450);
  assert.ok(time.restStart >= time.nameStart + 20 * time.nameStep - 100, 'the other lines wait for the name');
  assert.equal(time.end, time.restStart + 4 * time.restStep + 380);
  assert.ok(time.end <= 2200, `the whole intro is short (${time.end}ms)`);
  assert.ok(80 + 63 * time.tileStep + time.tileFade <= time.restStart, 'the photo is complete before the rest appears');
  assert.equal(introTimeline(0, 0).end, 1100 + 380, 'no letters and no extras still ends cleanly');
  assert.deepEqual(introTimeline(NaN, -3), introTimeline(0, 0));
});

test('the cover is set up in the head, with the intro only on a plain load, and a failsafe', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /root\.classList\.add\("has-cover"\);\s*if \(!window\.location\.hash\) \{\s*root\.classList\.add\("at-cover"\);\s*if \(!calm\) root\.classList\.add\("intro-play"\);/);
  assert.match(head, /history\.scrollRestoration = "manual";[\s\S]*?entry\.type === "reload"\) \{[\s\S]*?history\.replaceState\(null, "", window\.location\.pathname \+ window\.location\.search\);[\s\S]*?window\.scrollTo\(0, 0\);/, 'a reload starts over at the hero, without the #section');
  assert.match(head, /getAttribute\("data-cover"\) !== "ready"\)\s*root\.classList\.remove\("has-cover", "at-cover", "intro-play"\)/, 'the ordinary page appears if script.js never loads');
  assert.match(css, /html\.at-cover \.sidebar \{\s*visibility: hidden;\s*translate: calc\(-100% - 48px\) 0;/, 'away and unfocusable at the top of the page');
  assert.match(css, /html\.has-cover \.hero \{[^}]*min-height: 100vh;[^}]*translate: calc\(var\(--main-offset\) \/ -2\) 0;/, 'the hero fills the window and is centred on it');
  assert.doesNotMatch(css, /html\.(?:intro|at-cover) \.main > \.section/, 'the sections below are never hidden');
  const module = js.slice(js.indexOf('const cover = (() => {'), js.indexOf('20. Scroll aids'));
  assert.match(module, /coverProgress\(window\.scrollY, hero\.offsetHeight\)/, 'the layout follows the scroll position both ways');
  assert.match(module, /prefersReducedMotion\(\) \? \(window\.scrollY > 4 \? 1 : 0\)/, 'reduced motion: it switches instead of gliding');
  assert.match(module, /name\.setAttribute\('aria-label', title\)/, 'the name stays readable to screen readers while it types');
  assert.doesNotMatch(module, /innerHTML/);
});

test('cover progress: 0 at the top, 1 shortly before the hero has left, smooth and never backwards', () => {
  const { coverProgress } = require('../script.js');
  assert.equal(coverProgress(0, 900), 0);
  assert.equal(coverProgress(720, 900), 1, 'complete at 80% of the hero');
  assert.equal(coverProgress(5000, 900), 1);
  assert.equal(coverProgress(-50, 900), 0, 'rubber-band overscroll stays at the cover');
  assert.equal(coverProgress(360, 900), 0.5, 'halfway in the middle');
  assert.ok(coverProgress(72, 900) < 0.05, 'eases in: the first nudge barely moves anything');
  let last = 0;
  for (let y = 0; y <= 900; y += 10) { const p = coverProgress(y, 900); assert.ok(p >= last && p <= 1); last = p; }
  assert.equal(coverProgress(10, 0), 1, 'a missing hero height cannot divide by zero');
  assert.equal(coverProgress(NaN, 900), 0);
});

test('photo glitch: a few thin strips, some showing the other image, never the whole photo', () => {
  const { glitchSlices } = require('../script.js');
  let seed = 11;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let run = 0; run < 300; run++) {
    const slices = glitchSlices(random);
    assert.ok(slices.length >= 3 && slices.length <= 5);
    assert.ok(slices.some((s) => s.alt), 'the alternate image always breaks through somewhere');
    let area = 0;
    for (const s of slices) {
      assert.ok(s.height >= 4 && s.height <= 12, 'thin bands');
      assert.ok(s.top >= 0 && s.top + s.height <= 100, 'inside the photo');
      assert.ok(Math.abs(s.shift) >= 2 && Math.abs(s.shift) <= 6, 'a small sideways jump');
      area += s.height;
    }
    assert.ok(area <= 60, 'strips, not a full-frame flash');
  }
  assert.ok(glitchSlices(() => 0.99).every((s) => !s.alt) === false, 'even an unlucky roll shows the alternate once');
  for (let run = 0; run < 100; run++) {
    const peak = glitchSlices(random, 1);
    assert.ok(peak.length >= 4 && peak.length <= 6, 'the band plus the strips fit the six layers');
    assert.deepEqual([peak[0].alt, peak[0].height, Math.abs(peak[0].shift)], [true, 75, 1], 'at the peak three quarters of the photo is the other image, almost in place');
    assert.ok(peak[0].top >= 0 && peak[0].top + peak[0].height <= 100);
    const part = glitchSlices(random, 0.4)[0];
    assert.equal(part.height, 48, 'it builds up to the peak and back down');
  }
  assert.ok(glitchSlices(random, 7)[0].height === 75 && glitchSlices(random, -2).every((s) => s.height <= 12), 'out-of-range amounts are clamped');
});

test('contact form: problems are found per field, before anything is sent', () => {
  const { contactProblems } = require('../script.js');
  const good = { name: 'Ada', email: 'ada@example.com', message: 'We have an opening for you.' };
  assert.deepEqual(contactProblems(good), {});
  assert.deepEqual(Object.keys(contactProblems({})).sort(), ['email', 'message', 'name']);
  assert.deepEqual(Object.keys(contactProblems()), ['name', 'email', 'message']);
  assert.match(contactProblems({ ...good, name: '   ' }).name, /name/);
  for (const email of ['ada', 'ada@', 'ada@example', 'a b@example.com', '@example.com']) assert.ok(contactProblems({ ...good, email }).email, email);
  assert.match(contactProblems({ ...good, email: '' }).email, /so I can reply/, 'says why it is needed');
  assert.match(contactProblems({ ...good, message: 'hi' }).message, /little more/);
  assert.deepEqual(contactProblems({ ...good, email: '  ada@example.com ' }), {}, 'stray spaces are fine');
  assert.deepEqual(Object.keys(contactProblems({ name: 5, email: null, message: [] })).sort(), ['email', 'message', 'name']);
});

test('contact form: labelled fields, a hidden trap for bots, and hidden until the script turns it on', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const contact = html.slice(html.indexOf('id="contact"'));
  assert.ok(contact.indexOf('class="terminal"') < contact.indexOf('class="contact-form"'), 'terminal first, form below');
  assert.match(contact, /<form class="contact-form" novalidate hidden>/);
  for (const id of ['contact-name', 'contact-email', 'contact-message']) {
    assert.match(contact, new RegExp(`<label for="${id}">`), `${id} has a visible label`);
    assert.match(contact, new RegExp(`id="${id}"[^>]*required[^>]*aria-describedby="${id}-error"`));
  }
  assert.match(contact, /<p class="contact-trap" aria-hidden="true">[\s\S]*?name="website"[^>]*tabindex="-1"/);
  const data = require('../assets/data.js');
  assert.ok(data.contact && 'endpoint' in data.contact);
  const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const module = js.slice(js.indexOf('const contactForm = (() => {'), js.indexOf('20. Scroll aids'));
  assert.match(module, /mailtoLink\(owner,/, 'a failed send offers the visitor\'s own mail app, message included');
  assert.doesNotMatch(module, /innerHTML/);
});

test('email typos: common slips in the big providers get a suggestion, real domains do not', () => {
  const { emailSuggestion } = require('../script.js');
  assert.equal(emailSuggestion('ada@gmial.com'), 'ada@gmail.com');
  assert.equal(emailSuggestion('Ada.L@GMAIL.CON'), 'Ada.L@gmail.com', 'the name is kept as typed');
  assert.equal(emailSuggestion('  ada@yahooo.com '), 'ada@yahoo.com');
  assert.equal(emailSuggestion('ada@hotmial.com'), 'ada@hotmail.com');
  assert.equal(emailSuggestion('ada@outlok.com'), 'ada@outlook.com');
  for (const fine of ['ada@gmail.com', 'ada@company.co', 'ada@sti.edu.ph', 'ada@yahoo.com.ph', 'ada', '@gmial.com', '', null, 5]) assert.equal(emailSuggestion(fine), null, String(fine));
});

test('pages: Projects and More about me are views of the same file, without the cover', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(html, /view=\(projects\|more\|stack\|case\|post\|blog\|links\|guestbook\|resume\)\(&\|\$\)\/\.exec\(window\.location\.search\);\s*if \(view\) \{\s*root\.classList\.add\("view-" \+ view\[1\]\);\s*return;/);
  assert.match(css, /html\.view-more \.main > \.section:not\(#personal\):not\(#now\):not\(#background\):not\(#writing\):not\(#outside\):not\(#contact\),/, 'More about me includes Now alongside photos, bio, background, writing and terminal');
  assert.match(css, /html\.has-cover #outside,\s*html\.has-cover #contact :is\(\.contact-intro, \.terminal, \.terminal-chips\) \{\s*display: none;/, 'Home leaves those two out, but only when the head script ran');
  assert.doesNotMatch(html, /class="project-more"/, 'all projects are shown without an expansion button');
  assert.match(html, /href="\.\/#projects" data-home>Back to home</);
  const data = require('../assets/data.js');
  assert.ok(data.projects.every((p) => !('featured' in p)), 'every project is listed at home; nothing is marked featured');
});

test('home projects are slim rows that link to their full card on the Projects page', () => {
  const { projectSlug } = require('../script.js');
  assert.equal(projectSlug('Pakisuyo Express'), 'project-pakisuyo-express');
  assert.equal(projectSlug('AmIgo'), 'project-amigo');
  assert.equal(projectSlug('  C++ & Rust!  '), 'project-c-rust');
  assert.equal(projectSlug(null), 'project-');
  const data = require('../assets/data.js');
  assert.equal(new Set(data.projects.map((p) => projectSlug(p.title))).size, data.projects.length, 'every project gets its own anchor');
  const fs = require('node:fs');
  const path = require('node:path');
  const js = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
  assert.match(js, /link\.href = projectLink\(project\);/);
  assert.match(js, /li\.id = projectSlug\(project\.title\);/, 'the full card carries the matching anchor');
});

test('stack page: each tool lists the projects whose tags name it, and nothing looser', () => {
  const { stackUses } = require('../script.js');
  const data = require('../assets/data.js');
  const uses = (tool) => stackUses(tool, data.projects);
  assert.deepEqual(uses('Docker + Compose'), ['Ambiancy', 'Thready']);
  assert.deepEqual(uses('Node.js 20 (Alpine)'), ['Thready'], 'a tag may be the start of the tool\'s full name');
  assert.deepEqual(uses('GitHub Actions'), ['Pakisuyo Express', 'OwlSet']);
  assert.deepEqual(uses('TypeScript'), ['Ambiancy', 'OwlSet', 'Thready', 'AmIgo']);
  assert.deepEqual(uses('React 18.3'), ['Ambiancy'], 'React Native is a different thing');
  assert.deepEqual(uses('Vite'), ['Ambiancy', 'Pakisuyo Express']);
  assert.deepEqual(uses('Vitest'), ['Ambiancy']);
  assert.deepEqual(uses('Azure'), ['Thready']);
  for (const unused of ['Git', 'GitHub', 'Java', 'Python']) assert.deepEqual(uses(unused), [], `${unused}: no project tag names it`);
  assert.deepEqual(stackUses('Vite', null), []);
  assert.deepEqual(stackUses('', data.projects), []);
});

test('case studies: every project has a role and a study, with nothing private in them', () => {
  const { validateData, projectSlug } = require('../script.js');
  const data = require('../assets/data.js');
  assert.deepEqual(validateData(data), []);
  const roles = Object.fromEntries(data.projects.map((p) => [p.title, p.role]));
  assert.equal(roles.Ambiancy, 'Independent developer');
  assert.equal(roles['Pakisuyo Express'], 'Independent developer');
  assert.equal(roles.AmIgo, 'Independent developer');
  assert.match(roles.OwlSet, /Hackathon submission.*Frontend and DevOps lead/);
  assert.match(roles.Thready, /Thesis.*Frontend and DevOps lead/);
  for (const project of data.projects) {
    const study = project.caseStudy;
    for (const part of ['problem', 'built', 'ships', 'learned']) assert.ok(typeof study[part] === 'string' && study[part].length > 80, `${project.title}: ${part}`);
    assert.ok(study.pipeline.oneWay && study.pipeline.flow.length >= 4, `${project.title}: a pipeline to draw`);
    const text = JSON.stringify(study);
    assert.doesNotMatch(text, /\b\d{1,3}(?:\.\d{1,3}){3}\b|[a-z0-9-]+\.(?:dev|ts\.net)\b/i, `${project.title}: no addresses or hostnames`);
    assert.doesNotMatch(text, /—/, 'plain punctuation');
  }
  for (const title of ['Thready', 'AmIgo']) assert.equal(data.projects.find((p) => p.title === title).links.source, null, `${title}: the repository stays private`);
  const bad = structuredClone(data); bad.projects[0].caseStudy.ships = 5;
  assert.ok(validateData(bad).some((e) => e.startsWith('projects[0].caseStudy')));
  assert.equal(projectSlug('Pakisuyo Express').replace('project-', ''), 'pakisuyo-express', 'the address is ?view=case&p=pakisuyo-express');
});


test('resume page: the PDF\'s sections, with the phone number kept off the public page', () => {
  const data = require('../assets/data.js');
  const page = data.resumePage;
  assert.deepEqual(page.sections.map((s) => s.title), ['Education', 'Technical Skills', 'Projects', 'Certifications & Awards']);
  assert.doesNotMatch(JSON.stringify(page), /\+63|\b09\d{2}|\d{3}\s?\d{3}\s?\d{3,4}\b/, 'no phone number');
  for (const section of page.sections) for (const item of section.items) for (const bullet of item.bullets) {
    assert.ok(typeof bullet === 'string' || (typeof bullet.label === 'string' && typeof bullet.text === 'string'), section.title);
  }
  const fs = require('node:fs');
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /view=\(projects\|more\|stack\|case\|post\|blog\|links\|guestbook\|resume\)/);
  assert.doesNotMatch(html, /class="nav-link"[^>]*data-view="resume"/, 'no sidebar link: reached from the hero button');
});

test('decodeText: settles left to right, keeps spaces, ends on the real text', () => {
  const { decodeText } = require('../script.js');
  const zero = () => 0; // always the first glyph, 'A'
  assert.equal(decodeText(' About', 0, zero), ' AAAAA', 'nothing settled yet; the leading space stays');
  assert.equal(decodeText(' About', 0.5, zero), ' AbAAA', 'the first half has settled');
  assert.equal(decodeText(' About', 1), ' About');
  assert.equal(decodeText(' About', 7), ' About', 'past the end is still the real text');
  assert.equal(decodeText('A B', NaN, zero), 'A A', 'bad progress counts as the start');
  assert.equal(decodeText('', 0.5), '');
});
