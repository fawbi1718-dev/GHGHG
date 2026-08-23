import React, { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Medicine } from '../types';
import { X, ArrowRightLeft, Activity, CheckCircle, Package, Building2, TrendingUp, AlertTriangle, Truck } from 'lucide-react';

interface SubstitutionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetMedicine: Medicine | null;
  allMedicines: Medicine[];
  onSubstitute: (substitute: Medicine) => void;
  lang: 'en' | 'ar';
}

interface B2BAlternative {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  price: number;
  costPrice: number;
  supplier: string;
  isB2B: boolean;
  deliveryTime: string;
}

export default function SubstitutionDrawer({
  isOpen,
  onClose,
  targetMedicine,
  allMedicines,
  onSubstitute,
  lang
}: SubstitutionDrawerProps) {
  const isArabic = lang === 'ar';

  const { localAlts, b2bAlts } = useMemo(() => {
    if (!targetMedicine) return { localAlts: [], b2bAlts: [] };

    // 1. In-Stock Local Alternatives
    const local = allMedicines.filter(m => 
      m.id !== targetMedicine.id && 
      m.genericName.toLowerCase() === targetMedicine.genericName.toLowerCase() &&
      m.stock > 0
    ).sort((a, b) => b.stock - a.stock);

    // 2. Mock B2B Wholesale Warehouse Stock
    const b2b: B2BAlternative[] = [
      {
        id: `b2b-${Date.now()}-1`,
        name: `Generic ${targetMedicine.genericName}`,
        genericName: targetMedicine.genericName,
        strength: targetMedicine.strength,
        price: targetMedicine.price * 0.8, // 20% cheaper retail
        costPrice: targetMedicine.price * 0.4, // Good margin
        supplier: 'Apex Wholesale',
        isB2B: true,
        deliveryTime: isArabic ? 'اليوم في 4:00 م' : 'Today at 4:00 PM'
      },
      {
        id: `b2b-${Date.now()}-2`,
        name: `Premium ${targetMedicine.genericName}`,
        genericName: targetMedicine.genericName,
        strength: targetMedicine.strength,
        price: targetMedicine.price * 1.1,
        costPrice: targetMedicine.price * 0.6,
        supplier: 'PharmaCorp Direct',
        isB2B: true,
        deliveryTime: isArabic ? 'غداً صباحاً' : 'Tomorrow Morning'
      }
    ];

    return { localAlts: local, b2bAlts: b2b };
  }, [targetMedicine, allMedicines, isArabic]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        // Automatically swap with the best local alternative if available
        if (localAlts.length > 0) {
          onSubstitute(localAlts[0]);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, localAlts, onSubstitute]);

  if (!targetMedicine) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto" dir={isArabic ? 'rtl' : 'ltr'}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-0"
          />

          {/* Centered Modal Dialog Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-2xl border border-slate-200/90 flex flex-col max-h-[88vh] overflow-hidden my-auto"
          >
            {/* Header / Requested Medicine Summary Card */}
            <div className="p-5 sm:p-6 bg-slate-50/90 border-b border-slate-200 shrink-0">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                      {isArabic ? 'نفذ من المخزون / البدائل التكافؤية' : 'Out of Stock / Equivalent Alternatives'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isArabic ? 'العنصر المطلوب غير متوفر حالياً. تصفح البدائل التكافؤية أدناه.' : 'The requested item is currently unavailable. Browse bio-equivalents below.'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mt-3 p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {isArabic ? 'المنتج المطلوب' : 'Requested Item'}
                </div>
                <div className="font-black text-slate-900 text-base sm:text-lg">
                  {targetMedicine.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 border border-brand-200 rounded-lg text-xs font-bold text-brand-800 shadow-2xs">
                    <Activity className="w-3.5 h-3.5 text-brand-600" />
                    {targetMedicine.genericName}
                  </span>
                  {targetMedicine.strength && (
                    <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-2xs">
                      {targetMedicine.strength}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Alternatives List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/40">
              
              {/* Local In-Stock Alternatives */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-brand-500" />
                  {isArabic ? 'بدائل متوفرة محلياً' : 'In-Stock Alternatives'}
                </h3>
                
                {localAlts.length > 0 ? (
                  <div className="space-y-3">
                    {localAlts.map(alt => {
                      const margin = alt.price - (alt.price * 0.6); // Simulating cost
                      const marginPercent = Math.round((margin / alt.price) * 100);
                      
                      return (
                        <div key={alt.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow group relative overflow-hidden">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-bold text-slate-800 text-[15px]">{alt.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500 font-medium">{alt.supplier}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="text-xs text-brand-600 font-bold flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  {alt.stock} {isArabic ? 'متوفر' : 'in stock'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <div className="font-bold text-slate-800">${alt.price.toFixed(2)}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {marginPercent}% {isArabic ? 'هامش ربح' : 'Margin'}
                            </div>
                            
                            <button
                              onClick={() => {
                                onSubstitute(alt);
                                onClose();
                              }}
                              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-xs cursor-pointer"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                              {isArabic ? 'استبدال' : 'Swap & Add'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-6 bg-slate-100/50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-sm text-slate-500 font-medium">
                      {isArabic ? 'لا توجد بدائل متوفرة محلياً' : 'No local alternatives available in stock.'}
                    </p>
                  </div>
                )}
              </div>

              {/* B2B Wholesale Alternatives */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-500" />
                  {isArabic ? 'طلب من المستودع (B2B)' : 'Wholesale Direct (B2B)'}
                </h3>
                
                <div className="space-y-3 opacity-90">
                  {b2bAlts.map((alt, idx) => (
                    <div key={alt.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative">
                      {idx === 0 && (
                        <div className="absolute -top-2.5 -right-2.5 bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs z-10 border-2 border-white">
                          {isArabic ? 'الأفضل سعراً' : 'Lowest Price'}
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-700 text-[15px]">{alt.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 font-medium">{alt.supplier}</span>
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-slate-700">${alt.price.toFixed(2)}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 bg-blue-50 px-2 py-1 rounded">
                          <Truck className="w-3.5 h-3.5" />
                          {alt.deliveryTime}
                        </div>
                        
                        <button
                          disabled
                          className="flex items-center gap-1.5 text-slate-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 cursor-not-allowed bg-white"
                        >
                          {isArabic ? 'طلب B2B (قريباً)' : 'Order B2B (Soon)'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
