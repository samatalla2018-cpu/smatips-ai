# SmaTrips AI — Production Readiness Gap Analysis

Date: 2026-08-25
Scope: Full repository audit against the 24 Aug 2026 Production Readiness Assessment, Priorities 1–6.

## 0. Architecture summary (evidence)

- **Stack**: Static frontend (vanilla JS/HTML/CSS, no bundler, no `package.json` prior to this work) served by **Cloudflare Pages**, backed by **Cloudflare Pages Functions** in [functions/](functions/) and a single **Cloudflare D1** database.
- **Auth**: Phone + SMS OTP via **Authentica** ([functions/_utils.js](functions/_utils.js) `sendOtpViaAuthentica`/`verifyOtpViaAuthentica`), custom HMAC-SHA256 signed session cookie (`smatrips_session`), verified in [functions/_middleware.js](functions/_middleware.js).
- **Payments**: **Moyasar** invoices, created server-side in [functions/api/payment/create.js](functions/api/payment/create.js), activated via webhook [functions/api/payment/webhook.js](functions/api/payment/webhook.js) gated by a `?token=` shared secret.
- **Data**: `users`, `subscriptions`, `trips` tables in [schema.sql](schema.sql). No migrations directory existed — `schema.sql` is applied directly (evidence: [.d1-local-only.toml](.d1-local-only.toml) comment "أوامر D1 المحلية فقط").
- **Deployment**: No `wrangler.toml` (deliberately removed per commit `dff8f9a` to avoid overwriting Cloudflare Dashboard config). No `.github/` workflows. Deployment is presumed to be Cloudflare Pages' git-integration auto-deploy on push to `main` — **MANUAL ACTION REQUIRED** to confirm exact Cloudflare Pages project settings (build command, branch deploy config, preview-branch behavior) since none of that is visible from the repo.
- **Secrets**: `.dev.vars` is git-ignored (verified: `git check-ignore .dev.vars` → ignored). No API keys/secrets found in `js/`, `css/`, or `index.html` (verified via grep). Local `.dev.vars` is missing `MOYASAR_SECRET_KEY` (present in prod per commit `70dfa3c` presumably, but not confirmable from repo — **MANUAL ACTION REQUIRED** to verify Cloudflare Pages production env vars).

---

## PRIORITY 1 — OTP validation / trusted-session creation

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Endpoints inventoried | DONE | [send-otp.js](functions/api/send-otp.js), [verify-otp.js](functions/api/verify-otp.js), [logout.js](functions/api/logout.js), [_middleware.js](functions/_middleware.js) (session read/refresh-on-every-request-path), [payment/webhook.js](functions/api/payment/webhook.js) (unrelated callback but audited for pattern). No separate "refresh" endpoint exists — session is a stateless signed token re-verified per request. |
| 2a | Malformed provider response fails closed | **FAIL** | [functions/api/verify-otp.js:15-18](functions/api/verify-otp.js:15): `verifyOtpViaAuthentica` catches JSON-parse failure and returns `data = {}` ([_utils.js:69](functions/_utils.js:69)). The check `if (!ok \|\| data?.success === false)` only rejects when HTTP status is non-2xx **or** `data.success` is the literal boolean `false`. A 200 response with an empty/malformed/missing-`success`-field body passes the check and **creates a session**. This is the confirmed High-severity bug. |
| 2b | Timeout fails closed | **FAIL** (not tested, but not handled) | No `AbortController`/timeout on the `fetch()` calls in `sendOtpViaAuthentica`/`verifyOtpViaAuthentica`. A hang would hold the Worker until Cloudflare's platform-level timeout kills it (fails closed by accident, not by design), but a slow/successful-looking response has no bound. No explicit test coverage existed. |
| 2c | Missing expected fields fail | **FAIL** | Same root cause as 2a — `data.success === undefined` is treated as success. |
| 2d | Unexpected provider status fails | **FAIL** | Same — only HTTP `!res.ok` is treated as failure; any 2xx is treated as success regardless of body shape. |
| 2e | Invalid OTP never creates session | **FAIL** (in the ambiguous-response case) | Confirmed by the above; a *correctly-rejected* OTP (provider returns `success:false`) does correctly avoid session creation today — only the ambiguous/malformed path is broken. |
| 2f | Provider/API errors never = success | **FAIL** | Same defect. |
| 3 | No frontend-supplied values trusted for auth decisions | PASS | `verify-otp.js` only trusts `env.AUTHENTICA_API_KEY` (server secret) + the provider's own response; `phone`/`otp` from the client are just inputs to the provider call, not authorization decisions. |
| 4 | Explicit server-side validation before session | **FAIL** (fixed in Phase B) | See 2a. |
| 5a | OTP attempt rate limiting | **FAIL** | No rate limiting exists anywhere in the codebase (verified via grep for "rate", "limit", "throttle" — no matches). |
| 5b | Resend rate limiting | **FAIL** | Same. |
| 5c | Expiry handling | PARTIAL | Session token expiry is enforced ([_utils.js:29](functions/_utils.js:29) `data.exp <= Date.now()`). OTP-code expiry itself is entirely delegated to Authentica (no local tracking) — acceptable since Authentica is the OTP issuer, but there is no local record of *when* an OTP was requested to bound verify attempts to a window. |
| 5d | Replay protection | UNKNOWN | Whether Authentica invalidates an OTP after first successful use is an external-provider behavior not verifiable from this repo. **MANUAL ACTION REQUIRED**: confirm with Authentica docs/dashboard that verify-otp is single-use server-side. |
| 5e | Secure session/cookie config | PASS | [verify-otp.js:26](functions/api/verify-otp.js:26): `HttpOnly; Secure; SameSite=Lax`, signed with HMAC-SHA256, server-held `SESSION_SECRET`. |
| 5f | Correct callback validation | PASS (payment), N/A (no auth callback) | Auth has no separate callback/webhook. Payment webhook validated in Priority 3. |
| 6 | OTP/tokens never logged | PASS | Verified via grep — no `console.log`/logging of `otp`, `body`, or session tokens anywhere in `functions/`. |
| 7 | Automated tests | **FAIL** (no test framework existed) | No `package.json`, no test runner, no test files anywhere in the repo prior to this work. |

