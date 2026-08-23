import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Link as LinkIcon, Save, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { db } from '../infrastructure/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../application/auth/AuthContext';

interface BarcodeLinkerModalProps {
 isOpen: boolean;
 onClose: () => void;
 lang?: 'en' | 'ar';
 scannedBarcode: string;
 triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
 onLinkComplete?: () => void;
}

export default function BarcodeLinkerModal({
 isOpen,
 onClose,
 lang = 'en',
 scannedBarcode,
 triggerToast,
 onLinkComplete
}: BarcodeLinkerModalProps) {
 const { searchCatalogRemote } = useCatalog();
 const { currentSession } = useAuth();
 
 const [searchQuery, setSearchQuery] = useState('');
 const [debouncedQuery, setDebouncedQuery] = useState('');
 const [suggestions, setSuggestions] = useState<any[]>([]);
 const [selectedItem, setSelectedItem] = useState<any | null>(null);
 const [isLinking, setIsLinking] = useState(false);

 useEffect(() => {
 if (isOpen) {
 setSearchQuery('');
 setSelectedItem(null);
 setSuggestions([]);
 }
 }, [isOpen]);

 useEffect(() => {
 const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
 return () => clearTimeout(timer);
 }, [searchQuery]);

 useEffect(() => {
 let isMounted = true;
 const searchMeds = async () => {
 if (!debouncedQuery.trim() || selectedItem) {
 setSuggestions([]);
 return;
 }
 try {
 const results = await searchCatalogRemote(debouncedQuery.trim(), 15);
 if (isMounted) setSuggestions(results);
 } catch (e) {
 console.error(e);
 }
 };
 searchMeds();
 return () => { isMounted = false; };
 }, [debouncedQuery, searchCatalogRemote, selectedItem]);

 const handleLinkBarcode = async () => {
 if (!selectedItem || !currentSession?.pharmacyId || !db) return;
 
 setIsLinking(true);
 try {
 // Create a mapped alias record in Firestore for this pharmacy
 // e.g. tenants/{pharmacyId}/barcode_aliases/{scannedBarcode}
 const aliasRef = doc(db, 'tenants', currentSession.pharmacyId, 'barcode_aliases', scannedBarcode);
 await setDoc(aliasRef, {
 barcode: scannedBarcode,
 catalogId: selectedItem.id,
 linkedAt: new Date().toISOString(),
 linkedBy: currentSession.userId || 'unknown'
 });
 
 triggerToast(
 lang === 'ar' ? 'تم ربط الباركود بنجاح. يمكنك الآن إضافته للمخزون.' : 'Barcode linked successfully. You can now restock it.',
 'success'
 );
 if (onLinkComplete) {
 onLinkComplete();
 }
 onClose();
 } catch (err) {
 console.error(err);
 triggerToast(
 lang === 'ar' ? 'فشل ربط الباركود' : 'Failed to link barcode',
 'error'
 );
 } finally {
 setIsLinking(false);
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 10 }}
 onClick={(e) => e.stopPropagation()}
 className="w-full max-w-xl bg-white rounded-xl shadow-md overflow-hidden flex flex-col max-h-[90vh]"
 >
 <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-blue-100 text-brand-600 flex items-center justify-center">
 <LinkIcon className="w-5 h-5" />
 </div>
 <div>
 <h2 className="text-lg font-bold text-slate-800">
 {lang === 'ar' ? 'ربط باركود غير معروف' : 'Link Unknown Barcode'}
 </h2>
 <p className="text-xs text-slate-500 font-medium font-mono mt-0.5">
 {scannedBarcode}
 </p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="p-6 overflow-y-auto flex-1">
 <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-2 text-brand-700 text-sm">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
 <p>
 {lang === 'ar' 
 ? `لم يتم العثور على الباركود (${scannedBarcode}). ابحث في الكتالوج المركزي لربطه بمنتج موجود.`
 : `Barcode (${scannedBarcode}) not found. Search the master catalog to link it to an existing product.`}
 </p>
 </div>

 <div className="mb-6 relative">
 <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
 {lang === 'ar' ? 'البحث عن الدواء' : 'Search Medicine'}
 </label>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="text"
 autoFocus
 value={searchQuery}
 onChange={(e) => {
 setSearchQuery(e.target.value);
 if (selectedItem) setSelectedItem(null);
 }}
 className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
 placeholder={lang === 'ar' ? 'بحث بالاسم العلمي أو التجاري...' : 'Search by scientific or trade name...'}
 />
 </div>

 {/* Suggestions Dropdown */}
 {suggestions.length > 0 && !selectedItem && (
 <div className="absolute z-10 top-full left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden divide-y divide-slate-100">
 {suggestions.map((item, idx) => (
 <div
 key={idx}
 onClick={() => {
 setSelectedItem(item);
 setSearchQuery(item.name || item.name_en || '');
 setSuggestions([]);
 }}
 className="p-3 hover:bg-blue-50 cursor-pointer transition-colors"
 >
 <div className="font-bold text-slate-800 text-sm">{item.name || item.name_en}</div>
 <div className="text-xs text-slate-500 mt-0.5 font-medium">{item.composition}</div>
 </div>
 ))}
 </div>
 )}
 </div>
 
 {selectedItem && (
 <div className="p-4 border border-brand-200 bg-brand-50 rounded-xl flex items-center justify-between">
 <div>
 <h4 className="font-bold text-brand-900">{selectedItem.name || selectedItem.name_en}</h4>
 <p className="text-xs text-brand-700 mt-1">{selectedItem.composition}</p>
 </div>
 <CheckCircle2 className="w-6 h-6 text-brand-500" />
 </div>
 )}
 </div>

 <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
 <button 
 type="button" 
 onClick={onClose}
 className="px-4 py-2 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
 >
 {lang === 'ar' ? 'إلغاء' : 'Cancel'}
 </button>
 
 <button
 onClick={handleLinkBarcode}
 disabled={!selectedItem || isLinking}
 className={`px-6 py-2 rounded-xl text-white font-bold text-sm transition-all shadow-sm flex items-center gap-2 ${!selectedItem || isLinking ? 'bg-blue-400/50 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 hover:shadow-md'}`}
 >
 {isLinking ? (
 <RefreshCw className="w-4 h-4 animate-spin" />
 ) : (
 <Save className="w-4 h-4" />
 )}
 {lang === 'ar' ? 'ربط بالباركود' : 'Link Barcode'}
 </button>
 </div>
 </motion.div>
 </div>
 );
}
