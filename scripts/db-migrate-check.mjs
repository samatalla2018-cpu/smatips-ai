#!/usr/bin/env node
// Schema-drift check (Priority 4): applies the ordered migration chain to a throwaway
// in-memory SQLite database and compares the resulting schema against schema.sql (which is
// meant to be the generated concatenation of the same migrations). If they disagree, either
// schema.sql was hand-edited without a matching migration, or a migration was added without
// regenerating schema.sql — either way this is schema drift and must fail before promotion.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'migrations');

function buildFromMigrations() {
  const db = new DatabaseSync(':memory:');
  const files = readdirSync(migrationsDir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  if (files.length === 0) throw new Error('No migration files found in migrations/');
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.exec(sql);
  }
  return { db, files };
}

function buildFromSchemaSql() {
  const db = new DatabaseSync(':memory:');
  const sql = readFileSync(join(root, 'schema.sql'), 'utf8');
  db.exec(sql);
  return db;
}

function snapshotSchema(db) {
  const objects = db.prepare(
    "SELECT type, name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
  ).all();

  const snapshot = {};
  for (const obj of objects) {
    if (obj.type === 'table') {
      const columns = db.prepare(`PRAGMA table_info(${obj.name})`).all()
        .map((c) => `${c.name}:${c.type}:notnull=${c.notnull}:pk=${c.pk}:dflt=${c.dflt_value ?? ''}`)
        .sort();
      snapshot[`table:${obj.name}`] = columns;
    } else {
      // طبّع نص إنشاء الفهرس بإزالة الفروق التافهة (IF NOT EXISTS، المسافات)
      const normalized = (obj.sql || '').replace(/\s+/g, ' ').replace(/IF NOT EXISTS/i, '').trim();
      snapshot[`index:${obj.name}`] = [normalized];
    }
  }
  return snapshot;
}

function diffSnapshots(fromMigrations, fromSchemaSql) {
  const keys = new Set([...Object.keys(fromMigrations), ...Object.keys(fromSchemaSql)]);
  const problems = [];
  for (const key of keys) {
    const a = JSON.stringify(fromMigrations[key] || null);
    const b = JSON.stringify(fromSchemaSql[key] || null);
    if (a !== b) {
      problems.push({ object: key, fromMigrations: fromMigrations[key] || null, fromSchemaSql: fromSchemaSql[key] || null });
    }
  }
  return problems;
}

try {
  const { db: migrationsDb, files } = buildFromMigrations();
  const schemaSqlDb = buildFromSchemaSql();

  const fromMigrations = snapshotSchema(migrationsDb);
  const fromSchemaSql = snapshotSchema(schemaSqlDb);
  const problems = diffSnapshots(fromMigrations, fromSchemaSql);

  console.log(`Applied ${files.length} migration file(s): ${files.join(', ')}`);

  if (problems.length > 0) {
    console.error('\nSCHEMA DRIFT DETECTED — schema.sql does not match the migration chain:\n');
    for (const p of problems) {
      console.error(`  ${p.object}`);
      console.error(`    from migrations:  ${JSON.stringify(p.fromMigrations)}`);
      console.error(`    from schema.sql:  ${JSON.stringify(p.fromSchemaSql)}`);
    }
    console.error('\nRegenerate schema.sql from migrations/*.sql (in numeric order) and re-run this check.');
    process.exit(1);
  }

  console.log('OK — schema.sql matches the migration chain exactly. No drift detected.');
  process.exit(0);
} catch (err) {
  console.error('Migration check failed to run:', err.message);
  process.exit(1);
}
