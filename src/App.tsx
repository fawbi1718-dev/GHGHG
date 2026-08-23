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

  // Sync Engine State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ loaded: 0, total: 22000 });
  const [syncLogs, setSyncLogs] = useState<{msg: string, type: string}[]>([]);
  const [syncError, setSyncError] = useState(false);

  // Trigger safe boot-up auto clean routine and check catalog sync
  useEffect(() => {
    autoCleanLegacyData();
    
    // Auto-sync on app load
    try {
      BackgroundSyncEngine.getInstance().triggerSyncLoop();
    } catch (e) {
      console.error(e);
    }
  }, []);

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
    const checkAndSyncCatalog = async () => {
      try {
        const state = getCatalogSyncState();
        if (state.status !== 'COMPLETE') {
          startSync();
        } else if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
          // Full-catalog diagnostics run ONLY when explicitly requested via ?debug
          // (these perform full IndexedDB cursor scans and are not production startup work).
          const verification = await verifyCatalogCompleteness(supabase);
          console.log("[VERIFICATION_REPORT]", JSON.stringify(verification, null, 2));

          const s1 = await searchLocalMeds('panadol');
          const s2 = await searchLocalMeds('آسبرين');
          const s3 = await searchLocalMeds('اسبرين');
          const s4 = await searchLocalMeds('بنادول');

          console.log("[TEST_SEARCH_REPORT]", JSON.stringify({
            'panadol': s1.length,
            'آسبرين': s2.length,
            'اسبرين': s3.length,
            'بنادول': s4.length,
            's1_names': s1.map(m=>m.nameEn).slice(0, 3)
          }, null, 2));
        }
      } catch (err) {
        console.error("Catalog sync failed", err);
      }
    };

    checkAndSyncCatalog();
  }, [startSync]);

  useEffect(() => {
    if (activePharmacy && activePharmacy.tenantType) {
      setTenantType(activePharmacy.tenantType);
    }
  }, [activePharmacy, setTenantType]);

  useEffect(() => {
    // Immediate tenant isolation
    setMedicines([]);
    setSalesLogs([]);

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
        developerMode={false}
        triggerToast={triggerToast}
        lang={lang}
        setLang={setLang}
      />

      {/* Non-destructive Sync Progress (Rendered as overlay without unmounting the app tree) */}
      {(isSyncing || syncError) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-950/80 backdrop-blur-sm text-white p-6">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col items-center">
            <h2 className="text-xl font-bold mb-4">
              {lang === 'ar' ? 'مزامنة كتالوج الأدوية للعمل دون اتصال...' : 'Setting up Pharmacy Catalog for Offline Use...'}
            </h2>
            
            {!syncError ? (
              <>
                <div className="w-full bg-slate-800 rounded-full h-3 mb-3 overflow-hidden border border-slate-700">
                  <div 
                    className="bg-emerald-500 h-3 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min(100, Math.round((syncProgress.loaded / (syncProgress.total || 1)) * 100)) || 0}%` }}
                  />
                </div>
                <p className="text-slate-300 text-sm font-medium">
                  {Math.min(100, Math.round((syncProgress.loaded / (syncProgress.total || 1)) * 100)) || 0}% ({syncProgress.loaded} / {syncProgress.total || '?'} items)
                </p>
              </>
            ) : (
              <div className="mb-4 flex flex-col items-center gap-3 w-full">
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-xs font-medium text-center w-full">
                  {lang === 'ar' ? 'فشل الاتصال بقاعدة البيانات السحابية، يمكنك المتابعة أو إعادة المحاولة.' : 'Connection to database failed or returned zero records. You can continue offline or retry.'}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={startSync}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                  <button 
                    onClick={() => setSyncError(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === 'ar' ? 'متابعة دون مزامنة' : 'Continue Offline'}
                  </button>
                </div>
              </div>
            )}

            <div className="w-full bg-black/60 rounded-xl p-3 font-mono text-[11px] overflow-y-auto h-36 border border-slate-800 text-left shadow-inner flex flex-col gap-1 mt-3">
              {syncLogs.map((log, i) => (
                <div key={i} className={`
                  ${log.type === 'error' ? 'text-red-400 font-bold' : ''}
                  ${log.type === 'success' ? 'text-emerald-400' : ''}
                  ${log.type === 'info' ? 'text-slate-300' : ''}
                `}>
                  <span className="text-slate-600 opacity-70">[{new Date().toLocaleTimeString()}]</span> {log.msg}
                </div>
              ))}
              {syncLogs.length === 0 && <span className="text-slate-500 animate-pulse">Initializing connection...</span>}
            </div>
          </div>
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
