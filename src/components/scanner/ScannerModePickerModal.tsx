import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, PlusCircle, X, Camera, Zap, PackageCheck, Sparkles } from 'lucide-react';

export type ScannerMode = 'SELL' | 'ADD_STOCK';

interface ScannerModePickerModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSelectMode: (mode: ScannerMode) => void;
 lang?: 'en' | 'ar';
}

export default function ScannerModePickerModal({
 isOpen,
 onClose,
 onSelectMode,
 lang = 'ar'
}: ScannerModePickerModalProps) {
 if (!isOpen) return null;

 return (
 <AnimatePresence>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none"
 onClick={onClose}
 >
 <motion.div
 initial={{ scale: 0.95, y: 12, opacity: 0 }}
 animate={{ scale: 1, y: 0, opacity: 1 }}
 exit={{ scale: 0.95, y: 12, opacity: 0 }}
 transition={{ duration: 0.18, ease: 'easeOut' }}
 className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-2xl text-white overflow-hidden my-auto"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header Accent Glow */}
 <div className="absolute -top-12 -left-12 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
 <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

 {/* Close Button */}
 <button
 onClick={onClose}
 className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-all"
 >
 <X className="w-5 h-5" />
 </button>

 {/* Title Header */}
 <div className="text-center space-y-2 mb-6">
 <div className="inline-flex items-center justify-center p-3 bg-brand-50 text-brand-700 rounded-md border border-brand-200 mb-1">
 <Camera className="w-7 h-7" />
 </div>
 <h3 className="text-xl font-extrabold text-white flex items-center justify-center gap-2">
 {lang === 'ar' ? 'ماذا تريد أن تفعل؟' : 'What would you like to do?'}
 </h3>
 <p className="text-xs text-slate-400 max-w-xs mx-auto">
 {lang === 'ar' 
 ? 'اختر وضع الكاميرا لبدء البيع المباشر أو إدخال بضاعة جديدة للمخزون' 
 : 'Select camera mode to start quick checkout or inventory intake'}
 </p>
 </div>

 {/* Mode Options Cards */}
 <div className="grid grid-cols-1 gap-3.5">
 {/* Option A: SELL */}
 <button
 onClick={() => onSelectMode('SELL')}
 className="group relative p-4 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-teal-500/60 rounded-xl text-right transition-all duration-200 active:scale-[0.98] shadow-lg flex items-center gap-4 overflow-hidden"
 dir={lang === 'ar' ? 'rtl' : 'ltr'}
 >
 <div className="p-3 bg-teal-500/15 group-hover:bg-teal-500 text-teal-400 group-hover:text-slate-950 rounded-xl border border-teal-500/30 transition-all shrink-0">
 <ShoppingCart className="w-6 h-6" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <h4 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors">
 {lang === 'ar' ? 'بيع مباشر (POS)' : 'Sell in POS'}
 </h4>
 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
 {lang === 'ar' ? 'مسح سريع مستمر' : 'Continuous Scan'}
 </span>
 </div>
 <p className="text-xs text-slate-400 mt-1 line-clamp-2">
 {lang === 'ar' 
 ? 'إضافة الأدوية مباشرة إلى سلة نقطة البيع والفاتورة النشطة' 
 : 'Add scanned medicines directly to active checkout cart'}
 </p>
 </div>
 </button>

 {/* Option B: ADD_STOCK */}
 <button
 onClick={() => onSelectMode('ADD_STOCK')}
 className="group relative p-4 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-purple-500/60 rounded-xl text-right transition-all duration-200 active:scale-[0.98] shadow-lg flex items-center gap-4 overflow-hidden"
 dir={lang === 'ar' ? 'rtl' : 'ltr'}
 >
 <div className="p-3 bg-purple-500/15 group-hover:bg-purple-500 text-purple-400 group-hover:text-white rounded-xl border border-purple-500/30 transition-all shrink-0">
 <PlusCircle className="w-6 h-6" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <h4 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
 {lang === 'ar' ? 'إدخال وجبة / مخزون' : 'Add Stock & Intake'}
 </h4>
 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
 {lang === 'ar' ? 'تعبئة تلقائية' : 'Auto-fill'}
 </span>
 </div>
 <p className="text-xs text-slate-400 mt-1 line-clamp-2">
 {lang === 'ar' 
 ? 'جلب اسم الدواء وسعره من الكتالوج لملء نموذج الإدخال فوراً' 
 : 'Fetch name & price from catalog to auto-populate intake form'}
 </p>
 </div>
 </button>
 </div>

 {/* Footer note */}
 <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
 <Sparkles className="w-3.5 h-3.5 text-teal-400" />
 <span>{lang === 'ar' ? 'مدعوم بقاعدة بيانات الأدوية المعتمدة' : 'Powered by Master Pharmaceutical Database'}</span>
 </div>
 </motion.div>
 </motion.div>
 </AnimatePresence>
 );
}
