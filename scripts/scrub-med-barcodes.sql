-- ============================================================
-- ESHMUN: MEDS barcode hygiene scrub
-- Run in: Supabase Dashboard -> SQL Editor
-- Why: source data has trailing commas in barcode ("123456,"),
--      which broke exact-match lookups (fixed in app code, but
--      cleaning at the source keeps search fast and exact).
--
-- DRY RUN FIRST: the SELECT shows exactly what will change.
-- ============================================================

-- 1) Preview affected rows
SELECT sako, name, barcode
FROM "MEDS"
WHERE barcode IS NOT NULL
  AND (barcode LIKE '%,%' OR barcode <> TRIM(barcode));

-- 2) Apply scrub: trim whitespace + strip ALL commas from barcodes
UPDATE "MEDS"
SET barcode = REPLACE(TRIM(barcode), ',', '')
WHERE barcode IS NOT NULL
  AND (barcode LIKE '%,%' OR barcode <> TRIM(barcode));

-- 3) Verify none left
SELECT COUNT(*) AS remaining_dirty FROM "MEDS"
WHERE barcode LIKE '%,%' OR (barcode <> TRIM(barcode));
