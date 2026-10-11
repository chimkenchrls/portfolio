-- Counters for the portfolio API: the shared poke total ("pokes") and one row per
-- day for the chat budget ("chat:YYYY-MM-DD"). Safe to run more than once.
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
