const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateGuestbook, guestbookCursor, listGuestbook, saveGuestbook } = require('../server/guestbook.js');
const { createLocalGuestbook } = require('../server/guestbook-local.js');
const { guestbookProblems, guestbookPage, safeDemo, validateData } = require('../script.js');
const { Readable, Writable } = require('node:stream');
const { finished } = require('node:stream/promises');
const { createPortfolioServer } = require('../server.js');
const note = (n = 1) => ({ name: 'Ada', message: 'Hello from a visitor.', submissionId: n.toString(16).padStart(32, '0') });

test('guestbook validation bounds public text and normalizes names without interpreting markup', () => {
  const clean = validateGuestbook({ ...note(), name: '  Ada\n Visitor  ', message: ' <script>alert(1)</script>\r\nHello ' });
  assert.equal(clean.name, 'Ada Visitor');
  assert.equal(clean.message, '<script>alert(1)</script>\nHello');
  for (const body of [null, {}, { ...note(), name: '' }, { ...note(), name: 'x'.repeat(61) }, { ...note(), message: '' }, { ...note(), message: 'x'.repeat(501) }, { ...note(), submissionId: 'not-a-token' }]) assert.throws(() => validateGuestbook(body));
  assert.deepEqual(validateGuestbook({ website: 'bot.example' }), { spam: true });
  assert.deepEqual(guestbookProblems(note()), {});
  assert.deepEqual(Object.keys(guestbookProblems({ name: [], message: null })).sort(), ['message', 'name']);
  assert.throws(() => guestbookCursor('1 OR 1=1'));
  assert.throws(() => guestbookCursor('9007199254740992'));
});

