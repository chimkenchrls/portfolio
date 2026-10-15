'use strict';

// Shared by the Worker and the optional Node server. Notes remain private until
// the owner approves them in the database; public responses contain no trap data.
const { ChatError } = require('./chat.js');
const LIMITS = { name: 60, message: 500, page: 20 };
const validateGuestbook = (body) => {
  const text = (key) => body && typeof body[key] === 'string' ? body[key] : '';
  if (text('website').trim()) return { spam: true };
  const name = text('name').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const message = text('message').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (!name || name.length > LIMITS.name) throw new ChatError(400, 'INVALID_NAME', 'Please use a name of 1–60 characters.');
  if (!message || message.length > LIMITS.message) throw new ChatError(400, 'INVALID_MESSAGE', 'Please write a note of 1–500 characters.');
  const submissionId = text('submissionId');
  if (!/^[a-f0-9]{32}$/.test(submissionId)) throw new ChatError(400, 'INVALID_SUBMISSION', 'Please refresh and try again.');
  return { name, message, submissionId };
};
const guestbookCursor = (value) => {
  if (value === null || value === undefined) return null;
  if (!/^[1-9]\d{0,15}$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new ChatError(400, 'INVALID_CURSOR', 'That page could not be loaded.');
  }
  return Number(value);
};
const listGuestbook = async (db, before) => {
  const cursor = guestbookCursor(before);
  const sql = 'SELECT id, name, message, created_at AS createdAt FROM guestbook_entries WHERE approved = 1';
  const statement = cursor === null
    ? db.prepare(`${sql} ORDER BY id DESC LIMIT 21`)
    : db.prepare(`${sql} AND id < ?1 ORDER BY id DESC LIMIT 21`).bind(cursor);
  const { results } = await statement.all();
  const entries = results.slice(0, LIMITS.page).map(({ id, name, message, createdAt }) => ({ id, name, message, createdAt }));
  const total = Number(await db.prepare('SELECT COUNT(*) AS total FROM guestbook_entries WHERE approved = 1').first('total')) || 0;
  return { entries, total, nextCursor: results.length > LIMITS.page ? String(entries.at(-1).id) : null };
};
const saveGuestbook = (db, note, now = new Date()) => db.prepare(
  'INSERT INTO guestbook_entries (submission_id, name, message, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(submission_id) DO NOTHING',
).bind(note.submissionId, note.name, note.message, now.toISOString()).run();

module.exports = { LIMITS, validateGuestbook, guestbookCursor, listGuestbook, saveGuestbook };
