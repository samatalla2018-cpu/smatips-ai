# Operations Runbook — SmaTrips AI

## Provider ownership / dependency map

| Provider | Used for | What breaks if it's down | Where credentials live |
|---|---|---|---|
| **Cloudflare Pages** | Hosting, Functions runtime, deploy pipeline | Entire site unreachable | Cloudflare account (MANUAL ACTION: record account owner/admins) |
| **Cloudflare D1** (`smatripsai-db`) | All persistent data (users, subscriptions, trips, rate-limit/payment event logs) | No login persistence, no trip saves, no subscription checks | Bound automatically via Pages Functions `env.DB` |
| **Authentica** (`api.authentica.sa`) | SMS OTP send/verify | Users cannot log in at all | `AUTHENTICA_API_KEY` (Cloudflare Pages env var) |
| **Moyasar** | Payment invoice creation + webhook | Users cannot pay / activate subscription | `MOYASAR_SECRET_KEY`, `MOYASAR_WEBHOOK_SECRET` (Cloudflare Pages env vars) |

**Incident ownership placeholders** (no real personnel are represented in this repository —
replace with actual names/contacts before relying on this runbook):
- **Primary on-call / incident commander**: `<TBD — assign an owner>`
- **Cloudflare account owner**: `<TBD>`
- **Authentica account owner**: `<TBD>`
- **Moyasar account owner**: `<TBD>`
- **Escalation contact**: `<TBD>`

## Alerting — what's implemented vs. what needs manual configuration

**Implemented in code** (this session): structured JSON logging via [functions/_log.js](functions/_log.js)
for OTP send/verify (success, failure, rate-limited), payment webhook processing (activated,
duplicate, provider-verify-failed), never including OTP codes, session tokens, or API keys —
verified by reading every log call site and by the test suite's captured log output.

**Requires manual configuration in Cloudflare (MANUAL ACTION REQUIRED)** — this repo cannot
create dashboard-side alert rules:

