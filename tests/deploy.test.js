const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, '.github', 'scripts', 'cache-bust.sh');

test('cache-bust stamps style, script, and data URLs with the version', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(dir, 'index.html'));
  execFileSync('bash', [SCRIPT, dir, 'abc1234']);
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  for (const ref of ['./style.css', './script.js', './assets/data.js']) {
    assert.ok(html.includes(`"${ref}?v=abc1234"`), `${ref} not stamped`);
    assert.ok(!html.includes(`"${ref}"`), `${ref} left unstamped`);
  }
});

test('cache-bust refuses to run without a version', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(dir, 'index.html'));
  assert.throws(() => execFileSync('bash', [SCRIPT, dir, ''], { stdio: 'pipe' }));
});

test('deploy workflow runs cache-bust on the staged site', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(yml, /bash \.github\/scripts\/cache-bust\.sh _site "\$\{GITHUB_SHA::7\}"/);
});

test('the 404 page is published by both hosts and works from any path', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(vercel.buildCommand, /cp -r [^&]*\b404\.html\b/);
  assert.match(yml, /cp -r [^\n]*\b404\.html\b/);
  const html = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
  assert.match(html, /<a href="https:\/\/kenchrls\.vercel\.app\/">/);
  assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ''), /(?:href|src)="(?!https:)|url\("(?!https:)/, 'relative URLs break on nested paths');
});
