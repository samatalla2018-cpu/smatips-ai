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

### Production vs. preview/staging separation — CONFIRMED (verified 2026-09-02)

Re-verified directly against the live Cloudflare Pages project (read-only, no settings changed):

```
$ wrangler pages secret list --project-name=smatripsai
production: ALLOWED_PHONE, AUTHENTICA_API_KEY, MOYASAR_SECRET_KEY,
            MOYASAR_WEBHOOK_SECRET, SESSION_SECRET, SUBSCRIPTION_PRICE_SAR
            (all 6 present, values encrypted/never printed)

$ wrangler pages secret list --project-name=smatripsai --env=preview
preview:    (no secrets — empty list)
```

Preview deployments have **zero** secrets bound — they cannot leak `AUTHENTICA_API_KEY`,
`SESSION_SECRET`, `MOYASAR_SECRET_KEY`, or `MOYASAR_WEBHOOK_SECRET` because none of those exist in
the Preview environment at all. This is the strongest possible form of separation (not just
"different values" but "not present"). One consequence: a Preview deployment cannot exercise the
OTP/payment flow end-to-end today (calls relying on those env vars will fail closed with a 500, not
silently use production credentials) — this is safe behavior, not a bug, but note it if a future
task wants a working Preview-based staging test of OTP/payment; that would require its own
test-mode credentials added to the Preview environment deliberately.

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

## CI status — LIVE and green (re-verified 2026-09-02)

`.github/workflows/ci.yml` exists and runs on every push/PR to `main` (`gh workflow list` → `CI
active`). The credential used for `git push` now carries the `workflow` OAuth scope (confirmed via
`gh auth status`: `gist, read:org, repo, workflow`), so the scope restriction described in the
superseded section below no longer blocks committing workflow files.

Re-verified directly against GitHub, not assumed:
- `gh run list --branch main` shows the most recent runs on `main` as `completed success`,
  including the run for the merge that brought this branch's work into `main`
  (`Merge pull request #2 from samatalla2018-cpu/fix-otp-session-restore` → `success`).
- `npm test` (55/55) and `npm run db:migrate:check` (no drift) — the same two steps the workflow
  runs — were re-executed locally during this audit and passed.

**This means: `main` currently has a real, working CI gate** (tests + schema-drift check on every
push/PR). Do not remove or "fix" `.github/workflows/ci.yml` based on the historical account below —
it now reflects a resolved, working state.

<details>
<summary>Historical record (superseded) — why CI was missing/failing earlier, kept for context only</summary>

`.github/workflows/ci.yml` did not exist in the repository as of the Priority 5 audit — verified
directly (`git ls-files .github/` returned nothing at the time). It was written once before
(commit `439e652`) and removed again in the very next commit (`d53bb1e`) because the pushing
credential available in that session lacked the `workflow` OAuth scope GitHub requires to create or
modify files under `.github/workflows/`. After the scope was granted, the workflow file was added
back, then went through a few failing iterations (wrong YAML indentation, a stale script name
`d1:migrate:check` that didn't match `package.json`'s actual `db:migrate:check` script, and a
Node-version mismatch against `package.json`'s `engines` field) before being corrected — see
`gh run list` history for the exact failing → passing sequence (commits `Fix CI workflow YAML
indentation`, `Fix CI: run tests on Node 24 to match package.json engines`, `Fix ci.yml: correct
YAML indentation and script name`). None of that history is still an open issue.

</details>

The workflow content, for reference (do not edit without a real reason — it is currently green):

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

      - name: Schema drift check (migrations vs schema.sql)
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
