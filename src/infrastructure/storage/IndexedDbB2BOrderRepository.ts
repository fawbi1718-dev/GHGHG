import { IndexedDBStore } from "./IndexedDBStore";
import { B2BOrder } from "../../domain/b2b";

export class IndexedDbB2BOrderRepository {
 public async saveOrder(order: any): Promise<void> {
 const activeTenantId = IndexedDBStore.getActiveTenantId();
 if (activeTenantId === 'default' || (order.buyerTenantId !== activeTenantId && order.sellerTenantId !== activeTenantId)) {
 throw new Error("Cannot save B2B order without matching active tenant.");
 }
 
 // Ensure syncStatus is set for sync pickup without modifying business status
 if (!order.syncStatus) {
 order.syncStatus = 'PENDING_SYNC';
 }

 const { store } = await IndexedDBStore.getStore("pending_orders", "readwrite");
 return new Promise<void>((resolve, reject) => {
 const request = store.put(order);
 request.onsuccess = () => resolve();
 request.onerror = () => reject(new Error(`Failed to save pending order: ${request.error?.message}`));
 });
 }

 public async getPendingOrders(): Promise<any[]> {
 const activeTenantId = IndexedDBStore.getActiveTenantId();
 if (activeTenantId === 'default') return [];
 
 const { store } = await IndexedDBStore.getStore("pending_orders", "readonly");
 
 // We fetch all and filter in-memory since we don't have an index on syncStatus
 return new Promise((resolve, reject) => {
 const request = store.getAll();
 request.onsuccess = () => {
 const results = (request.result || []) as any[];
 const filtered = results.filter(o => 
 (o.buyerTenantId === activeTenantId || o.sellerTenantId === activeTenantId) && 
 o.syncStatus === 'PENDING_SYNC'
 );
 resolve(filtered);
 };
 request.onerror = () => reject(new Error(`Failed to fetch pending orders: ${request.error?.message}`));
 });
 }

 public async markOrderSynced(orderId: string): Promise<void> {
 const activeTenantId = IndexedDBStore.getActiveTenantId();
 if (activeTenantId === 'default') return;
 const { store } = await IndexedDBStore.getStore("pending_orders", "readwrite");
 return new Promise<void>((resolve, reject) => {
 const getReq = store.get(orderId);
 getReq.onsuccess = () => {
 const order = getReq.result;
 if (order && (order.buyerTenantId === activeTenantId || order.sellerTenantId === activeTenantId)) {
 order.syncStatus = 'SYNCED';
 const updateReq = store.put(order);
 updateReq.onsuccess = () => resolve();
 updateReq.onerror = () => reject(new Error(`Failed to update order status: ${updateReq.error?.message}`));
 } else {
 resolve(); // Not found or wrong tenant, ignore
 }
 };
 getReq.onerror = () => reject(new Error(`Failed to get order: ${getReq.error?.message}`));
 });
 }
}
