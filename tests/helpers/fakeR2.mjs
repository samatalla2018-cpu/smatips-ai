// محاكاة بسيطة وصادقة كفاية لواجهة R2Bucket (put/get) — تُستخدم في اختبارات رفع إيصال التحويل
// البنكي بدون الحاجة لاتصال حقيقي بـ Cloudflare R2.

export function createFakeR2() {
  const store = new Map();
  return {
    async put(key, value, options = {}) {
      store.set(key, { value, httpMetadata: options.httpMetadata || {} });
      return { key };
    },
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return { body: entry.value, httpMetadata: entry.httpMetadata };
    },
    _store: store,
  };
}
