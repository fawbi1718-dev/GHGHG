# Eshmun — Pharmacy Operating Platform

Bilingual (Arabic/English) offline-capable platform for **retail pharmacies** and
**wholesale warehouses**: point-of-sale, FEFO inventory management, barcode
scanning, a 22k-record medicine catalog, and a cross-tenant B2B marketplace
(including pharmacy-to-pharmacy **surplus exchange**).

> Product state: pilot-ready. Firestore security rules are hardened — deploy
> them together with the app bundle (see `FIRESTORE_RULES_DEPLOYMENT.md`).

## Quick start

```bash
npm install
npm run host        # production build served on your network (:4173) — phone reachable
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server, hot reload (`--host` included → LAN accessible) |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve the last build |
| `npm run host` | Build **and** serve on `0.0.0.0:4173` |
| `npm test` | Vitest unit suites (FEFO allocator, barcode/search normalization, cost model) |
| `npm run lint` | TypeScript check (`tsc --noEmit`) |

## Architecture in one screen

```
React 19 + TS + Vite + Tailwind v4
│
├── domain/            pure business logic (FEFOStockAllocator, DrugBatch…)
├── application/       AuthContext (Firebase Auth), hooks
├── infrastructure/    IndexedDB repos · BackgroundSyncEngine · NetworkSentinel
│                      WebLockManager · HardwareIntegrationService
├── services/          Supabase catalog sync + local search engine (IndexedDB)
├── components/        feature UI (POS, Ledger, marketplace, warehouse tabs)
└── presentation/      RootNavigator (role-aware shell & routing)
```

**Data sources**
- Firebase Auth + Firestore: tenants, storage_inventory (+batches), ledger,
  wholesale_offers, b2b_orders, b2b_notifications.
- Supabase `MEDS` table → synced once into IndexedDB `localMeds` (~22k records)
  for instant offline search.
- Security: see `firestore.rules` — tenant membership via
  `tenants/{id}.authorizedUsers[]`, B2B order state machine enforced server-side.

## Key flows
- **POS sale** → explicit batch read → `FEFOStockAllocator` → atomic writeBatch
  (batch decrements + aggregate stock + ledger doc).
- **Surplus Exchange** → any pharmacy publishes near-expiry stock as an offer;
  buyers order through the same B2B pipeline; sellers manage/pause/remove their
  listings from the Ledger (♻️ button).
- **Warehouse dispatch** → validate → FEFO allocate → deduct batches+aggregate →
  decrement offer availability → mark DISPATCHED — all in ONE atomic writeBatch.
- **Offline** → mutations queue locally; BackgroundSyncEngine delivers with
  attempt-capped retries; permanently failed items are parked (never deleted)
  and re-armable from the sync widget.

## Operations notes
- Hosting: `npm run host` binds LAN so phones on the same Wi-Fi can connect.
  Camera scanning requires a secure context — use `localhost`, `adb reverse`,
  or serve over HTTPS.
- Deployment: publish `firestore.rules` **together with** a fresh app bundle.
  Checklist: `FIRESTORE_RULES_DEPLOYMENT.md`.
- Project memory / roadmap / known issues: `PROJECT_STATE.md`.

## Design system
"Eshmun Clinical" (see `REDESIGN_NOTES.md` in the redesign lab): neutral slate
surfaces, single teal accent (`brand-*` tokens in `index.css`), hairline borders,
8px radius ceiling, JetBrains Mono for identifiers/prices, no decorative emoji.
