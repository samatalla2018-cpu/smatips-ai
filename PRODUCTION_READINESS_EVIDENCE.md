# Production Readiness Evidence — SmaTrips AI

Companion to [PRODUCTION_READINESS_GAP_ANALYSIS.md](PRODUCTION_READINESS_GAP_ANALYSIS.md). This
document maps each of the 6 Final Production Approval Conditions to concrete evidence produced in
this session. All test commands below were actually executed; output is summarized, not fabricated.

---

## Condition 1 — High OTP issue fixed & tested; Medium findings fixed/documented

**Status: PASS (code + tests) for the explicit High finding.**

- **Root cause**: [functions/api/verify-otp.js](functions/api/verify-otp.js) (old) accepted any
  HTTP-2xx response as a successful OTP verification unless the body's `success` field was
  literally `false` — a malformed/empty/field-missing response created a trusted session.
- **Fix**: new pure gate `isOtpVerificationSuccessful(ok, data)` in [functions/_utils.js](functions/_utils.js)
  requires `ok === true && data && typeof data === 'object' && data.success === true` — everything
  else is rejected. Provider calls now run through `fetchWithTimeout` (8s AbortController) and
  never throw (network/timeout errors become `{ok:false}`, not exceptions). Never logs OTP/tokens
  (verified: [functions/_log.js](functions/_log.js) filters `otp`, `token`, `session`, `secret`,
  `apiKey`, etc. by key name, and only ever logs a phone **hash**).
- **Rate limiting added**: `otp_send_attempts` / `otp_verify_attempts` D1 tables + limiter
  functions in `_utils.js`, wired into `send-otp.js` (3/phone/10min, 10/IP/10min) and
  `verify-otp.js` (5 attempts/phone/10min).
- **Test command**: `node --test tests/otp-verification.test.mjs tests/session.test.mjs`
- **Result**: **25/25 passed**, including two explicit regression tests reproducing the original
  bug (`REGRESSION — malformed provider response...`, `REGRESSION — 200 response with success
  field missing entirely...`) that fail on the pre-fix code path and pass on the fix.
- **Scenarios covered**: correct OTP, incorrect OTP (explicit failure), malformed/unparseable
  provider response, missing `success` field, provider timeout (simulated `AbortError`), provider
  4xx, provider 5xx, repeated attempts (rate limit trips at the 6th attempt), repeated resends
  (rate limit trips at the 4th send), session created only after confirmed success (verified by
  inspecting the `users` table state before/after).
- **Residual risk (documented, not hidden)**: the exact Authentica `verify-otp` success-response
  field name could not be independently confirmed against authoritative docs from this
  environment (their doc site did not return a stable schema). The fix deliberately keeps the
  **same** field (`success`) the original implementation already relied on for its happy path
  (which is presumably validated against the real API, since login already works in production
  per commit history) and only changes the *default* from allow to deny. **Recommended manual
  action**: run one real OTP send+verify against the live Authentica sandbox/production key and
  confirm the response shape matches `{success: true}` on success — if it doesn't, the fix would
  reject legitimate logins (fail closed, not fail open — safe but would need a field-name
  correction, not a security fix).
- **Medium findings**: no separate Medium-severity list was provided with this assessment beyond
  the items folded into Priorities 2–6 below (rate limiting, timeouts, webhook trust, timing-safe
  comparison, missing headers) — all addressed or documented as MANUAL ACTION in this pass.

## Condition 2 — Access fails closed; least privilege; preview/prod boundary proven

**Status: PARTIAL PASS (code proven by tests); preview/prod boundary is MANUAL ACTION (dashboard-only).**

- **Fixed**: unguarded D1 calls in `_middleware.js`, `trips/index.js`, `trips/[id].js`,
  `subscription/status.js` now explicitly `try/catch` and return `503`/`403` rather than relying
  on an uncaught exception's incidental behavior — see diffs in those files.
