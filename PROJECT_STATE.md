# PROJECT_STATE.md

Compact, factual project memory. Update whenever a phase changes architecture.
Last updated: Phase X.4 (Redesign Lab).

---

## 1. PROJECT PURPOSE
Bilingual (Arabic RTL / English LTR) offline-capable platform for retail pharmacies and wholesale warehouses: POS checkout, inventory/ledger management, barcode scanning, a ~22k-record medicine catalog (Supabase mirror → IndexedDB), and a cross-tenant B2B wholesale marketplace with order lifecycle.

## 2. CURRENT ARCHITECTURE
- React 19 + TypeScript 5.8 (non-strict) + Vite 6 + Tailwind v4 (`@tailwindcss/vite`, no postcss config).
- Backend: Firebase (Auth + Firestore). Catalog source: Supabase table `MEDS` → keyset-paginated sync into IndexedDB `PharmacyAppDB/localMeds` (keyPath `sako`; indexes `by-barcode`, `by-name`, `by-company`).
- Layers: `domain/` (DrugBatch, FEFOStockAllocator), `application/` (AuthContext; RegisterApplicationService is DORMANT — see §11), `infrastructure/` (IndexedDB repos, BackgroundSyncEngine, NetworkSentinel, WebLockManager, HardwareIntegrationService), `components/` + `presentation/navigation/RootNavigator` (conditional-render tabs; warehouse role = `WHOLESALE_WAREHOUSE` tenantType).
- State: App-level `medicines`/`salesLogs` from Firestore snapshots, prop-drilled. Mirrors persisted via coalescing `utils/localMirror.ts`.
- Sync: Firestore-native offline persistence for live data; outbound mutation queue (`sync_queue`) in IndexedDB processed by BackgroundSyncEngine (attempt-capped, parked items kept, JSON-success verified); B2B orders upload via Firestore directly.

## 3. PHARMACY FEATURES COMPLETED
POS cart/checkout (`firestoreCompleteSale`: FEFO batch deduction via writeBatch + ledger write + POSTransactionService bookkeeping) · inventory CRUD · item detail view · analytics/dashboard · medicine directory (CompaniesDirectoryTab: company browse, drug search/detail/bio-equivalents, add-to-POS) · order tracking with status filters and Active/History separation · receipt of dispatched B2B orders with auto-restock (`confirmWarehouseOrderReceipt`) · scanner stack (CentralScannerModal native BarcodeDetector + html5-qrcode fallback, InlineCameraScanner, FullScreenScannerTab; secure-context guards + manual entry).

## 4. WAREHOUSE FEATURES COMPLETED
Ledger (WarehouseInventoryTab): intake via StockIntakeModal (catalog prefill supported), memoized filter/sort/low-stock, per-medicine Edit modal (fields + physical stock correction: additions create corrective batch; reductions deduct FEFO-first via FEFOStockAllocator; atomic batch) · offers publishing/editing/deactivation (deterministic id `off_{sellerId}_{safeCatalogId}`) · dispatch queue with FEFO stock deduction + offer availability decrement in one atomic writeBatch · Order History (lazy bounded query, status filters) · read-only Catalog tab with "Add to Warehouse Inventory" entry.

## 5. B2B FLOW
Pharmacy: marketplace offers listener (`wholesale_offers WHERE active==true`, self-excluded) → cart (memory-only) → order per seller (`b2b_orders/{PO-...}`, status PENDING_APPROVAL).
Warehouse: realtime PENDING_APPROVAL queue → Dispatch (validate → FEFO allocate → deduct batches+aggregate → decrement offer availability → status DISPATCHED + manifest, single writeBatch) or Reject (status DRAFT).
Buyer: DISPATCHED → RECEIVED via confirmWarehouseOrderReceipt (+storage_inventory restock).
Statuses: DRAFT | PENDING_APPROVAL | DISPATCHED | RECEIVED (DRAFT = rejected).

## 6. FIRESTORE COLLECTIONS + SECURITY MODEL
- `tenants/{tenantId}` (+`storage_inventory/{medId}/batches`, `ledger`): tenant private inventory/sales. Rules file still permissive (`auth != null`) outside b2b_orders — HARDENING PENDING DEPLOYMENT.
- `b2b_orders/{orderId}`: local rules enforce state machine (seller: PENDING_APPROVAL→DISPATCHED|DRAFT; buyer: DISPATCHED→RECEIVED) with `authorizedUsers` tenant membership + affectedKeys whitelists; immutable orderId/parties/items. **Deployment required.**
- `wholesale_offers/{offerId}`, `b2b_notifications`, `pharmacies/*`, `pharmacy_users/*`: auth!=null. `medicines_catalog/{id}`: optional non-blocking mirror from intake; NO rule match (default-deny tolerated by design since 6.4).
- Tenant membership: `tenants/{id}.authorizedUsers[]` contains Auth UID.

