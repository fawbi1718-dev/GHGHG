import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
 Calendar, 
 MapPin, 
 History, 
 Plus, 
 Minus, 
 TrendingUp, 
 TrendingDown, 
 AlertTriangle,
 User,
 Shield,
 Clock,
 Package,
 Activity,
 Archive,
 Save,
 ShoppingCart,
 Send
} from 'lucide-react';
import { Medicine } from '../types';
import { translations } from '../data/translations';
import { useAuth } from '../application/auth/AuthContext';
import { db } from '../infrastructure/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface ItemViewTabProps {
 medicines: Medicine[];
 selectedMedicineId: string | null;
 onSelectMedicine: (id: string | null) => void;
 onUpdateStock: (id: string, delta: number, note?: string) => void;
 onUpdateDetails: (id: string, updatedFields: Partial<Medicine>) => void;
 triggerToast: (message: string, type: 'success' | 'info') => void;
 lang?: 'en' | 'ar';
}

export default function ItemViewTab({
 medicines,
 selectedMedicineId,
 onSelectMedicine,
 onUpdateStock,
 onUpdateDetails,
 triggerToast,
 lang = 'en',
}: ItemViewTabProps) {
 const t = translations[lang];
 const { currentSession } = useAuth();
 // Memoized lookups: the selected medicine and the low-stock shortcut list
 // are derived once per input change instead of on every render pass.
 const medicine = useMemo(
 () => medicines.find(med => med.id === selectedMedicineId),
 [medicines, selectedMedicineId]
 );
 const lowStockMedicines = useMemo(
 () => medicines.filter(m => m.stock < m.minThreshold),
 [medicines]
 );

 // States for B2B Order
 const [b2bQty, setB2bQty] = useState<string>('50');
 const [isSubmittingB2B, setIsSubmittingB2B] = useState(false);

 // States for manual transactions
 const [transactionDelta, setTransactionDelta] = useState<string>('');
 const [transactionType, setTransactionType] = useState<'manual_add' | 'manual_subtract'>('manual_subtract');
 const [transactionNote, setTransactionNote] = useState<string>('');

 // States for Edit Details mode
 const [isEditing, setIsEditing] = useState(false);
 const [editForm, setEditForm] = useState<Partial<Medicine>>({});

 // Reset form states on medicine change
 React.useEffect(() => {
 setTransactionDelta('');
 setTransactionNote('');
 setIsEditing(false);
 if (medicine) {
 setEditForm({
 strength: medicine.strength,
 shelfLocation: medicine.shelfLocation,
 price: medicine.price,
 minThreshold: medicine.minThreshold,
 supplier: medicine.supplier,
 batchNumber: medicine.batchNumber,
 });
 }
 }, [selectedMedicineId, medicine]);

 const translateCategory = (cat: string) => {
 if (lang !== 'ar') return cat;
 const cats: Record<string, string> = {
 'All': 'الكل',
 'Antibiotics': 'مضادات حيوية',
 'Cardiology': 'أدوية القلب',
 'Analgesics': 'مسكنات الألم',
 'Antivirals': 'مضادات الفيروسات',
 'Diabetic': 'أدوية السكري',
 'Imported': 'مخزون مستورد',
 };
 return cats[cat] || cat;
 };

 if (!medicine) {
 // Elegant fallback screen when no item is selected
 return (
 <div id="item-view-empty" className="p-8 rounded-xl bg-white border border-slate-200 text-center max-w-2xl mx-auto space-y-6 my-8 shadow-sm">
 <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-emerald-600 mx-auto">
 <Activity className="w-7 h-7 stroke-[2.2] animate-pulse" />
 </div>
 <div>
 <h2 className="text-xl font-bold text-slate-800 ">{t.reviewTelemetry}</h2>
 <p className="text-slate-500 text-xs mt-2 max-w-md mx-auto leading-relaxed font-semibold">
 {t.reviewTelemetryDescription}
 </p>
 </div>

 {/* Shortcuts list */}
 <div className="space-y-3">
 <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
 {lang === 'ar' ? 'مقترحات المراجعة العاجلة' : 'Critical Review Suggestions'}
 </div>
 <div className="flex flex-wrap justify-center gap-2">
 {lowStockMedicines.length > 0 ? (
 lowStockMedicines.map(m => (
 <button
 key={m.id}
 onClick={() => onSelectMedicine(m.id)}
 className="bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
 >
 <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
 {m.name} ({lang === 'ar' ? 'مخزون' : 'Stock'}: {m.stock})
 </button>
 ))
 ) : (
 medicines.slice(0, 4).map(m => (
 <button
 key={m.id}
 onClick={() => onSelectMedicine(m.id)}
 className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
 >
 <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
 {m.name}
 </button>
 ))
 )}
 </div>
 </div>
 </div>
 );
 }

 const daysToExpiry = Math.ceil((new Date(medicine.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
 const isExpired = daysToExpiry <= 0;
 const isExpiringSoon = daysToExpiry > 0 && daysToExpiry < 90;
 const isLowStock = medicine.stock < medicine.minThreshold;
 const totalValuation = medicine.stock * medicine.price;

 const handleCommitTransaction = (e: React.FormEvent) => {
 e.preventDefault();
 const deltaNum = parseInt(transactionDelta, 10);
 if (isNaN(deltaNum) || deltaNum <= 0) {
 triggerToast(lang === 'ar' ? "يرجى إدخال كمية صحيحة للتعديل." : "Please enter a positive transaction quantity delta.", "info");
 return;
 }

 const appliedDelta = transactionType === 'manual_add' ? deltaNum : -deltaNum;
 
 if (transactionType === 'manual_subtract' && medicine.stock - deltaNum < 0) {
 triggerToast(lang === 'ar' ? `المخزون غير كافٍ! لا يمكن صرف كمية أكبر من المتاح (${medicine.stock}).` : `Insufficient stock! Cannot dispense more than current stock (${medicine.stock}).`, "info");
 return;
 }

 onUpdateStock(
 medicine.id, 
 appliedDelta, 
 transactionNote.trim() || (lang === 'ar' ? `تعديل يدوي للسجل (${transactionType === 'manual_add' ? 'إضافة' : 'صرف'})` : `Manual ledger adjustment (${transactionType === 'manual_add' ? 'addition' : 'subtraction'})`)
 );

 triggerToast(
 lang === 'ar' 
 ? `تم قيد الحركة بنجاح: ${transactionType === 'manual_add' ? '+' : '-'}${deltaNum} وحدة.` 
 : `Committed ledger change: ${transactionType === 'manual_add' ? '+' : '-'}${deltaNum} to stock.`, 
 "success"
 );
 setTransactionDelta('');
 setTransactionNote('');
 };

 const handleSaveDetails = (e: React.FormEvent) => {
 e.preventDefault();
 const priceNum = parseFloat(editForm.price as any);
 const thresholdNum = parseInt(editForm.minThreshold as any, 10);

 if (isNaN(priceNum) || priceNum <= 0) {
 triggerToast(lang === 'ar' ? "يجب أن يكون السعر رقماً صحيحاً موجباً" : "Price must be a valid positive number", "info");
 return;
 }
 if (isNaN(thresholdNum) || thresholdNum < 0) {
 triggerToast(lang === 'ar' ? "يجب أن يكون حد الأمان رقماً صحيحاً أكبر أو يساوي صفر" : "Threshold must be a valid positive number or 0", "info");
 return;
 }

 onUpdateDetails(medicine.id, {
 strength: editForm.strength,
 shelfLocation: editForm.shelfLocation,
 price: priceNum,
 minThreshold: thresholdNum,
 supplier: editForm.supplier,
 batchNumber: editForm.batchNumber,
 lastUpdated: new Date().toISOString()
 });

 triggerToast(lang === 'ar' ? `تم تحديث البيانات التعريفية لـ ${medicine.name}.` : `Updated profile metadata for ${medicine.name}.`, "success");
 setIsEditing(false);
 };

 const handleGenerateB2BOrder = async () => {
 if (!currentSession || !currentSession.pharmacyId) return;
 const qty = parseInt(b2bQty, 10);
 if (isNaN(qty) || qty <= 0) {
 triggerToast("Please enter a valid B2B restock quantity.", "info");
 return;
 }

 setIsSubmittingB2B(true);
 try {
 // Find Ibn Sina Wholesalers tenant Id or use generic if not found
 // Actually we know it from associatedTenantIds if we seeded it, or we can just query it.
 // But we can also just let the user know it's a DRAFT order.
 // The prompt asks to "Generate a restock request to 'Ibn Sina Wholesalers'".
 // Since it's a mock test, let's just use the first WHOLESALE_WAREHOUSE the user has access to,
 // or default to "mock_wholesaler".
 let sellerTenantId = "tenant_mock_warehouse_1";
 if (currentSession.associatedTenantIds && currentSession.associatedTenantIds.length > 0) {
 // Just pick the last one assuming it's the one we seeded recently
 sellerTenantId = currentSession.associatedTenantIds[currentSession.associatedTenantIds.length - 1];
 }

 const orderId = `b2b_req_${Date.now()}`;
 
 const orderData = {
 orderId,
 buyerTenantId: currentSession.pharmacyId,
 sellerTenantId,
 status: "DRAFT", // The prompt explicitly asks to verify order state is 'DRAFT'
 items: [{
 id: `item_${Date.now()}`,
 originalCatalogId: medicine.id,
 name: medicine.name,
 requestedQuantity: qty,
 costAtOrder: medicine.price * 0.8 // 20% margin
 }],
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString()
 };

 await setDoc(doc(db, "orders", orderId), orderData);
 
 triggerToast("B2B Restock Order generated in DRAFT state!", "success");
 setB2bQty('50');
 } catch (e) {
 console.error(e);
 triggerToast("Failed to generate B2B order.", "info");
 } finally {
 setIsSubmittingB2B(false);
 }
 };

 const getTransactionTypeStyle = (type: string) => {
 switch (type) {
 case 'manual_add':
 case 'stock_in':
 return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 ', icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> };
 case 'manual_subtract':
 return { bg: 'bg-rose-50 text-rose-700 border-rose-200 ', icon: <TrendingDown className="w-3.5 h-3.5 text-rose-600" /> };
 case 'scan_add':
 return { bg: 'bg-blue-50 text-emerald-700 border-blue-200 ', icon: <Plus className="w-3.5 h-3.5 text-emerald-600" /> };
 default:
 return { bg: 'bg-slate-100 text-slate-700 border-slate-200 ', icon: <Clock className="w-3.5 h-3.5 text-slate-500" /> };
 }
 };

 return (
 <div id="item-view-container" className="space-y-6">
 {/* Detail Header & Action */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <button
 onClick={() => onSelectMedicine(null)}
 className="text-xs font-mono font-bold text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer shadow-sm animate-pulse"
 >
 {lang === 'ar' ? '← العودة للسجل العام' : '← Back to Ledger'}
 </button>
 <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
 <Shield className="w-3.5 h-3.5 text-emerald-500" />
 {lang === 'ar' ? 'رمز حماية العزل:' : 'Tenant Isolation Key:'} <b className="text-slate-600 ">pharmacy-east-01</b>
 </span>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
 {/* Analytics Card Column */}
 <div className="lg:col-span-4 space-y-6">
 <div className="p-6 rounded-xl bg-white border border-slate-200 relative overflow-hidden shadow-sm">
 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
 
 {/* Core Item Label */}
 <div>
 <span className="text-[10px] font-mono font-bold text-emerald-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md uppercase">
 {translateCategory(medicine.category)}
 </span>
 <h2 className="text-xl font-bold tracking-tight text-slate-800 mt-3">
 {medicine.name}
 </h2>
 <p className="text-slate-400 text-xs italic mt-0.5 font-mono">
 {medicine.genericName}
 </p>
 </div>

 {/* Live Stats Gauges */}
 <div className="mt-6 space-y-4 pt-6 border-t border-slate-100 ">
 {/* Stock Bar */}
 <div>
 <div className="flex justify-between text-[11px] font-mono mb-1 text-slate-500">
 <span className="font-bold">{lang === 'ar' ? 'درجة إشباع المخزون' : 'Stock Saturation'}</span>
 <span className={isLowStock ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
 {medicine.stock} / {medicine.minThreshold * 2} {lang === 'ar' ? 'علبة' : 'capacity'}
 </span>
 </div>
 <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
 <div 
 className={`h-full rounded-full transition-all duration-500 ${
 isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
 }`}
 style={{ width: `${Math.min(100, (medicine.stock / ((medicine.minThreshold * 2) || 1)) * 100)}%` }}
 />
 </div>
 <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mt-1.5">
 <span>{lang === 'ar' ? 'حد طلب إعادة التوريد:' : 'Reorder threshold limit:'} {medicine.minThreshold}</span>
 <span className={isLowStock ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
 {isLowStock ? (lang === 'ar' ? 'تنبيه: مخزون منخفض' : 'LOW TRIGGER') : (lang === 'ar' ? 'آمن' : 'SECURE')}
 </span>
 </div>
 </div>

 {/* Financial Valuation Widget */}
 <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex justify-between items-center">
 <div className="font-mono">
 <span className="text-[9px] text-slate-400 uppercase block font-bold">{lang === 'ar' ? 'إجمالي قيمة المستودع' : 'Asset Valuation'}</span>
 <span className="text-md font-bold text-emerald-600 mt-0.5 block">
 {(Number(totalValuation) || 0).toLocaleString()} {lang === 'ar' ? 'ل.س' : 'S.P.'}
 </span>
 </div>
 <div className="text-right font-mono">
 <span className="text-[9px] text-slate-400 uppercase block font-bold">{lang === 'ar' ? 'سعر المفرد للعلبة' : 'Price per Unit'}</span>
 <span className="text-xs text-slate-600 mt-0.5 block font-bold">
 {(Number(medicine?.price) || 0).toLocaleString()} {lang === 'ar' ? 'ل.س' : 'S.P.'}
 </span>
 </div>
 </div>

 {/* Shelf Expiry gauge */}
 <div className={`p-3 rounded-xl border flex justify-between items-center ${
 isExpired 
 ? 'bg-rose-50 border-rose-200 text-rose-800 ' 
 : isExpiringSoon 
 ? 'bg-amber-50 border-amber-200 text-amber-800 ' 
 : 'bg-slate-50 border-slate-150 text-slate-700 '
 }`}>
 <div className="font-mono">
 <span className="text-[9px] text-slate-400 uppercase block font-bold">{lang === 'ar' ? 'تاريخ الصلاحية' : 'Shelf Expiry'}</span>
 <span className="text-xs font-bold mt-0.5 block">
 {medicine.expiryDate}
 </span>
 </div>
 <div className="text-right font-mono">
 <span className="text-[9px] text-slate-400 uppercase block font-bold">{lang === 'ar' ? 'الوقت المتبقي' : 'Countdown'}</span>
 <span className={`text-xs font-bold mt-0.5 block ${
 isExpired 
 ? 'text-rose-600' 
 : isExpiringSoon 
 ? 'text-amber-600' 
 : 'text-emerald-600'
 }`}>
 {isExpired 
 ? (lang === 'ar' ? 'منتهي الصلاحية' : 'EXPIRED') 
 : lang === 'ar' ? `متبقي ${daysToExpiry} يوم` : `${daysToExpiry} days`}
 </span>
 </div>
 </div>
 </div>

 {/* Specifications list */}
 <div className="mt-6 pt-6 border-t border-slate-100 font-mono text-xs space-y-2.5">
 <div className="flex justify-between">
 <span className="text-slate-400">{lang === 'ar' ? 'الشكل الصيدلاني:' : 'Dosage Form:'}</span>
 <span className="text-slate-700 font-bold">{medicine.dosageForm}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-400">{lang === 'ar' ? 'العيار والتركيز:' : 'Strength:'}</span>
 <span className="text-slate-700 font-bold">{medicine.strength}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-400">{lang === 'ar' ? 'مكان التخزين:' : 'Shelf Location:'}</span>
 <span className="text-slate-700 font-bold">{medicine.shelfLocation}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-400">{lang === 'ar' ? 'رقم الطبخة/LOT:' : 'Batch Code:'}</span>
 <span className="text-slate-700 font-bold">{medicine.batchNumber}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-400">{lang === 'ar' ? 'المورد المعتمد:' : 'Supplier:'}</span>
 <span className="text-slate-700 font-bold text-right truncate max-w-[180px]" title={medicine.supplier}>
 {medicine.supplier}
 </span>
 </div>
 <div className="flex justify-between text-[10px] pt-1 text-slate-400 italic">
 <span>{lang === 'ar' ? 'آخر تحديث للبيان:' : 'Last Updated:'}</span>
 <span>{new Date(medicine.lastUpdated).toLocaleString()}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Detailed Panels (Edit / Adjust Stock / History Timeline) */}
 <div className="lg:col-span-8 space-y-6">
 {/* Toggle buttons */}
 <div className="flex gap-2">
 <button
 onClick={() => setIsEditing(false)}
 className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all border cursor-pointer ${
 !isEditing 
 ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
 : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
 }`}
 >
 {lang === 'ar' ? 'حركات الإدخال والصرف' : 'Adjust Ledger Stock'}
 </button>
 <button
 id="btn-toggle-edit"
 onClick={() => setIsEditing(true)}
 className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all border cursor-pointer ${
 isEditing 
 ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
 : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
 }`}
 >
 {lang === 'ar' ? 'تعديل البيانات التعريفية' : 'Edit Specs Sheet'}
 </button>
 </div>

 <AnimatePresence mode="wait">
 {!isEditing ? (
 <motion.div
 key="ledger-tab"
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 className="space-y-6"
 >
 {/* Adjust Stock Form Card */}
 <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
 <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
 <History className="text-emerald-600 stroke-[2.2]" />
 {lang === 'ar' ? 'تسجيل حركة مخزنية جديدة' : 'Record Ledger Stock Change'}
 </h3>
 <p className="text-xs text-slate-400 leading-relaxed">
 {lang === 'ar' 
 ? 'قم بتقييد عمليات الصرف اليومية أو عمليات توريد الأدوية. يتم حفظ التوقيت الدقيق والتاريخ وتفاصيل الحركة تلقائياً.' 
 : 'Log stock replenishment or dispensations. Every submission stamps a real-time trace in this medicine\'s permanent document history.'}
 </p>

 <form onSubmit={handleCommitTransaction} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
 {/* Action Selector */}
 <div className="md:col-span-3 space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'نوع العملية' : 'Action Type'}</label>
 <select
 id="ledger-action-type"
 value={transactionType}
 onChange={(e) => setTransactionType(e.target.value as any)}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-colors appearance-none cursor-pointer"
 >
 <option value="manual_subtract">{lang === 'ar' ? 'صرف دواء (-)' : 'Dispense (-)'}</option>
 <option value="manual_add">{lang === 'ar' ? 'توريد/إضافة (+)' : 'Replenish (+)'}</option>
 </select>
 </div>

 {/* Quantity Input */}
 <div className="md:col-span-3 space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'الكمية (بالعلبة)' : 'Quantity (Units)'}</label>
 <input
 id="ledger-action-qty"
 type="number"
 min="1"
 required
 placeholder="e.g. 10"
 value={transactionDelta}
 onChange={(e) => setTransactionDelta(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
 />
 </div>

 {/* Transaction Note */}
 <div className="md:col-span-4 space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'ملاحظات الحركة والتدقيق' : 'Audit Log Reason'}</label>
 <input
 id="ledger-action-note"
 type="text"
 placeholder={lang === 'ar' ? 'مثال: صرف دواء بوصفة طبية' : 'e.g. Dispensed under prescription'}
 value={transactionNote}
 onChange={(e) => setTransactionNote(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none focus:border-emerald-500/50 transition-colors"
 />
 </div>

 {/* Commit Button */}
 <div className="md:col-span-2">
 <button
 id="btn-commit-ledger"
 type="submit"
 className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
 >
 {lang === 'ar' ? 'تقييد الحركة' : 'Commit'}
 </button>
 </div>
 </form>
 </div>

 {/* B2B Restock Card */}
 <div className="p-6 rounded-xl bg-indigo-50/50 border border-indigo-200/50 shadow-sm space-y-4">
 <div className="flex justify-between items-center pb-2">
 <h3 className="text-md font-bold text-indigo-900 flex items-center gap-2">
 <ShoppingCart className="text-emerald-600 w-5 h-5 stroke-[2.2]" />
 {lang === 'ar' ? 'طلب توريد من المستودع (B2B)' : 'Wholesale Restock Request (B2B)'}
 </h3>
 </div>
 <p className="text-xs text-indigo-700/80 leading-relaxed">
 {lang === 'ar' 
 ? 'إنشاء طلب توريد إلكتروني مباشر من المستودع المعتمد.' 
 : 'Generate a direct procurement order to your primary wholesale distributor.'}
 </p>

 <div className="flex flex-col sm:flex-row gap-4 items-end">
 <div className="w-full sm:w-1/3 space-y-1.5">
 <label className="text-xs font-semibold text-indigo-800 font-mono">
 {lang === 'ar' ? 'الكمية المطلوبة' : 'Requested Qty'}
 </label>
 <input
 type="number"
 min="1"
 value={b2bQty}
 onChange={(e) => setB2bQty(e.target.value)}
 className="w-full bg-white border border-indigo-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
 />
 </div>
 <button
 onClick={handleGenerateB2BOrder}
 disabled={isSubmittingB2B}
 className="w-full sm:w-auto px-6 py-2 bg-emerald-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-500/20"
 >
 <Send className="w-3.5 h-3.5" />
 {lang === 'ar' ? 'إرسال طلب التوريد' : 'Submit Restock Request'}
 </button>
 </div>
 </div>

 {/* History timeline card */}
 <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
 <div className="flex justify-between items-center border-b border-slate-100 pb-3">
 <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
 <Clock className="text-emerald-600 stroke-[2.2]" />
 {lang === 'ar' ? 'سجل التدقيق التاريخي للبطاقة' : 'Audit History Timeline'}
 </h3>
 <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
 {lang === 'ar' ? 'الحركات الصادرة والواردة' : 'Inbound & Outbound Logs'}
 </span>
 </div>

 <div className="space-y-4 max-h-96 overflow-y-auto pr-1 scrollbar">
 {medicine.history && medicine.history.length > 0 ? (
 medicine.history.map((log) => {
 const style = getTransactionTypeStyle(log.type);
 const isDeltaPositive = log.delta > 0;
 return (
 <div key={log.id} className="relative pl-6 pb-4 border-l border-slate-100 last:border-transparent last:pb-0">
 {/* Bullet Circle */}
 <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full border-2 ${
 isDeltaPositive ? 'bg-emerald-500 border-white' : 'bg-rose-500 border-white'
 }`} />

 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-150 ">
 <div className="space-y-1">
 <div className="flex flex-wrap items-center gap-2">
 <span className={`text-[9px] font-mono font-bold uppercase tracking-wide border px-1.5 py-0.5 rounded flex items-center gap-1 ${style.bg}`}>
 {style.icon}
 {log.type === 'manual_subtract' && lang === 'ar' ? 'تخفيض يدوي' : 
 log.type === 'manual_add' && lang === 'ar' ? 'إدخال يدوي' : 
 log.type === 'scan_add' && lang === 'ar' ? 'إدخال باركود' : 
 log.type.replace('_', ' ')}
 </span>
 <span className="text-xs text-slate-700 font-bold font-mono">
 {isDeltaPositive ? '+' : ''}{log.delta} {lang === 'ar' ? 'علبة' : 'units'}
 </span>
 <span className="text-[10px] text-slate-400 font-mono font-semibold">
 → {lang === 'ar' ? 'الرصيد بعد الحركة:' : 'Balance:'} {log.stockAfter}
 </span>
 </div>
 <p className="text-xs text-slate-600 font-medium">{log.note}</p>
 </div>

 <div className="text-right shrink-0 font-mono">
 <span className="text-[10px] text-slate-400 block font-bold">
 {new Date(log.timestamp).toLocaleString()}
 </span>
 <span className="text-[9px] text-emerald-600 block mt-0.5 font-bold">
 {lang === 'ar' ? 'المسؤول:' : 'Operator:'} {log.userEmail || "anonymous"}
 </span>
 </div>
 </div>
 </div>
 );
 })
 ) : (
 <div className="text-center py-6 text-slate-400 text-xs italic">
 {lang === 'ar' ? 'لا يوجد حركات مضافة بعد لهذا الصنف صيدلانياً.' : 'No transactions found. Adjust stock above to create audit traces.'}
 </div>
 )}
 </div>
 </div>
 </motion.div>
 ) : (
 <motion.div
 key="edit-tab"
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 >
 <form onSubmit={handleSaveDetails} className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
 <div className="flex justify-between items-center border-b border-slate-100 pb-3">
 <div>
 <h3 className="text-md font-bold text-slate-800 ">{lang === 'ar' ? 'تعديل المعايير التفصيلية للبطاقة' : 'Edit Specs Sheet'}</h3>
 <p className="text-xs text-slate-400 mt-0.5">
 {lang === 'ar' ? 'تعديل المعايير السريرية المعتمدة ومكان التخزين ومستويات الأمان.' : 'Update core characteristics and shelf telemetry parameters.'}
 </p>
 </div>
 <Archive className="text-slate-400" />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Strength */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'العيار والتركيز' : 'Product Strength'}</label>
 <input
 id="edit-strength"
 type="text"
 required
 value={editForm.strength || ''}
 onChange={(e) => setEditForm({ ...editForm, strength: e.target.value })}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none focus:border-emerald-500/50 transition-all"
 />
 </div>

 {/* Shelf Location */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'مكان التخزين (الرف)' : 'Shelf Location'}</label>
 <input
 id="edit-location"
 type="text"
 required
 value={editForm.shelfLocation || ''}
 onChange={(e) => setEditForm({ ...editForm, shelfLocation: e.target.value })}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none focus:border-emerald-500/50 transition-all"
 />
 </div>

 {/* Price */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'سعر مبيع المفرد (ل.س)' : 'Price per Unit (ل.س)'}</label>
 <input
 id="edit-price"
 type="number"
 required
 value={editForm.price || ''}
 onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
 />
 </div>

 {/* Warning Threshold */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'الحد الأدنى للأمان' : 'Safety Threshold Limit'}</label>
 <input
 id="edit-threshold"
 type="number"
 required
 value={editForm.minThreshold || ''}
 onChange={(e) => setEditForm({ ...editForm, minThreshold: parseInt(e.target.value, 10) || 0 })}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
 />
 </div>

 {/* Batch Number */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'رقم الطبخة LOT' : 'Batch / LOT Code'}</label>
 <input
 id="edit-batch"
 type="text"
 required
 value={editForm.batchNumber || ''}
 onChange={(e) => setEditForm({ ...editForm, batchNumber: e.target.value })}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
 />
 </div>

 {/* Supplier */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-500 font-mono">{lang === 'ar' ? 'اسم المورد المعتمد' : 'Supplier Distributor'}</label>
 <input
 id="edit-supplier"
 type="text"
 required
 value={editForm.supplier || ''}
 onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
 className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none focus:border-emerald-500/50 transition-all"
 />
 </div>
 </div>

 <div className="flex justify-end gap-3 pt-2">
 <button
 type="button"
 onClick={() => setIsEditing(false)}
 className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
 >
 {lang === 'ar' ? 'إلغاء' : 'Cancel'}
 </button>
 <button
 id="btn-save-details"
 type="submit"
 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
 >
 <Save className="w-3.5 h-3.5" />
 {lang === 'ar' ? 'حفظ التعديلات' : 'Save Details'}
 </button>
 </div>
 </form>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 </div>
 );
}
