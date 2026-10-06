const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { safeResume, scrollProgress, validateData } = require('../script.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const SITE = 'https://chimkenchrls.github.io/portfolio/';
const meta = (key) => {
  const m = new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`).exec(html);
  assert.ok(m, `missing meta ${key}`);
  return m[1];
};
const pngSize = (file) => {
  const bytes = fs.readFileSync(path.join(ROOT, file));
  assert.equal(bytes.toString('latin1', 1, 4), 'PNG', `${file} is a PNG`);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

test('link previews: Open Graph tags point at an absolute image on the live site', () => {
  assert.equal(meta('og:type'), 'website');
  assert.equal(meta('og:url'), SITE);
  assert.match(meta('og:title'), /Kenneth Charles Valdez/);
  assert.ok(meta('og:description').length > 40);
  assert.equal(meta('og:image'), `${SITE}assets/og.jpg`);
  assert.deepEqual([meta('og:image:width'), meta('og:image:height')], ['1200', '630']);
  assert.ok(meta('og:image:alt').length > 20);
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}"`));
});

test('the preview image exists, is 1200x630, web-sized, and carries no camera metadata', () => {
  const bytes = fs.readFileSync(path.join(ROOT, 'assets', 'og.jpg'));
  assert.ok(bytes.length < 300 * 1024, `og.jpg is ${Math.round(bytes.length / 1024)} KB`);
  assert.equal(bytes.indexOf(Buffer.from('Exif\0\0')), -1);
  let at = 2;
  let size = null;
  while (at < bytes.length && !size) {
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xc2) size = [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  assert.deepEqual(size, [1200, 630]);
});

test('the browser tab icon is the profile photo, not the old logo', () => {
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="\.\/assets\/favicon-32\.png"/);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="192x192" href="\.\/assets\/favicon-192\.png"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/assets\/apple-touch-icon\.png"/);
  assert.deepEqual(pngSize('assets/favicon-32.png'), [32, 32]);
  assert.deepEqual(pngSize('assets/favicon-192.png'), [192, 192]);
  assert.deepEqual(pngSize('assets/apple-touch-icon.png'), [180, 180]);
  assert.doesNotMatch(html, /logo\.svg/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'assets', 'logo.svg')), 'the unused logo is deleted');
});

test('safeResume accepts a PDF in ./assets/ or an https link, nothing else', () => {
  assert.equal(safeResume('./assets/resume.pdf'), './assets/resume.pdf');
  assert.equal(safeResume(' ./assets/Kenneth-Valdez_CV.PDF '), './assets/Kenneth-Valdez_CV.PDF');
  assert.equal(safeResume('https://example.com/cv.pdf'), 'https://example.com/cv.pdf');
  for (const bad of [null, undefined, '', 42, '/resume.pdf', './assets/../secret.pdf', './assets/resume.docx', 'javascript:alert(1)', 'http://example.com/cv.pdf']) {
    assert.equal(safeResume(bad), null, `expected null for ${String(bad)}`);
  }
});

test('resume: the button only appears once data.js points at a real file', () => {
  const data = require('../assets/data.js');
  assert.ok('resume' in data.profile, 'profile.resume exists (null until there is a PDF)');
  if (data.profile.resume !== null) {
    assert.ok(safeResume(data.profile.resume), 'a valid path or link');
    if (data.profile.resume.startsWith('./')) assert.ok(fs.existsSync(path.join(ROOT, data.profile.resume)), 'the PDF is in the repo');
  }
  const bad = JSON.parse(JSON.stringify(data));
  bad.profile.resume = 'resume.docx';
  assert.ok(validateData(bad).some((e) => e.startsWith('profile.resume')));
  assert.doesNotMatch(html, />\s*Resume\s*</, 'no static button that could point at nothing');
  assert.match(read('script.js'), /safeResume\(profile\.resume\)[\s\S]{0,200}'btn btn-secondary', 'Resume'/);
  assert.match(read('style.css'), /\.btn-secondary \{/);
});

test('scrollProgress runs 0 to 1 and never leaves that range', () => {
  assert.equal(scrollProgress(0, 3000, 1000), 0);
  assert.equal(scrollProgress(1000, 3000, 1000), 0.5);
  assert.equal(scrollProgress(2000, 3000, 1000), 1);
  assert.equal(scrollProgress(2600, 3000, 1000), 1, 'overscroll');
  assert.equal(scrollProgress(-40, 3000, 1000), 0, 'rubber-band at the top');
  assert.equal(scrollProgress(0, 800, 1000), 0, 'a page that does not scroll');
});

test('scroll aids: a progress line and a back-to-top button, calm under reduced motion', () => {
  const css = read('style.css');
  const js = read('script.js');
  assert.match(html, /<div class="scroll-progress" aria-hidden="true">\s*<span class="scroll-progress-bar"><\/span>/);
  assert.match(html, /<button class="to-top" type="button">[\s\S]*?Back to <\/span>top\s*<\/button>/);
  assert.match(css, /\.scroll-progress \{[^}]*position:\s*fixed/);
  assert.match(css, /\.to-top \{[^}]*visibility:\s*hidden/, 'hidden (and unfocusable) until you scroll');
  assert.match(css, /\.to-top\.is-visible \{[^}]*visibility:\s*visible/);
  const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.to-top \{[^}]*transition:\s*none/);
  const aids = js.slice(js.indexOf('const scrollAids'), js.indexOf('99. Boot'));
  assert.match(aids, /passive:\s*true/);
  assert.match(aids, /prefersReducedMotion\(\) \? 'auto' : 'smooth'/);
});
