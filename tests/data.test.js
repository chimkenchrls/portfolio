const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('data.js exports PORTFOLIO_DATA with every section', () => {
  const data = require('../assets/data.js');
  for (const key of ['profile', 'experience', 'education', 'stack', 'projects', 'certifications', 'certificationsPending']) {
    assert.ok(key in data, `missing ${key}`);
  }
});

test('content matches the approved spec', () => {
  const data = require('../assets/data.js');
  assert.equal(data.profile.email, 'charleskenneth129@gmail.com');
  assert.equal(data.profile.linkedin, 'https://www.linkedin.com/in/kennethcharlesvaldez');
  // Projects are free to be added, reordered, and reworded: check their shape, not their text.
  assert.ok(data.projects.length >= 1);
  const titles = data.projects.map((p) => p.title);
  assert.equal(new Set(titles).size, titles.length, 'project titles are unique');
  for (const project of data.projects) {
    assert.ok(['done', 'in-progress', 'coming-soon'].includes(project.status), `${project.title}: status`);
    assert.ok(project.description === null || project.description.trim().length > 20, `${project.title}: description`);
  }
  assert.deepEqual(data.stack.map((g) => g.category), [
    'DevOps & Cloud', 'Security & Identity', 'Backend', 'Frontend', 'AI & Machine Learning', 'Developer Tools',
  ]);
  assert.equal(data.certifications.length, 0);
  assert.ok(!('stats' in data), 'stats row was removed');
});

test('every stack icon slug has a file on disk', () => {
  const data = require('../assets/data.js');
  for (const group of data.stack) {
    for (const item of group.items) {
      if (item.icon === null) continue;
      const file = path.join(ROOT, 'assets', 'icons', 'stack', `${item.icon}.svg`);
      assert.ok(fs.existsSync(file), `${item.name}: ${file} missing`);
    }
  }
});

test('highlight chips were removed from the data', () => {
  const data = require('../assets/data.js');
  assert.ok(!('highlights' in data));
});

test('the real data passes validateData', () => {
  const data = require('../assets/data.js');
  const { validateData } = require('../script.js');
  assert.deepEqual(validateData(data), []);
});

test("data.js sets ck's chimken high score", () => {
  const data = require('../assets/data.js');
  assert.deepEqual(data.game, { owner: 'ck', highScore: 3236 });
});

test('validateData rejects a bad game entry', () => {
  const { validateData } = require('../script.js');
  const data = JSON.parse(JSON.stringify(require('../assets/data.js')));
  data.game = { owner: '', highScore: -3 };
  const errors = validateData(data);
  assert.ok(errors.some((e) => e.startsWith('game')), errors.join(' | '));
});

test('outside-the-IDE photos have files on disk, no per-photo captions, one section description', () => {
  const data = require('../assets/data.js');
  assert.ok(Array.isArray(data.outside) && data.outside.length >= 3);
  for (const item of data.outside) {
    assert.match(item.photo, /^\.\/assets\/outside\/[\w.-]+\.(svg|jpe?g|png|webp)$/);
    assert.ok(fs.existsSync(path.join(ROOT, item.photo)), `${item.photo} missing`);
    assert.ok(!('caption' in item), 'captions were dropped');
  }
  assert.equal(data.outsideIntro, 'Life away from the terminal. The places, things, and little moments that recharge me between builds.');
});

test('validateData rejects bad outside entries', () => {
  const { validateData } = require('../script.js');
  const data = JSON.parse(JSON.stringify(require('../assets/data.js')));
  data.outside = [{ photo: 'https://evil.example/x.jpg' }];
  const errors = validateData(data);
  assert.ok(errors.some((e) => e.startsWith('outside[0]')), errors.join(' | '));
});

test('outside photos are real, web-sized, and carry no EXIF/GPS metadata', () => {
  const data = require('../assets/data.js');
  assert.equal(data.outside.length, 8);
  for (const { photo } of data.outside) {
    assert.doesNotMatch(photo, /placeholder/, 'placeholders replaced');
    assert.match(photo, /\.jpg$/);
    const bytes = fs.readFileSync(path.join(ROOT, photo));
    assert.ok(bytes.length < 200 * 1024, `${photo} is ${Math.round(bytes.length / 1024)} KB`);
    assert.equal(bytes.indexOf(Buffer.from('Exif\0\0')), -1, `${photo} still has EXIF metadata`);
  }
});

test('no raw originals or archives are left inside the site', () => {
  const left = fs.readdirSync(path.join(ROOT, 'assets', 'outside'))
    .filter((f) => /\.(heic|mov|zip|png|jpeg)$/i.test(f) || /placeholder/.test(f) || fs.statSync(path.join(ROOT, 'assets', 'outside', f)).isDirectory());
  assert.deepEqual(left, []);
});