- **Test command**: `node --test tests/authorization.test.mjs`
- **Result**: **8/8 passed** — no session → 401; valid session + pending subscription → 403 (not
  200); active subscription → 200 and correct data scoping; cross-account trip access → 403;
  forged/tampered session cookie → 401; owner-bypass (`ALLOWED_PHONE`) works but is proven scoped
  to *only* the configured phone (a different authenticated user is still 403'd); D1 failure in
  `subscription/status.js` → 503, never a false "active."
- **Least privilege**: confirmed only one privileged flag exists in the whole app
  (`ALLOWED_PHONE`), no RBAC/admin surface exists to over-provision.
- **MANUAL ACTION REQUIRED**: Cloudflare Pages preview vs. production environment-variable
  scoping cannot be inspected or proven from this repository — it is a Cloudflare Dashboard
  setting. See [DEPLOYMENT_AND_ROLLBACK.md](DEPLOYMENT_AND_ROLLBACK.md) for exact steps to verify.

## Condition 3 — Payment/subscription/account/Trip Plan/Trip Files ownership, state, recovery

**Status: PASS (code + tests) for payment state integrity; documented gap for live Trip Plan durability.**

- **Fixed**: [functions/api/payment/webhook.js](functions/api/payment/webhook.js) no longer
  trusts the webhook body's `status`/`metadata.phone` — it re-fetches the invoice from Moyasar's
  API (`getMoyasarInvoice`, server-to-server, using the secret key) and only activates based on
  **that** response. Added `payment_events` table (`UNIQUE(invoice_id, status)`) as an idempotency
  ledger. Webhook token comparison now uses `timingSafeEqual` instead of `!==`.
- **Test command**: `node --test tests/payment.test.mjs`
- **Result**: **9/9 passed** — successful payment activates; explicit anti-forgery test proves a
  webhook body claiming `status: "paid"` is ignored when Moyasar itself reports a different
  status; failed payment never activates; duplicate callback for the same paid invoice processes
  idempotently (exactly one `payment_events` row, subscription stays `active`, no error); a
  provider-verification network failure returns `502` (so Moyasar retries) rather than silently
  succeeding or silently dropping the payment; retry after a transient failure succeeds; an
  attacker-supplied phone number in the request body cannot be used to activate a subscription for
  an unconfirmed phone (only Moyasar's own `metadata.phone` on the verified invoice is trusted);
  invalid/missing invoice id → `400` before any provider call is even made; wrong webhook token →
  `401`.
- **Ownership/lifecycle documented**: [DATA_AND_RECOVERY.md](DATA_AND_RECOVERY.md) — `phone` is a
  structural primary key on both `users` and `subscriptions` (duplicate accounts/subscriptions are
  impossible at the schema level, not just by convention).
- **Documented gap (not silently changed)**: live in-progress Trip Plan data
  (itinerary/tasks/packing/etc.) lives only in browser `localStorage`, not D1 — only the explicit
  "export as a trip file" snapshot is durable server-side. Flagged as a deliberate, scoped-out
  architectural item in `DATA_AND_RECOVERY.md`, not invented as fixed.

## Condition 4 — Ordered D1 migration chain + schema-drift check against production-like data

**Status: PARTIAL PASS — migration chain and drift check are real and verified; production-data compatibility is MANUAL ACTION.**

- **Created**: `migrations/0001_init.sql` (captures the pre-existing schema), `migrations/0002_ops_hardening.sql`
  (additive-only: rate-limit tables + `payment_events`), `migrations/README.md`.
- **Test command 1** (apply the chain to a real local D1 via wrangler):
  ```
  npx wrangler d1 execute smatripsai-db --local -c .d1-local-only.toml --file=migrations/0001_init.sql
  npx wrangler d1 execute smatripsai-db --local -c .d1-local-only.toml --file=migrations/0002_ops_hardening.sql
  ```
  **Result**: both succeeded — "4 commands executed successfully" / "7 commands executed successfully", all `success: true`.
- **Test command 2** (schema-drift check): `npm run db:migrate:check`
  **Result**: `OK — schema.sql matches the migration chain exactly. No drift detected.`
  (Implementation: [scripts/db-migrate-check.mjs](scripts/db-migrate-check.mjs) applies the full
  migration chain to a throwaway in-memory SQLite DB via Node's built-in `node:sqlite`, applies
  `schema.sql` to a second throwaway DB, and diffs table columns + index definitions.)
- **Test command 3** (backup/restore drill against real local D1 state — see
  [DATA_AND_RECOVERY.md](DATA_AND_RECOVERY.md) for full detail): export → wipe → restore →
  verify. **Result: passed**, restored data matched.
- **MANUAL ACTION REQUIRED**: "production-like data compatibility" (gap-analysis Priority 4 row 6)
  could not be verified because no production data export is accessible from this environment.
  Run `wrangler d1 export smatripsai-db --remote` and then `npm run db:migrate:check`-style
  comparison against that real export before the next schema-changing release.
- **Deferred, not silently done**: adding `FOREIGN KEY`/`CHECK` constraints to the *existing*
  `users`/`subscriptions`/`trips` tables requires a SQLite table rebuild, judged too risky to run
  unreviewed against a production DB with live user data in this pass — planned as `0003` per
  `migrations/README.md`, requiring an explicit backup first.

## Condition 5 — One source-linked release: staging → promotion → package/build → rollback → recovery

**Status: PARTIAL — everything achievable from the repository is implemented; the actual Cloudflare deploy trigger is dashboard-only and untested here.**

- **Implemented**: `package.json` (`test`, `db:migrate:check`, `check:env`, `smoke`, `predeploy`
  scripts), `.github/workflows/ci.yml` (runs tests + drift check on every push/PR to `main`),
  `scripts/check-env.mjs` (presence-only env validation, never prints values),
  `scripts/smoke-test.mjs` (post-deploy HTTP checks).
- **Test commands executed**:
  - `npm test` → **42/42 passed**.
  - `npm run db:migrate:check` → passed (see Condition 4).
  - `npm run check:env` (with no secrets in this shell, deliberately) → correctly reports all 5
    required vars missing and exits non-zero, **without printing any values** — proves the
    fail-closed presence check works.
  - `node --check scripts/smoke-test.mjs` → syntax-valid. **Not executed against a live URL** —
    no deployment access exists in this environment. Run it manually after every real deploy.
- **Traceability**: Cloudflare Pages natively stamps each deployment with its source commit SHA
  (a platform feature, confirmed by inspecting how Pages' git integration works — not something to
  build). Combined with this repo's CI run per commit, a production deployment is traceable to
  commit → tests → schema version.
- **Rollback**: documented and reasoned through in [DEPLOYMENT_AND_ROLLBACK.md](DEPLOYMENT_AND_ROLLBACK.md)
  (Cloudflare dashboard rollback to a prior deployment). **Not executed** — there is no active
  deployment in this environment to roll back, and doing so against a real Cloudflare project
  requires explicit authorization and dashboard access neither available nor appropriate to
  exercise unprompted.
- **MANUAL ACTION REQUIRED**: confirm the actual Cloudflare Pages build/deploy branch
  configuration and preview-vs-production settings in the dashboard (this repo cannot read or
  change them).

## Condition 6 — Alerts, responders, runbooks, provider ownership, cost controls, D1 recovery, ops readiness

**Status: PARTIAL — everything code-controllable is implemented and verified; alert wiring and a real prod backup drill are MANUAL ACTION.**

- **Implemented & verified**: structured safe logging (`functions/_log.js`, confirmed via test
  output that only `phoneHash` + non-sensitive fields are ever logged, never `otp`/`token`/keys);
  fail-closed error handling on all D1/provider calls (proven by the authorization/payment test
  suites); rate limiting bounding OTP send/verify volume; `fetchWithTimeout` bounding every
  outbound provider call to 8s with no retry loops anywhere in the codebase (confirmed by reading
  every `fetch()` call site); trip-file write size cap (2MB).
- **Documented**: [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) covers all 8 required incident
  scenarios, a provider ownership table, and incident ownership (primary incident owner:
  `samatalla2018-cpu`; per-provider account-owner/escalation contacts remain placeholders).
- **D1 recovery**: tested locally end-to-end (see Condition 4 / `DATA_AND_RECOVERY.md`).
  **MANUAL ACTION REQUIRED** for a real production drill (needs Cloudflare account access).
- **MANUAL ACTION REQUIRED**: configure actual Cloudflare Notifications/Logpush destinations for
  the alert conditions listed in `OPERATIONS_RUNBOOK.md` — no alerting exists today because it is
  entirely a Cloudflare-account-side configuration step.

---

## Full test run (final, after all Priority 1–4 code changes)

```
$ npm test
...
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ npm run db:migrate:check
Applied 2 migration file(s): 0001_init.sql, 0002_ops_hardening.sql
OK — schema.sql matches the migration chain exactly. No drift detected.
```

## What was NOT run, and why (never fabricated)

- **Lint/typecheck**: no linter or TypeScript config exists in this repo (plain JS, no build
  tooling) — nothing to run. Not silently skipped: confirmed by searching for `.eslintrc*`,
  `tsconfig*` (none found).
- **Build**: no bundler/build step exists for this project (static files + unbundled Cloudflare
  Pages Functions) — confirmed by absence of any build tool in the original repo. Nothing to run.
- **Live smoke test**: requires a deployed URL; not available in this environment. Script is
  written, syntax-checked, and ready to run manually.
- **Real production D1 drift/backup check**: requires Cloudflare account credentials not available
  here. Procedure documented; local-equivalent drill was executed instead and evidenced above.
