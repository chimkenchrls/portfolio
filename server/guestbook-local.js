'use strict';

// Node-only adapter for the same prepared statements as D1. Never published.
const fs = require('node:fs');
const path = require('node:path');
const createLocalGuestbook = (filename) => {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec(fs.readFileSync(path.join(__dirname, '../worker/schema.sql'), 'utf8'));
  return {
    close: () => sqlite.close(),
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const bound = (values = []) => ({
        all: async () => ({ results: statement.all(...values) }),
        first: async (column) => { const row = statement.get(...values); return row ? column ? row[column] : row : null; },
        run: async () => statement.run(...values),
      });
      return { ...bound(), bind: (...values) => bound(values) };
    },
  };
};
module.exports = { createLocalGuestbook };