test('notes persist across connections, are private until approval, and retries do not duplicate them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-guestbook-'));
  const filename = path.join(dir, 'notes.sqlite');
  let db = createLocalGuestbook(filename);
  try {
    await saveGuestbook(db, validateGuestbook(note()));
    await saveGuestbook(db, validateGuestbook(note()));
    assert.deepEqual(await listGuestbook(db), { entries: [], total: 0, nextCursor: null });
    assert.equal(await db.prepare('SELECT COUNT(*) AS total FROM guestbook_entries').first('total'), 1);
    db.close();
    db = createLocalGuestbook(filename);
    await db.prepare('UPDATE guestbook_entries SET approved = 1 WHERE submission_id = ?1').bind(note().submissionId).run();
    const page = await listGuestbook(db);
    assert.equal(page.total, 1);
    assert.equal(page.entries[0].name, 'Ada');
    assert.deepEqual(Object.keys(page.entries[0]).sort(), ['createdAt', 'id', 'message', 'name']);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('approved notes paginate without exposing pending notes or repeating boundary entries', async () => {
  const db = createLocalGuestbook(':memory:');
  try {
    for (let n = 1; n <= 24; n++) await saveGuestbook(db, note(n));
    await db.prepare('UPDATE guestbook_entries SET approved = 1 WHERE id != 22').run();
    const first = await listGuestbook(db);
    const next = await listGuestbook(db, first.nextCursor);
    assert.equal(first.total, 23);
    assert.equal(first.entries.length, 20);
    assert.equal(next.entries.length, 3);
    assert.equal(next.nextCursor, null);
    assert.equal(new Set([...first.entries, ...next.entries].map((entry) => entry.id)).size, 23);
    assert.ok(!first.entries.some((entry) => entry.id === 22));
    assert.ok(guestbookPage(first));
    assert.equal(guestbookPage({ ...first, nextCursor: 'bad' }), null);
    assert.equal(guestbookPage({ ...first, entries: [first.entries[0], first.entries[0]] }), null);
    assert.equal(guestbookPage({ ...first, entries: [{ ...first.entries[0], message: 'x'.repeat(501) }] }), null);
  } finally { db.close(); }
});

test('the Worker guestbook handles CORS, methods, moderation, traps, and rate limits', async () => {
  const worker = (await import('../worker/index.mjs')).default;
  const db = createLocalGuestbook(':memory:');
  const origin = 'https://kenchrls.vercel.app';
  const env = { ALLOWED_ORIGINS: origin, DB: db, GUESTBOOK_DAILY_LIMIT: '3' };
  const request = (method = 'GET', body, site = origin, ip = '192.0.2.80') => new Request('https://api.example/api/guestbook', {
    method, headers: { origin: site, 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    assert.equal((await worker.fetch(request('GET', undefined, 'https://bad.example'), env)).status, 403);
    assert.equal((await worker.fetch(request('DELETE'), env)).status, 405);
    assert.equal((await worker.fetch(request('OPTIONS'), env)).headers.get('access-control-allow-methods'), 'GET, POST');
    assert.equal((await worker.fetch(request('GET'), { ...env, DB: null })).status, 503);
    assert.equal((await worker.fetch(request('POST', {}), env)).status, 400);
    const trapped = await worker.fetch(request('POST', { website: 'spam.example' }), env);
    assert.deepEqual(await trapped.json(), { ok: true, pending: true });
    assert.equal(await db.prepare('SELECT COUNT(*) AS total FROM guestbook_entries').first('total'), 0);
    const accepted = await worker.fetch(request('POST', note()), env);
    assert.deepEqual(await accepted.json(), { ok: true, pending: true });
    assert.equal((await (await worker.fetch(request(), env)).json()).total, 0);
    assert.equal((await worker.fetch(request('POST', note()), env)).status, 200);
    assert.equal((await worker.fetch(request('POST', note(2)), env)).status, 429);
    assert.equal((await worker.fetch(request('POST', note(2), origin, '192.0.2.81'), env)).status, 200);
    assert.equal((await worker.fetch(request('POST', note(3), origin, '192.0.2.82'), env)).status, 429);
  } finally { db.close(); }
});

test('demo configuration accepts local media with a transcript and rejects external or executable URLs', () => {
  const demo = { src: './assets/projects/demo.mp4', poster: './assets/projects/demo.jpg', captions: './assets/projects/demo.vtt', title: 'A demo', summary: 'What the clip shows.' };
  assert.ok(safeDemo(demo));
  for (const src of ['javascript:alert(1)', 'https://example.com/demo.mp4', './assets/projects/../secret.mp4']) assert.equal(safeDemo({ ...demo, src }), false);
  assert.equal(safeDemo({ ...demo, captions: null }), false);
  const data = structuredClone(require('../assets/data.js'));
  assert.deepEqual(validateData(data), []);
  for (const project of data.projects.filter((item) => item.demo)) {
    for (const key of ['src', 'poster', 'captions']) assert.ok(fs.statSync(path.join(__dirname, '..', project.demo[key])).size > 0, `${project.title}: ${key} is published`);
    assert.match(fs.readFileSync(path.join(__dirname, '..', project.demo.captions), 'utf8'), /^WEBVTT\n/);
  }
  data.now = { title: 'Now', updated: 'not a date', items: [] };
  data.projects[0].demo = { ...demo, src: 'https://bad.example/video.mp4' };
  assert.ok(validateData(data).some((problem) => problem.startsWith('now:')));
  assert.ok(validateData(data).some((problem) => problem.includes('.demo:')));
});

test('the local HTTP server supports same-origin reads, pending writes and approved notes without a Gemini key', async () => {
  const db = createLocalGuestbook(':memory:');
  const server = createPortfolioServer({ apiKey: null, guestbookDb: db });
  const call = async (method, body, origin, host = 'localhost:8787') => {
    const req = Readable.from([Buffer.from(body ? JSON.stringify(body) : '')]);
    Object.assign(req, { url: '/api/guestbook', method, headers: { host, ...(origin ? { origin } : {}), 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
    const chunks = [];
    const res = new Writable({ write(chunk, _, done) { chunks.push(Buffer.from(chunk)); done(); } });
    res.headers = {};
    res.setHeader = (key, value) => { res.headers[key] = value; };
    res.writeHead = (status, headers) => { res.statusCode = status; Object.assign(res.headers, headers); };
    const done = finished(res);
    server.emit('request', req, res);
    await done;
    return { status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') };
  };
  try {
    assert.equal((await call('GET')).status, 200, 'same-origin fetch does not send an Origin header on GET');
    assert.equal((await call('GET', null, null, 'evil.example')).status, 403);
    assert.equal((await call('POST', note())).status, 403, 'writes require an explicit allowed origin');
    assert.equal((await call('POST', note(), 'http://localhost:8787')).status, 200);
    assert.equal(JSON.parse((await call('GET')).body).total, 0);
    await db.prepare('UPDATE guestbook_entries SET approved = 1').run();
    assert.equal(JSON.parse((await call('GET')).body).total, 1);
    assert.equal((await call('DELETE', null, 'http://localhost:8787')).status, 405);
  } finally { db.close(); }
});
