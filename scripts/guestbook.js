'use strict';

// Owner-only CLI: database credentials stay in Wrangler, never in the website.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createLocalGuestbook } = require('../server/guestbook-local.js');

const main = async () => {
  const args = process.argv.slice(2);
  const remote = args.includes('--remote');
  const words = args.filter((arg) => !['--remote', '--local'].includes(arg));
  const [action, rawId] = words;
  const id = Number(rawId);
  if ((remote && args.includes('--local')) || !['list', 'approve', 'remove'].includes(action)
    || (action === 'list' ? words.length !== 1 : words.length !== 2 || !/^[1-9]\d*$/.test(rawId || '') || !Number.isSafeInteger(id))) {
    throw new Error('Usage: node scripts/guestbook.js list | approve ID | remove ID [--local | --remote]');
  }
  const sql = action === 'list'
    ? 'SELECT id, name, message, created_at, approved FROM guestbook_entries ORDER BY id DESC LIMIT 100'
    : action === 'approve' ? 'UPDATE guestbook_entries SET approved = 1 WHERE id = ?1' : 'DELETE FROM guestbook_entries WHERE id = ?1';
  if (remote) {
    // Only a validated integer is interpolated; visitor text never becomes SQL.
    const result = spawnSync('npx', ['wrangler', 'd1', 'execute', 'portfolio', '--remote', '--command', sql.replace('?1', String(id))], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    if (result.error) throw new Error('Wrangler could not start. Check your Node/npm installation.');
    process.exitCode = Number.isInteger(result.status) ? result.status : 1;
    return;
  }
  const db = createLocalGuestbook(path.join(__dirname, '../.local/guestbook.sqlite'));
  try {
    if (action === 'list') console.table((await db.prepare(sql).all()).results);
    else {
      const result = await db.prepare(sql).bind(id).run();
      console.log(Number(result.changes) ? `${action === 'approve' ? 'Approved' : 'Removed'} note ${id}.` : 'No matching note.');
    }
  } finally { db.close(); }
};
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
