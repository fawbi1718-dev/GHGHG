# FIRESTORE RULES DEPLOYMENT — CHECKLIST (Phase 6.16 P0)

## 1. What changed vs the previously deployed ruleset
The deployed rules are KNOWN to differ from the repository (proven in Phase 6.2:
reads succeeded while seller updates failed with `permission-denied`). The local
file is now the single source of truth and MUST be compared against the Console
before overwriting.

Hardening introduced in this ruleset:
| Collection | Before (local) | After |
|---|---|---|
| `tenants/{id}` profile doc | any authed user R/W | authed read; **member-only write** |
| `tenants/{id}/**` subcollections | any authed user R/W | **member-only read+write** |
| `wholesale_offers` | any authed user R/W | read: authed · **create/update/delete: seller-tenant member only** |
| `b2b_orders` | (6.2 hardened block) | unchanged — verify deployed copy matches |
| `b2b_notifications` | any authed user R/W | immutable events; typed + field-whitelisted; writer must be an involved tenant member |
| `catalog/{drugId}` | **world-writable (`if true`)** | public read, **all client writes blocked** |
| `medicines_catalog/{id}` | no rule → default-deny | authed read; additive field-whitelisted intake mirror writes (documented exception) |
| `pharmacy_users/{uid}` | any authed user R/W | **owner-only** (`auth.uid == userId`) |
| `pharmacies/{pid}` (legacy) | any authed user R/W | unchanged (authenticated) — LEGACY-COMPAT EXCEPTION, see §4 |

## 2. Pre-deploy verification
1. Firebase Console → Firestore → Rules: copy the currently deployed rules into
   this repo as `firestore.rules.DEPLOYED_SNAPSHOT` for the audit trail.
2. Diff mentally against §1 — if the deployed set already contains tenant
   checks not listed here, STOP and reconcile before overwriting.
3. Confirm the app version to deploy alongside: git commit
   **(HEAD at time of writing: `de3f5c4`, Phase 6.15E)** or newer that passes
   `npx tsc --noEmit && npm test && npm run build`.

## 3. Deploy
Option A (Console): paste the full contents of `firestore.rules` → Publish.
Option B (CLI, once a project is linked):
```
firebase deploy --only firestore:rules
```
Rules deploy atomically and take ~1 minute to propagate.

## 4. Known accepted residuals (documented, not oversights)
1. **`pharmacies/*` legacy write remains authenticated-broad.** Doc shape predates
   `authorizedUsers[]`; enforcing membership risks breaking sign-in/profile-save.
   Migration: backfill `authorizedUsers` on legacy docs, then tighten to
   `tenantMember(resource.id)` in a follow-up.
2. **`medicines_catalog` authenticated additive writes.** Required by warehouse
   ingestion barcode lookups without a backend. Abuse impact = junk reference
   rows only. Migrate to a server-side ingest when functions exist.
3. **Tenant profile docs are readable cross-tenant.** Required for supplier
   discovery / buyer enrichment / switcher. Contains only business-public fields
   (name, city, phone, license). Subcollection data stays fully private.

## 5. Post-deploy smoke matrix (run immediately)
| Test | Expected |
|---|---|
| Pharmacy A reads Pharmacy B's inventory/ledger | permission-denied |
| Any user edits `/catalog/foo` | permission-denied |
| User X writes `pharmacy_users/X` | allowed; writes `pharmacy_users/Y` from X | denied |
| Warehouse A publishes offer (seller=A) | allowed |
| Warehouse B updates Warehouse A's offer | permission-denied |
| Dispatch order of seller A as warehouse A | allowed (stock deducts) |
| Second dispatch of same order | permission-denied (state machine) |
| Buyer receives DISPATCHED order | allowed |
| Order notification appears on counterparty | toast fires ≤ seconds after action |
| Offer quantity reaches 0 | offer inactive; inventory untouched |

## 6. Rollback
Keep the pre-deploy Console snapshot (§2.1). Re-publish it to revert. Note:
rolling back re-opens the world-writable catalog/tenants holes — treat rollback
as emergency-only.
