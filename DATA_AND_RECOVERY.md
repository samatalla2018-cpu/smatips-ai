# Data ownership, lifecycle & recovery — SmaTrips AI

## Ownership & lifecycle rules

| Entity | Owned by | Created when | Identified by | Deleted when |
|---|---|---|---|---|
| **Account** (`users` row) | The phone number itself | First successful OTP verification ([functions/api/verify-otp.js](functions/api/verify-otp.js), `ensureUserAndSubscription`) | `phone` (PRIMARY KEY — structurally unique, `INSERT OR IGNORE` prevents duplicates) | No deletion path exists today (no account-deletion endpoint). Documented gap, not invented as fixed. |
| **Subscription** | 1:1 with an Account | Same moment as the Account (`INSERT OR IGNORE` into `subscriptions`, `status='pending'`) | `phone` (PRIMARY KEY, 1:1 with `users`) | Never deleted; status transitions `pending` → `active` on confirmed payment (Priority 3). No downgrade/cancellation path exists today (product is "lifetime" subscription per the paywall copy — no recurring billing to cancel). |
| **Trip Plan** (live, in-progress) | The browser session | Client-side only, in `localStorage` ([js/store.js](js/store.js)) | Not phone-scoped — lives entirely on-device | Cleared by the user's browser storage; **not backed up server-side today** (see "Known gap" below). |
| **Trip Files** (`trips` row) | The Account that exported them | User explicitly exports/downloads a trip via [functions/api/trips/index.js](functions/api/trips/index.js) `onRequestPost` | `id` (UUID PK) + `phone` (owner, enforced on every read — [functions/api/trips/[id].js](functions/api/trips/[id].js)) | No deletion endpoint exists today. Documented gap. |

### Known gap (documented, not silently changed)

The **live** trip-planning data (itinerary, tasks, packing list, weather, etc. — everything under
`/trip`, `/itinerary`, `/tasks`, `/packing`, etc.) lives only in browser `localStorage`. It is
**not durable** — clearing browser data or switching devices loses it. The only server-side
durability is the explicit "export as a trip file" action, which snapshots a fully-rendered HTML
document into the `trips` table. This is a genuine product/architecture gap for data durability,
but restructuring where live trip data lives is a large, product-shaping change that was
explicitly kept out of scope for this security/reliability pass (per the instruction to preserve
existing UX/features and only change what security/reliability requires). Recommended as a
separate, deliberately-scoped follow-up.

### Orphan / ambiguous / duplicate record check (Priority 3)

- `users.phone` and `subscriptions.phone` are both `PRIMARY KEY` — duplicate accounts or duplicate
  subscription rows for the same phone are **structurally impossible** at the schema level, not
  just prevented by application logic.
- `trips.id` is a `crypto.randomUUID()` primary key generated server-side — no collision risk.
- The one small accepted race (documented in the gap analysis, Priority 3 row 9): if the Worker
  crashes between creating a Moyasar invoice and attaching its id to the `subscriptions` row, the
  webhook's invoice-id lookup would miss — but `activateSubscriptionByPhone` (used when the
  webhook's confirmed invoice carries `metadata.phone`, which Moyasar always returns since we set
  it at invoice-creation time) still recovers it. No double charge is possible either way, since
  invoice creation itself is not a charge.

## Backup & recovery — verified procedure

### Local drill performed in this session

A full backup/restore cycle was executed against this machine's local D1 dev database (via
`wrangler d1 execute --local` / `wrangler d1 export --local`, backed by the same SQLite engine D1
uses in production) to validate the procedure end-to-end:

1. Applied both migrations to the local D1 database — succeeded (11 SQL statements, all `success: true`).
2. Inserted a test user/subscription row.
3. Ran `wrangler d1 export smatripsai-db --local -c .d1-local-only.toml --output=<file>.sql` — produced a valid SQL dump (56 lines, 11 `INSERT` statements covering pre-existing local dev data + the test row).
4. Simulated a disaster by deleting the local D1 state directory entirely.
5. Restored via `wrangler d1 execute smatripsai-db --local -c .d1-local-only.toml --file=<file>.sql` — succeeded.
6. Verified the restored data matched (`SELECT phone, status FROM subscriptions` returned the expected rows, including the test row from step 2).

The export happened to include a real-looking local developer test record already present in this
machine's `.wrangler` dev state from before this session. That export file was deleted immediately
after the drill and was never staged/committed (verified via `git status`) — it never left this
machine and is not referenced anywhere in the repo.

**This proves the mechanics of the procedure work** (export format is valid, restore is
lossless for what it captures). It does **not** constitute a production backup/recovery test,
since it ran against local dev state, not the real `smatripsai-db` production database.

### Production backup/recovery — MANUAL ACTION REQUIRED

Cloudflare D1 does not currently offer fully-automatic scheduled backups accessible without
account-level action. Run this manually (requires Cloudflare account access this environment
does not have) and repeat on a regular cadence (recommended: before every schema-changing
deployment, and at minimum monthly):

```bash
# 1. Export the real production database (requires wrangler login with account access)
wrangler d1 export smatripsai-db --remote --output=backup-$(date +%Y%m%d).sql

# 2. Store the export somewhere outside the Cloudflare account (encrypted object storage,
#    a private secrets vault, etc.) — never commit it to git (it contains real user phone
#    numbers and trip content).

# 3. Periodically (e.g. quarterly) test the restore path against a SEPARATE scratch D1
#    database (never restore-test against production directly):
wrangler d1 create smatripsai-db-restore-test
wrangler d1 execute smatripsai-db-restore-test --remote --file=backup-YYYYMMDD.sql
# verify row counts / spot-check data, then delete the scratch database.
```

### Recovery time expectation

For a database of this size and shape (three-to-six simple tables, no large blobs beyond
`trips.html_content`), a full export+restore cycle is expected to complete in well under a minute
based on the local drill — actual production timing depends on data volume at the time and has
not been measured against real production data from this environment.

## Destructive schema changes — required process

Per `migrations/README.md`, any future migration that alters or drops an existing column/table
(e.g. the planned `0003_constraints.sql` adding `FOREIGN KEY`/`CHECK` constraints via table
rebuild) must:
1. Be preceded by a fresh production export (see above).
2. Be tested against a scratch copy of production data first.
3. Run in a maintenance window with the rollback plan from [DEPLOYMENT_AND_ROLLBACK.md](DEPLOYMENT_AND_ROLLBACK.md) ready.
4. Never run automatically from CI.
