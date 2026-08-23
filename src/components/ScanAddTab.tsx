import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { 
 QrCode, 
 Sparkles, 
 PlusCircle, 
 CheckCircle, 
 RefreshCw, 
 Database, 
 User, 
 MapPin, 
 Layers, 
 Camera, 
 CameraOff, 
 BookOpen,
 Keyboard,
 AlertTriangle
} from 'lucide-react';
import { Medicine } from '../types';
import { searchLocalMeds, findLocalMedByBarcode, normalizeBarcode } from '../services/syncEngine';
import { CATEGORIES, DOSAGE_FORMS } from '../data/constants';
import { translations } from '../data/translations';
import { useAuth } from '../application/auth/AuthContext';
import { db } from '../infrastructure/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { IndexedDbInventoryRepository } from '../infrastructure/storage/IndexedDbInventoryRepository';
import { BackgroundSyncEngine } from '../infrastructure/sync/BackgroundSyncEngine';
import { unlockCamera } from './FullScreenScannerTab';
import { useHardware } from '../application/hooks/useHardware';
import { useCatalog } from '../context/CatalogContext';

interface ScanAddTabProps {
 onAddMedicine: (newMed: Medicine) => Promise<void> | void;
 triggerToast: (message: string, type: 'success' | 'info') => void;
 setActiveTab: (tab: 'analytics' | 'inventory' | 'scan' | 'view') => void;
 onSelectMedicine: (id: string) => void;
 lang?: 'en' | 'ar';
 externalScannedCode?: { code: string; timestamp: number } | null;
}

