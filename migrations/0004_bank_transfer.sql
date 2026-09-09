-- 0004_bank_transfer.sql
-- يضيف طريقة دفع ثانية (تحويل بنكي يدوي) بجانب Moyasar الحالي — إضافي بالكامل، لا يعدّل ولا يحذف
-- أي جدول أو بيانات موجودة. كل طلب تحويل مرتبط بـ trip_id محدد (نفس مبدأ الدفع الحالي لكل رحلة).
--
-- حالة trips.payment_status لهذه الرحلة تبقى 'pending' طوال المراجعة (pending/under_review/rejected
-- في هذا الجدول) ولا تتحول إلى 'paid' إلا بعد اعتماد إداري صريح، عبر نفس activateTripPayment()
-- المستخدمة أصلًا لتفعيل مدفوعات Moyasar — لا يوجد نظام "فتح رحلة" منفصل.

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

-- يمنع على مستوى قاعدة البيانات نفسها (وليس فقط منطق التطبيق) وجود أكثر من طلب تحويل "نشط"
-- (pending أو under_review) لنفس trip_id في نفس اللحظة — خط دفاع إضافي ضد التكرار عند تسابق الطلبات.
CREATE UNIQUE INDEX IF NOT EXISTS idx_btr_trip_active
  ON bank_transfer_requests(trip_id)
  WHERE status IN ('pending', 'under_review');
