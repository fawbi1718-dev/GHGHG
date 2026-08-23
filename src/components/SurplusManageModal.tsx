import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../infrastructure/firebase';
import { Medicine } from '../types';

export interface SurplusListing {
  offerDocId: string;
  active: boolean;
  availableQuantity: number;
  priceSyp: number;
}

interface SurplusManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  listing: SurplusListing | null;
  sellerTenantId: string;
  lang?: 'en' | 'ar';
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  /** Called after any successful change so the Ledger can refresh its badge. */
  onChanged?: () => void;
}

/**
 * Manage an existing surplus listing: edit quantity/price, pause/resume,
 * or deactivate entirely (with optional reason). Deactivation writes the
 * existing OFFER_DEACTIVATED notification event (warn-only) so affected
 * pharmacies are informed and prune their carts. Private inventory is
 * never touched.
 */
export default function SurplusManageModal({
  isOpen,
  onClose,
  medicine,
  listing,
  sellerTenantId: _sellerTenantId,
  lang = 'en',
  triggerToast,
  onChanged
}: SurplusManageModalProps) {
  const [qty, setQty] = useState<string>(String(listing?.availableQuantity ?? 0));
  const [price, setPrice] = useState<string>(String(listing?.priceSyp ?? 0));
  const [reason, setReason] = useState<string>('Sold out');
  const [busy, setBusy] = useState<'save' | 'toggle' | 'deactivate' | null>(null);

  React.useEffect(() => {
    if (isOpen && listing) {
      setQty(String(listing.availableQuantity));
      setPrice(String(listing.priceSyp));
      setBusy(null);
    }
  }, [isOpen, listing]);

  if (!medicine || !listing) return null;

  const offerRef = () => doc(db!, 'wholesale_offers', listing.offerDocId);

  const notifyDeactivation = async (finalReason: string) => {
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      if (!db) return;
      await addDoc(collection(db, 'b2b_notifications'), {
        type: 'OFFER_DEACTIVATED',
        offerId: listing.offerDocId,
        catalogId: String(medicine.catalogId || medicine.id),
        sellerName: medicine.name,
        drugName: (medicine as any).nameEn || medicine.name,
        reason: finalReason,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Deactivation notification skipped:', e);
    }
  };

  const handleSave = async () => {
    const nQty = parseInt(qty, 10);
    const nPrice = Number(price);
    if (!Number.isFinite(nQty) || nQty < 0) return triggerToast(lang === 'ar' ? 'كمية غير صالحة' : 'Invalid quantity', 'error');
    if (!Number.isFinite(nPrice) || nPrice <= 0) return triggerToast(lang === 'ar' ? 'سعر غير صالح' : 'Invalid price', 'error');
    setBusy('save');
    try {
      await setDoc(offerRef(), {
        availableQuantity: nQty, stock: nQty, priceSyp: nPrice, price: nPrice,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      triggerToast(lang === 'ar' ? 'تم تحديث العرض ✓' : 'Listing updated ✓', 'success');
      onChanged?.();
      onClose();
    } catch (e: any) {
      triggerToast(errMsg(e, lang), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = async () => {
    setBusy('toggle');
    try {
      const next = !listing.active;
      await updateDoc(offerRef(), {
        active: next,
        ...(next ? {} : { updatedAt: new Date().toISOString() })
      });
      triggerToast(
        next
          ? (lang === 'ar' ? 'تم تفعيل العرض في السوق' : 'Listing visible on marketplace')
          : (lang === 'ar' ? 'تم إخفاء العرض عن السوق' : 'Listing hidden from marketplace'),
        'info'
      );
      onChanged?.();
      onClose();
    } catch (e: any) {
      triggerToast(errMsg(e, lang), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDeactivate = async () => {
    setBusy('deactivate');
    try {
      await updateDoc(offerRef(), {
        active: false,
        updatedAt: new Date().toISOString(),
        deactivationReason: reason
      });
      // Warn-only: rules/offline must never block the cancel action itself.
      try {
        const { addDoc, collection } = await import('firebase/firestore');
        if (db) {
          await addDoc(collection(db, 'b2b_notifications'), {
            type: 'OFFER_DEACTIVATED',
            offerId: listing.offerDocId,
            catalogId: String(medicine.catalogId || medicine.id),
            drugName: (medicine as any).nameEn || medicine.name,
            sellerName: medicine.name,
            reason,
            createdAt: new Date().toISOString()
          });
        }
      } catch (notifErr) {
        console.warn('Deactivation notification skipped:', notifErr);
      }
      triggerToast(lang === 'ar' ? 'تم إيقاف العرض من السوق بالكامل' : 'Offer removed from marketplace', 'success');
      onChanged?.();
      onClose();
    } catch (e: any) {
      triggerToast(errMsg(e, lang), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!busy) onClose(); }}
      title={lang === 'ar' ? `إدارة عرض الفائض: ${medicine.name}` : `Manage surplus: ${medicine.name}`}
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <Button variant="danger" size="sm" onClick={handleDeactivate} isLoading={busy === 'deactivate'}>
            {lang === 'ar' ? 'إيقاف نهائي' : 'Remove'}
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleToggle} isLoading={busy === 'toggle'}>
              {listing.active ? (lang === 'ar' ? 'إخفاء' : 'Pause') : (lang === 'ar' ? 'استئناف' : 'Resume')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} isLoading={busy === 'save'}>
              {lang === 'ar' ? 'حفظ' : 'Save changes'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-slate-900">{medicine.name}</p>
          <Badge variant={listing.active ? 'success' : 'neutral'}>
            {listing.active ? (lang === 'ar' ? 'منشور' : 'Live') : (lang === 'ar' ? 'موقوف' : 'Paused')}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'الكمية المعروضة' : 'Quantity offered'}</span>
            <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-brand-700" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'السعر (ل.س)' : 'Price (SYP)'}</span>
            <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:border-brand-700" />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'سبب الإيقاف النهائي' : 'Removal reason (for Remove)'}</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-brand-700">
            <option value="Sold out">{lang === 'ar' ? 'تم البيع بالكامل' : 'Sold out'}</option>
            <option value="Expired stock removed">{lang === 'ar' ? 'إزالة مخزون منتهي' : 'Expired stock removed'}</option>
            <option value="No longer for sale">{lang === 'ar' ? 'لم يعد متوفراً للبيع' : 'No longer for sale'}</option>
            <option value="Other">{lang === 'ar' ? 'أخرى' : 'Other'}</option>
          </select>
        </label>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          {lang === 'ar'
            ? 'الإيقاف النهائي يخفي العرض ويبلغ الصيدليات المتأثرة. لا يمس مخزونك الخاص أبداً.'
            : 'Removing hides the listing and notifies affected pharmacies. Your private inventory is never touched.'}
        </p>
      </div>
    </Modal>
  );
}

function errMsg(e: any, lang: 'en'|'ar'): string {
  const denied = e?.code === 'permission-denied';
  return denied
    ? (lang === 'ar' ? 'تعذر التنفيذ: أذونات قاعدة البيانات.' : 'Not allowed by database permissions.')
    : (lang === 'ar' ? `فشل التنفيذ: ${e?.message || ''}` : `Action failed: ${e?.message || ''}`);
}
