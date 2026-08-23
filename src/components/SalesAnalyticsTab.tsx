import React from 'react';
import { motion } from 'motion/react';
import { Activity, Receipt, TrendingUp, DollarSign } from 'lucide-react';
import { useAuth } from '../application/auth/AuthContext';

interface SalesAnalyticsTabProps {
 lang: 'en' | 'ar';
 salesLogs: any[];
}

export default function SalesAnalyticsTab({ lang, salesLogs = [] }: SalesAnalyticsTabProps) {
 const { currentSession } = useAuth();
 
 const todayStr = new Date().toISOString().split('T')[0];
 const todaysSales = (salesLogs || []).filter(log => {
 try {
 return log.timestamp.split('T')[0] === todayStr;
 } catch {
 return false;
 }
 });

 const totalRevenue = todaysSales.reduce((sum, s) => sum + s.totalRevenue, 0);
 const totalProfit = todaysSales.reduce((sum, s) => sum + s.totalProfit, 0);

 return (
 <div className="space-y-6 bg-[#F4F7F5] min-h-[calc(100vh-4rem)] pb-12 font-sans -m-6 p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
 {/* Header */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-brand-100 shadow-sm">
 <div>
 <h1 className="text-2xl font-bold text-brand-950 flex items-center gap-2">
 <Activity className="w-6 h-6 text-brand-700" />
 {lang === 'ar' ? 'المبيعات والتحليلات' : 'Sales & Analytics'}
 </h1>
 <p className="text-sm text-slate-500 mt-1">
 {lang === 'ar' ? 'مراجعة أداء المبيعات وسجل الفواتير اليومية' : 'Review sales performance and daily chronological receipts journal'}
 </p>
 </div>
 </div>

 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="space-y-6"
 >
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="p-4 bg-white border border-brand-100 rounded-xl shadow-sm">
 <div className="flex items-center gap-2 mb-2">
 <div className="p-1.5 bg-brand-100 text-brand-700 rounded-lg">
 <DollarSign className="w-4 h-4" />
 </div>
 <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
 {lang === 'ar' ? 'إجمالي المبيعات اليوم' : "TODAY'S TOTAL REVENUE"}
 </span>
 </div>
 <span className="text-3xl font-black text-brand-950 font-mono block">
 {(Number(totalRevenue) || 0).toLocaleString()} <span className="text-sm text-brand-600">SYP</span>
 </span>
 </div>
 <div className="p-4 bg-white border border-brand-100 rounded-xl shadow-sm">
 <div className="flex items-center gap-2 mb-2">
 <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
 <TrendingUp className="w-4 h-4" />
 </div>
 <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
 {lang === 'ar' ? 'إجمالي الأرباح الصافية اليوم' : "TODAY'S NET PROFIT"}
 </span>
 </div>
 <span className="text-3xl font-black text-indigo-950 font-mono block">
 {(Number(totalProfit) || 0).toLocaleString()} <span className="text-sm text-brand-600">SYP</span>
 </span>
 </div>
 </div>

 <div className="bg-white border border-brand-100 rounded-xl shadow-sm overflow-hidden">
 <div className="p-4 border-b border-brand-100 bg-slate-50/50 flex items-center gap-2">
 <Receipt className="w-4 h-4 text-slate-500" />
 <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
 {lang === 'ar' ? 'سجل الفواتير والمقبوضات الصادرة اليوم' : "TODAY'S CHRONOLOGICAL RECEIPTS JOURNAL"} ({todaysSales.length})
 </span>
 </div>
 
 {todaysSales.length === 0 ? (
 <div className="py-12 text-center">
 <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-3" />
 <p className="text-sm font-bold text-slate-500">
 {lang === 'ar' ? 'لا توجد مبيعات مسجلة اليوم حتى الآن.' : 'No transactions recorded today.'}
 </p>
 </div>
 ) : (
 <div className="divide-y divide-brand-50">
 {todaysSales.map((sale: any) => (
 <div
 key={sale.saleId}
 className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
 >
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <span className="font-extrabold text-brand-900 font-mono text-sm bg-brand-50 px-2 py-0.5 rounded">
 #{sale.saleId.slice(-6).toUpperCase()}
 </span>
 <span className="text-xs font-bold text-slate-400 font-mono">
 {new Date(sale.timestamp).toLocaleTimeString(lang === 'ar' ? 'ar-SY' : 'en-US')}
 </span>
 </div>
 <div className="text-xs text-slate-600 font-medium">
 {sale.items.map((i: any) => `${i.name} (${i.quantitySold})`).join(', ')}
 </div>
 </div>
 
 <div className="flex items-center gap-4 shrink-0 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
 <div className="text-right">
 <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1">{lang === 'ar' ? 'المبيعات' : 'REVENUE'}</span>
 <span className="font-black text-brand-900 font-mono text-sm">{(Number(sale.totalRevenue) || 0).toLocaleString()} <span className="text-[10px] text-brand-600">SYP</span></span>
 </div>
 <div className="border-l border-slate-200 h-8 shrink-0" />
 <div className="text-right">
 <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1">{lang === 'ar' ? 'الربح' : 'PROFIT'}</span>
 <span className="font-black text-indigo-700 font-mono text-sm">{(Number(sale.totalProfit) || 0).toLocaleString()} <span className="text-[10px] text-brand-600">SYP</span></span>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </motion.div>
 </div>
 );
}
