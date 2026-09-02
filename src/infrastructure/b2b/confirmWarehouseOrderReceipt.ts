import { db } from '../firebase';
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, increment } from 'firebase/firestore';
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
  const nowIso = new Date().toISOString();

  for (const item of orderData.items) {
  const fulfilled_qty = item.approvedQuantity ?? item.requestedQuantity;
  if (fulfilled_qty <= 0) continue;

  // We check `storage_inventory` which is the Firestore representation of the pharmacy's inventory
  const safeMedId = String(item.originalCatalogId).replace(/\//g, '_');
  let targetInventoryRef = doc(db, 'tenants', currentSession.pharmacyId, 'storage_inventory', safeMedId);
  let targetDoc = await getDoc(targetInventoryRef);

  if (!targetDoc.exists()) {
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
  }
  }
  }

  // Every physical receipt lands as its own FEFO-tracked batch. POS sale
  // allocates EXCLUSIVELY from batches — aggregate-only stock is unsellable.
  const batchId = `b2b-${orderId}-${safeMedId}-${Date.now()}`;
  batch.set(doc(db, 'tenants', currentSession.pharmacyId, 'storage_inventory', safeMedId, 'batches', batchId), {
  batchId,
  medId: safeMedId,
  batchNumber: `B2B-${orderId}`,
  expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  cost: item.costAtOrder || 0,
  stock: fulfilled_qty,
  isSpoiled: false,
  lastUpdated: nowIso
  });

  if (targetDoc.exists()) {
  // CASE YES: atomic increment — never a stale read-modify-write.
  batch.update(targetInventoryRef, {
  stock: increment(fulfilled_qty),
  lastUpdated: nowIso
  });
  } else {
  // CASE NO: create a new pharmacy_inventory entry (aggregate mirrors its batch).
  batch.set(targetInventoryRef, {
  id: safeMedId,
  catalogId: item.originalCatalogId,
  name: item.name,
  stock: fulfilled_qty,
  minThreshold: 5,
  price: item.costAtOrder * 1.25, // default retail markup
  ownerId: currentSession.pharmacyId,
  batchNumber: `B2B-${orderId}`,
  expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
  lastUpdated: nowIso,
  history: [{
  id: `hist-${Date.now()}`,
  timestamp: nowIso,
  type: "stock_in",
  note: `Received from Warehouse Order #${orderId}`,
  delta: fulfilled_qty,
  stockAfter: fulfilled_qty
  }]
  });
  }

  totalReceivedCount += fulfilled_qty;
  }

 // Commit transaction
 await batch.commit();

 return totalReceivedCount;
};
