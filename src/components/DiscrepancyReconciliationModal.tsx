import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Check, Save } from 'lucide-react';
import { db } from '../infrastructure/firebase';
import { collection, getDocs, doc, writeBatch, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../application/auth/AuthContext';
import { Medicine } from '../types';

interface DiscrepancyReconciliationModalProps {
 medicine: Medicine;
 onClose: () => void;
 triggerToast: (msg: string, type: 'success' | 'error') => void;
 lang: 'en' | 'ar';
}

export default function DiscrepancyReconciliationModal({ medicine, onClose, triggerToast, lang }: DiscrepancyReconciliationModalProps) {
 const { currentSession } = useAuth();
 const [batches, setBatches] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 
 // reconciliation state
 const [reconcilingBatchId, setReconcilingBatchId] = useState<string | null>(null);
 const [physicalCount, setPhysicalCount] = useState<number>(0);
 const [reason, setReason] = useState<string>('');
 const [isSubmitting, setIsSubmitting] = useState(false);

 useEffect(() => {
 async function fetchBatches() {
 if (!currentSession?.pharmacyId || !db) return;
 try {
 const safeMedId = String(medicine.id).replace(/\//g, '_');
 const batchesRef = collection(db, 'tenants', currentSession.pharmacyId, 'storage_inventory', safeMedId, 'batches');
 const snap = await getDocs(batchesRef);
 const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
 // Only show batches with negative stock or all batches
 setBatches(loaded.filter(b => (b.stock || 0) < 0));
 } catch (e) {
 console.error("Failed to load batches", e);
 } finally {
 setLoading(false);
 }
 }
 fetchBatches();
 }, [currentSession, medicine.id]);

 const handleReconcile = async () => {
 if (!reconcilingBatchId || !currentSession?.pharmacyId || !db) return;
 setIsSubmitting(true);
 try {
 const batchToFix = batches.find(b => b.id === reconcilingBatchId);
 if (!batchToFix) return;
 
 const currentStock = batchToFix.stock || 0;
 const difference = physicalCount - currentStock; // e.g. counted 0 - current -4 = +4
 
 const safeMedId = String(medicine.id).replace(/\//g, '_');
 const batchRef = doc(db, 'tenants', currentSession.pharmacyId, 'storage_inventory', safeMedId, 'batches', reconcilingBatchId);
 const medRef = doc(db, 'tenants', currentSession.pharmacyId, 'storage_inventory', safeMedId);
 const auditRef = collection(db, 'tenants', currentSession.pharmacyId, 'inventory_audit_logs');
 
 const wb = writeBatch(db);
 
 // Update batch stock
 wb.update(batchRef, { stock: physicalCount, lastUpdated: new Date().toISOString() });
 
 // Update aggregate stock
 wb.update(medRef, { stock: increment(difference), lastUpdated: new Date().toISOString() });
 
 // Create explicit audit trail
 wb.set(doc(auditRef), {
 type: 'RECONCILIATION',
 medId: safeMedId,
 batchId: reconcilingBatchId,
 previousStock: currentStock,
 newStock: physicalCount,
 adjustment: difference,
 reason: reason,
 timestamp: serverTimestamp(),
 userEmail: currentSession.email || 'unknown',
 });
 
 await wb.commit();
 
 triggerToast(lang === 'ar' ? 'تمت المطابقة بنجاح' : 'Reconciliation applied successfully', 'success');
 setReconcilingBatchId(null);
 setPhysicalCount(0);
 setReason('');
 
 // Update local state
 setBatches(prev => prev.filter(b => b.id !== reconcilingBatchId)); // If resolved (>=0), it drops from list
 } catch (e: any) {
 triggerToast(e.message || 'Failed to reconcile', 'error');
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="bg-white rounded-xl shadow-md w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
 >
 <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
 <AlertTriangle className="w-5 h-5" />
 </div>
 <div>
 <h2 className="text-lg font-bold text-slate-800 tracking-tight">
 {lang === 'ar' ? 'مطابقة فروقات الجرد' : 'Inventory Discrepancy Reconciliation'}
 </h2>
 <p className="text-xs text-slate-500 font-medium">
 {medicine.name}
 </p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="p-5 overflow-y-auto">
 {loading ? (
 <div className="text-center py-10 text-slate-500">{lang === 'ar' ? 'جاري التحميل...' : 'Loading batches...'}</div>
 ) : batches.length === 0 ? (
 <div className="text-center py-10 text-brand-600 font-medium">
 {lang === 'ar' ? 'لا توجد فروقات سالبة لهذه المادة' : 'No negative discrepancies found for this item.'}
 </div>
 ) : (
 <div className="space-y-4">
 <p className="text-sm text-slate-600 mb-4">
 {lang === 'ar' ? 'تم اكتشاف وجبات بكمية سالبة نتيجة المبيعات دون اتصال.' : 'The following batches have negative stock due to offline sales concurrency.'}
 </p>
 {batches.map(batch => (
 <div key={batch.id} className="border border-red-200 bg-red-50/30 rounded-xl p-4">
 <div className="flex justify-between items-center mb-3">
 <div>
 <span className="text-xs font-mono font-bold text-slate-500">{lang === 'ar' ? 'رقم الوجبة' : 'Batch'}: {batch.batchNumber || 'N/A'}</span>
 <div className="text-sm font-bold text-red-700 mt-1">
 {lang === 'ar' ? 'الكمية الحالية' : 'Current System Quantity'}: {batch.stock}
 </div>
 </div>
 {reconcilingBatchId !== batch.id && (
 <button 
 onClick={() => {
 setReconcilingBatchId(batch.id);
 setPhysicalCount(0); // usually they recount and find 0, or maybe they found some elsewhere
 }}
 className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
 >
 {lang === 'ar' ? 'مطابقة' : 'Reconcile'}
 </button>
 )}
 </div>
 
 {reconcilingBatchId === batch.id && (
 <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="pt-3 border-t border-red-200 mt-3 space-y-3">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-bold text-slate-700 mb-1">{lang === 'ar' ? 'الكمية الفعلية (الجرد)' : 'Physical Count'}</label>
 <input 
 type="number" 
 value={physicalCount}
 onChange={e => setPhysicalCount(Number(e.target.value))}
 className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
 />
 </div>
 <div>
 <label className="block text-xs font-bold text-slate-700 mb-1">{lang === 'ar' ? 'السبب / ملاحظات' : 'Reason / Notes'}</label>
 <input 
 type="text" 
 value={reason}
 placeholder={lang === 'ar' ? 'مثال: جرد فعلي' : 'e.g. Physical count adjustment'}
 onChange={e => setReason(e.target.value)}
 className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
 />
 </div>
 </div>
 <div className="flex justify-end gap-2 mt-4">
 <button 
 onClick={() => setReconcilingBatchId(null)}
 className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
 >
 {lang === 'ar' ? 'إلغاء' : 'Cancel'}
 </button>
 <button 
 onClick={handleReconcile}
 disabled={isSubmitting}
 className="px-4 py-2 text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2"
 >
 <Check className="w-4 h-4" />
 {isSubmitting ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ المطابقة' : 'Apply Adjustment')}
 </button>
 </div>
 </motion.div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 </motion.div>
 </div>
 );
}
