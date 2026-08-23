import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../infrastructure/firebase';
import { Medicine } from '../types';
import { HardwareIntegrationService } from '../infrastructure/hardware/HardwareIntegrationService';

interface SurplusPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  seller: { tenantId: string; name: string; nameAr?: string; city?: string };
  lang?: 'en' | 'ar';
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const DAYS_DEFAULT_THRESHOLD = 90;

/**
 * Surplus Exchange: lets a retail pharmacy publish near-expiry / overstock
 * from its PRIVATE inventory as a public marketplace offer.
 * Inventory is never modified — publishing only writes a wholesale_offers
 * document (deterministic id `off_{sellerId}_{safeCatalogId}`), identical in
 * shape to warehouse offers plus `offerKind:'surplus'` and `sellerType`.
 */
export default function SurplusPublishModal({
  isOpen,
  onClose,
  medicine,
  seller,
  lang = 'en',
  triggerToast
}: SurplusPublishModalProps) {
  const [priceSyp, setPriceSyp] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  // Reset form each time a new medicine is presented.
  React.useEffect(() => {
    if (isOpen && medicine) {
      setPriceSyp(String(medicine.price || ''));
      setQuantity(String(medicine.stock || 0));
      setIsPublishing(false);
      setPublished(false);
    }
  }, [isOpen, medicine]);

  const daysToExpiry = medicine?.expiryDate
    ? Math.ceil((new Date(medicine.expiryDate).getTime() - Date.now()) / 86400000)
    : null;
  const isNearExpiry = daysToExpiry !== null && daysToExpiry <= DAYS_DEFAULT_THRESHOLD;

  const handlePublish = async () => {
    if (!medicine || !seller.tenantId) return;
    const qty = parseInt(quantity, 10);
    const price = Number(priceSyp);

    if (!Number.isFinite(qty) || qty <= 0) {
      triggerToast(lang === 'ar' ? 'الكمية يجب أن تكون أكبر من صفر' : 'Quantity must be greater than zero', 'error');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      triggerToast(lang === 'ar' ? 'السعر غير صالح' : 'Invalid price', 'error');
      return;
    }
    if (!db) {
      triggerToast(lang === 'ar' ? 'قاعدة البيانات غير متصلة' : 'Database unavailable', 'error');
      return;
    }

    setIsPublishing(true);
    try {
      const safeCatalogId = String(medicine.catalogId || medicine.id).replace(/\//g, '_');
      const offerDocId = `off_${seller.tenantId}_${safeCatalogId}`;
      const nowIso = new Date().toISOString();

      await setDoc(
        doc(db, 'wholesale_offers', offerDocId),
        {
          id: offerDocId,
          offerId: offerDocId,
          sellerTenantId: seller.tenantId,
          sellerName: seller.name,
          sellerCity: seller.city || '',
          catalogId: medicine.catalogId || safeCatalogId,
          tradeNameEn: (medicine as any).nameEn || medicine.name,
          tradeNameAr: medicine.name || '',
          composition: medicine.genericName || '',
          company: medicine.supplier || '',
          manufacturer: medicine.supplier || '',
          priceSyp: price,
          price,
          availableQuantity: qty,
          stock: qty,
          minimumOrderQuantity: 1,
          moq: 1,
          bonus: '',
          isClearance: false,
          expiryDate: medicine.expiryDate ? String(medicine.expiryDate).slice(0, 10) : nowIso.slice(0, 10),
          active: true,
          reliability: null as any, // computed from real order history by the marketplace
          offerKind: 'surplus',
          sellerType: 'RETAIL_PHARMACY',
          createdAt: nowIso,
          updatedAt: nowIso
        },
        { merge: true }
      );

      HardwareIntegrationService.getInstance().playScanSuccess();
      setPublished(true);
      triggerToast(
        lang === 'ar'
          ? `تم نشر فائض ${medicine.name} في السوق ✓`
          : `Surplus offer for ${medicine.name} published ✓`,
        'success'
      );
      setTimeout(onClose, 900);
    } catch (err: any) {
      console.warn('Surplus publish failed:', err);
      const denied = err?.code === 'permission-denied';
      triggerToast(
        denied
          ? (lang === 'ar'
              ? 'تعذر النشر: أذونات قاعدة البيانات تمنع كتابة العروض.'
              : 'Could not publish: database permissions deny offer writes.')
          : (lang === 'ar' ? 'فشل نشر العرض' : 'Failed to publish offer'),
        'error'
      );
      setIsPublishing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isPublishing) onClose(); }}
      title={lang === 'ar' ? 'نشر فائض من المخزون' : 'Publish Surplus Stock'}
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPublishing}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePublish}
            isLoading={isPublishing}
            disabled={published}
          >
            {published
              ? (lang === 'ar' ? 'تم النشر ✓' : 'Published ✓')
              : (lang === 'ar' ? 'نشر في السوق' : 'Publish to Marketplace')}
          </Button>
        </div>
      }
    >
      {medicine && (
        <div className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl">
            <p className="text-sm font-black text-slate-900">{medicine.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {lang === 'ar' ? 'مخزونك الخاص:' : 'Your private stock:'}{' '}
              <span className="font-mono font-bold text-slate-700">{medicine.stock}</span>
              {daysToExpiry !== null && (
                <span className={`ms-2 font-mono font-bold ${isNearExpiry ? 'text-amber-600' : 'text-slate-400'}`}>
                  · {lang === 'ar' ? `ينتهي خلال ${daysToExpiry} يوم` : `expires in ${daysToExpiry}d`}
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              {lang === 'ar'
                ? 'النشر لا يعدّل مخزونك الخاص — الكمية المتاحة للسوق تُخصم فقط عند الشحن الفعلي.'
                : 'Publishing never changes your private inventory — market availability decreases only on actual dispatch.'}
            </p>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'كمية الفائض المعروضة' : 'Surplus quantity to offer'}</span>
            <input
              type="number" min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'سعر الوحدة (ل.س)' : 'Unit price (SYP)'}</span>
            <input
              type="number" min="1"
              value={priceSyp}
              onChange={(e) => setPriceSyp(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
