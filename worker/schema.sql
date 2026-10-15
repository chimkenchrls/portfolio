-- Counters for the portfolio API: the shared poke total ("pokes") and one row per
-- day for the chat budget ("chat:YYYY-MM-DD"). Safe to run more than once.
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- New notes are pending. Only approved notes can be read through the API.
CREATE TABLE IF NOT EXISTS guestbook_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0, 1))
);
CREATE INDEX IF NOT EXISTS guestbook_public ON guestbook_entries (approved, id DESC);
