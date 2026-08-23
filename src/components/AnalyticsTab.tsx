import React from 'react';
import { motion } from 'motion/react';
import { 
 TrendingUp, 
 AlertTriangle, 
 CalendarDays, 
 Package, 
 MapPin, 
 ArrowRight,
 Info,
 Layers,
 Share2
} from 'lucide-react';
import { Medicine } from '../types';
import { translations } from '../data/translations';

interface AnalyticsTabProps {
 medicines: Medicine[];
 onSelectMedicine: (id: string) => void;
 triggerToast: (message: string, type: 'success' | 'info') => void;
 lang?: 'en' | 'ar';
}

export default function AnalyticsTab({ medicines, onSelectMedicine, triggerToast, lang = 'en' }: AnalyticsTabProps) {
 const t = translations[lang];

 // Current time for expiry checks
 const today = new Date();

 // "Share Missing Items" - formats items with stock <= minThreshold / stock === 0 and copies to clipboard
 const handleShareMissing = (e: React.MouseEvent) => {
 e.stopPropagation();
 
 // Filter items with quantity = 0 or below threshold (stock < minThreshold or stock === 0)
 const lackingItems = medicines.filter(item => item.stock === 0 || item.stock < item.minThreshold);
 
 if (lackingItems.length === 0) {
 triggerToast(
 lang === 'ar' 
 ? "لا توجد أدوية منخفضة أو ناقصة حالياً!" 
 : "No items are currently below safety thresholds!", 
 "info"
 );
 return;
 }

 // Format: "ORDER: Panadol(10), Amoxicillin(5)"
 // Restock quantity: (minThreshold * 2) - stock
 const orders = lackingItems.map(item => {
 const suggestedQty = (item.minThreshold * 2) - item.stock;
 return `${item.name}(${suggestedQty})`;
 });

 const orderStr = `ORDER: ${orders.join(', ')}`;

 // Copy to clipboard with iframe-resilient fallback
 const textArea = document.createElement("textarea");
 textArea.value = orderStr;
 textArea.style.top = "0";
 textArea.style.left = "0";
 textArea.style.position = "fixed";
 textArea.style.opacity = "0";
 document.body.appendChild(textArea);
 textArea.focus();
 textArea.select();
 
 try {
 document.execCommand('copy');
 triggerToast(
 lang === 'ar' 
 ? "تم نسخ نص الطلب! الصقه لمرسله لموردك عبر واتساب." 
 : "Order string copied! Paste this to your supplier via WhatsApp.", 
 "success"
 );
 } catch (err) {
 console.error("Failed to copy", err);
 triggerToast(
 lang === 'ar' 
 ? "فشل نسخ النص. يرجى تكرار المحاولة." 
 : "Failed to copy order string automatically.", 
 "info"
 );
 }
 document.body.removeChild(textArea);
 };

 // Helper to calculate days until expiry
 const getDaysToExpiry = (expiryStr: string) => {
 const expiry = new Date(expiryStr);
 const diffTime = expiry.getTime() - today.getTime();
 return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 };

 // Calculations
 const totalUniqueItems = medicines.length;
 const totalStockItems = medicines.reduce((acc, item) => acc + item.stock, 0);

 // Expiring soon: within 30 days
 const expiringSoonItems = medicines.filter(item => {
 const days = getDaysToExpiry(item.expiryDate);
 return days >= 0 && days <= 30;
 });

 // Low stock: under the 20% threshold (stock < minThreshold * 0.2)
 const lowStockThresholdItems = medicines.filter(item => {
 const threshold20 = item.minThreshold * 0.2;
 return item.stock < threshold20;
 });

 return (
 <div id="analytics-tab-root" className="space-y-8 animate-fade-in">
 {/* Page Header */}
 <div>
 <h1 className="text-3xl font-bold tracking-tight text-slate-800 font-display flex items-center gap-3">
 <TrendingUp className="text-brand-500 w-8 h-8 stroke-[2.2]" />
 {lang === 'ar' ? 'تحليلات مخزون العيادة' : 'Clinical Inventory Analytics'}
 </h1>
 <p className="text-slate-500 text-sm mt-1 leading-relaxed">
 {lang === 'ar' 
 ? 'إحصاءات تشغيلية عالية المستوى، ومؤشرات الخطورة السريرية للمستودع الدوائي.' 
 : 'High-level operational stats, clinical risk metrics, and priority replenishment indicators.'}
 </p>
 </div>

 {/* High-Level KPIs Bento Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* KPI 1: Total Stock */}
 <div className="p-6 rounded-xl glass-panel bg-white border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl pointer-events-none" />
 <div className="flex items-center gap-4">
 <div className="p-3 bg-blue-50 rounded-xl text-brand-600">
 <Package className="w-6 h-6 stroke-[2]" />
 </div>
 <div>
 <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
 {lang === 'ar' ? 'إجمالي المواد المتوفرة' : 'Total Items In Stock'}
 </span>
 <div className="flex items-baseline gap-2 mt-1">
 <span className="text-4xl font-bold text-slate-800 font-mono tracking-tight">{(Number(totalStockItems) || 0).toLocaleString()}</span>
 <span className="text-slate-400 text-xs font-mono">{lang === 'ar' ? 'وحدة' : 'units'}</span>
 </div>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
 <span className="text-slate-500">{lang === 'ar' ? 'الأدوية الفريدة المسجلة' : 'Unique medicines tracked'}</span>
 <span className="font-semibold text-slate-700 font-mono">{totalUniqueItems} SKUs</span>
 </div>
 </div>

 {/* KPI 2: Expiring Soon */}
 <div className="p-6 rounded-xl glass-panel bg-white border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
 <div className="flex items-center gap-4">
 <div className={`p-3 rounded-xl ${expiringSoonItems.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
 <CalendarDays className="w-6 h-6 stroke-[2]" />
 </div>
 <div>
 <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
 {lang === 'ar' ? 'ينتهي خلال ٣٠ يوماً' : 'Expiring Within 30 Days'}
 </span>
 <div className="flex items-baseline gap-2 mt-1">
 <span className={`text-4xl font-bold font-mono tracking-tight ${expiringSoonItems.length > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
 {expiringSoonItems.length}
 </span>
 <span className="text-slate-400 text-xs font-mono">{lang === 'ar' ? 'مادة' : 'items'}</span>
 </div>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
 <span className="text-slate-500">{lang === 'ar' ? 'تتطلب التدوير العاجل' : 'Requires immediate rotation'}</span>
 {expiringSoonItems.length > 0 && <span className="font-bold text-rose-500 animate-pulse">{lang === 'ar' ? 'إجراء مطلوب' : 'Action Required'}</span>}
 </div>
 </div>

 {/* KPI 3: Low Stock Alerts */}
 <div className="p-6 rounded-xl glass-panel bg-white border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
 <div className="flex items-center gap-4">
 <div className={`p-3 rounded-xl ${lowStockThresholdItems.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
 <AlertTriangle className="w-6 h-6 stroke-[2]" />
 </div>
 <div>
 <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
 {lang === 'ar' ? 'مخزون حرج منخفض (<٢٠٪)' : 'Critical Low Stock (<20%)'}
 </span>
 <div className="flex items-baseline gap-2 mt-1">
 <span className={`text-4xl font-bold font-mono tracking-tight ${lowStockThresholdItems.length > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
 {lowStockThresholdItems.length}
 </span>
 <span className="text-slate-400 text-xs font-mono">{lang === 'ar' ? 'مادة' : 'items'}</span>
 </div>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
 <span className="text-slate-500">{lang === 'ar' ? 'أقل من حد الأمان المحدد' : 'Under 20% of min safety stock'}</span>
 {lowStockThresholdItems.length > 0 && <span className="font-bold text-amber-600">{lang === 'ar' ? 'ينصح بالتوريد' : 'Reorder Advised'}</span>}
 </div>
 </div>
 </div>

 {/* Main Analysis Split Panels */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 
 {/* Left Column: Expiring Soon List */}
 <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
 <div>
 <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
 <h2 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
 <CalendarDays className="text-rose-500 w-5 h-5" />
 {lang === 'ar' ? 'قائمة مراقبة الصلاحية الحرجة (٣٠ يوماً)' : 'Critical Expiry Watchlist (30 Days)'}
 </h2>
 <span className="text-xs font-mono text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full font-bold">
 {expiringSoonItems.length} {lang === 'ar' ? 'تنبيهات' : 'Warnings'}
 </span>
 </div>

 {expiringSoonItems.length === 0 ? (
 <div className="py-12 text-center text-slate-400 text-xs space-y-2">
 <p className="font-medium">{lang === 'ar' ? 'جميع الأدوية في تاريخ صلاحية آمن وسليم.' : 'All medicines have healthy clinical shelf lives.'}</p>
 <p className="text-[11px] text-slate-400">{lang === 'ar' ? 'لا توجد وجبات تنتهي صلاحيتها خلال الـ ٣٠ يوماً القادمة.' : 'No batches expiring within the next 30 days.'}</p>
 </div>
 ) : (
 <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
 {expiringSoonItems.map(item => {
 const days = getDaysToExpiry(item.expiryDate);
 return (
 <div 
 key={item.id}
 onClick={() => onSelectMedicine(item.id)}
 className="p-3.5 bg-slate-50/50 hover:bg-slate-100 border border-slate-100 rounded-xl transition-all flex justify-between items-center cursor-pointer group"
 >
 <div className="space-y-1">
 <div className="font-semibold text-slate-800 text-xs group-hover:text-brand-600:text-blue-400 transition-colors">
 {item.name} <span className="text-slate-400 text-[10px] font-mono">({item.strength})</span>
 </div>
 <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
 <span>{lang === 'ar' ? 'الرف' : 'Shelf'}: {item.shelfLocation}</span>
 <span>•</span>
 <span>{lang === 'ar' ? 'الوجبة' : 'Batch'}: {item.batchNumber}</span>
 </div>
 </div>
 <div className="text-right shrink-0">
 <span className="text-[10px] font-bold uppercase font-mono px-2 py-1 rounded bg-rose-50 border border-rose-100 text-rose-600">
 {days === 0 
 ? (lang === 'ar' ? 'ينتهي اليوم' : 'Expires Today') 
 : (lang === 'ar' ? `متبقي ${days} يوم` : `${days} Days Left`)}
 </span>
 <span className="text-[10px] text-slate-400 block mt-1 font-mono">{item.expiryDate}</span>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
 <span className="flex items-center gap-1">
 <Info className="w-3.5 h-3.5 text-slate-400" />
 {lang === 'ar' ? 'تأكد من تطبيق نظام الصرف حسب الأسبقية في الانتهاء (FEFO).' : 'Ensure FEFO (First Expired, First Out) inventory rotation.'}
 </span>
 </div>
 </div>

 {/* Right Column: Under 20% Safety Stock Alerts List */}
 <div className="p-6 rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
 <div>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-100">
 <h2 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
 <AlertTriangle className="text-amber-500 w-5 h-5 animate-pulse" />
 {lang === 'ar' ? 'تنبيهات الأمان للمخزون المنخفض (<٢٠٪)' : 'Under-Threshold Safety Alerts (<20%)'}
 </h2>
 <div className="flex items-center gap-2">
 <span className="text-xs font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
 {lowStockThresholdItems.length} {lang === 'ar' ? 'منخفض' : 'Low'}
 </span>
 <button
 id="btn-share-missing"
 onClick={handleShareMissing}
 title={lang === 'ar' ? 'نسخ ومشاركة قائمة المواد الناقصة' : 'Copy and share missing/low-stock items list'}
 className="bg-brand-600 hover:bg-brand-700 text-white:bg-brand-700 text-xs font-bold font-sans px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
 >
 <Share2 className="w-3.5 h-3.5 text-white" />
 <span>{lang === 'ar' ? 'مشاركة النواقص' : 'Share Missing'}</span>
 </button>
 </div>
 </div>

 {lowStockThresholdItems.length === 0 ? (
 <div className="py-12 text-center text-slate-400 text-xs space-y-2">
 <p className="font-medium">{lang === 'ar' ? 'جميع مستويات مخزون الأدوية في النطاق الآمن.' : 'All medicine stock levels are clinically safe.'}</p>
 <p className="text-[11px] text-slate-400">{lang === 'ar' ? 'لا توجد مواد تنخفض كمياتها حالياً عن الـ ٢٠٪ كحد أمان.' : 'No items are currently below the 20% minimum safety buffer.'}</p>
 </div>
 ) : (
 <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
 {lowStockThresholdItems.map(item => {
 const percentageOfThreshold = Math.round((item.stock / (item.minThreshold || 10)) * 100);
 return (
 <div 
 key={item.id}
 onClick={() => onSelectMedicine(item.id)}
 className="p-3.5 bg-slate-50/50 hover:bg-slate-100 border border-slate-100 rounded-xl transition-all flex flex-col gap-2.5 cursor-pointer group"
 >
 <div className="flex justify-between items-start">
 <div className="space-y-1">
 <div className="font-semibold text-slate-800 text-xs group-hover:text-brand-600:text-blue-400 transition-colors">
 {item.name} <span className="text-slate-400 text-[10px] font-mono">({item.strength})</span>
 </div>
 <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
 <span>{lang === 'ar' ? 'المورد' : 'Supplier'}: {item.supplier}</span>
 <span>•</span>
 <span>{lang === 'ar' ? 'الرف' : 'Shelf'}: {item.shelfLocation}</span>
 </div>
 </div>
 <div className="text-right font-mono shrink-0">
 <span className="text-xs font-bold text-rose-500 block">
 {item.stock} {lang === 'ar' ? 'علبة بالمستودع' : 'in stock'}
 </span>
 <span className="text-[10px] text-slate-400 block mt-0.5">
 {lang === 'ar' ? 'حد الأمان' : 'Min safety'}: {item.minThreshold}
 </span>
 </div>
 </div>

 {/* Progress Bar & Status percentage */}
 <div className="space-y-1">
 <div className="flex justify-between text-[10px] font-mono text-slate-400">
 <span>{lang === 'ar' ? 'حالة مستوى الأمان:' : 'Safety Level Status:'}</span>
 <span className="text-rose-500 font-bold">{percentageOfThreshold}% {lang === 'ar' ? 'من حد التنبيه' : 'of threshold'}</span>
 </div>
 <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
 <div 
 className="h-full bg-rose-500 rounded-full" 
 style={{ width: `${Math.min(100, Math.max(5, percentageOfThreshold))}%` }} 
 />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
 <span className="flex items-center gap-1">
 <Layers className="w-3.5 h-3.5 text-slate-400" />
 {lang === 'ar' ? 'المخزون منخفض بشكل حرج. ينصح بطلب التوريد والإنعاش.' : 'Stock is critically depleted. Procurement reorder is advised.'}
 </span>
 </div>
 </div>
 </div>
 </div>
 );
}