**Acceptance condition: NOT MET prior to Phase B.** Fixed in Phase B — see `PRODUCTION_READINESS_EVIDENCE.md`.

---

## PRIORITY 2 — Fail-open access / least privilege

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Fail-open routes identified | PARTIAL | See rows below — the only real gate is `_middleware.js` (page routing) plus per-endpoint checks in each `functions/api/**` file. No dedicated admin surface exists in this app (grep for "admin" across the repo found no matches). |
| 2 | Missing-auth → access | PASS | [_middleware.js:420](functions/_middleware.js:420): `if (!session) return loginHtml()` — fails closed (returns login page, not `next()`). Every `functions/api/**` handler independently calls `verifySessionToken` and returns 401 on failure — verified in send-otp is public-by-design (pre-auth), verify-otp is public-by-design (pre-auth), logout is stateless, payment/create, subscription/status, trips/index, trips/[id] all check session first and return 401/error responses, never `next()`/pass-through, if the check fails. |
| 3 | Authorization-check-throws → access | PARTIAL | `verifySessionToken` is wrapped in try/catch internally and returns `null` on any exception ([_utils.js:31](functions/_utils.js:31)) → correctly fails closed. However `getSubscriptionStatus`, `getTripById`, and the Authentica/Moyasar `fetch()` calls have **no try/catch** in the calling endpoints — an unhandled exception (e.g. D1 outage) becomes an uncaught promise rejection, which Cloudflare Pages Functions turns into a generic 500 (fails closed for auth purposes, but ungraceful and not attributable — addressed in Phase B/Priority 6 as structured error handling). |
| 4 | Missing config → access | PASS | `send-otp.js` and `payment/create.js` explicitly check `env.AUTHENTICA_API_KEY`/`env.MOYASAR_SECRET_KEY` presence and return `500` rather than proceeding. `verify-otp.js` did **not** guard `env.AUTHENTICA_API_KEY` missing (would call fetch with `undefined` header, provider would presumably reject — but this was unverified/implicit, not explicit fail-closed) — hardened in Phase B. |
| 5 | Unknown role → access | N/A | App has exactly one privileged role: `ALLOWED_PHONE` owner bypass ([_middleware.js:425](functions/_middleware.js:425), [trips/index.js:7](functions/api/trips/index.js:7), [trips/[id].js:10](functions/api/trips/[id].js:10)). No RBAC/role table exists. The owner-bypass logic is `if (isOwner) return next()` / grant — never a default-allow for *unrecognized* roles, since there are none. |
| 6 | Upstream-service-fails → access | PASS (auth), **FAIL** (fixed — OTP) | Middleware: if `getSubscriptionStatus` throws, the request 500s rather than granting access (uncaught rejection → error page, not `next()`). OTP: this **was** the Priority-1 bug — a "successful-looking but malformed" upstream response was treated as authoritative success. |
| 7 | Least privilege reviewed | PASS | Single owner-bypass flag, phone-scoped data access everywhere (`trip.phone !== session.phone` check in [trips/[id].js:17](functions/api/trips/[id].js:17)). No excessive privilege found to reduce. |
| 8 | Admin/privileged ops protected | N/A | No admin routes exist in this app. |
| 9 | Backend authz independent of frontend | PASS | Confirmed: `js/app.js` payment-success overlay is purely cosmetic (`maybeShowPaymentSuccess`) and does **not** grant access — real gating is server-side `getSubscriptionStatus` re-checked on every page load via `_middleware.js`. |
| 10 | No security via hidden buttons only | PASS | Subscribe buttons are shown/hidden client-side ([app.js:162](js/app.js:162)) purely as UX; the actual paywall is enforced server-side regardless of button visibility. |
| 11 | Prod secrets not exposed to preview | UNKNOWN / **MANUAL ACTION REQUIRED** | Cloudflare Pages preview-deployment environment variable scoping is a **dashboard setting**, not visible from this repo. Must be verified in Cloudflare Pages project settings (Settings → Environment variables → confirm Production vs Preview variables are distinct, and that `AUTHENTICA_API_KEY`/`MOYASAR_SECRET_KEY`/`SESSION_SECRET`/`MOYASAR_WEBHOOK_SECRET` are **not** shared with preview deployments, since preview URLs are semi-public). |
| 12 | Authorization tests | **FAIL** (none existed) | Addressed in Phase B alongside Priority 1 tests. |

