# Deployment & Rollback — SmaTrips AI

## Current deployment mechanism (as found)

Cloudflare Pages **git integration**: pushing to `main` on GitHub (`samatalla2018-cpu/smatips-ai`)
triggers Cloudflare to build and deploy automatically. There is no `wrangler.toml` in this repo
(deliberately removed — commit `dff8f9a` — so it can't clobber the Cloudflare Dashboard's own
build/env config), and no local/manual `wrangler pages deploy` path exists in this codebase.
**This means the actual deploy trigger and its configuration (build command, output directory,
branch mapping, preview-deployment behavior) live entirely in the Cloudflare dashboard and are
not controllable or verifiable from this repository — MANUAL ACTION REQUIRED to confirm.**

## Controlled release flow (what this repo now enforces)

```
SOURCE (git commit on a branch)
   -> BUILD (none needed — static files + Functions, no bundler)
   -> TEST (npm test — 42 automated tests: OTP fail-closed, authorization, payment webhook)
   -> STAGING/PREVIEW (Cloudflare Pages auto-creates a preview deployment for every
                         non-main branch/PR — this is the de-facto staging environment)
   -> APPROVAL (PR review + green CI required before merge to main — see .github/workflows/ci.yml)
   -> MIGRATION (manually run any new migrations/*.sql against the remote D1 DB BEFORE merging
                  the code that depends on them — migrations are additive-only in this change set,
                  so they are safe to apply ahead of the code deploy)
   -> PRODUCTION (merge to main -> Cloudflare Pages auto-deploys)
   -> VERIFICATION (npm run smoke against the live production URL)
```

### Traceability

Every Cloudflare Pages deployment is natively stamped with the git commit SHA it was built from
(visible in the Cloudflare dashboard's Deployments list) — this is a platform feature, not
something this repo needs to add. Combined with:
- `npm test` output (attached to the CI run for that commit),
- `npm run db:migrate:check` output (schema state at that commit),
- the migration file(s) present at that commit (`migrations/`),

...a given production deployment is fully traceable to: commit SHA -> test results -> schema
version -> environment. There is no separate "build" artifact to version (no bundler), so
source commit SHA *is* the build identifier here.

### Preventing accidental deploys of uncommitted/unreviewed code

This is already structurally true: Cloudflare Pages' git integration only ever deploys what was
pushed to the connected branch. There is no local `wrangler deploy` script in this repo, so there
is no path for a developer to push straight to production from their machine.

### Production vs. preview/staging separation

**MANUAL ACTION REQUIRED** (Cloudflare Dashboard → Pages project → Settings → Environment
variables): confirm that `AUTHENTICA_API_KEY`, `SESSION_SECRET`, `MOYASAR_SECRET_KEY`,
`MOYASAR_WEBHOOK_SECRET` are set **separately** for Production and Preview, and that Preview does
not silently inherit Production secrets (preview URLs are `*.smatripsai.pages.dev`-style and are
reachable by anyone with the link — they must not carry production payment/OTP credentials for a
real customer-facing Authentica/Moyasar account, or use test-mode credentials there instead).

## Environment variable validation before deploy

`scripts/check-env.mjs` (wired into `npm run predeploy`) checks presence (never value) of:
`AUTHENTICA_API_KEY`, `SESSION_SECRET`, `MOYASAR_SECRET_KEY`, `MOYASAR_WEBHOOK_SECRET`,
`SUBSCRIPTION_PRICE_SAR`. Run it against whatever shell/CI environment has pulled the relevant
values before a deploy that depends on them.

## Deployment smoke test

```bash
BASE_URL=https://<your-deployment>.pages.dev npm run smoke
```

Checks (no credentials required, sends no real OTP/payment):
- home page returns HTML,
- `/api/subscription/status` and `/api/trips` reject unauthenticated requests with 401 (never 200),
- `/api/send-otp` rejects a missing phone with 400 (not 500),
- `/api/verify-otp` never returns 200/sets a cookie for an unverified code,
- `/api/payment/webhook` rejects a wrong token with 401.

This script was written and syntax-validated in this session but **not executed against a live
URL**, since no deployment access is available from this environment — run it manually against
the actual preview/production URL as part of every release.

## Rollback procedure

Application code:
1. Cloudflare Pages keeps every previous deployment. In the dashboard: **Pages project →
   Deployments → select the last known-good deployment → "Rollback to this deployment"**
   (or: revert the bad commit on `main` and let CI/CD redeploy — slower but keeps git history
   linear; the dashboard rollback is faster for an active incident).
2. After rollback, immediately run `npm run smoke` against the production URL to confirm.

Database compatibility during rollback:
- All migrations in this change set (`migrations/0001_init.sql`, `0002_ops_hardening.sql`) are
  **additive only** (new tables/indexes, no column drops, no type changes). Rolling application
  code back to a version that predates these tables is safe — the old code simply never queries
  the new tables.
- **Rule for all future migrations**: keep every migration backward-compatible with the
  previous release's code for at least one full release cycle (i.e. never drop/rename a column or
  table in the same migration that the code stops using it — do it in a follow-up migration after
  the rollback window has passed). This is what makes "rollback app code without a matching DB
  rollback" safe in general, not just for this change set.
- If a future migration is ever destructive, the rollback plan must include a tested D1 restore
  procedure — see [DATA_AND_RECOVERY.md](DATA_AND_RECOVERY.md).

## CI

`.github/workflows/ci.yml` runs `npm test` and `npm run db:migrate:check` on every push/PR to
`main`. This gates *merges*, not the Cloudflare *deploy* step itself (which remains a Cloudflare
account setting outside this repo's control) — but since production only deploys what's on `main`,
and CI must be green to responsibly merge to `main`, this closes the practical gap.

## What was NOT done (explicitly, not silently)

- No actual production deployment or migration was performed in this session — per the
  instruction not to perform irreversible production changes without explicit approval.
- No real Cloudflare dashboard settings were changed (cannot be, from this codebase).
