import React, { useState } from 'react';
import { useAuth } from '../../application/auth/AuthContext';
import { 
  Building2, 
  Store, 
  MapPin, 
  Phone, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  LogOut, 
  Globe, 
  ShieldCheck,
  Navigation
} from 'lucide-react';
import { motion } from 'motion/react';

interface RequiredOrganizationProfileModalProps {
  lang?: 'en' | 'ar';
  setLang?: (lang: 'en' | 'ar') => void;
  triggerToast?: (msg: string, type: 'success' | 'info' | 'error') => void;
  /** Optional "remind me later" dismissal — profile stays required next session. */
  onDismiss?: () => void;
}

const SYRIAN_CITIES = [
  { en: 'Damascus', ar: 'دمشق' },
  { en: 'Rif Dimashq', ar: 'ريف دمشق' },
  { en: 'Aleppo', ar: 'حلب' },
  { en: 'Homs', ar: 'حمص' },
  { en: 'Hama', ar: 'حماة' },
  { en: 'Latakia', ar: 'اللاذقية' },
  { en: 'Tartus', ar: 'طرطوس' },
  { en: 'Daraa', ar: 'درعا' },
  { en: 'As-Suwayda', ar: 'السويداء' },
  { en: 'Quneitra', ar: 'القنيطرة' },
  { en: 'Deir ez-Zor', ar: 'دير الزور' },
  { en: 'Al-Hasakah', ar: 'الحسكة' },
  { en: 'Raqqa', ar: 'الرقة' },
  { en: 'Idlib', ar: 'إدلب' }
];

