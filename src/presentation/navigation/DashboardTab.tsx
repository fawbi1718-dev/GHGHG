import React, { useMemo } from 'react';
import { Medicine, SaleRecord } from '../../types';
import { Package, AlertTriangle, TrendingUp, ShoppingCart, Activity, ScanLine, ArrowRight } from 'lucide-react';

interface DashboardTabProps {
 medicines: Medicine[];
 salesLogs: SaleRecord[];
 lang: 'en' | 'ar';
 onNavigate: (tab: any) => void;
}

export default function DashboardTab({ medicines, salesLogs, lang, onNavigate }: DashboardTabProps) {
 const lowStockThreshold = 10;
 
 const { lowStockItems, outOfStockItems, totalValue, totalItems } = useMemo(() => {
 let lowStock: Medicine[] = [];
 let outOfStock: Medicine[] = [];
 let value = 0;
 
 medicines.forEach(m => {
 value += m.price * m.stock;
 if (m.stock === 0) outOfStock.push(m);
 else if (m.stock <= lowStockThreshold) lowStock.push(m);
 });
 
 return { 
 lowStockItems: lowStock, 
 outOfStockItems: outOfStock,
 totalValue: value,
 totalItems: medicines.length
 };
 }, [medicines]);

  const recentSales = useMemo(() => {
    return [...salesLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [salesLogs]);

 return (
 <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
 <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold text-slate-800 ">
 {lang === 'ar' ? 'نظرة عامة' : 'Overview'}
 </h2>
 <p className="text-sm text-slate-500 ">
 {lang === 'ar' ? 'مرحباً بك في لوحة تحكم الصيدلية' : 'Welcome back to your pharmacy dashboard.'}
 </p>
 </div>
 
 <div className="flex gap-2">
 <button 
 onClick={() => onNavigate('checkout')}
 className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
 >
 <ShoppingCart className="w-4 h-4" />
 <span>{lang === 'ar' ? 'بيع جديد' : 'New Sale'}</span>
 </button>
 <button 
 onClick={() => onNavigate('scan')}
 className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-semibold transition-colors"
 >
 <ScanLine className="w-4 h-4" />
 <span>{lang === 'ar' ? 'إضافة دواء' : 'Add Stock'}</span>
 </button>
 </div>
 </div>

 {/* Bento Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
 
 {/* Main Stats Card */}
 <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
 <div>
 <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
 <Activity className="w-5 h-5 text-emerald-600 " />
 </div>
 <h3 className="text-slate-500 text-sm font-medium mb-1">
 {lang === 'ar' ? 'إجمالي قيمة المخزون' : 'Total Inventory Value'}
 </h3>
 <div className="text-3xl md:text-4xl font-bold text-slate-800 font-mono tracking-tight">
 {(Number(totalValue) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} SYP
 </div>
 </div>
 
 <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100 ">
 <div>
 <div className="text-2xl font-bold text-slate-800 ">{totalItems}</div>
 <div className="text-xs text-slate-500 font-medium">{lang === 'ar' ? 'إجمالي الأصناف' : 'Total Items'}</div>
 </div>
 <div>
 <div className="text-2xl font-bold text-slate-800 ">{salesLogs.length}</div>
 <div className="text-xs text-slate-500 font-medium">{lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</div>
 </div>
 </div>
 </div>

 {/* Low Stock Alert Card */}
 <div className={`rounded-xl border p-6 shadow-sm flex flex-col \${outOfStockItems.length > 0 ? 'bg-red-50 border-red-200 ' : 'bg-orange-50 border-orange-200 '}`}>
 <div className="flex items-center gap-3 mb-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center \${outOfStockItems.length > 0 ? 'bg-red-100 ' : 'bg-orange-100 '}`}>
 <AlertTriangle className={`w-5 h-5 \${outOfStockItems.length > 0 ? 'text-red-600 ' : 'text-orange-600 '}`} />
 </div>
 <h3 className={`font-semibold \${outOfStockItems.length > 0 ? 'text-red-900 ' : 'text-orange-900 '}`}>
 {lang === 'ar' ? 'تنبيهات المخزون' : 'Stock Alerts'}
 </h3>
 </div>
 
 <div className="flex-1 space-y-4">
 {outOfStockItems.slice(0, 2).map(item => (
 <div key={item.id} className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-red-100 ">
 <div className="truncate pr-2">
 <div className="text-sm font-bold text-slate-800 truncate">{item.name}</div>
 <div className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Out of Stock</div>
 </div>
 </div>
 ))}
 {lowStockItems.slice(0, 3 - Math.min(2, outOfStockItems.length)).map(item => (
 <div key={item.id} className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-orange-100 ">
 <div className="truncate pr-2">
 <div className="text-sm font-bold text-slate-800 truncate">{item.name}</div>
 <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">{item.stock} Remaining</div>
 </div>
 </div>
 ))}
 {(lowStockItems.length + outOfStockItems.length) === 0 && (
 <div className="text-sm text-green-600 font-medium flex items-center gap-2 h-full justify-center">
 All stock levels are healthy!
 </div>
 )}
 </div>
 
 <button 
 onClick={() => onNavigate('inventory')}
 className={`mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors \${outOfStockItems.length > 0 ? 'bg-red-100 hover:bg-red-200 text-red-700 ' : 'bg-orange-100 hover:bg-orange-200 text-orange-700 '}`}
 >
 <span>View All</span>
 <ArrowRight className="w-4 h-4" />
 </button>
 </div>

 {/* Recent Activity */}
 <div className="md:col-span-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
 <TrendingUp className="w-5 h-5 text-green-600 " />
 </div>
 <h3 className="font-semibold text-slate-800 ">
 {lang === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
 </h3>
 </div>
 <button 
 onClick={() => onNavigate('analytics')}
 className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
 >
 <span>{lang === 'ar' ? 'كل التقارير' : 'All Reports'}</span>
 <ArrowRight className="w-4 h-4" />
 </button>
 </div>
 
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="border-b border-slate-100 ">
 <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
 <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{lang === 'ar' ? 'الأصناف' : 'Items'}</th>
 <th className="pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 ">
 {recentSales.length > 0 ? recentSales.map(sale => (
 <tr key={sale.saleId} className="hover:bg-slate-50 transition-colors">
 <td className="py-3 text-sm text-slate-600 ">
 {new Date(sale.timestamp || Date.now()).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </td>
 <td className="py-3 text-sm text-slate-800 font-medium">
 {sale.items?.length || 0} {sale.items?.length === 1 ? 'item' : 'items'}
 </td>
 <td className="py-3 text-sm text-slate-800 font-bold font-mono text-right">
 {(Number(sale.totalRevenue) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} SYP
 </td>
 </tr>
 )) : (
 <tr>
 <td colSpan={3} className="py-8 text-center text-sm text-slate-500 ">
 No recent sales found.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 </div>
 </div>
 );
}
