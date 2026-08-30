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
   -> APPROVAL (PR review recommended before merge to main; automated CI-gated approval is
                 NOT currently live — see "CI status" below)
   -> MIGRATION (manually run any new migrations/*.sql against the remote D1 DB BEFORE merging
                  the code that depends on them — migrations are additive-only in this change set,
                  so they are safe to apply ahead of the code deploy)
   -> PRODUCTION (merge to main -> Cloudflare Pages auto-deploys)
   -> VERIFICATION (npm run smoke against the live production URL)
```

### Traceability

Every Cloudflare Pages deployment is natively stamped with the git commit SHA it was built from —
visible both in the Cloudflare dashboard's Deployments list and via
`wrangler pages deployment list` (each row's `Source` column). This is a platform feature, not
something this repo needs to add, and it does **not** depend on CI existing (verified live: current
production's `Source` matches `git rev-parse HEAD` exactly). Combined with:
- `npm test` output (run manually before pushing, until CI is added — see "CI status" below),
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

**Executed live against production** during the Priority 5 audit (2026-08-30): `BASE_URL=https://smatripsai.pages.dev npm run smoke` -> 6/6 checks passed. Re-run this after every deploy.

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

## CI status — NOT currently live (verified, root cause confirmed)

`.github/workflows/ci.yml` does **not** exist in this repository right now — verified directly
(`git ls-files .github/` returns nothing). It was written once before (commit `439e652`) and
removed again in the very next commit (`d53bb1e`) for a confirmed, reproducible reason: **GitHub
rejects any push that creates or modifies a file under `.github/workflows/` unless the pushing
credential has the separate `workflow` OAuth scope.** The credential available in this environment
does not have it — confirmed via `gh auth status` (scopes: `gist, read:org, repo` — no `workflow`).
This is not a one-off; the same restriction was hit and documented twice now, independently.

**This means: there is currently no automated CI gate on this repository.** Merges to `main` are
not blocked by test failures. Production deployment traceability (source commit -> deployed
artifact) does **not** depend on CI and remains fully intact regardless (see "Traceability" above,
and the live-verified evidence in the Priority 5 audit) — but the "tests must pass before promoting"
control described in the release flow above is currently a manual discipline (`npm test` before
pushing), not an enforced one.

**MANUAL ACTION REQUIRED to close this gap** — either:
1. Add the file below directly via the GitHub web UI (repo -> Actions tab -> "set up a workflow
   yourself", or Add file -> Create new file -> path `.github/workflows/ci.yml`), which is not
   subject to the OAuth scope restriction since it isn't a `git push`, or
2. Grant the `workflow` scope to whatever token/credential this environment uses for `git push`,
   after which the file below can be committed and pushed normally.

```yaml
name: CI

# يشغّل الاختبارات وفحص انحراف المخطط على كل push/PR — Cloudflare Pages لا ينشر إلى الإنتاج
# إلا من فرع main المتصل بلوحة Cloudflare، لكن هذا الـ workflow يمنع دمج main بكود لا يجتاز
# الاختبارات (بوابة قبل الترويج — راجع DEPLOYMENT_AND_ROLLBACK.md).

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Run automated tests (auth, OTP, authorization, payment)
        run: npm test

      - name: Schema-drift check (migrations vs schema.sql)
        run: npm run db:migrate:check
```

## Priority 5 audit evidence (2026-08-30, live-verified)

- Current production deployment (`wrangler pages deployment list --environment=production`) Source
  field matches `git rev-parse HEAD` exactly (`9292f4d`) — confirmed source-to-production
  traceability, not assumed.
- The immediately-prior deployment (commit `479eb81`, its own stable `https://<hash>.pages.dev`
  URL) was fetched directly and still serves the correct app — confirmed a working rollback target
  actually exists, not just listed.
- No Preview-environment deployments exist (`--environment=preview` returns an empty list) —
  confirmed clean staging isolation, no stray/ambiguous artifacts (the one that existed was found
  and removed during the Priority 2 audit).
- `wrangler pages` has no CLI rollback subcommand — rollback is a Cloudflare dashboard action only
  ("Rollback to this deployment" on a past deployment), as this doc already stated.
- No actual rollback was performed (not needed — production is healthy) and no Cloudflare dashboard
  settings were changed from this codebase (git-push-based CI cannot reach dashboard config either
  way).
