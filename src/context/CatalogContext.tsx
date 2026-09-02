import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { normalizeBarcode } from '../services/syncEngine';
import { useAuth } from '../application/auth/AuthContext';

export interface CatalogItem {
 id?: string;
 barcode?: string;
 code?: string;
 name?: string;
 nameEn?: string;
 name_en?: string;
 price?: number | string;
 company?: string;
 company_name?: string;
 form?: string;
 composition?: string;
 composition_key?: string;
 uses?: string;
 dosage?: string;
 package?: string;
 quantity?: number;
 [key: string]: any;
}

export interface MappedMedicine {
 id: string;
 name: string;
 name_en: string;
 price: number;
 composition: string;
 company: string;
 barcode: string;
 form: string;
}

interface CatalogContextType {
 catalogRaw: CatalogItem[];
 mappedCatalog: MappedMedicine[];
 isLoading: boolean;
 isLoadingCatalog: boolean;
 catalogProgress: number;
 error: string | null;
 findByBarcode: (barcode: string) => CatalogItem | null;
 findMedicineByCode: (scannedCode: string | number) => CatalogItem | null;
 searchCatalog: (query: string, limit?: number) => MappedMedicine[];
 searchCatalogRemote: (query: string, limit?: number) => Promise<MappedMedicine[]>;
 findByBarcodeRemote: (barcode: string) => Promise<MappedMedicine | null>;
 refetchCatalog: () => Promise<void>;
}

export const extractField = (obj: any, keys: string[]): any => {
 if (!obj || typeof obj !== 'object') return undefined;
 for (const key of keys) {
 if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
 return obj[key];
 }
 }
 const objKeys = Object.keys(obj);
 for (const key of keys) {
 const lowerKey = key.toLowerCase();
 const match = objKeys.find(k => k.toLowerCase() === lowerKey);
 if (match && obj[match] !== undefined && obj[match] !== null && obj[match] !== '') {
 return obj[match];
 }
 }
 return undefined;
};

