import { ErrorBoundary } from './ErrorBoundary';
import React, { useState, useEffect, useCallback } from 'react';
import { Medicine, SaleRecord } from './types';
import { AuthProvider, useAuth } from './application/auth/AuthContext';
import RootNavigator from './presentation/navigation/RootNavigator';
import { db } from './infrastructure/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

import { ThemeProvider, useTenantTheme } from './components/ThemeContext';
import { CatalogProvider } from './context/CatalogContext';
import { UIProvider, useUI } from './context/UIContext';
import { autoCleanLegacyData } from './utils/autoClean';
import { persistMirror } from './utils/localMirror';
import { BackgroundSyncEngine } from './infrastructure/sync/BackgroundSyncEngine';
import { syncCatalogFromSupabase, searchLocalMeds, getCatalogSyncState, verifyCatalogCompleteness } from './services/syncEngine';
import { supabase } from './lib/supabaseClient';

(window as any).verifyCatalogCompleteness = async () => {
  return await verifyCatalogCompleteness(supabase);
};

function AppContent() {
  const { currentSession, activePharmacy } = useAuth();
  const { setTenantType } = useTenantTheme();
  const { lang, setLang, triggerToast } = useUI();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [salesLogs, setSalesLogs] = useState<SaleRecord[]>([]);
  // False until the FIRST inventory snapshot for this tenant lands — lets the
  // Ledger show skeletons instead of flashing a fake "empty" state.
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  // Sync Engine State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ loaded: 0, total: 22000 });
  const [syncLogs, setSyncLogs] = useState<{msg: string, type: string}[]>([]);
  const [syncError, setSyncError] = useState(false);

  // Trigger safe boot-up auto clean routine and check catalog sync
  // AUTH LIFECYCLE: nothing below runs before a user signs in — no catalog
  // sync, no tenant database opens, no background tasks on the login screen.
  useEffect(() => {
    if (!currentSession) return;

    autoCleanLegacyData();

    // Auto-sync on app load
    try {
      BackgroundSyncEngine.getInstance().triggerSyncLoop();
    } catch (e) {
      console.error(e);
    }
  }, [currentSession]);

  const startSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(false);
    setSyncLogs([]);
    try {
      await syncCatalogFromSupabase(
        supabase, 
        (loaded, total) => {
          setSyncProgress({ loaded, total });
        },
        (msg, type) => {
          setSyncLogs(prev => [...prev, { msg, type }]);
        }
      );
      
      setIsSyncing(false);
    } catch (err) {
      console.error("Catalog sync failed", err);
      setSyncError(true);
    }
  }, []);

  useEffect(() => {
    // AUTH LIFECYCLE: catalog synchronization is tenant-agnostic data work,
    // but it must never start on the public login screen.
    if (!currentSession) return;
    const checkAndSyncCatalog = async () => {
      try {
        const state = getCatalogSyncState();
        if (state.status !== 'COMPLETE') {
          startSync();
        } else {
          // Self-healing: a stale COMPLETE flag over an emptied store
          // (e.g. after a wipe) must not permanently suppress re-sync.
          try {
            const { countLocalMeds } = await import('./services/syncEngine');
            const localCount = await countLocalMeds();
            if (!localCount) {
              console.warn('[catalog] COMPLETE flag but 0 local meds — forcing re-sync');
              startSync();
            }
          } catch (e) {
            console.error('Catalog completeness check failed', e);
          }
        }

        // Full-catalog diagnostics run ONLY when explicitly requested via ?debug
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
          const verification = await verifyCatalogCompleteness(supabase);
          console.log("[VERIFICATION_REPORT]", JSON.stringify(verification, null, 2));

          const s1 = await searchLocalMeds('panadol');
          const s4 = await searchLocalMeds('بنادول');

          console.log("[TEST_SEARCH_REPORT]", JSON.stringify({
            'panadol': s1.length,
            'بنادول': s4.length
          }, null, 2));
        }
      } catch (err) {
        console.error("Catalog sync failed", err);
      }
    };

    checkAndSyncCatalog();
  }, [startSync, currentSession]);

  useEffect(() => {
    if (activePharmacy && activePharmacy.tenantType) {
      setTenantType(activePharmacy.tenantType);
    }
  }, [activePharmacy, setTenantType]);

  useEffect(() => {
    // Immediate tenant isolation
    setMedicines([]);
    setSalesLogs([]);
    setInventoryLoaded(false);

    if (!currentSession?.pharmacyId || !db) return;
    
    // 1. Pre-load from localStorage immediately
    try {
      const localMeds = localStorage.getItem(`syrian_inventory_${currentSession.pharmacyId}`);
      if (localMeds) setMedicines(JSON.parse(localMeds));
      const localSales = localStorage.getItem(`syrian_sales_${currentSession.pharmacyId}`);
      if (localSales) setSalesLogs(JSON.parse(localSales));
    } catch (e) {}

    // 2. Subscribe to Firebase for live updates
    const medsRef = collection(db, 'tenants', currentSession.pharmacyId, 'storage_inventory');

    const unsubscribeMeds = onSnapshot(query(medsRef), (snapshot) => {
      const loadedMeds: Medicine[] = [];

      snapshot.forEach(doc => {
        loadedMeds.push({ ...doc.data(), id: doc.id } as Medicine);
      });

      setMedicines(loadedMeds);
      setInventoryLoaded(true);
      persistMirror(`syrian_inventory_${currentSession.pharmacyId}`, loadedMeds);
    }, (error) => {
      console.warn("Firestore meds subscription error (Operating in offline mode):", error);
    });

    const salesRef = collection(db, 'tenants', currentSession.pharmacyId, 'ledger');
    const unsubscribeSales = onSnapshot(query(salesRef), (snapshot) => {
      const loadedSales: SaleRecord[] = [];
      snapshot.forEach(doc => {
        loadedSales.push({ ...doc.data(), saleId: doc.id } as SaleRecord);
      });
      setSalesLogs(loadedSales);
      persistMirror(`syrian_sales_${currentSession.pharmacyId}`, loadedSales);
    }, (error) => {
      console.warn("Firestore sales subscription error (Operating in offline mode):", error);
    });

    return () => {
      unsubscribeMeds();
      unsubscribeSales();
    };
  }, [currentSession?.pharmacyId]);

  return (
    <>
      <RootNavigator 
        medicines={medicines}
        setMedicines={setMedicines}
        salesLogs={salesLogs}
        setSalesLogs={setSalesLogs}
        isLoadingInventory={!inventoryLoaded}
        developerMode={false}
        triggerToast={triggerToast}
        lang={lang}
        setLang={setLang}
      />

      {/* Non-blocking sync status — corner widget */}
      {(isSyncing || syncError) && (
        <div className="fixed bottom-4 right-4 z-[70] w-72 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {lang === 'ar' ? 'مزامنة قاعدة البيانات…' : 'Syncing medicine database…'}
            </span>
            <span className="text-[10px] font-mono text-brand-600 font-bold">
              {Math.min(100, Math.round((syncProgress.loaded / (syncProgress.total || 1)) * 100)) || 0}%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div className="bg-brand-600 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.round((syncProgress.loaded / (syncProgress.total || 1)) * 100)) || 0}%` }} />
          </div>
          {syncError && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-600">
              <p className="text-[10px] text-rose-600 font-semibold">{lang === 'ar' ? 'فشل الاتصال — يمكنك المتابعة دون اتصال.' : 'Connection failed — continue offline.'}</p>
              <div className="flex gap-1.5">
                <button onClick={startSync} className="flex-1 py-1 bg-brand-600 text-white text-[10px] font-bold rounded-md cursor-pointer">{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button>
                <button onClick={() => setSyncError(false)} className="flex-1 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md cursor-pointer">{lang === 'ar' ? 'متابعة' : 'Dismiss'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <UIProvider>
        <ThemeProvider>
          <AuthProvider>
            <CatalogProvider>
              <AppContent />
            </CatalogProvider>
          </AuthProvider>
        </ThemeProvider>
      </UIProvider>
    </ErrorBoundary>
  );
}
