import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ShoppingCart, Activity, Building2 } from 'lucide-react';

export interface AlternativeItem {
  id: string;
  name: string;
  manufacturer?: string;
  unitPrice: number;
  expiryDate?: string;
  stock: number;
  activeIngredient?: string;
}

interface GenericAlternativeCardProps {
  searchedBrand: string;
  activeIngredientName: string;
  alternatives: AlternativeItem[];
  onAddToCart: (item: AlternativeItem) => void;
  lang: 'en' | 'ar';
}

export default function GenericAlternativeCard({
  searchedBrand,
  activeIngredientName,
  alternatives,
  onAddToCart,
  lang,
}: GenericAlternativeCardProps) {
  if (!alternatives || alternatives.length === 0) return null;
  const isArabic = lang === 'ar';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-amber-200 rounded-lg overflow-hidden shadow-sm max-w-4xl mx-auto my-3"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Banner */}
      <div className="bg-amber-50/90 p-4 sm:p-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-amber-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl mt-0.5 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-amber-950 text-base sm:text-lg">
              {isArabic ? 'العلامة التجارية غير متوفرة / بدائل متكافئة' : 'Exact brand out of stock / Bio-Equivalents'}
            </h3>
            <p className="text-amber-800 text-xs sm:text-sm mt-0.5 leading-relaxed max-w-xl">
              {isArabic 
                ? `لم نتمكن من العثور على "${searchedBrand}". نعرض لك بدائل متوفرة في الصيدلية تحتوي على نفس المادة الفعالة:` 
                : `We couldn't find "${searchedBrand}" in stock. Available alternatives with the same active ingredient:`}
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-amber-200/60 rounded-lg text-amber-900 text-xs font-bold uppercase tracking-wide">
              <Activity className="w-3.5 h-3.5" />
              {activeIngredientName}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of alternatives - Centered for both mobile and desktop */}
      <div className="p-4 sm:p-6 bg-slate-50/50 flex flex-wrap items-stretch justify-center gap-4">
        {alternatives.map((item, idx) => (
          <div 
            key={item.id}
            className="w-full sm:w-[280px] md:w-[300px] bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between relative group"
          >
            {idx === 0 && (
              <div className="absolute -top-2.5 -right-2.5 bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs z-10 border-2 border-white">
                {isArabic ? 'الأفضل سعراً' : 'Best Value'}
              </div>
            )}
            
            <div className="mb-3">
              <h4 className="text-base font-bold text-slate-800 line-clamp-2">
                {item.name}
              </h4>
              {item.manufacturer && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{item.manufacturer}</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-slate-50 rounded-xl text-xs border border-slate-100">
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5">{isArabic ? 'السعر' : 'Unit Price'}</div>
                <div className="font-bold text-brand-700 font-mono">{Number(item.unitPrice || 0).toLocaleString()} {isArabic ? 'ل.س' : 'SYP'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5">{isArabic ? 'المخزون' : 'Stock'}</div>
                <div className="font-bold text-slate-700">{item.stock} {isArabic ? 'علبة' : 'units'}</div>
              </div>
              {item.expiryDate && (
                <div className="col-span-2 mt-1">
                  <div className="text-[10px] uppercase text-slate-400 font-semibold mb-0.5">{isArabic ? 'تاريخ الصلاحية' : 'Expiry'}</div>
                  <div className="font-mono text-xs text-slate-600">{item.expiryDate}</div>
                </div>
              )}
            </div>

            <button
              onClick={() => onAddToCart(item)}
              className="w-full py-2.5 bg-brand-50 text-brand-800 hover:bg-brand-600 hover:text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors duration-200 border border-brand-200 hover:border-transparent text-xs cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              {isArabic ? 'إضافة بديل للطلب' : 'Add Alternative'}
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