test('the Live Photo card has a small, silent, metadata-free looping video', () => {
  const data = require('../assets/data.js');
  const live = data.outside[0];
  assert.equal(live.photo, './assets/outside/outside-1.jpg');
  assert.equal(live.video, './assets/outside/outside-1.mp4');
  const bytes = fs.readFileSync(path.join(ROOT, live.video));
  assert.ok(bytes.length < 1024 * 1024, `video is ${Math.round(bytes.length / 1024)} KB`);
  for (const marker of ['com.apple.quicktime', 'iPhone']) {
    assert.equal(bytes.indexOf(Buffer.from(marker)), -1, `video still contains "${marker}" metadata`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, live.video.replace(/\.mp4$/, '.webm'))), 'webm fallback missing');
  assert.ok(data.outside.slice(1).every((item) => !('video' in item)));
});

test('validateData only accepts local mp4/webm videos', () => {
  const { validateData } = require('../script.js');
  const data = JSON.parse(JSON.stringify(require('../assets/data.js')));
  data.outside[0].video = './assets/outside/clip.mov';
  assert.ok(validateData(data).some((e) => e.startsWith('outside[0].video')));
});

test('project screenshots: listed files exist, are web-sized, and carry no metadata', () => {
  const data = require('../assets/data.js');
  const withMedia = data.projects.filter((p) => p.media);
  assert.ok(withMedia.length >= 2, 'at least two projects show screenshots');
  for (const project of withMedia) {
    const shots = Object.entries(project.media);
    assert.ok(shots.length >= 1 && shots.every(([kind]) => ['desktop', 'mobile'].includes(kind)), `${project.title}: desktop and/or mobile`);
    for (const [kind, file] of shots) {
      assert.match(file, /^\.\/assets\/projects\/[\w.-]+\.jpg$/, `${project.title} ${kind}`);
      const bytes = fs.readFileSync(path.join(ROOT, file));
      assert.ok(bytes.length < 250 * 1024, `${file} is ${Math.round(bytes.length / 1024)} KB`);
      assert.equal(bytes.indexOf(Buffer.from('Exif\0\0')), -1, `${file} has EXIF metadata`);
    }
  }
});

test('validateData rejects screenshots outside assets/projects or of unknown kinds', () => {
  const { validateData } = require('../script.js');
  const data = JSON.parse(JSON.stringify(require('../assets/data.js')));
  data.projects[0].media = { desktop: 'https://evil.example/x.jpg' };
  assert.ok(validateData(data).some((e) => e.startsWith('projects[0].media.desktop')));
  data.projects[0].media = { tablet: './assets/projects/x.jpg' };
  assert.ok(validateData(data).some((e) => e.startsWith('projects[0].media')));
  data.projects[0].media = null;
  assert.ok(!validateData(data).some((e) => e.startsWith('projects[0].media')), 'null means no screenshots');
});

test('three projects show desktop + mobile screenshots (Ambiancy, Pakisuyo Express, Thready)', () => {
  const data = require('../assets/data.js');
  const both = data.projects.filter((p) => p.media && p.media.desktop && p.media.mobile);
  assert.ok(both.length >= 3, `only ${both.length} projects have both screenshots`);
});

test("a project's description uses the same feature names as its chat replay", () => {
  const data = require('../assets/data.js');
  for (const project of data.projects.filter((p) => p.chat)) {
    const said = project.chat.scenes.flatMap((s) => s.messages).map((m) => m.text).join(' ');
    if (/study mode/i.test(said)) {
      assert.match(project.description, /study mode/i, `${project.title}: the bot calls it "study mode"`);
      assert.doesNotMatch(project.description, /tutor mode/i, `${project.title}: description still says "tutor mode"`);
    }
  }
});

test('the degree is listed once, under Education, with its achievement', () => {
  const data = require('../assets/data.js');
  const { validateData } = require('../script.js');
  const degree = data.education.find((e) => e.current);
  assert.ok(degree.bullets.length >= 1, 'the current school carries the achievement');
  assert.ok(!data.experience.some((e) => e.org === degree.school && /^BS /.test(e.title)), 'not repeated under Experience');
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'script.js'), 'utf8'), /education[\s\S]{0,260}rowBullets\(li, item\)/, 'education rows render bullets');
  const bad = JSON.parse(JSON.stringify(data));
  bad.education[0].bullets = 'nope';
  assert.ok(validateData(bad).some((e) => e.startsWith('education[0].bullets')));
});
