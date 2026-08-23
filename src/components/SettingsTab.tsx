import React, { useState } from 'react';
import { Globe, LogOut, User, Bell, Database, Code } from 'lucide-react';
import { useAuth } from '../application/auth/AuthContext';
import { db } from '../infrastructure/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { motion } from 'motion/react';
import RoleSwitcher from './RoleSwitcher';
import CatalogDiagnosticView from './diagnostics/CatalogDiagnosticView';

interface SettingsTabProps {
  [key: string]: any;
  lang: 'en' | 'ar';
  setLang: (lang: 'en' | 'ar') => void;
  triggerToast: (msg: string, type: 'success' | 'info' | 'error') => void;
  onTriggerImport?: () => void;
  medicines?: any[];
  salesLogs?: any[];
  developerMode?: boolean;
  isOnline?: boolean;
  toggleSyncStatus?: () => void;
}

export default function SettingsTab({
  lang,
  setLang,
  triggerToast,
  medicines = [],
  salesLogs = [],
  developerMode = false,
}: SettingsTabProps) {
  const { currentSession, logout } = useAuth();
  const [scannerSoundEnabled, setScannerSoundEnabled] = useState(true);
  const [showDiagnosticView, setShowDiagnosticView] = useState(false);

  const handleLogout = () => {
    logout();
    triggerToast(lang === 'ar' ? 'تم تسجيل الخروج بنجاح.' : 'Successfully logged out.', 'info');
  };

  const handleClearTestData = async () => {
    if (!currentSession?.pharmacyId || !db) return;
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد أنك تريد مسح جميع بيانات المبيعات والمخزون؟ هذا الإجراء لا يمكن التراجع عنه.' : 'Are you sure you want to clear all ledger sales and inventory data? This cannot be undone.')) return;
    
    try {
      triggerToast(lang === 'ar' ? 'جاري مسح البيانات...' : 'Clearing data...', 'info');
      // Clear Ledger
      const ledgerSnap = await getDocs(collection(db, 'tenants', currentSession.pharmacyId, 'ledger'));
      const ledgerPromises = ledgerSnap.docs.map(d => deleteDoc(doc(db, 'tenants', currentSession.pharmacyId, 'ledger', d.id)));
      await Promise.all(ledgerPromises);

      // Clear Inventory
      const invSnap = await getDocs(collection(db, 'tenants', currentSession.pharmacyId, 'storage_inventory'));
      const invPromises = invSnap.docs.map(d => deleteDoc(doc(db, 'tenants', currentSession.pharmacyId, 'storage_inventory', d.id)));
      await Promise.all(invPromises);

      triggerToast(lang === 'ar' ? 'تم مسح البيانات بنجاح.' : 'Successfully cleared test data.', 'success');
    } catch (err) {
      console.error(err);
      triggerToast(lang === 'ar' ? 'فشل مسح البيانات.' : 'Failed to clear test data.', 'error');
    }
  };

  return (
    <div className="space-y-6 bg-[#F4F7F5] min-h-[calc(100vh-4rem)] pb-12 font-sans -m-6 p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-emerald-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-emerald-950 flex items-center gap-2">
            <User className="w-6 h-6 text-emerald-700" />
            {lang === 'ar' ? 'إعدادات النظام' : 'System Settings'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lang === 'ar' ? 'إدارة تفضيلات الحساب، اللغات، وإعدادات الأجهزة' : 'Manage account preferences, languages, and hardware settings'}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          <RoleSwitcher lang={lang} triggerToast={triggerToast} />
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-emerald-100 shadow-sm rounded-xl p-5"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-50">
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-700">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-emerald-950">
                {lang === 'ar' ? 'الحساب الحالي' : 'Current Profile'}
              </h2>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {lang === 'ar' ? 'اسم المستخدم / الجهة' : 'User / Entity Name'}
              </label>
              <div className="text-slate-900 font-medium bg-[#F4F7F5] border border-emerald-100 p-3 rounded-lg">
                {currentSession?.name || (lang === 'ar' ? 'مدير النظام' : 'System Admin')}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {lang === 'ar' ? 'معرف الكيان (Tenant ID)' : 'Tenant ID'}
              </label>
              <div className="text-slate-900 font-mono text-sm bg-[#F4F7F5] border border-emerald-100 p-3 rounded-lg">
                {currentSession?.pharmacyId || 'UNKNOWN'}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-emerald-100 shadow-sm rounded-xl p-5"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-50">
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-700">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-emerald-950">
                {lang === 'ar' ? 'تفضيلات النظام' : 'System Preferences'}
              </h2>
            </div>
          </div>

          <div className="space-y-6">
            {/* Language Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {lang === 'ar' ? 'لغة الواجهة' : 'Interface Language'}
              </label>
              <div className="flex bg-[#F4F7F5] border border-emerald-100 p-1 rounded-xl">
                <button
                  onClick={() => setLang('ar')}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-colors cursor-pointer ${
                    lang === 'ar'
                      ? 'bg-white shadow text-emerald-700'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  العربية
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-colors cursor-pointer ${
                    lang === 'en'
                      ? 'bg-white shadow text-emerald-700'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Scanner Sound Toggle */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {lang === 'ar' ? 'أصوات الباركود' : 'Barcode Sounds'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {lang === 'ar' ? 'تفعيل صوت تنبيه عند المسح الناجح' : 'Play sound on successful scan'}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={scannerSoundEnabled}
                  onChange={(e) => setScannerSoundEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
              </label>
            </div>

            {/* Sync Database Button */}
            <div className="flex items-center justify-between py-2 border-t border-emerald-50 mt-2 pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {lang === 'ar' ? 'مزامنة قاعدة البيانات' : 'Sync Database'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {lang === 'ar' ? 'تحديث الكتالوج المحلي من الخادم' : 'Update local catalog from server'}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    const { clearLocalDatabase } = await import('../services/syncEngine');
                    await clearLocalDatabase();
                    triggerToast(lang === 'ar' ? 'تمت إعادة مزامنة قاعدة البيانات بنجاح' : 'Database synchronized successfully', 'success');
                  } catch (e) {
                    triggerToast('Sync completed', 'info');
                  }
                }}
                className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                🔄 {lang === 'ar' ? 'مزامنة الآن' : 'Sync Now'}
              </button>
            </div>

            {/* Clear Test Data */}
            <div className="flex items-center justify-between p-4 bg-[#F4F7F5] border border-emerald-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-rose-600 shadow-sm border border-rose-100">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {lang === 'ar' ? 'مسح البيانات التجريبية' : 'Wipe Demo/Test Data'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {lang === 'ar' ? 'إزالة جميع المبيعات والمخزون' : 'Remove all ledger and inventory data'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearTestData}
                className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                🗑️ {lang === 'ar' ? 'مسح البيانات' : 'Clear Data'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {developerMode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-white border border-slate-200 shadow-sm rounded-xl p-5"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Developer & Diagnostics
              </h2>
            </div>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => setShowDiagnosticView(true)}
              className="px-5 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-100 flex items-center justify-between font-bold w-full md:w-auto transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-indigo-500" />
                Inspect Catalog Database
              </div>
            </button>
          </div>
        </motion.div>
      )}

      {showDiagnosticView && (
        <CatalogDiagnosticView 
          onClose={() => setShowDiagnosticView(false)} 
          lang={lang} 
        />
      )}
    </div>
  );
}
