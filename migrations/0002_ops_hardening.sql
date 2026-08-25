-- 0002_ops_hardening.sql
-- إضافات لا تُغيّر أو تحذف أي بيانات موجودة (Additive only — safe on a live production DB
-- with existing users/subscriptions/trips data). يضيف:
--   1) جداول تحديد المعدّل لطلبات OTP (إرسال/تحقق) — أولوية 1 من تقييم الجاهزية للإنتاج.
--   2) جدول سجل أحداث الدفع (payment_events) لتدقيق الويبهوك ومنع المعالجة المكررة بصمت — أولوية 3.
--
-- ملاحظة (أولوية 4): إضافة قيود FOREIGN KEY/CHECK على الجداول الموجودة (users/subscriptions/trips)
-- في SQLite/D1 تتطلب إعادة بناء الجدول (rebuild)، وهي عملية أكثر خطورة على قاعدة بيانات إنتاج
-- تحتوي بيانات حقيقية. تم تأجيلها عمدًا إلى هجرة منفصلة (0003) تُنفَّذ بعد نسخة احتياطية صريحة
-- وموافقة صاحب المنتج — راجع DATA_AND_RECOVERY.md.

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
