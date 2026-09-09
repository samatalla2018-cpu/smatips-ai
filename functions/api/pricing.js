import { jsonResponse } from '../_utils.js';

// عام بلا مصادقة عمدًا: السعر يُعرض أصلًا لزائر لم يسجّل الدخول بعد (بطاقة الدفع في معاينة
// الرحلة المجانية قبل OTP) — القيمتان مصدرهما env فقط، حتى لا يتكرر "69"/"89" في ملفات الواجهة.
export async function onRequestGet({ env }) {
  const priceSar = Number(env.SUBSCRIPTION_PRICE_SAR) || null;
  const regularPriceSar = Number(env.REGULAR_PRICE_SAR) || null;
  return jsonResponse({ price_sar: priceSar, regular_price_sar: regularPriceSar });
}