export default function ScanAddTab({
 onAddMedicine,
 triggerToast,
 setActiveTab,
 onSelectMedicine,
 lang = 'en',
 externalScannedCode
}: ScanAddTabProps) {
 const t = translations[lang];
 const { currentSession } = useAuth();
 const hardware = useHardware();
 const { findByBarcodeRemote } = useCatalog();

 // Form States
 const [name, setName] = useState('');
 const [catalogId, setCatalogId] = useState<string | undefined>(undefined);
 const [unrecognizedModalOpen, setUnrecognizedModalOpen] = useState(false);
 const [scannedCode, setScannedCode] = useState('');
 const [genericName, setGenericName] = useState('');
 const [category, setCategory] = useState(CATEGORIES[1] || 'Antibiotics');
 const [dosageForm, setDosageForm] = useState(DOSAGE_FORMS[0] || 'Tablet');
 const [strength, setStrength] = useState('');
 const [stock, setStock] = useState('40');
 const [minThreshold, setMinThreshold] = useState('15');
 const [expiryDate, setExpiryDate] = useState('');
 const [price, setPrice] = useState('15000');
 const [shelfLocation, setShelfLocation] = useState('Shelf A-3');
 const [supplier, setSupplier] = useState('Apex Therapeutics');
 const [batchNumber, setBatchNumber] = useState('');

 // Auto-complete Search States
 const [nameSuggestions, setNameSuggestions] = useState<any[]>([]);
 const [showSuggestions, setShowSuggestions] = useState(false);
 const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);

 // Search medicines catalog as you go
 useEffect(() => {
 const searchCatalog = async () => {
 if (!name || name.trim().length < 2) {
 setNameSuggestions([]);
 return;
 }
 setIsSearchingCatalog(true);
 try {
 const results = await searchLocalMeds(name, 10);
 // Map them to the format expected by the suggestions dropdown
 const mappedResults = results.map(item => ({
 id: item.sako ? String(item.sako) : (item.barcode || item.name),
 name: item.name || '',
 genericName: item.nameEn || item.name_en || '',
 scientificName: item.composition_key || '',
 category: CATEGORIES[1],
 dosageForm: item.form || DOSAGE_FORMS[0],
 strength: '',
 price: Number(item.price) || 15000,
 shelfLocation: '',
 supplier: item.company_name || 'Apex Therapeutics',
 barcode: item.barcode || ''
 }));
 setNameSuggestions(mappedResults);
 } catch (e) {
 console.error("Search error", e);
 } finally {
 setIsSearchingCatalog(false);
 }
 };
 
 const timeoutId = setTimeout(searchCatalog, 400);
 return () => clearTimeout(timeoutId);
 }, [name, db]);

 // Set default expiry date (1 year from now) and generate starting barcode/batch on load
 useEffect(() => {
 const oneYearFromNow = new Date();
 oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
 setExpiryDate(oneYearFromNow.toISOString().split('T')[0]);
 generateNewBatchNumber();
 }, []);

 useEffect(() => {
 if (externalScannedCode) {
 processScannedBarcode(externalScannedCode.code, 'camera');
 }
 }, [externalScannedCode]);

 const generateNewBatchNumber = (prefix = "BAT") => {
 const rand = Math.floor(100000 + Math.random() * 900000);
 setBatchNumber(`${prefix}-${new Date().getFullYear()}-${rand}`);
 };

 const translateCategory = (cat: string) => {
 if (lang !== 'ar') return cat;
 const cats: Record<string, string> = {
 'All': 'الكل',
 'Antibiotics': 'مضادات حيوية',
 'Cardiology': 'أدوية القلب',
 'Analgesics': 'مسكنات الألم',
 'Antivirals': 'مضادات الفيروسات',
 'Diabetic': 'أدوية السكري',
 'Imported': 'مخزون مستورد',
 };
 return cats[cat] || cat;
 };

 const translateDosageForm = (form: string) => {
 if (lang !== 'ar') return form;
 const forms: Record<string, string> = {
 'Tablet': 'حبوب / كبسول',
 'Syrup': 'شراب سائل',
 'Injection': 'حقن علاجية',
 'Ointment': 'مرهم / كريم',
 'Drops': 'قطرة عينية/أذنية',
 'Inhaler': 'منشقة / بخاخ',
 };
 return forms[form] || form;
 };

 const processScannedBarcode = async (barcode: string, source: 'camera' | 'usb' = 'camera') => {
 setBatchNumber(barcode);
 try {
 let matched: any = null;
 let matchedId: string | null = null;

 // 1. Query Firestore storage_inventory
 if (!matched && currentSession?.pharmacyId && db) {
 const q = query(
 collection(db, 'tenants', currentSession.pharmacyId, 'storage_inventory'),
 where('barcode', '==', barcode)
 );
 const snapshot = await getDocs(q);
 if (!snapshot.empty) {
 const docData = snapshot.docs[0].data();
 matchedId = snapshot.docs[0].id;
 matched = {
 name: docData.name || '',
 genericName: docData.genericName || '',
 category: docData.category || CATEGORIES[1],
 dosageForm: docData.dosageForm || DOSAGE_FORMS[0],
 strength: docData.strength || '',
 price: docData.price || 15000,
 shelfLocation: docData.shelfLocation || '',
 supplier: docData.supplier || '',
 batchNumber: docData.barcode || docData.batchNumber || barcode,
 };
 } else {
 // Fallback legacy pharmacies collection check
 const legacyQ = query(
 collection(db, 'pharmacies', currentSession.pharmacyId, 'storage_inventory'),
 where('barcode', '==', barcode)
 );
 const legacySnapshot = await getDocs(legacyQ);
 if (!legacySnapshot.empty) {
 const docData = legacySnapshot.docs[0].data();
 matchedId = legacySnapshot.docs[0].id;
 matched = {
 name: docData.name || '',
 genericName: docData.genericName || '',
 category: docData.category || CATEGORIES[1],
 dosageForm: docData.dosageForm || DOSAGE_FORMS[0],
 strength: docData.strength || '',
 price: docData.price || 15000,
 shelfLocation: docData.shelfLocation || '',
 supplier: docData.supplier || '',
 batchNumber: docData.barcode || docData.batchNumber || barcode,
 };
 }
 }
 }

 // 3. Query Local Catalog via IndexedDB
 const normBarcode = normalizeBarcode(barcode);
 if (!matched) {
 const localMatch = await findLocalMedByBarcode(normBarcode);
 if (localMatch) {
 matchedId = String(localMatch.sako || localMatch.id || normBarcode);
 matched = {
 name: String(localMatch.name || localMatch.name_en || 'Unknown'),
 genericName: String(localMatch.nameEn || localMatch.name_en || localMatch.composition_key || ''),
 scientificName: String(localMatch.composition_key || ''),
 category: CATEGORIES[1],
 dosageForm: String(localMatch.form || DOSAGE_FORMS[0]),
 strength: String(localMatch.dosage || ''), 
 price: Number(localMatch.price || localMatch.public_price || localMatch.syp_price) || 15000,
 shelfLocation: 'Shelf A-1',
 supplier: String(localMatch.company_name || localMatch.company || 'Apex Therapeutics'),
 batchNumber: normBarcode,
 };
 setCatalogId(matchedId);
 } else {
 const localMatches = await searchLocalMeds(normBarcode, 1);
 if (localMatches && localMatches.length > 0) {
 const item = localMatches[0];
 matchedId = String(item.sako || normBarcode);
 matched = {
 name: String(item.name || 'Unknown'),
 genericName: String(item.nameEn || item.name_en || ''),
 scientificName: String(item.composition_key || ''),
 category: CATEGORIES[1],
 dosageForm: String(item.form || DOSAGE_FORMS[0]),
 strength: '', 
 price: Number(item.price) || 15000,
 shelfLocation: 'Shelf A-1',
 supplier: String(item.company_name || 'Apex Therapeutics'),
 batchNumber: normBarcode,
 };
 setCatalogId(matchedId);
 }
 }
 }

 if (matched && matchedId) {
 // Scenario A: Found
 // Play positive sound
 hardware.playScanSuccess();

 triggerToast(
 lang === 'ar'
 ? `تم العثور على ${matched.name}! جاري الانتقال لصفحة التفاصيل...`
 : `Loaded Item: ${matched.name}! Navigating to details...`,
 "success"
 );

 onSelectMedicine(matchedId);
 setActiveTab('view');
 } else {
 // Scenario B: Not Found
 // Play double-beep sound
 hardware.playScanError();

 setScannedCode(barcode);
 setUnrecognizedModalOpen(true);
 }
 } catch (e) {
 console.error(e);
 triggerToast("Error verifying barcode", "info");
 }
 };

 const processScannedBarcodeRef = useRef(processScannedBarcode);
 useEffect(() => {
 processScannedBarcodeRef.current = processScannedBarcode;
 }, [processScannedBarcode]);

 // Global USB Scanner listener
 useEffect(() => {
 let buffer = '';
 let lastTime = Date.now();
 let timeout: ReturnType<typeof setTimeout>;

 const handleGlobalKeyDown = (e: KeyboardEvent) => {
 // Don't intercept if modifier keys are pressed
 if (e.ctrlKey || e.altKey || e.metaKey) return;

 const currentTime = Date.now();
 
 if (currentTime - lastTime > 60) {
 buffer = '';
 }
 lastTime = currentTime;

 if (e.key === 'Enter') {
 if (buffer.length >= 5) {
 e.preventDefault(); // Prevent form submit or other actions
 const scanned = buffer;
 buffer = '';
 processScannedBarcodeRef.current(scanned, 'usb');
 }
 buffer = '';
 } else if (e.key.length === 1) {
 buffer += e.key;
 }
 
 clearTimeout(timeout);
 timeout = setTimeout(() => {
 buffer = '';
 }, 60);
 };

 // Use capture phase to intercept before React inputs do
 window.addEventListener('keydown', handleGlobalKeyDown, true);
 return () => {
 window.removeEventListener('keydown', handleGlobalKeyDown, true);
 clearTimeout(timeout);
 };
 }, []);

 const handleFormSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!name || !genericName || !strength || !expiryDate || !batchNumber) {
 triggerToast(lang === 'ar' ? "يرجى تعبئة كافة الحقول المطلوبة بالكامل" : "Please fill in all required fields", "info");
 return;
 }

 const priceNum = parseFloat(price);
 const stockNum = parseInt(stock, 10);
 const thresholdNum = parseInt(minThreshold, 10);

 if (isNaN(priceNum) || priceNum <= 0) {
 triggerToast(lang === 'ar' ? "يرجى إدخال سعر مبيع صحيح وموجب" : "Price must be a valid positive number", "info");
 return;
 }
 if (isNaN(stockNum) || stockNum < 0) {
 triggerToast(lang === 'ar' ? "يجب أن تكون الكمية صفر أو أكبر" : "Stock must be 0 or greater", "info");
 return;
 }
 if (isNaN(thresholdNum) || thresholdNum < 0) {
 triggerToast(lang === 'ar' ? "يجب أن يكون حد الأمان صفر أو أكبر" : "Threshold must be 0 or greater", "info");
 return;
 }

 

 const newMedicineId = `med-${Date.now()}`;
 const newMedicine: Medicine = {
 id: newMedicineId,
 catalogId,
 name,
 barcode: scannedCode || batchNumber,
 genericName,
 category,
 stock: stockNum,
 minThreshold: thresholdNum,
 expiryDate,
 price: priceNum,
 dosageForm,
 strength,
 shelfLocation,
 batchNumber,
 supplier,
 ownerId: currentSession?.pharmacyId || "default-pharmacy",
 lastUpdated: new Date().toISOString(),
 history: [
 {
 id: `hist-${Date.now()}`,
 timestamp: new Date().toISOString(),
 type: "scan_add",
 delta: stockNum,
 stockAfter: stockNum,
 note: lang === 'ar' ? "توريد أولي عبر الماسح والباركود" : "Initial Smart Ingestion",
 userEmail: currentSession?.email || "unknown@system"
 }
 ]
 };

 await onAddMedicine(newMedicine);
 triggerToast(lang === 'ar' ? `تم تسجيل المادة بنجاح: ${name} في المستودع.` : `Added ${name} to stock registry.`, "success");
 
 // View the newly created item
 onSelectMedicine(newMedicineId);
 setActiveTab('view');
 };

 return (
 <div id="scan-tab-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6">

 {/* Manual Intake Entry Form */}
 <div className="lg:col-span-12">
 <form onSubmit={handleFormSubmit} className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-6">
 <div className="flex justify-between items-center border-b border-slate-100 pb-4">
 <div>
 <h2 className="text-md font-bold text-slate-800 ">{t.pharmaceuticalIngestion}</h2>
 <p className="text-xs text-slate-400 mt-0.5">
 {t.registerBatchMetadata}
 </p>
 </div>
 <Database className="text-slate-400 w-5 h-5" />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Med Name */}
 <div className="space-y-1.5 relative">
 <label className="text-xs font-semibold text-slate-600 font-mono flex items-center gap-1">
 {t.medicineName} <span className="text-rose-500">*</span>
 {isSearchingCatalog && <RefreshCw className="w-3 h-3 animate-spin text-brand-500 ml-2" />}
 </label>
 <input
 id="form-med-name"
 type="text"
 required
 placeholder="e.g., Panadol, Augmentin"
 value={name}
 onFocus={() => setShowSuggestions(true)}
 onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
 onChange={(e) => {
 setName(e.target.value);
 setShowSuggestions(true);
 }}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all"
 />
 
 {/* Autocomplete Dropdown */}
 <AnimatePresence>
 {showSuggestions && nameSuggestions.length > 0 && (
 <motion.div
 initial={{ opacity: 0, y: -5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-md rounded-xl max-h-60 overflow-y-auto"
 >
 {nameSuggestions.map((suggestion) => (
 <div
 key={suggestion.id}
 onClick={() => {
 setName(suggestion.name);
 setCatalogId(suggestion.id);
 setGenericName(suggestion.scientificName || suggestion.genericName || '');
 setCategory(suggestion.category || category);
 setDosageForm(suggestion.dosageForm || dosageForm);
 setStrength(suggestion.strength || '');
 setPrice(suggestion.price?.toString() || '15000');
 if (suggestion.registeredCode || suggestion.barcode || suggestion.batchNumber) {
 setBatchNumber(suggestion.registeredCode || suggestion.barcode || suggestion.batchNumber);
 }
 setShowSuggestions(false);
 
 // Optional: Auto focus the next empty field
 }}
 className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
 >
 <div className="font-bold text-slate-800 text-xs">{suggestion.name}</div>
 <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
 <span>{suggestion.scientificName || suggestion.genericName} • {suggestion.dosageForm}</span>
 <span className="font-mono text-brand-600 ">{suggestion.registeredCode || suggestion.barcode || suggestion.batchNumber}</span>
 </div>
 </div>
 ))}
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* Generic Name */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">
 {t.genericFormulaName} <span className="text-rose-500">*</span>
 </label>
 <input
 id="form-generic-name"
 type="text"
 required
 placeholder="e.g., Paracetamol, Amoxicillin"
 value={genericName}
 onChange={(e) => setGenericName(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all"
 />
 </div>

 {/* Category Select */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">{t.category}</label>
 <select
 id="form-category"
 value={category}
 onChange={(e) => setCategory(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all appearance-none cursor-pointer"
 >
 {CATEGORIES.filter(cat => cat !== 'All').map(cat => (
 <option key={cat} value={cat}>
 {translateCategory(cat)}
 </option>
 ))}
 </select>
 </div>

 {/* Dosage Form Select */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">{t.dosageForm}</label>
 <select
 id="form-dosage"
 value={dosageForm}
 onChange={(e) => setDosageForm(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all appearance-none cursor-pointer"
 >
 {DOSAGE_FORMS.map(form => (
 <option key={form} value={form}>
 {translateDosageForm(form)}
 </option>
 ))}
 </select>
 </div>

 {/* Strength */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">
 {t.strength} <span className="text-rose-500">*</span>
 </label>
 <input
 id="form-strength"
 type="text"
 required
 placeholder="e.g., 500mg, 1g, 10mg/ml"
 value={strength}
 onChange={(e) => setStrength(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all"
 />
 </div>

 {/* Shelf Location */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">{t.shelfLocation}</label>
 <input
 id="form-location"
 type="text"
 placeholder="e.g., Shelf B-3, Fridge-1"
 value={shelfLocation}
 onChange={(e) => setShelfLocation(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all"
 />
 </div>

 {/* Price (ل.س) */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">
 {t.pricePerPack} <span className="text-rose-500">*</span>
 </label>
 <div className="relative">
 <input
 id="form-price"
 type="number"
 required
 placeholder="e.g., 15000"
 value={price}
 onChange={(e) => setPrice(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 pl-3 pr-14 text-xs text-slate-700 font-semibold focus:outline-none transition-all"
 />
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-600 text-xs font-mono font-bold">
 ل.س
 </span>
 </div>
 </div>

 {/* Expiry Date */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">
 {t.expiryDate} <span className="text-rose-500">*</span>
 </label>
 <input
 id="form-expiry"
 type="date"
 required
 value={expiryDate}
 onChange={(e) => setExpiryDate(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all text-slate-600 "
 />
 </div>

 {/* Current Stock */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">{t.initialStock}</label>
 <input
 id="form-stock"
 type="number"
 min="0"
 value={stock}
 onChange={(e) => setStock(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all"
 />
 </div>

 {/* Min Threshold */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">{t.safetyMinThreshold}</label>
 <input
 id="form-threshold"
 type="number"
 min="0"
 value={minThreshold}
 onChange={(e) => setMinThreshold(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all"
 />
 </div>

 {/* Batch Number */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono flex justify-between items-center">
 <span>{t.batchEanCode} <span className="text-rose-500">*</span></span>
 <button
 type="button"
 onClick={() => generateNewBatchNumber()}
 className="text-[10px] text-brand-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer font-mono"
 >
 <RefreshCw className="w-2.5 h-2.5" /> {t.regenerate}
 </button>
 </label>
 <input
 id="form-batch"
 type="text"
 required
 placeholder="e.g., AMX-2026-99"
 value={batchNumber}
 onChange={(e) => setBatchNumber(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold focus:outline-none transition-all font-mono"
 />
 </div>

 {/* Supplier */}
 <div className="space-y-1.5">
 <label className="text-xs font-semibold text-slate-600 font-mono">{t.wholesaleSupplier}</label>
 <input
 id="form-supplier"
 type="text"
 placeholder="e.g., Global Pharma Corp"
 value={supplier}
 onChange={(e) => setSupplier(e.target.value)}
 className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500/50 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold focus:outline-none transition-all"
 />
 </div>
 </div>

 {/* Locked Multi-tenant Parameters */}
 <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between border border-slate-200 ">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-brand-600 shrink-0">
 <User className="w-4 h-4" />
 </div>
 <div>
 <div className="text-xs font-bold text-slate-700 ">{t.securityTenantContext}</div>
 <div className="text-[10px] text-slate-400 font-medium">Scattered ownerId isolation active</div>
 </div>
 </div>
 <div className="text-right font-mono">
 <span className="text-[10px] bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 font-bold">
 ownerId: {currentSession?.pharmacyId || 'N/A'}
 </span>
 </div>
 </div>

 {/* Form Actions */}
 <div className="flex justify-end gap-3 pt-2">
 <button
 type="button"
 onClick={() => setActiveTab('inventory')}
 className="px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
 >
 {t.cancel}
 </button>
 <button
 id="btn-submit-intake"
 type="submit"
 className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
 >
 <PlusCircle className="w-4 h-4" />
 {t.ingestToRegistry}
 </button>
 </div>
 </form>
 </div>

 {/* Unrecognized Barcode Modal */}
 <AnimatePresence>
 {unrecognizedModalOpen && (
 <motion.div 
 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
 >
 <motion.div 
 initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
 className="bg-white rounded-xl w-full max-w-md shadow-lg overflow-hidden border border-slate-200 "
 >
 <div className="p-6 bg-red-50 border-b border-red-100 text-center">
 <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3 animate-bounce" />
 <h2 className="text-xl font-bold text-red-700 ">
 {lang === 'ar' ? 'رمز باركود غير معروف' : 'Unrecognized Barcode'}
 </h2>
 <p className="text-sm text-red-600/80 mt-1">
 {lang === 'ar' ? 'الرمز:' : 'Code:'} <span className="font-mono font-bold">{scannedCode}</span> {lang === 'ar' ? 'غير مسجل في الكتالوج.' : 'is not in the catalog.'}
 </p>
 </div>
 <div className="p-6 text-center space-y-3">
 <button 
 type="button"
 onClick={() => {
 setUnrecognizedModalOpen(false);
 unlockCamera();
 // Reset form and populate barcode
 setName('');
 setGenericName('');
 setPrice('15000');
 setBatchNumber(scannedCode);
 
 // Focus name input to make registration seamless
 setTimeout(() => {
 const inputEl = document.getElementById('form-med-name');
 if (inputEl) inputEl.focus();
 }, 100);
 }}
 className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition-colors cursor-pointer"
 >
 <PlusCircle className="w-5 h-5" />
 {lang === 'ar' ? 'تسجيل دواء جديد' : 'Register New Medicine'}
 </button>
 <button 
 type="button"
 onClick={() => {
 setUnrecognizedModalOpen(false);
 unlockCamera();
 }}
 className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
 >
 {lang === 'ar' ? 'إلغاء' : 'Cancel'}
 </button>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}