## 7. IMPORTANT DATA INVARIANTS
- Aggregate `storage_inventory.stock` = Σ batch stocks after any correction/dispatch/intake path.
- Dispatch never marks DISPATCHED without the matching deduction (single writeBatch); insufficient active stock blocks dispatch entirely.
- Offer `availableQuantity` mirrors sellable intent; reaches 0 ⇒ `active:false`. Publishing/deactivating offers never mutates inventory.
- Barcodes are always strings (leading zeroes preserved; never Number()).
- Reject path never touches inventory; pharmacy receive only adds pharmacy stock.
- Unsent sync payloads are never dequeued/faked; failed items park in `sync_queue` (recoverable via `retryParkedPayloads()`).

## 8. PERFORMANCE WORK COMPLETED
N+1 batch listeners removed (App has exactly 2 listeners: inventory+ledger) · cosmetic-dep resubscriptions eliminated (lang/toast/profile refs) · snapshot mirrors debounced+deduped (`localMirror.ts`, flush on pagehide) · boot diagnostics behind `?debug` · catalog search: derived normalized fields `_sn/_se/_sc/_sk/_sb` written at sync time (legacy rows fall back to live normalize), by-company index used for filtered searches (key-only resolution + range fetch), key-only barcode-index pass before legacy full scan, session companies cache invalidated on sync/clear · inventory tabs memoized (filter/sort/lowStock) with precomputed date epochs (NaN semantics preserved) · CentralScannerModal native BarcodeDetector loop timestamp-gated to ~12 detects/sec (80ms gate + no-overlap flag; rAF loop and cleanup unchanged; Html5Qrcode fallback untouched) · marketplace global search debounced 250ms (grouping memo consumes debounced value; realtime listener independent) · warehouse mobile dock columns derive from tab count (fixes double-row overlap after Catalog tab addition) · order-event notifications: warehouse writes ORDER_DISPATCHED/ORDER_REJECTED, pharmacy listener tenant-scoped (time-window query, client-side type switch — no composite index), pharmacy writes ORDER_RECEIVED on receipt + warehouse bounded receipt toast listener; multi-warehouse submission is per-group isolated with explicit partial-success reporting and cart pruning of succeeded groups only · vitest foundation (`npm test`): FEFO allocator, barcode/search normalization, cost-provenance/margin suites (16 tests).

### Phase 6.16 scalability decisions (audited, deliberate no-caps)
- **Inventory listener stays fully live & unbounded** — POS availability, warehouse stock, offline bootstrap and FEFO reads all require complete real-time accuracy; a cap would trade correctness for speed. Emission cost already mitigated by coalesced mirror writes.
- **Ledger listener stays complete** — SalesAnalytics/AnalyticsTab compute long-term revenue/profit from it; capping would silently corrupt historical analytics. Future path: server-side aggregation or paginated history UI before any windowing.
- **Offers listener stays unbounded** — marketplace must not hide legitimate offers. Growth is seller-driven/slow; revisit with storefront pagination if active offers exceed ~300.
- Deployment-ready full ruleset in `firestore.rules` + `FIRESTORE_RULES_DEPLOYMENT.md` checklist (deploy requires Console/CLI publish + app bundle rebuild together).

### Phase X.4 - delivery UX completion
- Dispatch drawer: delivery WINDOW (start+end datetime inputs, default tomorrow 10:00-12:00) rides inside manifest -> zero rules change.
- Pharmacy DISPATCHED card: Incoming Delivery panel with window text, Late badge past end+1h, dispatch token, grouped Confirm / Report actions.
- Warehouse queue: Delivery-failed audit chip on reverted orders + amber guidance strip (stock still reserved; intake returns via normal flow before re-dispatch or Reject).
- ORDER_DISPATCHED notification carries ETA; pharmacy toast includes it.

### Phase X.3 - order delivery lifecycle + surplus management
- Dispatch drawer gains expected-delivery datetime -> manifest.expectedDeliveryAt; pharmacy tracking shows ETA chip + late flag.
- Buyer report (package never arrived) reverts DISPATCHED to PENDING_APPROVAL with deliveryFailedAt; seller notified via ORDER_NOT_RECEIVED; queue picks it up realtime. Stock not auto-restored: seller re-dispatches after physical return intake or rejects. REQUIRES RULES REDEPLOY.
- My Surplus panel in Ledger header with live count; Manage editor per listing (qty/price, Pause/Resume, Remove+reason, notification). Recycle button contextual Publish vs Manage.
- Privacy: sync overlay no longer shows catalog record counts; login logo pulse removed.

