# D1 migrations

Ordered, idempotent SQL migration chain for the `smatripsai-db` D1 database. This directory is
the **source of truth** for the schema — [schema.sql](../schema.sql) at the repo root is a
generated convenience file (concatenation of all migrations in order) for quick local setup only.

## Files

| File | Purpose |
|---|---|
| `0001_init.sql` | Captures the schema as it existed before this migration chain was introduced (`users`, `subscriptions`, `trips`). |
| `0002_ops_hardening.sql` | Additive-only: `otp_send_attempts`, `otp_verify_attempts` (rate limiting), `payment_events` (webhook idempotency/audit ledger). |

## Rules

1. **Never edit a migration that has already been applied to any real environment.** Add a new numbered file instead.
2. Every migration must be **idempotent** (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) so re-running the chain is always safe.
3. A migration that alters or drops an existing table (schema-breaking or destructive) must:
   - be preceded by a documented backup step (see [../DATA_AND_RECOVERY.md](../DATA_AND_RECOVERY.md)),
   - be reviewed and explicitly approved before running against production,
   - never run automatically as part of CI/deploy.
4. After adding a migration, regenerate `schema.sql` (concatenate all migration files in numeric order under a header comment) so local setup stays in sync.

## Applying migrations

Local/dev database:

```bash
wrangler d1 execute smatripsai-db --local --file=migrations/0001_init.sql
wrangler d1 execute smatripsai-db --local --file=migrations/0002_ops_hardening.sql
```

Production (requires Cloudflare account access — run manually, never from an automated pipeline
without a reviewed approval step):

```bash
wrangler d1 execute smatripsai-db --remote --file=migrations/0002_ops_hardening.sql
```

## Schema-drift check

`scripts/db-migrate-check.mjs` applies the full migration chain to a throwaway local SQLite file
and diffs the resulting table/index definitions against [schema.sql](../schema.sql), failing if
they disagree. Run it before every promotion:

```bash
npm run db:migrate:check
```

This catches the case where `schema.sql` was hand-edited without a matching migration, or a
migration was added without regenerating `schema.sql` — i.e. schema drift between "what the
migration chain produces" and "what we believe the schema is."

## Planned (not yet applied) — 0003: constraints on existing tables

`users`, `subscriptions`, and `trips` currently lack `FOREIGN KEY`/`CHECK` constraints (SQLite
requires a table rebuild to add these to an existing table, which is riskier on a database with
live user data than an additive `CREATE TABLE IF NOT EXISTS`). A future `0003_constraints.sql` is
planned to add:

- `FOREIGN KEY (phone) REFERENCES users(phone)` on `subscriptions` and `trips`,
- `CHECK (status IN ('pending','active'))` on `subscriptions`.

This must be preceded by a full D1 backup/export and run in a maintenance window — see
[DATA_AND_RECOVERY.md](../DATA_AND_RECOVERY.md). Not included in this change set to avoid an
unreviewed destructive schema change on production data.
