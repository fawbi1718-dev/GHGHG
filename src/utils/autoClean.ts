export const CATALOG_VERSION = "v2.0_JSON_ONLY";

/**
 * Safely purges legacy obsolete catalog caches without affecting
 * active user authentication, tenant profiles, or Firebase IndexedDB.
 */
export async function autoCleanLegacyData(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const currentVersion = localStorage.getItem("CATALOG_STORAGE_VERSION");

    if (currentVersion !== CATALOG_VERSION) {
      console.log(`[AutoClean] Updating catalog cache marker to ${CATALOG_VERSION}...`);

      // Safely remove only legacy catalog keys from localStorage
      const legacyKeys = [
        'syrian_meds_cache',
        'legacy_catalog_items',
        'old_meds_db_version'
      ];
      legacyKeys.forEach(k => {
        try { localStorage.removeItem(k); } catch (e) {}
      });

      // Delete only obsolete catalog IndexedDBs if present (NEVER touch firebaseLocalStorageDb or active tenant DBs)
      const obsoleteDbs = ['pharmacy-cache', 'catalog_db', 'legacy_meds_db'];
      obsoleteDbs.forEach(dbName => {
        try {
          if ('indexedDB' in window) {
            indexedDB.deleteDatabase(dbName);
          }
        } catch (e) {}
      });

      // Mark version as clean
      localStorage.setItem("CATALOG_STORAGE_VERSION", CATALOG_VERSION);
    }
  } catch (error) {
    console.error("[AutoClean] Error running safe auto-clean routine:", error);
  }
}
