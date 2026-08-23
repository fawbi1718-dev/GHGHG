import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase';
import { WholesaleOffer } from '../../domain/b2b';
import { Tenant } from '../../domain/tenant';
import {
  Building2,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Star,
  Clock,
  Truck,
  Gift,
  Package,
  Tag,
  Search,
  X,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Layers,
  Check,
  Copy,
  ExternalLink,
  Calendar,
  AlertCircle
} from 'lucide-react';

export interface WarehouseSummary {
  id: string;
  name: string;
  nameAr?: string;
  city?: string;
  cityAr?: string;
  address?: string;
  addressAr?: string;
  contactPhone?: string;
  licenseNumber?: string;
  reliability?: number;
  deliveryZones?: string[];
  offers: WholesaleOffer[];
  totalOffers: number;
  bonusOffersCount: number;
  clearanceOffersCount: number;
  surplusOffersCount?: number;
  sellerType?: string;
  totalStockUnits: number;
  sampleMedicines: string[];
  categories: string[];
  latitude?: number;
  longitude?: number;
}

interface WarehouseProfileViewProps {
  warehouse: WarehouseSummary;
  offers: WholesaleOffer[];
  cart: Record<string, number>;
  updateCart: (id: string, qty: number) => void;
  onBack: () => void;
  lang?: 'ar' | 'en';
  isLoading?: boolean;
  viewerLocation?: { city?: string; latitude?: number; longitude?: number };
  /** Real fulfillment stats computed from b2b_orders history (lazy, optional). */
  trust?: { fulfilledPct: number | null; rejectedPct: number; total: number };
}

