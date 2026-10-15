// Cloudflare Worker: the portfolio's private API.
//   POST /api/chat   — pixel CK's replies, through Gemini (same logic as server.js)
//   GET  /api/pokes  — the shared poke total
//   POST /api/pokes  — add pokes to it
//   POST /api/contact — the contact form, emailed to the owner through Resend
// Keys are Worker secrets (GEMINI_API_KEY, RESEND_API_KEY); counters live in D1 (binding DB).
// Deploy steps: docs/assistant.md.
import chat from '../server/chat.js';
import contact from '../server/contact.js';
import guestbook from '../server/guestbook.js';
import data from '../assets/data.js';

const { ChatError, validateMessages, generateReply, createLimiter } = chat;
const { validateContact, canReceiveMail, sendContact } = contact;
const { validateGuestbook, listGuestbook, saveGuestbook } = guestbook;

const MAX_BODY = 32768; // bytes, same as server.js
const MAX_POKES_PER_REQUEST = 20;
const TOTAL = 'pokes';

// Per-isolate bursts. Cloudflare sets CF-Connecting-IP itself, so it can be trusted here.
// The daily chat budget is kept in D1, because isolates come and go.
const allowChat = createLimiter({ dailyLimit: Number.MAX_SAFE_INTEGER });
const perMinute = (limit, now = Date.now) => {
  const visitors = new Map();
  return (ip) => {
    const time = now();
    for (const [key, entry] of visitors) if (time >= entry.until) visitors.delete(key);
    const entry = visitors.get(ip) || { count: 0, until: time + 60000 };
    if (entry.count >= limit || (!visitors.has(ip) && visitors.size >= 5000)) return false;
    entry.count += 1;
    visitors.set(ip, entry);
    return true;
  };
};
const allowPoke = perMinute(40);
const allowContact = perMinute(3);
const allowGuestbook = perMinute(2);

const origins = (env) => new Set(String(env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));

