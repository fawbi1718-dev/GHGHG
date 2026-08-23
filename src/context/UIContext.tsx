import React, { createContext, useContext, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastMessage {
 id: string;
 message: string;
 type: ToastType;
}

interface UIContextType {
 theme: 'dark' | 'light';
 setTheme: (theme: 'dark' | 'light') => void;
 lang: 'ar' | 'en';
 setLang: (lang: 'ar' | 'en') => void;
 toast: ToastMessage | null;
 triggerToast: (message: string, type?: ToastType) => void;
 dismissToast: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
 const saved = localStorage.getItem('app-theme');
 return (saved === 'light' || saved === 'dark') ? saved : 'dark';
 });

 const [lang, setLangState] = useState<'ar' | 'en'>(() => {
 const saved = localStorage.getItem('app-lang');
 return (saved === 'ar' || saved === 'en') ? saved : 'en';
 });

 const [toast, setToast] = useState<ToastMessage | null>(null);

 useEffect(() => {
 const root = document.documentElement;
 if (theme === 'dark') {
 root.classList.add('dark');
 } else {
 root.classList.remove('dark');
 }
 }, [theme]);

 useEffect(() => {
 document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
 document.documentElement.lang = lang;
 }, [lang]);

 const setTheme = (newTheme: 'dark' | 'light') => {
 setThemeState(newTheme);
 localStorage.setItem('app-theme', newTheme);
 };

 const setLang = (newLang: 'ar' | 'en') => {
 setLangState(newLang);
 localStorage.setItem('app-lang', newLang);
 };

 const triggerToast = (message: string, type: ToastType = 'info') => {
 const id = Math.random().toString(36).substring(2, 9);
 setToast({ id, message, type });
 setTimeout(() => {
 setToast((prev) => (prev?.id === id ? null : prev));
 }, 4500);
 };

 const dismissToast = () => setToast(null);

 return (
 <UIContext.Provider
 value={{
 theme,
 setTheme,
 lang,
 setLang,
 toast,
 triggerToast,
 dismissToast,
 }}
 >
 {children}
 <AnimatePresence>
        {toast && (
          <div 
            className="fixed inset-x-0 top-6 sm:top-8 z-[9999] flex items-center justify-center pointer-events-none px-4"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: "spring", damping: 26, stiffness: 360 }}
              className={`pointer-events-auto max-w-md w-full p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md text-slate-100 border shadow-2xl flex items-center gap-3.5 ${
                toast.type === "success"
                  ? "border-emerald-500/50 shadow-emerald-950/50 ring-1 ring-emerald-500/20"
                  : toast.type === "error"
                  ? "border-rose-500/50 shadow-rose-950/50 ring-1 ring-rose-500/20"
                  : "border-slate-700 shadow-slate-950/60 ring-1 ring-slate-700/30"
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  toast.type === "success"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : toast.type === "error"
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {toast.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : toast.type === "error" ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-slate-400">
                    {lang === "ar" ? "إشعار النظام" : "SYSTEM NOTIFICATION"}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-200 mt-0.5 leading-snug">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={dismissToast}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </UIContext.Provider>
 );
};

export const useUI = (): UIContextType => {
 const context = useContext(UIContext);
 if (!context) {
 throw new Error('useUI must be used within a UIProvider');
 }
 return context;
};