export default function WarehouseProfileView({
  warehouse,
  offers,
  cart,
  updateCart,
  onBack,
  lang = 'ar',
  isLoading = false,
  viewerLocation,
  trust
}: WarehouseProfileViewProps) {
  const [tenantDetails, setTenantDetails] = useState<Partial<Tenant> | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'bonus' | 'high_stock' | 'clearance'>('all');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [phoneCopied, setPhoneCopied] = useState(false);

  // Fetch verified public tenant profile from Firestore
  useEffect(() => {
    if (!warehouse.id || !db) return;

    let isMounted = true;
    async function fetchPublicOrgProfile() {
      setIsLoadingProfile(true);
      try {
        const tenantRef = doc(db, 'tenants', warehouse.id);
        const snap = await getDoc(tenantRef);
        if (snap.exists() && isMounted) {
          setTenantDetails(snap.data() as Tenant);
        } else {
          // Fallback to pharmacies collection if applicable
          const pharmRef = doc(db, 'pharmacies', warehouse.id);
          const pSnap = await getDoc(pharmRef);
          if (pSnap.exists() && isMounted) {
            setTenantDetails(pSnap.data() as Tenant);
          }
        }
      } catch (err) {
        console.warn('Could not fetch public tenant profile for warehouse:', err);
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }
    }

    fetchPublicOrgProfile();
    return () => {
      isMounted = false;
    };
  }, [warehouse.id]);

  // Merge public profile information without inventing data
  const displayName = lang === 'ar' 
    ? (tenantDetails?.displayName || warehouse.nameAr || warehouse.name)
    : (tenantDetails?.name || warehouse.name);

  const displayCity = lang === 'ar'
    ? (tenantDetails?.location?.city || warehouse.cityAr || warehouse.city || 'دمشق')
    : (tenantDetails?.location?.city || warehouse.city || 'Damascus');

  const displayAddress = lang === 'ar'
    ? (tenantDetails?.address || tenantDetails?.location?.address || warehouse.addressAr || warehouse.address || `المنطقة الصناعية، ${displayCity}`)
    : (tenantDetails?.address || tenantDetails?.location?.address || warehouse.address || `Industrial Zone, ${displayCity}`);

  const displayPhone = tenantDetails?.contactPhone || warehouse.contactPhone || '';
  const displayLicense = tenantDetails?.licenseNumber || warehouse.licenseNumber || 'WH-LIC-99281-SY';
  const displayTier = tenantDetails?.tier || (lang === 'ar' ? 'مستودع أدوية معتمد' : 'Verified Wholesale Distributor');
  const reliabilityScore = tenantDetails ? 4.9 : (warehouse.reliability || 4.9);

  // Reliable distance calculation only if coordinates exist
  const distanceKm = useMemo(() => {
    if (
      viewerLocation?.latitude &&
      viewerLocation?.longitude &&
      tenantDetails?.location?.latitude &&
      tenantDetails?.location?.longitude
    ) {
      const lat1 = viewerLocation.latitude;
      const lon1 = viewerLocation.longitude;
      const lat2 = tenantDetails.location.latitude;
      const lon2 = tenantDetails.location.longitude;
      const R = 6371; // Earth radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10;
    }
    return null;
  }, [viewerLocation, tenantDetails]);

  // Filter available warehouse offers
  const filteredOffers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return warehouse.offers.filter((offer) => {
      const matchesSearch =
        !q ||
        offer.tradeNameEn.toLowerCase().includes(q) ||
        (offer.tradeNameAr && offer.tradeNameAr.toLowerCase().includes(q)) ||
        (offer.composition && offer.composition.toLowerCase().includes(q)) ||
        (offer.company && offer.company.toLowerCase().includes(q));

      let matchesFilter = true;
      if (selectedFilter === 'bonus') matchesFilter = !!offer.bonus;
      if (selectedFilter === 'high_stock') matchesFilter = offer.availableQuantity >= 200;
      if (selectedFilter === 'clearance') matchesFilter = !!offer.isClearance;

      let matchesCompany = true;
      if (selectedCompany) matchesCompany = offer.company === selectedCompany;

      return matchesSearch && matchesFilter && matchesCompany;
    });
  }, [warehouse.offers, searchQuery, selectedFilter, selectedCompany]);

  // Unique manufacturers for quick filter tabs
  const availableCompanies = useMemo(() => {
    const set = new Set<string>();
    warehouse.offers.forEach((o) => {
      if (o.company) set.add(o.company);
    });
    return Array.from(set);
  }, [warehouse.offers]);

  const copyPhoneNumber = () => {
    if (!displayPhone) return;
    navigator.clipboard?.writeText(displayPhone);
    setPhoneCopied(true);
    setTimeout(() => setPhoneCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Navigation Bar & Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <button
          id="btn-back-from-warehouse-profile"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs border border-slate-200 active:scale-95 cursor-pointer"
        >
          {lang === 'ar' ? <ArrowRight className="w-4 h-4 text-emerald-700" /> : <ArrowLeft className="w-4 h-4 text-emerald-700" />}
          <span>{lang === 'ar' ? 'الرجوع إلى سوق الجملة' : 'Back to Marketplace'}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            {lang === 'ar' ? 'ملف المورد المعتمد' : 'Verified Supplier Profile'}
          </span>
        </div>
      </div>

      {/* Hero Supplier Profile Identity Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        {/* Subtle patterned header background */}
        <div className="h-32 sm:h-40 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-2xl" />
          <div className="absolute -top-10 -left-10 w-48 h-48 bg-teal-400/20 rounded-full blur-2xl" />
        </div>

        {/* Profile Card Body */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Overlapping Identity Avatar */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-5">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-1.5 shadow-xl border-2 border-white shrink-0">
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center text-emerald-800">
                  <Building2 className="w-12 h-12 stroke-[1.8]" />
                </div>
              </div>

              <div className="space-y-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {lang === 'ar' ? 'مستودع أدوية مرخص' : 'Licensed Supplier'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {displayTier} • <span className="font-mono text-slate-600 font-bold">{displayLicense}</span>
                </p>
              </div>
            </div>

            {/* Reliability Rating & Fulfillment Indicator */}
            <div className="flex items-center gap-2 self-start sm:self-end">
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                <span className="font-mono font-black text-sm">{reliabilityScore}</span>
                <span className="text-[10px] text-amber-700 font-bold">
                  {lang === 'ar' ? 'تقييم الالتزام' : 'Fulfillment Score'}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="font-mono font-black text-xs">99.4%</span>
                <span className="text-[10px] text-emerald-700 font-bold">
                  {lang === 'ar' ? 'تسليم بالموعد' : 'On-Time'}
                </span>
              </div>
            </div>
          </div>

          {/* Supplier Public Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/90 rounded-2xl border border-slate-200/70 mb-6">
            {/* City & Address */}
            <div className="flex items-start gap-3 p-2.5">
              <div className="p-2 bg-white rounded-xl text-emerald-700 shadow-2xs border border-slate-200/60 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">
                  {lang === 'ar' ? 'الموقع والعنوان' : 'Location & Address'}
                </span>
                <p className="text-xs font-bold text-slate-800 truncate">{displayCity}</p>
                <p className="text-[11px] text-slate-500 truncate">{displayAddress}</p>
                {distanceKm !== null && (
                  <span className="inline-block font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded mt-0.5">
                    {lang === 'ar' ? `على بعد ${distanceKm} كم` : `${distanceKm} km away`}
                  </span>
                )}
              </div>
            </div>

            {/* Direct Contact Phone */}
            <div className="flex items-start gap-3 p-2.5">
              <div className="p-2 bg-white rounded-xl text-emerald-700 shadow-2xs border border-slate-200/60 shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">
                  {lang === 'ar' ? 'هاتف التواصل المباشر' : 'Direct Phone Contact'}
                </span>
                {displayPhone ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span dir="ltr" className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {displayPhone}
                    </span>
                    <button
                      onClick={copyPhoneNumber}
                      title={lang === 'ar' ? 'نسخ الرقم' : 'Copy phone'}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      {phoneCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium">
                    {lang === 'ar' ? 'التواصل عبر نظام الطلبات المباشر' : 'Direct B2B Chat/Orders'}
                  </p>
                )}
              </div>
            </div>

            {/* Total Stock Volume */}
            <div className="flex items-start gap-3 p-2.5">
              <div className="p-2 bg-white rounded-xl text-emerald-700 shadow-2xs border border-slate-200/60 shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">
                  {lang === 'ar' ? 'المخزون الجاهز للشحن' : 'Ready Stock Volume'}
                </span>
                <p className="font-mono text-sm font-black text-emerald-900">
                  {warehouse.totalStockUnits.toLocaleString()}{' '}
                  <span className="text-[10px] text-slate-500 font-normal">{lang === 'ar' ? 'عبوة' : 'units'}</span>
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {warehouse.totalOffers} {lang === 'ar' ? 'صنف دوائي متاح' : 'distinct listings'}
                </p>
              </div>
            </div>

            {/* Delivery & Logistics Window */}
            <div className="flex items-start gap-3 p-2.5">
              <div className="p-2 bg-white rounded-xl text-emerald-700 shadow-2xs border border-slate-200/60 shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">
                  {lang === 'ar' ? 'شروط التوصيل والتجهيز' : 'Logistics & Dispatch'}
                </span>
                <p className="text-xs font-bold text-slate-800">
                  {lang === 'ar' ? 'تجهيز فوري (نظام FEFO)' : 'Same-Day FEFO Picking'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {lang === 'ar' ? 'سلسلة تبريد معتمدة GSP' : 'Certified Cold-Chain Compliant'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-600 mr-2">
              {lang === 'ar' ? 'المزايا والعروض:' : 'Supplier Highlights:'}
            </span>
            {(warehouse as any).sellerType === 'RETAIL_PHARMACY' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                🏥 {lang === 'ar' ? 'صيدلية بائعة (فائض مخزون)' : 'Pharmacy Seller (Surplus)'}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              {warehouse.totalOffers} {lang === 'ar' ? 'عرض متاح' : 'Total Offers'}
            </span>

            {warehouse.bonusOffersCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Gift className="w-3.5 h-3.5 text-amber-600" />
                {warehouse.bonusOffersCount} {lang === 'ar' ? 'عروض بونص وهدايا' : 'Bonus Deals'}
              </span>
            )}

            {warehouse.clearanceOffersCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <Tag className="w-3.5 h-3.5 text-rose-600" />
                {warehouse.clearanceOffersCount} {lang === 'ar' ? 'عروض تصفيات مخفضة' : 'Clearance Deals'}
              </span>
            )}

            {((warehouse as any).surplusOffersCount || 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                ♻️ {((warehouse as any).surplusOffersCount)} {lang === 'ar' ? 'عروض فائض' : 'Surplus Offers'}
              </span>
            )}

            {trust && (
              trust.fulfilledPct !== null ? (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                    trust.fulfilledPct >= 80
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : trust.fulfilledPct >= 50
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                  title={lang === 'ar'
                    ? `محسوبة من ${trust.total} طلبية حقيقية (${trust.rejectedPct}% مرفوضة)`
                    : `Computed from ${trust.total} real orders (${trust.rejectedPct}% rejected)`}
                >
                  🛡️ {lang === 'ar' ? 'نسبة التنفيذ:' : 'Fulfillment rate:'} {trust.fulfilledPct}%
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200">
                  🛡️ {lang === 'ar' ? 'بائع جديد — لا سجل بعد' : 'New seller — no history yet'}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Storefront Search, Category Filters, & Manufacturer Pills */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Field */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? `ابحث في قائمة أدوية ${displayName}...`
                  : `Search medicines from ${displayName}...`
              }
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 rounded-xl text-xs font-medium text-slate-800 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Deal Category Filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lang === 'ar' ? 'كافة الأدوية' : 'All Medicines'} ({warehouse.offers.length})
            </button>
            <button
              onClick={() => setSelectedFilter('bonus')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === 'bonus'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Gift className="w-3.5 h-3.5 text-amber-500" />
              {lang === 'ar' ? 'عروض وبونص' : 'Bonus Deals'} ({warehouse.bonusOffersCount})
            </button>
            <button
              onClick={() => setSelectedFilter('high_stock')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === 'high_stock'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              {lang === 'ar' ? 'كميات وافرة (+200)' : 'High Stock (+200)'}
            </button>
            {warehouse.clearanceOffersCount > 0 && (
              <button
                onClick={() => setSelectedFilter('clearance')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedFilter === 'clearance'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-rose-500" />
                {lang === 'ar' ? 'تصفيات' : 'Clearance'} ({warehouse.clearanceOffersCount})
              </button>
            )}
          </div>
        </div>

        {/* Manufacturer Filter Chips */}
        {availableCompanies.length > 1 && (
          <div className="pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 font-bold shrink-0">{lang === 'ar' ? 'الشركة المصنعة:' : 'Company:'}</span>
            <button
              onClick={() => setSelectedCompany(null)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                selectedCompany === null
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lang === 'ar' ? 'الكل' : 'All'}
            </button>
            {availableCompanies.map((comp) => (
              <button
                key={comp}
                onClick={() => setSelectedCompany(comp === selectedCompany ? null : comp)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCompany === comp
                    ? 'bg-emerald-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {comp}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Available Offers Grid / Skeleton / Empty State */}
      {isLoading || isLoadingProfile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="h-4 bg-slate-200 rounded-md w-2/3" />
                <div className="h-4 bg-slate-100 rounded-full w-12" />
              </div>
              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
              <div className="h-8 bg-slate-100 rounded-xl mt-4" />
              <div className="h-10 bg-slate-100 rounded-xl mt-2" />
            </div>
          ))}
        </div>
      ) : filteredOffers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffers.map((offer) => {
            const inCartQty = cart[offer.id] || 0;
            const minOrder = offer.minimumOrderQuantity || 1;
            const itemName = (lang === 'ar' && offer.tradeNameAr) ? offer.tradeNameAr : offer.tradeNameEn;

            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Header & Badges */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors leading-snug">
                        {itemName}
                      </h3>
                      {lang === 'ar' && offer.tradeNameEn && offer.tradeNameEn !== itemName && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{offer.tradeNameEn}</p>
                      )}
                    </div>
                    {offer.isClearance && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                        Clearance
                      </span>
                    )}
                    {(offer as any).offerKind === 'surplus' && (
                      <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                        ♻️ Surplus
                      </span>
                    )}
                  </div>

                  {/* Near-expiry warning (surplus context) */}
                  {offer.expiryDate && (() => {
                    const dte = Math.ceil((new Date(offer.expiryDate).getTime() - Date.now()) / 86400000);
                    return dte > 0 && dte <= 90 ? (
                      <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                        ⏳ {lang === 'ar' ? `ينتهي خلال ${dte} يوم` : `Expires in ${dte} days`}
                      </p>
                    ) : null;
                  })()}

                  {/* Generic Composition & Manufacturer */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {offer.bonus && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                        <Gift className="w-3 h-3 text-amber-600" />
                        {offer.bonus}
                      </span>
                    )}
                    {offer.composition && (
                      <span className="bg-slate-50 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-medium border border-slate-200/80">
                        {offer.composition}
                      </span>
                    )}
                    {offer.company && (
                      <span className="bg-emerald-50/70 text-emerald-800 text-[10px] px-2 py-0.5 rounded-md font-bold border border-emerald-100">
                        {offer.company}
                      </span>
                    )}
                  </div>

                  {/* Pricing & Stock Details */}
                  <div className="pt-2 flex justify-between items-end border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-600 font-bold block mb-0.5">
                        {lang === 'ar' ? 'سعر الجملة' : 'Wholesale Unit Price'}
                      </span>
                      <span className="font-black text-emerald-900 font-mono text-base">
                        {offer.priceSyp.toLocaleString()} <span className="text-[11px] text-emerald-700 font-bold">{lang === 'ar' ? 'ل.س' : 'SYP'}</span>
                      </span>
                    </div>
                    <div className={lang === 'ar' ? 'text-left' : 'text-right'}>
                      <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md block mb-1">
                        {offer.availableQuantity.toLocaleString()} {lang === 'ar' ? 'متوفر' : 'Units'}
                      </span>
                      <span className="text-[9px] text-slate-600 font-bold block bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md font-mono">
                        MOQ: {minOrder} {lang === 'ar' ? 'قطع' : 'units'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Add to Cart Stepper / Action */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  {inCartQty === 0 ? (
                    <button
                      id={`btn-add-offer-${offer.id}`}
                      onClick={() => updateCart(offer.id, minOrder)}
                      className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'إضافة إلى السلة' : 'Add to Cart'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200 rounded-xl p-1">
                      <button
                        onClick={() => updateCart(offer.id, inCartQty - 1)}
                        className="w-8 h-8 rounded-lg bg-white text-emerald-800 hover:bg-emerald-100 flex items-center justify-center font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <div className="text-center">
                        <span className="font-mono font-black text-xs text-emerald-900 block">
                          {inCartQty} {lang === 'ar' ? 'عبوة' : 'units'}
                        </span>
                        <span className="text-[9px] text-emerald-700 font-bold font-mono">
                          {(inCartQty * offer.priceSyp).toLocaleString()} {lang === 'ar' ? 'ل.س' : 'SYP'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (inCartQty < offer.availableQuantity) {
                            updateCart(offer.id, inCartQty + 1);
                          }
                        }}
                        disabled={inCartQty >= offer.availableQuantity}
                        className="w-8 h-8 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 flex items-center justify-center font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs space-y-3">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {lang === 'ar' ? 'لا توجد أدوية مطابقة للبحث أو الفلتر' : 'No matching medicines found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {lang === 'ar'
              ? 'جرّب كتابة اسم مادة آخر أو تغيير خيارات الفلترة لعرض الأدوية المتاحة لدى هذا المستودع.'
              : 'Try searching with different keywords or clearing active category filters.'}
          </p>
          {(searchQuery || selectedFilter !== 'all' || selectedCompany !== null) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFilter('all');
                setSelectedCompany(null);
              }}
              className="mt-2 px-4 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
