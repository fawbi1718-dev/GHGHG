import { db } from '../firebase';
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { B2BOrder } from '../../domain/b2b';

/**
 * 3. WAREHOUSE ORDER CONFIRMATION AUTO-RESTOCK
 * 
 * When a pharmacist confirms receipt of an incoming B2B warehouse order (or status becomes 'RECEIVED'):
 * 1. Fetch all order_items associated with orderId.
 * 2. For each item:
 * - Check if it exists in pharmacy_inventory.
 * - If YES: Increment stock_quantity by fulfilled_qty.
 * - If NO: Create a new pharmacy_inventory entry with stock_quantity = fulfilled_qty, barcode, and batch info from the order invoice.
 * 3. Returns the total fulfilled quantity to be used in UI for a success toast: 
 * "Inventory updated with [X] items from Order #[OrderNumber]."
 */
export const confirmWarehouseOrderReceipt = async (orderId: string, currentSession: any) => {
 if (!db || !currentSession?.pharmacyId) return 0;
 
 const orderRef = doc(db, 'b2b_orders', orderId);
 const orderDoc = await getDoc(orderRef);
 if (!orderDoc.exists()) return 0;
 
 const orderData = orderDoc.data() as B2BOrder;
 if (orderData.buyerTenantId !== currentSession.pharmacyId) {
 throw new Error("Unauthorized: Order does not belong to your pharmacy");
 }

 if (orderData.status === 'RECEIVED') {
 return 0; // Already received
 }

 const batch = writeBatch(db);

 // 1. Mark order as RECEIVED
 batch.update(orderRef, {
 status: 'RECEIVED',
 updatedAt: new Date().toISOString()
 });

 // 2. Process order items for Auto-Restock
 let totalReceivedCount = 0;
 
 for (const item of orderData.items) {
 const fulfilled_qty = item.approvedQuantity ?? item.requestedQuantity;
 if (fulfilled_qty <= 0) continue;

 // We check `storage_inventory` which is the Firestore representation of the pharmacy's inventory
 const safeMedId = String(item.originalCatalogId).replace(/\//g, '_');
 let targetInventoryRef = doc(db, 'tenants', currentSession.pharmacyId, 'storage_inventory', safeMedId);
 let targetDoc = await getDoc(targetInventoryRef);
 let existingStock = 0;
 
 if (targetDoc.exists()) {
 existingStock = targetDoc.data().stock || 0;
 } else {
 // Safest compatibility fallback for legacy inventory:
 // Check if the item exists under a legacy generated ID but retains the originalCatalogId
 const legacyQueryByCatalogId = query(
 collection(db, 'tenants', currentSession.pharmacyId, 'storage_inventory'),
 where('catalogId', '==', item.originalCatalogId)
 );
 const legacySnap = await getDocs(legacyQueryByCatalogId);
 
 if (!legacySnap.empty) {
 targetDoc = legacySnap.docs[0];
 targetInventoryRef = targetDoc.ref;
 existingStock = targetDoc.data().stock || 0;
 } else {
 // Last resort fallback by exact name matching
 const legacyQueryByName = query(
 collection(db, 'tenants', currentSession.pharmacyId, 'storage_inventory'),
 where('name', '==', item.name)
 );
 const legacySnapName = await getDocs(legacyQueryByName);
 if (!legacySnapName.empty) {
 targetDoc = legacySnapName.docs[0];
 targetInventoryRef = targetDoc.ref;
 existingStock = targetDoc.data().stock || 0;
 }
 }
 }

 if (targetDoc.exists()) {
 // CASE YES: Increment stock_quantity
 batch.update(targetInventoryRef, { 
 stock: existingStock + fulfilled_qty,
 lastUpdated: new Date().toISOString()
 });
 } else {
 // CASE NO: Create a new pharmacy_inventory entry
 batch.set(targetInventoryRef, {
 id: safeMedId,
 catalogId: item.originalCatalogId,
 name: item.name,
 stock: fulfilled_qty, // stock_quantity = fulfilled_qty
 minThreshold: 5,
 price: item.costAtOrder * 1.25, // default retail markup
 ownerId: currentSession.pharmacyId,
 batchNumber: `B2B-${orderId}`, // batch info from order invoice
 expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
 lastUpdated: new Date().toISOString(),
 history: [{
 id: `hist-${Date.now()}`,
 timestamp: new Date().toISOString(),
 type: "stock_in",
 notes: `Received from Warehouse Order #${orderId}`,
 quantityChange: fulfilled_qty,
 priceAtTime: item.costAtOrder
 }]
 });
 }

 totalReceivedCount += fulfilled_qty;
 }

 // Commit transaction
 await batch.commit();

 return totalReceivedCount;
};
