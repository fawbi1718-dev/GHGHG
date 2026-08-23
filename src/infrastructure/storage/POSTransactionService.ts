import { IndexedDBStore } from './IndexedDBStore';

export interface POSTransactionRecord {
 transactionId: string;
 tenantId: string;
 createdAt: number;
 status: 'PENDING' | 'SYNCED' | 'FAILED' | 'REQUIRES_REVIEW';
 totalRevenue: number;
 paymentMethod: string;
 items: any[];
 allocations: any[];
 error?: string;
 lastAttemptAt: number;
 updatedAt: number;
}

export class POSTransactionService {
 public static async saveTransaction(record: POSTransactionRecord): Promise<void> {
 const activeTenantId = IndexedDBStore.getActiveTenantId();
 if (activeTenantId === 'default' || record.tenantId !== activeTenantId) {
 throw new Error("Cannot save transaction for a different tenant or without an active tenant.");
 }
 return new Promise(async (resolve, reject) => {
 try {
 const { transaction, store } = await IndexedDBStore.getStore('pos_transactions', 'readwrite');
 
 const request = store.put(record);
 
 request.onsuccess = () => resolve();
 request.onerror = () => reject(new Error('Failed to save POS transaction'));
 
 transaction.oncomplete = () => resolve();
 transaction.onerror = () => reject(transaction.error);
 } catch (err) {
 reject(err);
 }
 });
 }

 public static async getTransaction(transactionId: string): Promise<POSTransactionRecord | null> {
 const activeTenantId = IndexedDBStore.getActiveTenantId();
 if (activeTenantId === 'default') {
 return null;
 }
 return new Promise(async (resolve, reject) => {
 try {
 const { store } = await IndexedDBStore.getStore('pos_transactions', 'readonly');
 const request = store.get(transactionId);
 
 request.onsuccess = () => {
 const record = request.result;
 if (record && record.tenantId === activeTenantId) {
 resolve(record);
 } else {
 resolve(null);
 }
 };
 request.onerror = () => reject(new Error('Failed to get POS transaction'));
 } catch (err) {
 reject(err);
 }
 });
 }

 public static async updateTransactionStatus(
 transactionId: string,
 status: POSTransactionRecord['status'],
 error?: string
 ): Promise<void> {
 const record = await this.getTransaction(transactionId);
 if (!record) return;

 record.status = status;
 record.updatedAt = Date.now();
 record.lastAttemptAt = Date.now();
 if (error) {
 record.error = error;
 }

 await this.saveTransaction(record);
 }

 public static async getPendingTransactions(): Promise<POSTransactionRecord[]> {
 return this.getTransactionsByStatus('PENDING');
 }

 public static async getFailedTransactions(): Promise<POSTransactionRecord[]> {
 const activeTenantId = IndexedDBStore.getActiveTenantId();
 if (activeTenantId === 'default') return [];

 return new Promise(async (resolve, reject) => {
 try {
 const { store } = await IndexedDBStore.getStore('pos_transactions', 'readonly');
 const index = store.index('status');
 
 const failedReq = index.getAll('FAILED');
 const reviewReq = index.getAll('REQUIRES_REVIEW');
 
 failedReq.onsuccess = () => {
 reviewReq.onsuccess = () => {
 const allResults = [...(failedReq.result || []), ...(reviewReq.result || [])];
 const filtered = allResults.filter(r => r.tenantId === activeTenantId);
 resolve(filtered);
 };
 reviewReq.onerror = () => reject(new Error('Failed to get REQUIRES_REVIEW transactions'));
 };
 failedReq.onerror = () => reject(new Error('Failed to get FAILED transactions'));
 } catch (err) {
 reject(err);
 }
 });
 }

 private static async getTransactionsByStatus(status: POSTransactionRecord['status']): Promise<POSTransactionRecord[]> {
 const activeTenantId = IndexedDBStore.getActiveTenantId();
 if (activeTenantId === 'default') return [];

 return new Promise(async (resolve, reject) => {
 try {
 const { store } = await IndexedDBStore.getStore('pos_transactions', 'readonly');
 const index = store.index('status');
 const request = index.getAll(status);
 
 request.onsuccess = () => {
 const results = (request.result || []) as POSTransactionRecord[];
 const filtered = results.filter(r => r.tenantId === activeTenantId);
 resolve(filtered);
 };
 request.onerror = () => reject(new Error(`Failed to get transactions with status ${status}`));
 } catch (err) {
 reject(err);
 }
 });
 }
}
