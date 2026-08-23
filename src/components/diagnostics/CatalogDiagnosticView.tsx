import React, { useState, useEffect } from 'react';
import { Search, Database, RefreshCw, X, AlertCircle, FileText, CheckCircle, Table as TableIcon } from 'lucide-react';
import { getDB as getCatalogDB } from '../../services/syncEngine';

const STORE_NAME = 'localMeds';

interface DiagnosticStats {
 totalRecords: number;
 uniqueSakos: number;
 missingArName: number;
 missingEnName: number;
 missingIngredient: number;
 missingBarcode: number;
 duplicateSakos: number;
}

export default function CatalogDiagnosticView({
 onClose,
 lang,
}: {
 onClose: () => void;
 lang: 'en' | 'ar';
}) {
 const [stats, setStats] = useState<DiagnosticStats | null>(null);
 const [isCalculating, setIsCalculating] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const [searchResults, setSearchResults] = useState<any[]>([]);
 const [isSearching, setIsSearching] = useState(false);
 const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
 
 const expectedCount = 21904;

 const calculateStats = async () => {
 setIsCalculating(true);
 try {
 const db = await getCatalogDB();
 const tx = db.transaction(STORE_NAME, 'readonly');
 const store = tx.objectStore(STORE_NAME);
 
 let cursor = await store.openCursor();
 
 let total = 0;
 let missingAr = 0;
 let missingEn = 0;
 let missingIng = 0;
 let missingBc = 0;
 
 const seenSakos = new Set<string>();
 let duplicates = 0;

 while (cursor) {
 total++;
 const val = cursor.value;
 
 if (val.sako) {
 if (seenSakos.has(val.sako)) {
 duplicates++;
 } else {
 seenSakos.add(val.sako);
 }
 }
 
 if (!val.name || String(val.name).trim() === '') missingAr++;
 if (!val.english_name || String(val.english_name).trim() === '') missingEn++;
 if (!val.active_ingredient && !val.main_ingredient) missingIng++;
 if (!val.barcode || String(val.barcode).trim() === '') missingBc++;
 
 cursor = await cursor.continue();
 }
 
 setStats({
 totalRecords: total,
 uniqueSakos: seenSakos.size,
 missingArName: missingAr,
 missingEnName: missingEn,
 missingIngredient: missingIng,
 missingBarcode: missingBc,
 duplicateSakos: duplicates
 });
 } catch (err) {
 console.error("Diagnostic error:", err);
 } finally {
 setIsCalculating(false);
 }
 };

 useEffect(() => {
 calculateStats();
 }, []);

 const handleSearch = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!searchQuery.trim()) return;
 
 setIsSearching(true);
 setSearchResults([]);
 setSelectedRecord(null);
 
 try {
 const db = await getCatalogDB();
 const tx = db.transaction(STORE_NAME, 'readonly');
 const store = tx.objectStore(STORE_NAME);
 
 let cursor = await store.openCursor();
 const results = [];
 const q = searchQuery.toLowerCase().trim();
 
 while (cursor && results.length < 100) { // cap at 100
 const val = cursor.value;
 let matched = false;
 
 if (
 (val.sako && String(val.sako).toLowerCase().includes(q)) ||
 (val.name && String(val.name).toLowerCase().includes(q)) ||
 (val.english_name && String(val.english_name).toLowerCase().includes(q)) ||
 (val.barcode && String(val.barcode).toLowerCase().includes(q)) ||
 (val.active_ingredient && String(val.active_ingredient).toLowerCase().includes(q)) ||
 (val.main_ingredient && String(val.main_ingredient).toLowerCase().includes(q))
 ) {
 matched = true;
 }
 
 if (matched) {
 results.push(val);
 }
 
 cursor = await cursor.continue();
 }
 
 setSearchResults(results);
 } catch (err) {
 console.error("Search error:", err);
 } finally {
 setIsSearching(false);
 }
 };

 return (
 <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="bg-white rounded-xl shadow-lg w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-200 ">
 
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-slate-100 ">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-emerald-600 ">
 <Database className="w-5 h-5" />
 </div>
 <div>
 <h2 className="text-xl font-bold text-slate-800 ">
 Catalog Diagnostic Inspector
 </h2>
 <p className="text-sm text-slate-500">Developer/Admin Tool — Read-Only Mode</p>
 </div>
 </div>
 <button 
 onClick={onClose}
 className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="flex-1 overflow-auto p-6 flex flex-col lg:flex-row gap-6">
 
 {/* Left Column: Stats & Search */}
 <div className="w-full lg:w-1/3 flex flex-col gap-6">
 
 {/* Stats Panel */}
 <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 ">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold text-slate-800 ">Catalog Integrity</h3>
 <button 
 onClick={calculateStats} 
 disabled={isCalculating}
 className="p-1.5 hover:bg-slate-200 rounded-md text-emerald-600 disabled:opacity-50"
 title="Refresh Counts"
 >
 <RefreshCw className={`w-4 h-4 ${isCalculating ? 'animate-spin' : ''}`} />
 </button>
 </div>

 {stats ? (
 <div className="space-y-3 text-sm">
 <div className="flex justify-between items-center pb-2 border-b border-slate-200 ">
 <span className="text-slate-600 ">Expected Count (Supabase)</span>
 <span className="font-mono font-medium text-slate-800 ">{expectedCount.toLocaleString()}</span>
 </div>
 <div className="flex justify-between items-center pb-2 border-b border-slate-200 ">
 <span className="text-slate-600 ">Local DB Total Records</span>
 <span className={`font-mono font-medium ${stats.totalRecords === expectedCount ? 'text-emerald-600' : 'text-amber-600'}`}>
 {stats.totalRecords.toLocaleString()}
 </span>
 </div>
 <div className="flex justify-between items-center pb-2 border-b border-slate-200 ">
 <span className="text-slate-600 ">Unique sako IDs</span>
 <span className="font-mono font-medium text-slate-800 ">{stats.uniqueSakos.toLocaleString()}</span>
 </div>
 
 <div className="pt-2">
 <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Missing Field Diagnostics</h4>
 <ul className="space-y-1">
 <li className="flex justify-between">
 <span className="text-slate-500">Missing Arabic Name</span>
 <span className="font-mono text-slate-700 ">{stats.missingArName}</span>
 </li>
 <li className="flex justify-between">
 <span className="text-slate-500">Missing English Name</span>
 <span className="font-mono text-slate-700 ">{stats.missingEnName}</span>
 </li>
 <li className="flex justify-between">
 <span className="text-slate-500">Missing Ingredient</span>
 <span className="font-mono text-slate-700 ">{stats.missingIngredient}</span>
 </li>
 <li className="flex justify-between">
 <span className="text-slate-500">Missing Barcode</span>
 <span className="font-mono text-slate-700 ">{stats.missingBarcode}</span>
 </li>
 </ul>
 </div>
 </div>
 ) : (
 <div className="py-8 text-center text-slate-400 text-sm">
 Calculating local integrity...
 </div>
 )}
 </div>

 {/* Search Panel */}
 <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex-1 flex flex-col">
 <h3 className="font-semibold text-slate-800 mb-4">Inspector Search</h3>
 <form onSubmit={handleSearch} className="flex gap-2 mb-4">
 <input 
 type="text" 
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="sako, name, barcode..."
 className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
 />
 <button 
 type="submit"
 disabled={isSearching || !searchQuery.trim()}
 className="bg-emerald-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center justify-center disabled:opacity-50"
 >
 {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
 </button>
 </form>

 <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white ">
 {searchResults.length > 0 ? (
 <ul className="divide-y divide-slate-100 ">
 {searchResults.map((res, i) => (
 <li 
 key={res.sako || i} 
 className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedRecord?.sako === res.sako ? 'bg-indigo-50 ' : ''}`}
 onClick={() => setSelectedRecord(res)}
 >
 <div className="font-medium text-sm text-slate-800 line-clamp-1">{res.name || res.english_name || 'Unnamed'}</div>
 <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
 <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{res.sako || 'NO_SAKO'}</span>
 {res.barcode && <span>• {res.barcode}</span>}
 </div>
 </li>
 ))}
 </ul>
 ) : (
 <div className="p-6 text-center text-sm text-slate-400">
 {searchQuery && !isSearching ? 'No results found in localDB' : 'Search to inspect specific records'}
 </div>
 )}
 </div>
 </div>
 
 </div>

 {/* Right Column: Raw Record View */}
 <div className="w-full lg:w-2/3 bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col">
 <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
 <FileText className="w-4 h-4 text-indigo-500" />
 Raw IndexedDB Record
 </h3>
 
 {selectedRecord ? (
 <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-lg p-4 font-mono text-xs md:text-sm">
 <table className="w-full text-left">
 <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
 <tr>
 <th className="py-2 px-3 font-semibold w-1/3">Field Key</th>
 <th className="py-2 px-3 font-semibold">Value State</th>
 <th className="py-2 px-3 font-semibold">Raw Data</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 ">
 {Object.keys(selectedRecord).sort().map(key => {
 const val = selectedRecord[key];
 const isMissing = val === undefined || val === null;
 const isEmptyStr = typeof val === 'string' && val.trim() === '';
 
 return (
 <tr key={key} className="hover:bg-slate-50 ">
 <td className="py-2 px-3 text-slate-600 ">{key}</td>
 <td className="py-2 px-3">
 {isMissing ? (
 <span className="inline-flex items-center gap-1 text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-xs">
 <X className="w-3 h-3" /> Missing
 </span>
 ) : isEmptyStr ? (
 <span className="inline-flex items-center gap-1 text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded text-xs">
 <AlertCircle className="w-3 h-3" /> Empty
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs">
 <CheckCircle className="w-3 h-3" /> Present
 </span>
 )}
 </td>
 <td className="py-2 px-3 text-slate-800 break-all">
 {isMissing ? 'null' : (typeof val === 'object' ? JSON.stringify(val) : String(val))}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-200 rounded-lg">
 <TableIcon className="w-8 h-8 mb-3 opacity-20" />
 <p>Select a record from the search results to view its raw data</p>
 </div>
 )}
 </div>
 
 </div>
 </div>
 </div>
 );
}
