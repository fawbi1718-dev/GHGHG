import React from 'react';
import { useAuth } from '../application/auth/AuthContext';
import { Building2, Store } from 'lucide-react';

export default function RoleSwitcher({ lang = 'en', triggerToast }: { lang?: 'en' | 'ar', triggerToast?: any }) {
 const { currentSession, activePharmacy, overrideDevState } = useAuth();
 
 const isFawbiAdmin = 
 currentSession?.email?.toLowerCase().includes('fawbi') || 
 currentSession?.name?.toLowerCase() === 'fawbi' ||
 currentSession?.fullName?.toLowerCase() === 'fawbi';

 if (!isFawbiAdmin || !overrideDevState) return null;

 const isWarehouse = activePharmacy?.tenantType === "WHOLESALE_WAREHOUSE";

 const handleToggle = () => {
 const newType = isWarehouse ? "RETAIL_PHARMACY" : "WHOLESALE_WAREHOUSE";
 overrideDevState(newType);
 if (triggerToast) {
 triggerToast(lang === 'ar' ? 'تم تبديل النمط' : 'Mode switched', 'success');
 }
 };

 return (
 <div className="flex items-center bg-[#F4F7F5] border border-emerald-200 rounded-xl p-1 shadow-inner relative z-50">
 <button
 onClick={() => !isWarehouse ? null : handleToggle()}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
 !isWarehouse 
 ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100' 
 : 'text-slate-500 hover:text-emerald-700'
 }`}
 >
 <Store className="w-3.5 h-3.5" />
 <span className="hidden sm:inline">{lang === 'ar' ? 'الصيدلية' : 'Pharmacy View'}</span>
 </button>
 <button
 onClick={() => isWarehouse ? null : handleToggle()}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
 isWarehouse 
 ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100' 
 : 'text-slate-500 hover:text-emerald-700'
 }`}
 >
 <Building2 className="w-3.5 h-3.5" />
 <span className="hidden sm:inline">{lang === 'ar' ? 'المستودع' : 'Warehouse View'}</span>
 </button>
 </div>
 );
}
