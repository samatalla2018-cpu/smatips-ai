// محاكاة بسيطة وصادقة لواجهة Cloudflare D1 مبنية فوق node:sqlite (نفس محرك SQLite الذي
// تستخدمه D1 فعليًا) — تُستخدم في اختبارات التكامل لتشغيل كود دوال الـ endpoints الحقيقي
// (functions/api/**) بدون الحاجة لاتصال حقيقي بـ Cloudflare.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function createFakeD1() {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = join(root, 'migrations');
  const files = readdirSync(migrationsDir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  for (const file of files) {
    sqlite.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }

  return {
    _sqlite: sqlite,
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        bind: (...args) => ({
          first: async () => {
            const row = stmt.get(...args);
            return row === undefined ? null : row;
          },
          run: async () => {
            stmt.run(...args);
            return { success: true };
          },
          all: async () => ({ results: stmt.all(...args) }),
        }),
      };
    },
    async batch(boundStatements) {
      const results = [];
      for (const s of boundStatements) results.push(await s.run());
      return results;
    },
  };
}