export default function RequiredOrganizationProfileModal({
  lang = 'en',
  setLang,
  triggerToast,
  onDismiss
}: RequiredOrganizationProfileModalProps) {
  const { currentSession, activePharmacy, updateOrganizationProfile, logout, isLoading: authLoading } = useAuth();

  const isWarehouse = activePharmacy?.tenantType === 'WHOLESALE_WAREHOUSE';
  const isArabic = lang === 'ar';

  // Form State initialized from activePharmacy if existing
  const [name, setName] = useState(
    activePharmacy?.name && activePharmacy.name !== 'Untitled Organization' && activePharmacy.name !== 'My Pharmacy'
      ? activePharmacy.name
      : ''
  );
  
  const [city, setCity] = useState(
    activePharmacy?.location?.city && activePharmacy.location.city !== 'Dev'
      ? activePharmacy.location.city
      : 'Damascus'
  );

  const [zone, setZone] = useState(activePharmacy?.location?.zone || '');
  
  const [address, setAddress] = useState(
    activePharmacy?.address || 
    (activePharmacy?.verifiedLocation && activePharmacy.verifiedLocation !== 'Dev Local' && activePharmacy.verifiedLocation !== 'Damascus, Syria'
      ? activePharmacy.verifiedLocation
      : '')
  );

  const [contactPhone, setContactPhone] = useState(
    activePharmacy?.contactPhone && activePharmacy.contactPhone !== '555-0000'
      ? activePharmacy.contactPhone
      : ''
  );

  const [licenseNumber, setLicenseNumber] = useState(
    activePharmacy?.licenseNumber && activePharmacy.licenseNumber !== 'DEV' && activePharmacy.licenseNumber !== 'PENDING'
      ? activePharmacy.licenseNumber
      : ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage(
        isArabic
          ? (isWarehouse ? 'يرجى إدخال اسم المستودع المعتمد.' : 'يرجى إدخال اسم الصيدلية الرسمي.')
          : (isWarehouse ? 'Please enter the official wholesale warehouse name.' : 'Please enter the official pharmacy name.')
      );
      return;
    }

    const cleanCity = city.trim();
    if (!cleanCity) {
      setErrorMessage(isArabic ? 'يرجى تحديد المحافظة / المدينة.' : 'Please select the city / governorate.');
      return;
    }

    const cleanAddress = address.trim();
    if (!cleanAddress || cleanAddress.length < 3) {
      setErrorMessage(
        isArabic
          ? 'يرجى إدخال العنوان التفصيلي للمنشأة (الشارع، البناء أو المعلم القريب).'
          : 'Please enter the detailed street address or location of the facility.'
      );
      return;
    }

    const cleanPhone = contactPhone.trim();
    if (!cleanPhone || cleanPhone.length < 4) {
      setErrorMessage(
        isArabic
          ? 'يرجى إدخال رقم هاتف التواصل المعتمد للطلبيات.'
          : 'Please enter a valid official contact phone number.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await updateOrganizationProfile({
        name: cleanName,
        city: cleanCity,
        zone: zone.trim(),
        address: cleanAddress,
        contactPhone: cleanPhone,
        licenseNumber: licenseNumber.trim() || undefined
      });

      if (triggerToast) {
        triggerToast(
          isArabic
            ? (isWarehouse ? 'تم إكمال وتحديث ملف المستودع بنجاح!' : 'تم إكمال وتحديث ملف الصيدلية بنجاح!')
            : (isWarehouse ? 'Warehouse organization profile completed!' : 'Pharmacy organization profile completed!'),
          'success'
        );
      }
    } catch (err: any) {
      console.error("Failed to complete profile:", err);
      setErrorMessage(err.message || (isArabic ? 'تعذر حفظ البيانات. يرجى المحاولة مرة أخرى.' : 'Failed to save profile. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-emerald-100/80 overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Modal Top Header */}
        <div className="bg-emerald-800 text-white p-5 sm:p-6 relative shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-inner">
                {isWarehouse ? <Building2 className="w-5 h-5" /> : <Store className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-200 block">
                  {isWarehouse 
                    ? (isArabic ? 'حساب مستودع أدوية جملة' : 'Wholesale Warehouse Tenant')
                    : (isArabic ? 'حساب صيدلية مرخصة' : 'Retail Pharmacy Tenant')}
                </span>
                <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                  {isArabic ? 'الملف التعريفي للمنشأة مطلوب' : 'Organization Profile Required'}
                </h2>
              </div>
            </div>

            {setLang && (
              <button 
                type="button"
                onClick={() => setLang(isArabic ? 'en' : 'ar')} 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors cursor-pointer"
              >
                <Globe className="w-3 h-3 text-emerald-300" />
                <span>{isArabic ? 'EN' : 'عربي'}</span>
              </button>
            )}
          </div>

          <p className="text-xs text-emerald-100/90 leading-relaxed">
            {isArabic
              ? 'يرجى إكمال البيانات الرسمية لمنشأتك للمتابعة. هذا الملف مشترك بين جميع موظفي ومستخدمي المنشأة ويضمن دقة الفواتير والطلبيات المتبادلة.'
              : 'Complete your organization profile to continue. This profile applies tenant-wide for all users and ensures accurate invoicing, routing, and B2B ordering.'}
          </p>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* 1. Organization Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {isWarehouse ? <Building2 className="w-3.5 h-3.5 text-emerald-700" /> : <Store className="w-3.5 h-3.5 text-emerald-700" />}
              <span>{isWarehouse ? (isArabic ? 'اسم المستودع الرسمي' : 'Wholesale Warehouse Name') : (isArabic ? 'اسم الصيدلية الرسمي' : 'Pharmacy Name')}</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isWarehouse 
                  ? (isArabic ? 'مثال: مستودع الشام الدوائي المركزي' : 'e.g. Damascus Central Med Supply')
                  : (isArabic ? 'مثال: صيدلية الشفاء' : 'e.g. Al-Shifaa Pharmacy')
              }
              className="w-full px-3.5 py-2.5 bg-[#F4F7F5] rounded-xl border border-emerald-100 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
            />
          </div>

          {/* 2. City & Zone Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isArabic ? 'المحافظة / المدينة' : 'City / Governorate'}</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F4F7F5] rounded-xl border border-emerald-100 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none transition-all"
              >
                {SYRIAN_CITIES.map((c) => (
                  <option key={c.en} value={c.en}>
                    {isArabic ? c.ar : c.en}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isArabic ? 'المنطقة / الحي' : 'Area / District'}</span>
              </label>
              <input
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder={isArabic ? 'مثال: المزة، أبو رمانة، الشهباء...' : 'e.g. Al-Mazza, Abu Roummaneh'}
                className="w-full px-3.5 py-2.5 bg-[#F4F7F5] rounded-xl border border-emerald-100 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* 3. Detailed Street Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isArabic ? 'العنوان التفصيلي (الشارع / البناء / المعلم)' : 'Detailed Street Address'}</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isArabic ? 'شارع بغداد، جانب المشفى المركزي، بناء 12' : 'Baghdad Street, Near Central Hospital, Bldg 12'}
              className="w-full px-3.5 py-2.5 bg-[#F4F7F5] rounded-xl border border-emerald-100 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
            />
          </div>

          {/* 4. Phone & License Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isArabic ? 'رقم الهاتف المعتمد' : 'Contact Phone'}</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder={isArabic ? '011-2345678 أو 0991234567' : '011-2345678 or 0991234567'}
                className="w-full px-3.5 py-2.5 bg-[#F4F7F5] rounded-xl border border-emerald-100 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isArabic ? 'رقم الترخيص الصحي / التجاري' : 'License / MOH Reg #'}</span>
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder={isArabic ? 'مثال: SY-MOH-2024-104' : 'e.g. SY-MOH-2024-104'}
                className="w-full px-3.5 py-2.5 bg-[#F4F7F5] rounded-xl border border-emerald-100 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl flex items-center gap-2.5 text-[11px] text-emerald-900 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              {isArabic
                ? 'يتم تخزين بيانات الموقع والاعتماد في سجل المنشأة لتفعيل الفوترة ومطابقة العروض الدوائية تلقائياً.'
                : 'Facility details are verified and stored securely with the tenant record for automated invoicing and procurement discovery.'}
            </span>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => logout()}
                disabled={isSubmitting || authLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>

              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  disabled={isSubmitting || authLoading}
                  className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-xs font-bold underline-offset-2 hover:underline transition-all cursor-pointer disabled:opacity-50"
                >
                  {isArabic ? 'لاحقاً' : 'Later'}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || authLoading}
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isArabic ? 'جاري الحفظ...' : 'Saving Profile...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isArabic ? 'حفظ ومتابعة إلى المنظومة' : 'Save & Continue'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
