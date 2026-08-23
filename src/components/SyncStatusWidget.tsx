import React, { useEffect, useState } from 'react';
import { BackgroundSyncEngine } from '../infrastructure/sync/BackgroundSyncEngine';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCatalog } from '../context/CatalogContext';

export default function SyncStatusWidget({ inline = false }: { inline?: boolean }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | undefined>();
  
  const { isLoadingCatalog } = useCatalog();

  useEffect(() => {
    const engine = BackgroundSyncEngine.getInstance();
    
    const unsubscribe = engine.onSyncStateChange((status) => {
      setIsSyncing(status.isSyncing);
      setLastSync(status.lastSync);
      setError(status.error);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSyncClick = () => {
    const engine = BackgroundSyncEngine.getInstance();
    engine.triggerSyncLoop();
  };

  const showWidget = isSyncing || isLoadingCatalog || !!error;

  return (
    <AnimatePresence>
      {showWidget && (
        <motion.button 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={handleSyncClick}
          disabled={isSyncing || isLoadingCatalog}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border w-full cursor-pointer ${
            (isSyncing || isLoadingCatalog)
              ? 'bg-brand-600 text-white border-brand-700 shadow-sm' 
              : error 
              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'
          }`}
        >
          {(isSyncing || isLoadingCatalog) ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
          ) : error ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-700 shrink-0" />
          )}
          <span className="truncate">
            {isLoadingCatalog ? 'Loading Catalog...' : isSyncing ? 'Syncing...' : 'Sync Error'}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