### Phases 6.17–6.19 (Surplus Exchange + UX hardening)
- **Surplus Exchange**: retail pharmacies publish near-expiry/overstock as marketplace offers (`SurplusPublishModal` → wholesale_offers with `offerKind:'surplus'`, `sellerType:'RETAIL_PHARMACY'`; deterministic id; inventory untouched). Marketplace shows ♻️ Surplus + ⏳ near-expiry(≤90d) badges, pharmacy-seller storefront chips, directory relabeled "Verified Sellers".
- **Surplus lifecycle management**: Recycle button is contextual — Publish when unlisted, Manage when listed (edit qty/price, Pause/Resume visibility, Remove with reason → OFFER_DEACTIVATED event notifies affected pharmacies and their carts auto-prune). Listed badge on Ledger cards. **Trust scores**: real fulfillment/rejection % computed lazily from seller's b2b_orders (limit 100) when a storefront opens; replaces fabricated reliability 4.9.
- **UI consistency**: unified `ui/StatusBadge` grammar across tracking/queue/history; loud gradient headers flattened.
- **Counter-offer**: reject modal gains optional available-qty + note composed into whitelisted `rejectionReason`; ORDER_REJECTED notification carries it.
- **Cart persistence**: B2B cart survives reload via sessionStorage (`eshmun_b2b_active_cart`); partial-success pruning compatible.
- **Profile gate dismissible** per session (`profile_gate_dismissed`); "Later" button; shell stays mounted.
- **Offline beep**: remote mixkit MP3 replaced by HardwareIntegrationService synthesized beep.

## 9. CURRENT CHECKPOINT
`C6.13_PRE_INVENTORY_OPTIMIZATION` (Desktop folder copy, pre-change). Prior: C0–C9 series + C6.11/C6.12 checkpoints. Git history also maintained locally (baseline e9d3aa6 → HEAD).

## 10. KNOWN REMAINING PROBLEMS
P0: **Deploy** the hardened ruleset (see FIRESTORE_RULES_DEPLOYMENT.md — Console publish + app bundle rebuild together; post-deploy smoke matrix included). Rotate Supabase publishable key (shipped in archives). Legacy `pharmacies/*` writes remain authenticated-broad pending authorizedUsers backfill migration.
P1: unbounded ledger/inventory snapshot listeners (deliberate no-cap, see §8 decision record) · B2B offers/orders listeners unbounded · cart memory-only (lost on reload) · remote mixkit beep URL at RootNavigator ~:753.
P1-cost: sale items with no recorded batch cost now carry `costEstimated:true` / `costSource:'unavailable'`; analytics surfaces should surface this count (`unknownCostItemCount`) rather than treating profit as exact when >0.
P2: profile-completion modal non-dismissable (mandatory city/address/phone; geo lat/lng exist in TenantLocation but are not collected — future discovery feature, no fake data) · warehouse profile view exists via WarehouseProfileView; richer supplier header (active-offer count etc.) deferred · render-all inventory rows (virtualization deferred).
P2/P3: DashboardTab imported but never rendered · dead ui/Modal imports in several components; 23 hand-rolled overlays vs 5 Modal usages · giant components (B2BMarketplaceTab ~1.5kL etc.) · first-sync serial puts (one-time cost) · barcode-fallback value scan for code/gtin/id-only matches (rare).

## 11. DO NOT TOUCH / DEFERRED AREAS
RegisterApplicationService + AntiFraudEngine + domain/ledger pipeline (dormant; architecture decision pending) · two-engine naming split (services/syncEngine vs infrastructure BackgroundSyncEngine) · migrating direct-Firestore UI files into repositories · component decomposition · FEFOStockAllocator internals & B2B state machine rules · scanner lifecycle implementations · localStorage bootstrap mechanism (only cadence may change) · html5-qrcode fallbacks.

## 12. NEXT RECOMMENDED PHASE
1. Deploy hardened ruleset + rebuilt bundle together (FIRESTORE_RULES_DEPLOYMENT.md) and run the post-deploy smoke matrix.
2. Rotate Supabase publishable key; migrate `pharmacies/*` legacy writes (authorizedUsers backfill).
3. Grow vitest: surplus publish payload, trust-score math, counter-offer reason composition, cart pruning logic.
4. Surplus v2 ideas: auto-suggest from FEFO expiry scan, buyer "surplus only" filter, distance sorting once geo captured.

## 12.5 AUTONOMOUS SESSION LOG (6.20)
- Sync widget: parked-payload count + one-tap retry (ops visibility).
- B2B cart: localStorage with 7-day expiry (survives restarts).
- README.md rewritten (setup/scripts/architecture/ops).
- Audit: password reset fully wired in AuthScreen ✓.
- Search-contract tests: company-key normalization stability + precomputed derived fields === live normalization (8 cases).
- Ledger skeletons until first tenant snapshot (isLoadingInventory flag through App→RootNavigator→tabs) — no more fake empty-state flash.

## 13. LATEST TYPECHECK/LINT/BUILD STATUS
`tsc --noEmit` CLEAN · lint script (= tsc) CLEAN · `vite build` ✓ · `npm test` 16/16 passed (Phase 6.19 commit `ce38547`). Device passes needed for: surplus publish→buy loop, dock on 320px, notifications delivery post-rules-deploy.
