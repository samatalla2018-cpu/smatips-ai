CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  phone TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  moyasar_invoice_id TEXT,
  paid_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  title TEXT NOT NULL,
  html_content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trips_phone ON trips(phone);