const reply = (status, body, headers = {}) => new Response(body === null ? null : JSON.stringify(body), {
  status,
  headers: { ...(body === null ? {} : { 'Content-Type': 'application/json; charset=utf-8' }), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});

const readJson = async (request) => {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new ChatError(415, 'INVALID_CONTENT_TYPE', 'Use application/json.');
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new ChatError(413, 'TOO_LARGE', 'The request is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY) throw new ChatError(413, 'TOO_LARGE', 'The request is too large.');
  try { return JSON.parse(text); } catch { throw new ChatError(400, 'INVALID_JSON', 'Send a valid JSON request.'); }
};

// One atomic statement: no lost updates when two visitors poke at once.
const add = (db, name, amount) => db
  .prepare('INSERT INTO counters (name, value) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET value = value + ?2 RETURNING value')
  .bind(name, amount).first('value');
const read = async (db, name) => Number(await db.prepare('SELECT value FROM counters WHERE name = ?1').bind(name).first('value')) || 0;

const handleChat = async (request, env, ip) => {
  if (request.method !== 'POST') throw Object.assign(new ChatError(405, 'METHOD_NOT_ALLOWED', 'Use POST.'), { allow: 'POST, OPTIONS' });
  if (!env.GEMINI_API_KEY) throw new ChatError(503, 'NOT_CONFIGURED', 'Live chat is not connected yet.');
  const messages = validateMessages(await readJson(request));
  const busy = () => Object.assign(new ChatError(429, 'RATE_LIMIT', 'Chat is busy. Please try again later.'), { retryAfter: '60' });
  if (!allowChat(ip)) throw busy();
  if (env.DB) {
    const limit = Number(env.DAILY_CHAT_LIMIT) || 100;
    const used = await add(env.DB, `chat:${new Date().toISOString().slice(0, 10)}`, 1);
    if (used > limit) throw busy();
  }
  const text = await generateReply({
    messages, data, apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    fetchImpl: env.fetchImpl || fetch, signal: AbortSignal.timeout(25000),
  });
  return { reply: text };
};

const handlePokes = async (request, env, ip) => {
  if (!env.DB) throw new ChatError(503, 'NOT_CONFIGURED', 'The poke counter is not connected yet.');
  if (request.method === 'GET') return { total: await read(env.DB, TOTAL) };
  if (request.method !== 'POST') throw Object.assign(new ChatError(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST.'), { allow: 'GET, POST, OPTIONS' });
  const body = await readJson(request);
  const count = body && body.count;
  if (!Number.isInteger(count) || count < 1 || count > MAX_POKES_PER_REQUEST) throw new ChatError(400, 'INVALID_COUNT', `Send a count from 1 to ${MAX_POKES_PER_REQUEST}.`);
  if (!allowPoke(ip)) throw Object.assign(new ChatError(429, 'RATE_LIMIT', 'Too many pokes. Give him a minute.'), { retryAfter: '60' });
  return { total: Number(await add(env.DB, TOTAL, count)) };
};

const handleContact = async (request, env, ip) => {
  if (request.method !== 'POST') throw Object.assign(new ChatError(405, 'METHOD_NOT_ALLOWED', 'Use POST.'), { allow: 'POST, OPTIONS' });
  if (!env.RESEND_API_KEY) throw new ChatError(503, 'NOT_CONFIGURED', 'The contact form is not connected yet.');
  const message = validateContact(await readJson(request));
  // A filled trap field is a bot: say "sent" and send nothing.
  if (message.spam) return { ok: true };
  const busy = () => Object.assign(new ChatError(429, 'RATE_LIMIT', 'Too many messages just now. Please try again in a minute, or email me.'), { retryAfter: '60' });
  if (!allowContact(ip)) throw busy();
  const fetchImpl = env.fetchImpl || fetch;
  if (!(await canReceiveMail({ email: message.email, fetchImpl, signal: AbortSignal.timeout(4000) }))) {
    throw new ChatError(400, 'INVALID_EMAIL', 'That email’s domain can’t receive mail. Please check it for typos.');
  }
  if (env.DB) {
    const limit = Number(env.CONTACT_DAILY_LIMIT) || 50;
    const used = await add(env.DB, `contact:${new Date().toISOString().slice(0, 10)}`, 1);
    if (used > limit) throw busy();
  }
  await sendContact({
    contact: message, apiKey: env.RESEND_API_KEY, to: env.CONTACT_TO || data.profile.email,
    from: env.CONTACT_FROM || 'Portfolio <onboarding@resend.dev>', fetchImpl, signal: AbortSignal.timeout(15000),
  });
  return { ok: true };
};

const handleGuestbook = async (request, env, ip) => {
  if (!['GET', 'POST'].includes(request.method)) throw Object.assign(new ChatError(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST.'), { allow: 'GET, POST, OPTIONS' });
  if (!env.DB) throw new ChatError(503, 'NOT_CONFIGURED', 'The guestbook is not connected yet.');
  if (request.method === 'GET') return listGuestbook(env.DB, new URL(request.url).searchParams.get('before'));
  const note = validateGuestbook(await readJson(request));
  if (note.spam) return { ok: true, pending: true };
  const busy = () => Object.assign(new ChatError(429, 'RATE_LIMIT', 'Please wait a minute before leaving another note.'), { retryAfter: '60' });
  if (!allowGuestbook(ip)) throw busy();
  const used = await add(env.DB, `guestbook:${new Date().toISOString().slice(0, 10)}`, 1);
  if (used > (Number(env.GUESTBOOK_DAILY_LIMIT) || 50)) throw busy();
  await saveGuestbook(env.DB, note);
  return { ok: true, pending: true };
};

const ROUTES = {
  '/api/chat': { handle: handleChat, methods: 'POST' },
  '/api/pokes': { handle: handlePokes, methods: 'GET, POST' },
  '/api/contact': { handle: handleContact, methods: 'POST' },
  '/api/guestbook': { handle: handleGuestbook, methods: 'GET, POST' },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname];
    if (!route) return reply(404, { code: 'NOT_FOUND', error: 'Not found.' });
    const origin = request.headers.get('origin');
    // Browsers always send Origin on these cross-site calls; anything else is not the site.
    if (!origin || !origins(env).has(origin)) return reply(403, { code: 'ORIGIN_DENIED', error: 'This origin is not allowed.' });
    const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    if (request.method === 'OPTIONS') {
      return reply(204, null, { ...cors, 'Access-Control-Allow-Methods': route.methods, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
    }
    try {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      return reply(200, await route.handle(request, env, ip), cors);
    } catch (error) {
      // Never pass upstream errors, credentials, or request details to the visitor.
      if (!(error instanceof ChatError)) return reply(500, { code: 'SERVER_ERROR', error: 'Something went wrong. Please try again.' }, cors);
      const extra = { ...(error.allow ? { Allow: error.allow } : {}), ...(error.retryAfter ? { 'Retry-After': error.retryAfter } : {}) };
      return reply(error.status, { code: error.code, error: error.message }, { ...cors, ...extra });
    }
  },
};