| Condition | How to detect it (using the logged events above) | Suggested Cloudflare mechanism |
|---|---|---|
| Authentication/OTP failure spike | Rate of `otp_verify_failed` events vs `otp_verify_success_session_created` | Cloudflare Logpush → your log sink (e.g. a SIEM/alerting tool) with a threshold alert; or Cloudflare Workers Analytics Engine if adopted later |
| Repeated rate-limit hits | Rate of `otp_send_rate_limited` / `otp_verify_rate_limited` | Same as above — a sudden spike suggests an attack, not normal usage |
| Payment failures / anomalies | `payment_webhook_provider_verify_failed` events, or absence of expected `payment_activated` events after a user completes checkout | Same as above |
| API error spikes (5xx) | Cloudflare's built-in **Pages → Analytics** already tracks status codes | Cloudflare Notifications (Dashboard → Notifications → add a new alert for HTTP 5xx rate on the Pages project) |
| D1 failures | The new fail-closed 503 responses (`_middleware.js`, `trips/*`, `subscription/status.js`) surface as 5xx in Pages Analytics | Same Cloudflare Notification as above |
| Deployment failures | Cloudflare Pages surfaces build/deploy failures in its dashboard and can email on failure | Cloudflare Dashboard → Pages project → Settings → confirm build-failure notifications are enabled |
| Critical application exceptions | Any uncaught exception becomes a Cloudflare Pages Functions error, visible via `wrangler pages deployment tail` or Logpush | Configure Logpush to a persistent sink (Cloudflare's live tail is not persistent) |

To act on these signals in real time, connect Cloudflare Logpush (or `wrangler pages deployment
tail` for ad-hoc/manual monitoring) to a destination your team actually watches — this is a
Cloudflare account configuration step, not something achievable purely from this codebase.

## Incident scenarios

### 1. Application outage (site unreachable / 5xx on everything)
1. Check Cloudflare status page (cloudflare.com/status) — rule out a platform-wide incident first.
2. Cloudflare Dashboard → Pages project → Deployments: confirm the latest deployment succeeded and is "Active".
3. `wrangler pages deployment tail` (or Logpush sink) for the error stack.
4. If the last deploy is the cause: **Rollback** — see [DEPLOYMENT_AND_ROLLBACK.md](DEPLOYMENT_AND_ROLLBACK.md).
5. After rollback/fix, run `npm run smoke` against production to confirm recovery.

### 2. Authentication/OTP outage (no one can log in)
1. Check for a spike in `otp_send_failed` / `otp_verify_failed` with `networkError: true` in logs — indicates Authentica itself is unreachable/erroring, not a bug in this app (the fail-closed design means a broken provider correctly shows as "login failing," which is expected safe behavior, not a bug to "fix" by loosening validation).
2. Confirm `AUTHENTICA_API_KEY` is still valid (Authentica dashboard/portal — MANUAL ACTION).
3. Check Authentica's own status/support channel.
4. Communicate to users via whatever channel is available (site banner, social — WhatsApp/TikTok links already in the footer) since there is no in-app status page today.

### 3. Payment failure (users can't subscribe / webhook not activating)
1. Check `payment_webhook_provider_verify_failed` logs — if present, Moyasar's invoice-lookup API is failing (network/credentials), not a logic bug.
2. Verify `MOYASAR_SECRET_KEY` / `MOYASAR_WEBHOOK_SECRET` are current (Moyasar dashboard — MANUAL ACTION).
3. Confirm the webhook URL configured in the Moyasar dashboard still points at `/api/payment/webhook?token=<MOYASAR_WEBHOOK_SECRET>` with the current secret.
4. For a specific stuck customer: check `subscriptions.status` for their phone via `wrangler d1 execute smatripsai-db --remote --command "SELECT * FROM subscriptions WHERE phone='<phone>'"`, and `payment_events` for their invoice id to see what Moyasar actually reported.
5. Never manually flip a subscription to `active` without confirming the invoice was genuinely paid via Moyasar's own dashboard — that would defeat the Priority 3 server-side verification fix.

### 4. D1/database failure
1. Symptoms: 503s from `_middleware.js`, `trips/*`, `subscription/status.js` (these now fail closed on DB errors rather than granting access — confirm this is what's happening, not a different bug).
2. Check Cloudflare D1 status in the dashboard.
3. If D1 itself is degraded, this is a platform incident — monitor Cloudflare status, no app-side fix exists.
4. Once restored, run `npm run smoke` to confirm.

### 5. Bad production release
1. Identify via failing smoke test or user reports immediately after a deploy.
2. Roll back per [DEPLOYMENT_AND_ROLLBACK.md](DEPLOYMENT_AND_ROLLBACK.md) (dashboard rollback is fastest).
3. Reproduce locally: `npm test` should have caught most logic regressions — if it didn't, add a regression test for the specific failure before re-deploying the fix.

### 6. Rollback (see also DEPLOYMENT_AND_ROLLBACK.md)
Quick reference: Cloudflare Dashboard → Pages → Deployments → previous good deployment →
"Rollback to this deployment." Database migrations in this change set are additive-only and safe
to leave in place during an app-code rollback.

### 7. Compromised secret/API key
1. **Immediately rotate the affected secret** at its source:
   - `AUTHENTICA_API_KEY` → Authentica portal → regenerate → update in Cloudflare Pages env vars.
   - `MOYASAR_SECRET_KEY` → Moyasar dashboard → regenerate → update in Cloudflare Pages env vars.
   - `MOYASAR_WEBHOOK_SECRET` → generate a new random value, update both the Cloudflare Pages env var **and** the webhook URL configured in Moyasar's dashboard (they must match).
   - `SESSION_SECRET` → generate a new random value, update in Cloudflare Pages env vars. **This immediately invalidates every existing session cookie** (all users are logged out) — that is the intended/safe behavior for a compromised session secret.
2. Redeploy (env var changes on Cloudflare Pages typically require a new deployment to take effect for existing deployments — trigger one, e.g. an empty commit or the dashboard's "retry deployment").
3. Review D1 (`otp_verify_attempts`, `payment_events`) for the affected window for signs of abuse.
4. Document the incident: what leaked, how, blast radius, remediation timestamp.

### 8. Provider outage (Authentica or Moyasar down, not a bug in this app)
1. Confirm via the provider's own status page/support.
2. The fail-closed design means this shows up as "login/payment failing safely," not as a security hole — do not attempt to bypass validation as a workaround.
3. Communicate an expected-delay message to users if the outage is prolonged.

## Cost-control / abuse protections implemented

| Protection | Where | Bound |
|---|---|---|
| OTP resend rate limit | `functions/api/send-otp.js` via `isOtpSendRateLimited` | 3 sends / phone / 10 min, 10 sends / IP / 10 min |
| OTP verify attempt rate limit | `functions/api/verify-otp.js` via `isOtpVerifyRateLimited` | 5 attempts / phone / 10 min |
| Provider call timeout | `functions/_utils.js` `fetchWithTimeout` (Authentica send/verify, Moyasar create/lookup) | 8s, always aborts rather than hanging indefinitely |
| Trip file write size cap | `functions/api/trips/index.js` | 2MB per trip HTML export |
| No unbounded retries anywhere | Reviewed — no retry loops exist in the codebase (all provider calls are single-attempt with a timeout, which is itself a safe default — no risk of a retry storm) | — |
| AI assistant external API calls | None exist yet — [js/pages/assistant.js](js/pages/assistant.js) `requestAssistantReply` is a local stub (`setTimeout` + canned message), verified by reading the file. No cost-control action needed until a real backend is wired up — **flag this runbook for an update when that happens.** | — |

## What still requires manual action (summary)

- Configure Cloudflare Notifications/Logpush for the alert conditions above.
- Fill in real incident-ownership contacts.
- Run a real production D1 backup/export and periodic restore drill (procedure in [DATA_AND_RECOVERY.md](DATA_AND_RECOVERY.md)).
- Confirm preview vs. production environment variable separation in the Cloudflare dashboard.
