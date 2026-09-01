-- يحوّل الدفع من اشتراك مدى الحياة لكل رقم جوال إلى دفعة 49 ريال مستقلة لكل رحلة (trip_id).
-- إضافي بالكامل: لا يحذف ولا يعدّل جدول subscriptions أو payment_events، ولا يفقد أي بيانات.
ALTER TABLE trips ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE trips ADD COLUMN moyasar_invoice_id TEXT;
ALTER TABLE trips ADD COLUMN paid_at INTEGER;
ALTER TABLE trips ADD COLUMN amount_sar INTEGER;

-- الرحلات المحفوظة قبل هذا التعديل دُفع مقابلها فعليًا عبر الاشتراك القديم — تُعتبر مدفوعة
-- تلقائيًا حتى لا يُطلب من صاحبها الدفع مرة أخرى مقابل محتوى يملكه بالفعل.
UPDATE trips SET payment_status = 'paid', paid_at = created_at WHERE payment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_trips_payment_status ON trips(payment_status);
CREATE INDEX IF NOT EXISTS idx_trips_moyasar_invoice ON trips(moyasar_invoice_id);
