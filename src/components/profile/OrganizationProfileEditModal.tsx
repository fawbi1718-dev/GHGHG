import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../application/auth/AuthContext';
import { useUI } from '../../context/UIContext';

const SYRIAN_CITIES = [
  'Damascus', 'Rif Dimashq', 'Aleppo', 'Homs', 'Hama', 'Latakia',
  'Tartus', 'Daraa', 'As-Suwayda', 'Quneitra', 'Deir ez-Zor', 'Al-Hasakah', 'Raqqa', 'Idlib'
];

interface OrganizationProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'ar';
}

/**
 * Edit the signed-in organization's public identity (tenant-level fields).
 * Changes propagate to marketplace storefronts and future order snapshots;
 * historical documents keep their original snapshot by design.
 */
export default function OrganizationProfileEditModal({
  isOpen,
  onClose,
  lang = 'ar'
}: OrganizationProfileEditModalProps) {
  const { activePharmacy, updateOrganizationProfile } = useAuth() as any;
  const { triggerToast } = useUI();
  const [form, setForm] = useState(() => ({
    name: activePharmacy?.name || '',
    nameAr: activePharmacy?.nameAr || '',
    phone: (activePharmacy as any)?.contactPhone || '',
    city: (activePharmacy as any)?.location?.city || (activePharmacy as any)?.city || '',
    address: (activePharmacy as any)?.address || '',
    workingHours: (activePharmacy as any)?.workingHours || ''
  }));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      triggerToast(lang === 'ar' ? 'اسم المؤسسة مطلوب' : 'Organization name is required', 'error');
      return;
    }
    if (!form.phone.trim()) {
      triggerToast(lang === 'ar' ? 'رقم الهاتف مطلوب' : 'Phone number is required', 'error');
      return;
    }
    setSaving(true);
    try {
      // Strip undefined values — Firestore rejects documents containing them
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries({
        name: form.name.trim(),
        nameAr: form.nameAr?.trim() || undefined,
        contactPhone: form.phone.trim(),
        // Preserve geographic fields the modal doesn't edit — updateOrganizationProfile
        // rebuilds location from city/zone, so omitting them would blank it.
        city: form.city?.trim() || 'Damascus',
        zone: (activePharmacy as any)?.location?.zone || '',
        address: form.address?.trim() || undefined,
        workingHours: form.workingHours?.trim() || undefined
      })) {
        if (v !== undefined) payload[k] = v;
      }
      await updateOrganizationProfile(payload as any);
      triggerToast(lang === 'ar' ? 'تم حفظ بيانات المؤسسة ✓' : 'Organization profile saved ✓', 'success');
      onClose();
    } catch (err: any) {
      const msg = err?.code === 'permission-denied'
        ? (lang === 'ar' ? 'ليست لديك صلاحية تعديل هذه البيانات.' : 'You do not have permission to edit this data.')
        : err?.message || 'Unknown error';
      console.error('Profile save error:', err?.code, err?.message);
      triggerToast(
        lang === 'ar' ? `فشل الحفظ: ${msg}` : `Save failed: ${msg}`,
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-600/20";

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose(); }}
      title={lang === 'ar' ? 'بيانات المؤسسة' : 'Organization Profile'}
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} isLoading={saving}>
            {lang === 'ar' ? 'حفظ' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {lang === 'ar'
            ? 'تظهر هذه البيانات للشركاء في السوق وعلى الطلبيات والإيصالات.'
            : 'Shown to trading partners on orders and receipts.'}
        </p>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'الاسم *' : 'Name *'}</span>
          <input className={inputCls} value={form.name} onChange={set('name')} />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'الاسم بالعربية' : 'Arabic name'}</span>
          <input className={inputCls} value={(form as any).nameAr ?? ''} onChange={set('nameAr')} dir="rtl" />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'الهاتف *' : 'Phone *'}</span>
          <input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+963 …" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'المدينة *' : 'City *'}</span>
            <select className={inputCls + ' mt-1'} value={form.city} onChange={set('city')}>
              <option value="">—</option>
              {SYRIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'ساعات العمل' : 'Working hours'}</span>
            <input className={inputCls} value={(form as any).workingHours ?? ''} onChange={set('workingHours')} placeholder={lang === 'ar' ? '9:00 - 21:00' : '9:00 - 21:00'} />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">{lang === 'ar' ? 'العنوان' : 'Address'}</span>
          <input className={inputCls} value={form.address} onChange={set('address')} />
        </label>
      </div>
    </Modal>
  );
}