export const mapMedicine = (item: any, index: number): MappedMedicine => {
 const name = String(extractField(item, ['name', 'trade_name', 'arabic_name', 'drug_name']) || 'Unknown');
 const barcode = String(extractField(item, ['barcode', 'code']) || '').replace(/,$/, '').trim();
 const sako = extractField(item, ['sako']);
 return {
 id: sako ? String(sako) : (barcode || `${name.replace(/\s+/g, '_')}_${index}`),
 name,
 name_en: String(extractField(item, ['name_en', 'nameEn', 'english_name', 'latin_name', 'generic_name']) || ''),
 price: Number(extractField(item, ['price', 'public_price', 'syp_price', 'cost'])) || 0,
 composition: String(extractField(item, ['composition_key', 'scientific_name', 'active_ingredient']) || ''),
 company: String(extractField(item, ['company_name', 'company', 'manufacturer']) || ''),
 barcode,
 form: String(extractField(item, ['form', 'dosage', 'pack']) || '')
 };
};

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
 const { currentSession } = useAuth();
 const [catalogRaw, setCatalogRaw] = useState<CatalogItem[]>([]);
 const [isLoading, setIsLoading] = useState<boolean>(true);
 const [catalogProgress, setCatalogProgress] = useState<number>(0);
 const [error, setError] = useState<string | null>(null);

 // RAM Map for 0ms lookup
 const barcodeMap = useRef<Map<string, CatalogItem>>(new Map());

 const fetchCatalog = async () => {
 setIsLoading(true);
 setError(null);
 setCatalogProgress(100);
 
 try {
 const allItems: CatalogItem[] = [];
 const map = new Map<string, CatalogItem>();
 
 // We only fetch a small initial chunk (limit 100) instead of 22000 records
 const { data, error: fetchError } = await supabase
 .from('MEDS')
 .select('*')
 .limit(100);

 if (fetchError) {
 throw fetchError;
 }

 if (data && data.length > 0) {
 for (const row of data) {
 allItems.push(row);
 
 const codes = [
 ...(row.barcode ? String(row.barcode).split(',') : []),
 ...(row.code ? String(row.code).split(',') : [])
 ];
 
 if (row.id) {
 map.set(String(row.id).trim(), row);
 }
 
 for (const codeStr of codes) {
 const cleanCode = codeStr.trim();
 if (cleanCode) {
 map.set(cleanCode, row);
 }
 }
 }
 }

 barcodeMap.current = map;
 setCatalogRaw(allItems);
 setCatalogProgress(100);
 
 } catch (err: any) {
 console.error("[CatalogContext] Failed to load catalog from Supabase:", err);
 setError(err.message || "Failed to load master catalog from Supabase");
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 // AUTH LIFECYCLE: no network catalog fetch on the public login screen.
 if (!currentSession) {
 setIsLoading(false);
 return;
 }
 fetchCatalog();
 }, [currentSession]);

 const mappedCatalog = useMemo(() => {
 return catalogRaw.map((item, idx) => mapMedicine(item, idx));
 }, [catalogRaw]);

 const searchCatalogRemote = useCallback(async (query: string, limit = 30): Promise<MappedMedicine[]> => {
 if (!query.trim()) return mappedCatalog.slice(0, limit);
 
 try {
 // Source data is dirty: barcodes often carry trailing commas ("123456,").
 // eq can never match those — use ilike with a cleaned needle instead.
 const cleanQuery = query.replace(/[\s,]+$/, '');
 const { data, error } = await supabase
 .from('MEDS')
 .select('*')
 .or(`name.ilike.%${query}%,nameEn.ilike.%${query}%,composition_key.ilike.%${query}%,company_name.ilike.%${query}%,barcode.ilike.%${cleanQuery}%`)
 .limit(limit);

 if (error) {
 console.error("Remote search error:", error);
 return [];
 }
 return (data || []).map((item, idx) => mapMedicine(item, idx));
 } catch (err) {
 console.error("Remote search exception:", err);
 return [];
 }
 }, [mappedCatalog]);

 const findByBarcodeRemote = async (barcode: string): Promise<MappedMedicine | null> => {
 if (!barcode.trim()) return null;
 // Comma-proof: source barcodes often end with a stray comma.
 const clean = normalizeBarcode(barcode);
 if (!clean) return null;

 try {
 const { data, error } = await supabase
 .from('MEDS')
 .select('*')
 .ilike('barcode', `%${clean}%`)
 .limit(1);

 if (error || !data || !(data as any[]).length) {
 return null;
 }
 return mapMedicine((data as any[])[0], 0);
 } catch (err) {
 console.error("Remote barcode find exception:", err);
 return null;
 }
 };

 // Fast synchronous function that checks the RAM Map directly
 const findMedicineByCode = (scannedCode: string | number): CatalogItem | null => {
 const codeStr = normalizeBarcode(scannedCode);
 if (!codeStr) return null;
 const match = barcodeMap.current.get(codeStr);
 if (match) return match;
 const stripped = codeStr.replace(/^0+/, '');
 if (stripped && stripped !== codeStr) {
 return barcodeMap.current.get(stripped) || null;
 }
 return null;
 };

 // Backwards compatibility alias
 const findByBarcode = (barcode: string): CatalogItem | null => {
 return findMedicineByCode(barcode);
 };

 // Search catalog items
 const searchCatalog = (query: string, limit = 50): MappedMedicine[] => {
 if (!query.trim()) return mappedCatalog.slice(0, limit);
 const q = query.trim().toLowerCase();
 const results: MappedMedicine[] = [];

 for (const item of mappedCatalog) {
 if (
 item.name.toLowerCase().includes(q) ||
 item.name_en.toLowerCase().includes(q) ||
 item.barcode.toLowerCase().includes(q) ||
 item.composition.toLowerCase().includes(q) ||
 item.company.toLowerCase().includes(q)
 ) {
 results.push(item);
 if (results.length >= limit) break;
 }
 }
 return results;
 };

 return (
 <CatalogContext.Provider
 value={{
 catalogRaw,
 mappedCatalog,
 isLoading,
 isLoadingCatalog: isLoading,
 catalogProgress,
 error,
 findByBarcode,
 findMedicineByCode,
 searchCatalog,
 searchCatalogRemote,
 findByBarcodeRemote,
 refetchCatalog: fetchCatalog
 }}
 >
 {children}
 </CatalogContext.Provider>
 );
};

export const useCatalog = () => {
 const context = useContext(CatalogContext);
 if (!context) {
 throw new Error("useCatalog must be used within a CatalogProvider");
 }
 return context;
};