**Acceptance condition: PARTIAL.** Code-level authorization already fails closed almost everywhere; the concrete gap was the OTP issue (Priority 1) and the unverifiable preview/production secret boundary (external dashboard, flagged MANUAL ACTION).

---

## PRIORITY 3 — Payment / subscription / account / trip lifecycle

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Payment workflow mapped | DONE | `payment/create.js` creates a Moyasar invoice tied to `session.phone`, stores `moyasar_invoice_id` on the `subscriptions` row ([_utils.js:88](functions/_utils.js:88) `attachInvoiceToSubscription`). `payment/webhook.js` receives Moyasar's callback, checks `status` text, and calls `activateSubscriptionByInvoiceId`/`activateSubscriptionByPhone`. |
| 2 | One authoritative server-side payment state | PASS | `subscriptions.status` in D1 is the single source of truth; both `_middleware.js` and `trips/*` re-query it server-side per request. |
| 3 | Frontend never declares payment success | PASS | Confirmed above (Priority 2 row 9) — `?payment=return` only triggers a UI overlay + a poll of `/api/subscription/status`; it does not set any client-trusted flag. |
| 4 | Payment status validated with provider server-side before granting access | **FAIL** | `payment/webhook.js` trusts the **webhook body's own `status` field** after only checking the `?token=` shared secret. It never calls back to Moyasar's API (`GET /v1/invoices/:id`) to independently confirm the invoice is actually `paid`. If the webhook secret is ever leaked (e.g., pasted into a log, shared link, browser history on a shared machine), an attacker who reaches the endpoint could POST an arbitrary `{"status":"paid","metadata":{"phone":"<victim-or-attacker-phone>"}}` and activate a subscription with **no real payment**. Fixed in Phase B: webhook now re-fetches the invoice from Moyasar's API using the secret key and only activates if Moyasar itself reports `status: paid`. |
| 5 | Idempotent payment operations | PARTIAL | `activateSubscriptionByInvoiceId`/`activateSubscriptionByPhone` are naturally idempotent (`UPDATE ... SET status='active'` is safe to repeat — repeated webhook delivery just re-sets the same state, no duplicate charge, no duplicate row). However there is no idempotency **ledger** (no `payment_events` table), so duplicate/replayed webhook calls are indistinguishable from new ones in any audit trail — addressed in Phase B (Priority 4 migration adds a `payment_events` table with a unique constraint on `(invoice_id, status)` to make processing auditable and to reject true duplicates explicitly rather than silently). |
| 6 | Explicit states | PASS | `pending` → `active` (see schema). This matches Moyasar's own invoice model reasonably (`initiated/paid/failed`); introducing extra states was judged unnecessary — kept minimal per instructions. |
| 7 | Subscription activation follows verified payment | **FAIL → FIXED** | See row 4. |
| 8 | Ownership/lifecycle rules for Account / Trip Plan / Trip Files | PARTIAL | Account = phone number, 1:1 with `subscriptions`, created via `INSERT OR IGNORE` on first OTP verification (no duplicate accounts possible — `phone` is the primary key). Trip Plan/Trip Files = rows in `trips`, owned by `phone`, access-checked on every read ([trips/[id].js:17](functions/api/trips/[id].js:17)). No documented policy for retention/deletion (no account-deletion or trip-deletion endpoint exists at all — not a bug, just an absent feature; documented as a gap in `DATA_AND_RECOVERY.md` rather than invented). |
| 9 | Interrupted operations recover safely | PARTIAL | `payment/create.js` creates the Moyasar invoice **then** attaches it to the subscription row; if the Worker crashes between those two steps, the invoice exists at Moyasar but isn't linked in D1 — the webhook's invoice-id lookup would then miss, though the `phone`-based fallback (`activateSubscriptionByPhone`) still recovers it. Documented as an accepted small race, not a data-corruption risk (no double charge — Moyasar invoice creation isn't itself a charge). |
| 10 | Orphan/ambiguous/duplicate records | PASS (schema-enforced) | `phone` is `PRIMARY KEY` on both `users` and `subscriptions` — duplicate accounts/subscriptions are structurally impossible. `trips.id` is a `crypto.randomUUID()` primary key. |
| 11 | Tests | **FAIL** (none existed) | Added in Phase B: webhook validation tests (duplicate callback, invalid invoice id, unauthorized token, provider-confirms-paid vs not). |

**Acceptance condition: PARTIAL → addressed in Phase B** (server-side Moyasar verification + payment_events ledger).

---

## PRIORITY 4 — D1 migrations, schema drift, structured Trip Plan storage

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Current schema/migrations inspected | DONE | Single file [schema.sql](schema.sql), no migrations directory, no version tracking. |
| 2 | One ordered migration chain | **FAIL → FIXED** | Created `migrations/0001_init.sql` (captures current schema.sql state) and `migrations/0002_ops_hardening.sql` (adds `otp_send_attempts`, `otp_verify_attempts`, `payment_events` tables + indexes/constraints needed by Phase B). Added `migrations/README.md` documenting the ordering/apply process, plus a `scripts/db-migrate-check.mjs` schema-drift check. |
| 3 | No silent out-of-migration schema mutation | PASS going forward | `schema.sql` is now generated *from* the migration chain (documented), not hand-edited independently. |
| 4 | Every table/index/constraint creatable from migration history | PASS (verified locally) | See Phase B evidence — migrations applied to a throwaway local D1/SQLite and diffed against `schema.sql`. |
| 5 | Schema-drift check before promotion | **FAIL → FIXED** | Added `scripts/db-migrate-check.mjs` (Node, uses `node:sqlite`/wrangler d1 locally) — see `DEPLOYMENT_AND_ROLLBACK.md`. |
| 6 | Production-like data compatibility | UNKNOWN | No production data snapshot available in this environment — **MANUAL ACTION REQUIRED**: run the drift check against a real D1 export before the next release (`wrangler d1 export`). |
| 7 | Trip Plan stored in structured/validated model | PARTIAL (by design, not a bug) | `trips.html_content` stores a fully-rendered, self-contained downloadable HTML trip file (this is a deliberate product feature — a portable offline trip document, confirmed by [tripfile.js](js/tripfile.js) and the "رحلاتي" download flow). The *live* trip-planning data (itinerary, tasks, packing list, etc.) is **not** stored in D1 at all today — it lives in client-side `localStorage` via [js/store.js](js/store.js), and `trips.html_content` is only a serialized export snapshot. This is a genuine architectural gap for durability (a user's in-progress trip plan is not backed up server-side) but changing where live trip data lives is a large, product-shaping change explicitly out of scope for a security/reliability readiness pass — **flagged, not silently changed**, per the instruction to preserve existing UX/features. Server-side write validation for the export endpoint was hardened in Phase B (title/html type + size bounds) without changing the storage model. |
| 8 | Validation before DB writes | PARTIAL → improved | `trips/index.js` already checked `html` is a non-empty string; Phase B adds a size cap (prevent unbounded blob writes) and title length/type validation. |
| 9 | PKs/FKs/uniqueness/indexes/timestamps/status constraints | PARTIAL | PKs present on all 3 tables; `idx_trips_phone` exists. No `FOREIGN KEY` from `trips.phone`/`subscriptions.phone` to `users.phone` (D1/SQLite supports FKs) — added in migration 0002. No `CHECK` constraint on `subscriptions.status` — added. |
| 10 | Deterministic/repeatable migrations | PASS (new) | Plain ordered `.sql` files, each idempotent (`IF NOT EXISTS` guards). |
| 11 | Backup/recovery documented before destructive changes | **FAIL → FIXED** | Documented in `DATA_AND_RECOVERY.md`. No destructive migration is included in this change set (only additive). |

**Acceptance condition: PARTIAL → addressed in Phase B**, with one item (production-like data compatibility) requiring MANUAL ACTION since no prod data export is accessible from this environment.

---

## PRIORITY 5 — Source-linked controlled release process

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1–2 | Current deployment inspected | DONE | No `wrangler.toml`, no CI config. Deployment is Cloudflare Pages' git-integration (push-to-deploy), configured entirely in the Cloudflare dashboard — **not visible or controllable from this repo**. |
| 3 | Controlled SOURCE→BUILD→TEST→STAGING→APPROVAL→MIGRATION→PROD→VERIFY flow | **FAIL → PARTIAL FIX** | Added `package.json` with `test`/`smoke`/`db:migrate:check` scripts, and `DEPLOYMENT_AND_ROLLBACK.md` documenting the intended flow given Cloudflare Pages' actual capabilities (preview deployments per-branch/PR = staging, promotion = merge to `main`). A GitHub Actions workflow (`.github/workflows/ci.yml`) was added to run tests+drift-check on every push/PR so `main` cannot merge red — this **gates merges**, but the actual Pages **deploy** step itself still happens via Cloudflare's own git integration (a Cloudflare account setting), which this repo cannot change without dashboard access. |
| 4 | Traceability to commit SHA/build/migration/env | PARTIAL | Cloudflare Pages natively stamps each deployment with the commit SHA (visible in the Cloudflare dashboard) — this already exists as a platform feature, not something to build. Added a `/api/version` style convention documented (not overengineered into a new endpoint since no build step injects one today) — see evidence doc for exact recommendation. |
| 5 | No accidental deploy of uncommitted code | PASS (platform-enforced) | Cloudflare Pages git-integration only ever deploys what was pushed to the connected branch — there is no local/manual deploy path in this repo (no `wrangler deploy` script existed). |
| 6 | Prod vs preview config separated | UNKNOWN / **MANUAL ACTION REQUIRED** | Dashboard setting, not in repo — same item as Priority 2 row 11. |
| 7 | Required env vars validated before deploy | **FAIL → FIXED** | Added `scripts/check-env.mjs`, wired into `npm run predeploy`, checks all required bindings/vars are declared (does not read values, only presence, so it never prints secrets). |
| 8 | Deployment smoke tests | **FAIL → FIXED** | Added `scripts/smoke-test.mjs` (hits `/`, `/api/subscription/status` unauthenticated-expect-401, etc. against a given base URL). |
| 9 | Documented rollback | **FAIL → FIXED** | `DEPLOYMENT_AND_ROLLBACK.md`. |
| 10 | Rollback accounts for DB compatibility | **FAIL → FIXED** | Documented — migrations in this change are additive-only, so any rollback of app code remains schema-compatible; documented rule that future migrations must stay backward-compatible for one release cycle. |
| 11 | CI scripts | **FAIL → FIXED** | `package.json` scripts + `.github/workflows/ci.yml`. |

**Acceptance condition: PARTIAL.** Everything controllable from the repository is implemented; the actual production deploy trigger is a Cloudflare account/dashboard setting outside this codebase's control — flagged MANUAL ACTION, not faked.

---

## PRIORITY 6 — Monitoring, incident response, recovery, ops readiness

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | App/server logging without sensitive data | PARTIAL → improved | Added minimal structured logging helper ([functions/_log.js](functions/_log.js)) used in the hardened OTP/payment paths — logs event name + phone **hash** (not raw phone) + outcome, never OTP/tokens/keys. |
| 2 | Error handling / structured error reporting | PARTIAL → improved | Wrapped previously-unguarded upstream calls (Authentica, Moyasar, D1) in try/catch returning safe fail-closed responses + a logged error code. |
| 3 | Critical failure alerts identified | **FAIL → DOCUMENTED** | No alerting exists (Cloudflare-side, e.g. Notifications/Logpush, is external). Alert *conditions* and *where to wire them* documented in `OPERATIONS_RUNBOOK.md` — **MANUAL ACTION REQUIRED** to actually configure Cloudflare Notifications/Logpush/a third-party monitor, since that's dashboard/external-service work. |
| 4 | Code vs manual clearly separated | DONE | Called out explicitly throughout this doc and in the runbook. |
| 5 | Ops runbook | **FAIL → FIXED** | `OPERATIONS_RUNBOOK.md` covers all 8 required scenarios. |
| 6 | Incident ownership placeholders | **FAIL → FIXED** | All incident-ownership roles assigned in `OPERATIONS_RUNBOOK.md` (primary incident owner, Cloudflare/Authentica/Moyasar account owner, escalation contact — all `samatalla2018-cpu`). |
| 7 | Provider ownership/dependency docs | **FAIL → FIXED** | Table in `OPERATIONS_RUNBOOK.md` (Authentica, Moyasar, Cloudflare). |
| 8–9 | D1 backup/recovery tested/documented | **FAIL → PARTIALLY FIXED** | Recovery *procedure* documented and a local dry-run performed against a throwaway D1 (`wrangler d1 export`/`import` cycle) — see `DATA_AND_RECOVERY.md`. A **real production** backup/restore drill requires Cloudflare account access — MANUAL ACTION REQUIRED. |
| 10 | Cost-control protections | PARTIAL → improved | OTP rate limiting (new) bounds Authentica API call volume per phone; added fetch timeouts (bounded retries N/A — no retries exist, which is itself safe/bounded); the AI assistant is currently a **stub with no external API calls** (verified — [js/pages/assistant.js:29](js/pages/assistant.js:29) `requestAssistantReply` is a local `setTimeout` mock, not a real API call), so there is no uncontrolled-API-loop risk today from that feature. |

**Acceptance condition: PARTIAL.** Everything code-controllable is implemented and documented; alerting/notification configuration and a real production D1 backup drill require Cloudflare dashboard access (MANUAL ACTION REQUIRED, documented with exact steps).

---

## Summary of confirmed FAIL items fixed in Phase B

1. OTP verification fail-open (Priority 1) — **the explicit High-severity finding**.
2. Missing OTP send/verify rate limiting (Priority 1).
3. No fetch timeouts on provider calls (Priority 1/6).
4. Payment webhook trusting client-supplied status without server-to-server confirmation (Priority 3).
5. No migration chain / schema-drift check (Priority 4).
6. No automated tests of any kind (Priority 1/2/3/4/5).
7. No CI, no env-var validation, no smoke test, no rollback doc (Priority 5).
8. No ops runbook / recovery documentation (Priority 6).

## Items requiring MANUAL ACTION (cannot be completed from this codebase)

See the "Manual actions" section of the final report for exact steps. Summary list:
- Verify Cloudflare Pages preview vs production environment-variable scoping.
- Verify Cloudflare Pages build/deploy branch configuration.
- Configure Cloudflare Notifications/Logpush (or a third-party monitor) for the alert conditions documented in `OPERATIONS_RUNBOOK.md`.
- Run a real production D1 backup/export and a restore drill.
- Confirm Authentica OTP single-use/replay behavior via their dashboard/docs.
- Add `MOYASAR_SECRET_KEY` (and confirm all other required vars) are set in the **production** Cloudflare Pages environment (already presumably done per commit history, but not verifiable from this repo).
