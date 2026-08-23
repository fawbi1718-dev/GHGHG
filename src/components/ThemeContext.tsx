import React, { createContext, useContext, useEffect, useState } from 'react';
import { TenantType } from '../domain/tenant';

interface ThemeContextState {
 theme: 'light' | 'dark';
 setTheme: (theme: 'light' | 'dark') => void;
 tenantType: TenantType | null;
 setTenantType: (type: TenantType) => void;
 isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextState>({
 theme: 'light',
 setTheme: () => {},
 tenantType: null,
 setTenantType: () => {},
 isTransitioning: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [tenantType, setTenantTypeState] = useState<TenantType | null>(null);
 
 const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
 const saved = localStorage.getItem('app-theme');
 return (saved === 'dark' || saved === 'light') ? saved : 'light';
 });
 
 const [isTransitioning, setIsTransitioning] = useState(false);

 useEffect(() => {
 const root = document.documentElement;
 if (theme === 'dark') {
 root.classList.add('dark');
 } else {
 root.classList.remove('dark');
 }
 }, [theme]);

 const setTheme = (newTheme: 'light' | 'dark') => {
 setThemeState(newTheme);
 localStorage.setItem('app-theme', newTheme);
 };

 const setTenantType = (newType: TenantType) => {
 if (newType !== tenantType) {
 setIsTransitioning(true);
 setTimeout(() => {
 setTenantTypeState(newType);
 const defaultTheme = newType === 'WHOLESALE_WAREHOUSE' ? 'dark' : 'light';
 // Only set default if user hasn't overridden
 if (!localStorage.getItem('app-theme')) {
 setThemeState(defaultTheme);
 } else if (localStorage.getItem('app-theme') !== defaultTheme) {
 // Allow tenant default to override if they switch? Let's just always switch it when they change tenants to give them the contextual experience, but save it.
 setTheme(defaultTheme);
 }
 setTimeout(() => setIsTransitioning(false), 50); // slight delay for CSS class to apply
 }, 400); // 400ms CSS animation match
 }
 };

 return (
 <ThemeContext.Provider value={{ theme, setTheme, tenantType, setTenantType, isTransitioning }}>
 <div className={`transition-all duration-500 transform-gpu ${isTransitioning ? 'opacity-0 scale-95 rotate-12' : 'opacity-100 scale-100 rotate-0'} [perspective:1000px] min-h-[100dvh] w-full flex flex-col`}>
 {children}
 </div>
 </ThemeContext.Provider>
 );
};

export const useTenantTheme = () => useContext(ThemeContext);

