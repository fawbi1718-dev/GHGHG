import React, { useState } from 'react';
import { useAuth } from '../../application/auth/AuthContext';
import { db } from '../../infrastructure/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { Search, Loader2, PackagePlus, ScanLine, Tag, CheckCircle2, History, Layers, Calendar, DollarSign, Archive, Trash2 } from 'lucide-react';

interface IngestionSessionItem {
 id: string;
 barcode: string;
 name: string;
 cartons: number;
 boxesPerCarton: number;
 totalQuantity: number;
 wholesalePrice: number;
 expiryDate: string;
 batchNumber: string;
 timestamp: Date;
}

export default function WarehouseIngestionTab({ triggerToast, lang = 'en' }: { triggerToast: (msg: string, type: 'success'|'info'|'error') => void, lang?: 'en' | 'ar' }) {
 const { currentSession, activePharmacy } = useAuth();
 
 const [barcode, setBarcode] = useState('');
 const [isSearching, setIsSearching] = useState(false);
 const [name, setName] = useState('');
 const [genericName, setGenericName] = useState('');
 
 const [cartons, setCartons] = useState('');
 const [boxesPerCarton, setBoxesPerCarton] = useState('');
 const [wholesalePrice, setWholesalePrice] = useState('');
 const [expiryDate, setExpiryDate] = useState(''); // MM/YYYY
 const [batchNumber, setBatchNumber] = useState('');
 
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [sessionItems, setSessionItems] = useState<IngestionSessionItem[]>([]);

 const handleLookup = async (e?: React.FormEvent) => {
 if (e) e.preventDefault();
 if (!barcode.trim()) return;
 
 setIsSearching(true);
 try {
 // 1. Try registeredCode
 let q = query(collection(db, 'medicines_catalog'), where('registeredCode', '==', barcode));
 let snapshot = await getDocs(q);
 
 // 2. Try commercialBarcodes if not found
 if (snapshot.empty) {
 q = query(collection(db, 'medicines_catalog'), where('commercialBarcodes', 'array-contains', barcode));
 snapshot = await getDocs(q);
 }
 
 if (!snapshot.empty) {
 const data = snapshot.docs[0].data();
 setName(data.tradeName || data.name || '');
 setGenericName(data.scientificName || data.genericName || '');
 if (data.packagingUnits) {
 setBoxesPerCarton(data.packagingUnits.toString());
 }
 triggerToast(lang === 'ar' ? 'تم العثور على الصنف في الكتالوج' : "Found catalog entry", "success");
 } else {
 triggerToast(lang === 'ar' ? 'غير موجود في الكتالوج، يرجى الإدخال اليدوي' : "Not found in catalog. Please enter manually.", "info");
 }
 } catch (err) {
 console.error(err);
 triggerToast("Error looking up barcode", "error");
 } finally {
 setIsSearching(false);
 }
 };

 const handleAddInventory = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!currentSession?.pharmacyId || !activePharmacy) return;
 
 const c = parseInt(cartons, 10) || 0;
 const b = parseInt(boxesPerCarton, 10) || 1;
 const totalQty = c * b;
 const price = parseFloat(wholesalePrice) || 0;
 
 if (!barcode || !name || totalQty <= 0 || price <= 0 || !expiryDate) {
 triggerToast(lang === 'ar' ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields", "error");
 return;
 }

 setIsSubmitting(true);
 try {
 // Parse MM/YYYY
 let formattedExpiry = expiryDate;
 if (expiryDate.includes('/')) {
 const [mm, yyyy] = expiryDate.split('/');
 formattedExpiry = `${yyyy}-${mm.padStart(2, '0')}-01`;
 }

 if (!currentSession?.pharmacyId || !barcode || typeof barcode !== 'string' || !barcode.trim()) {
 triggerToast(lang === 'ar' ? 'رمز الباركود غير صالح' : 'Invalid barcode or workspace ID', 'error');
 setIsSubmitting(false);
 return;
 }

 // Root path fallback just in case, but usually /tenants/{tenantId}/inventory/{barcode}
 const inventoryRef = doc(db, 'tenants', currentSession.pharmacyId, 'inventory', barcode.trim().replace(/\//g, '_'));
 
 const snap = await getDoc(inventoryRef);
 let existingStock = 0;
 if (snap.exists()) {
 existingStock = snap.data().stock || 0;
 }

 const payload = {
 id: barcode,
 catalogId: barcode,
 barcode: barcode,
 name: name,
 genericName: genericName,
 tenantId: currentSession.pharmacyId,
 tenantType: 'WHOLESALE',
 isPublic: true,
 unitPrice: price,
 stock: existingStock + totalQty,
 cartons: c,
 boxesPerCarton: b,
 batchNumber: batchNumber,
 expiryDate: formattedExpiry,
 warehouseName: activePharmacy.name,
 location: activePharmacy.verifiedLocation || 'Main Hub',
 isAdvertiser: true,
 updatedAt: new Date().toISOString()
 };
 
 await setDoc(inventoryRef, payload, { merge: true });
 
 const newItemId = Math.random().toString(36).substring(7);
 
 setSessionItems(prev => [{
 id: newItemId,
 barcode,
 name,
 cartons: c,
 boxesPerCarton: b,
 totalQuantity: totalQty,
 wholesalePrice: price,
 expiryDate,
 batchNumber,
 timestamp: new Date()
 }, ...prev]);
 
 triggerToast(lang === 'ar' ? `تم إضافة ${totalQty} وحدة للمخزون` : `Added ${totalQty} units of ${name} to inventory`, "success");
 
 // Keep boxesPerCarton or generic details, reset variables that change per batch
 setBarcode('');
 setName('');
 setGenericName('');
 setCartons('');
 setBoxesPerCarton('');
 setWholesalePrice('');
 setExpiryDate('');
 setBatchNumber('');
 
 } catch (err) {
 console.error(err);
 triggerToast("Failed to add inventory", "error");
 } finally {
 setIsSubmitting(false);
 }
 };
 
 const handleRemoveSessionItem = (id: string) => {
 setSessionItems(prev => prev.filter(item => item.id !== id));
 // Note: In a real app we might subtract it from Firestore if they undo, 
 // but for this UI a local remove is sufficient.
 };

 return (
 <div className="max-w-7xl mx-auto space-y-6 pb-20">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
 <div>
 <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
 <PackagePlus className="text-emerald-600" />
 {lang === 'ar' ? 'إدخال مخزون المستودع' : 'Warehouse Stock Ingestion'}
 </h1>
 <p className="text-sm text-slate-500 mt-1">
 {lang === 'ar' ? 'مسح الباركود وتسجيل الكميات المستلمة' : 'Scan barcodes and register incoming wholesale stock'}
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
 
 {/* Ingestion Form */}
 <div className="lg:col-span-8 space-y-6">
 <form onSubmit={handleAddInventory} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
 
 {/* Step 1: Barcode Scan & Lookup */}
 <div className="mb-8">
 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
 <ScanLine className="w-4 h-4 text-indigo-500" />
 {lang === 'ar' ? 'مسح الباركود للبحث' : 'Scan Barcode / Lookup'}
 </label>
 <div className="flex gap-3">
 <input
 type="text"
 value={barcode}
 onChange={e => setBarcode(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLookup(); } }}
 placeholder={lang === 'ar' ? 'أدخل أو امسح الباركود...' : 'Scan or enter barcode...'}
 className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
 autoFocus
 />
 <button
 type="button"
 onClick={handleLookup}
 disabled={isSearching || !barcode}
 className="px-6 py-3 bg-slate-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center gap-2"
 >
 {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
 {lang === 'ar' ? 'بحث' : 'Search'}
 </button>
 </div>
 </div>

 {/* Step 2: Details */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
 <div>
 <label className="text-sm font-bold text-slate-700 mb-2 block">
 {lang === 'ar' ? 'الاسم التجاري' : 'Trade Name'} *
 </label>
 <input
 type="text"
 required
 value={name}
 onChange={e => setName(e.target.value)}
 placeholder="e.g. Panadol Extra"
 className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
 />
 </div>
 <div>
 <label className="text-sm font-bold text-slate-700 mb-2 block">
 {lang === 'ar' ? 'الاسم العلمي (اختياري)' : 'Scientific Name (Optional)'}
 </label>
 <input
 type="text"
 value={genericName}
 onChange={e => setGenericName(e.target.value)}
 placeholder="e.g. Paracetamol"
 className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
 />
 </div>
 </div>

 <hr className="border-slate-100 mb-8" />

 {/* Step 3: Quantities & Pricing */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
 <div>
 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
 <Archive className="w-4 h-4 text-emerald-500" />
 {lang === 'ar' ? 'عدد الكراتين' : 'No. of Cartons'} *
 </label>
 <input
 type="number"
 required
 min="1"
 value={cartons}
 onChange={e => setCartons(e.target.value)}
 className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
 placeholder="0"
 />
 </div>
 <div>
 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
 <Layers className="w-4 h-4 text-emerald-500" />
 {lang === 'ar' ? 'علب في الكرتون' : 'Boxes per Carton'} *
 </label>
 <input
 type="number"
 required
 min="1"
 value={boxesPerCarton}
 onChange={e => setBoxesPerCarton(e.target.value)}
 className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
 placeholder="0"
 />
 </div>
 <div>
 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
 <DollarSign className="w-4 h-4 text-indigo-500" />
 {lang === 'ar' ? 'سعر الجملة للعلبة' : 'Wholesale Price / Box'} *
 </label>
 <input
 type="number"
 required
 step="0.01"
 min="0"
 value={wholesalePrice}
 onChange={e => setWholesalePrice(e.target.value)}
 className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
 placeholder="0.00"
 />
 </div>
 </div>

 {/* Step 4: Batch & Expiry */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
 <div>
 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
 <Calendar className="w-4 h-4 text-amber-500" />
 {lang === 'ar' ? 'تاريخ الصلاحية (MM/YYYY)' : 'Expiry Date (MM/YYYY)'} *
 </label>
 <input
 type="text"
 required
 value={expiryDate}
 onChange={e => setExpiryDate(e.target.value)}
 placeholder="MM/YYYY"
 pattern="(0[1-9]|1[0-2])\/\d{4}"
 title="Format: MM/YYYY"
 className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
 />
 </div>
 <div>
 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
 <Tag className="w-4 h-4 text-amber-500" />
 {lang === 'ar' ? 'رقم التشغيلة (اختياري)' : 'Batch Number (Optional)'}
 </label>
 <input
 type="text"
 value={batchNumber}
 onChange={e => setBatchNumber(e.target.value)}
 placeholder="BATCH-12345"
 className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
 />
 </div>
 </div>

 <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
 <div className="text-sm font-medium text-slate-500">
 {lang === 'ar' ? 'إجمالي الكمية المدخلة:' : 'Total Quantity to Add:'} 
 <span className="text-xl font-bold text-emerald-600 ml-2">
 {(parseInt(cartons, 10) || 0) * (parseInt(boxesPerCarton, 10) || 0)}
 </span>
 </div>
 <button
 type="submit"
 disabled={isSubmitting}
 className="px-8 py-3 bg-emerald-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
 >
 {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
 {lang === 'ar' ? 'إضافة للمخزون' : 'Add to Inventory'}
 </button>
 </div>
 </form>
 </div>

 {/* Session Summary Panel */}
 <div className="lg:col-span-4">
 <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 sticky top-6 h-auto max-h-[80vh] flex flex-col">
 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
 <History className="w-5 h-5 text-slate-500" />
 {lang === 'ar' ? 'المدخلات الحالية' : 'Session Summary'}
 </h3>
 
 <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
 {sessionItems.length === 0 ? (
 <div className="text-center py-12 text-slate-400">
 <PackagePlus className="w-12 h-12 mx-auto mb-3 opacity-20" />
 <p className="text-sm">{lang === 'ar' ? 'لا يوجد مدخلات في هذه الجلسة بعد.' : 'No items ingested in this session yet.'}</p>
 </div>
 ) : (
 sessionItems.map(item => (
 <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col relative group">
 <button 
 onClick={() => handleRemoveSessionItem(item.id)}
 className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50:bg-red-900/20 rounded-md transition-colors opacity-0 group-hover:opacity-100"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 
 <h4 className="font-bold text-slate-800 pr-8">{item.name}</h4>
 <span className="text-[10px] font-mono text-slate-500">{item.barcode}</span>
 
 <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-sm">
 <div>
 <span className="text-slate-500 block text-xs">{lang === 'ar' ? 'الكمية' : 'Qty'}</span>
 <span className="font-bold text-emerald-600">+{item.totalQuantity}</span>
 </div>
 <div>
 <span className="text-slate-500 block text-xs">{lang === 'ar' ? 'السعر' : 'Price'}</span>
 <span className="font-bold text-emerald-600">${item.wholesalePrice.toFixed(2)}</span>
 </div>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 </div>

 </div>
 </div>
 );
}
