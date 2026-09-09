-- ⚠️ ملف مولَّد — لا تُعدّله يدويًا. المصدر الحقيقي هو migrations/*.sql بالترتيب.
-- هذا الملف هو نتيجة تجميع كل الهجرات مرتبة رقميًا، ويُستخدم فقط كطريقة سريعة لإعداد
-- قاعدة بيانات محلية من الصفر (wrangler d1 execute --file=schema.sql). أي تعديل على المخطط
-- يجب أن يكون هجرة جديدة في migrations/ ثم تحديث هذا الملف بتشغيل توليده يدويًا.
-- راجع migrations/README.md لتفاصيل الترتيب والتحقق من عدم انحراف المخطط (schema drift).

-- ==== 0001_init.sql ====
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

-- ==== 0002_ops_hardening.sql ====
CREATE TABLE IF NOT EXISTS otp_send_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_send_phone_time ON otp_send_attempts(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_send_ip_time ON otp_send_attempts(ip, created_at);

CREATE TABLE IF NOT EXISTS otp_verify_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_verify_phone_time ON otp_verify_attempts(phone, created_at);

CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL,
  status TEXT NOT NULL,
  phone TEXT,
  processed_at INTEGER NOT NULL,
  UNIQUE(invoice_id, status)
);
CREATE INDEX IF NOT EXISTS idx_payment_events_invoice ON payment_events(invoice_id);

-- ==== 0003_trip_payments.sql ====
ALTER TABLE trips ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE trips ADD COLUMN moyasar_invoice_id TEXT;
ALTER TABLE trips ADD COLUMN paid_at INTEGER;
ALTER TABLE trips ADD COLUMN amount_sar INTEGER;

CREATE INDEX IF NOT EXISTS idx_trips_payment_status ON trips(payment_status);
CREATE INDEX IF NOT EXISTS idx_trips_moyasar_invoice ON trips(moyasar_invoice_id);

-- ==== 0004_bank_transfer.sql ====
CREATE TABLE IF NOT EXISTS bank_transfer_requests (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  trip_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  regular_price_sar INTEGER NOT NULL,
  amount_due_sar INTEGER NOT NULL,
  sender_name TEXT,
  reference_number TEXT,
  receipt_asset_key TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | under_review | paid | rejected
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  reviewed_by TEXT,
  reviewed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_btr_trip ON bank_transfer_requests(trip_id);
CREATE INDEX IF NOT EXISTS idx_btr_status ON bank_transfer_requests(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_btr_trip_active
  ON bank_transfer_requests(trip_id)
  WHERE status IN ('pending', 'under_review');
