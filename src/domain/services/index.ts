import { DrugBatch } from "../inventory";

export class InsufficientActiveStockError extends Error {
 constructor(
 public readonly drugMasterId: string,
 public readonly requestedQty: number,
 public readonly availableQty: number,
 message?: string
 ) {
 const deficit = requestedQty - availableQty;
 const defaultMsg = `Insufficient active, unexpired, and unspoiled stock for drug master ID: ${drugMasterId}. Requested: ${requestedQty}, Available: ${availableQty} (Deficit: ${deficit}).`;
 super(message || defaultMsg);
 this.name = "InsufficientActiveStockError";
 Object.setPrototypeOf(this, InsufficientActiveStockError.prototype);
 }
}

export class FEFOStockAllocator {
 /**
 * Deterministically allocates the requested stock quantity from a list of batches
 * using the First-Expiry, First-Out (FEFO) rule. Expired or spoiled batches are excluded.
 */
 public static allocateStock(
 batches: DrugBatch[],
 requestedQty: number,
 referenceTime: Date = new Date()
 ): { batchId: string; quantityToDeduct: number }[] {
 if (requestedQty <= 0) {
 throw new Error("FEFOStockAllocator failed: requested quantity must be positive.");
 }

 // 1. Filter out batches that are spoiled or expired relative to referenceTime
 const activeBatches = batches.filter(batch => {
 const isExpired = batch.expiryDate.getTime() <= referenceTime.getTime();
 const hasStock = batch.currentRemainingQuantity > 0;
 return !batch.isSpoiled && !isExpired && hasStock;
 });

 // 2. Sort by expiryDate in strict ascending order (FEFO)
 const sortedBatches = [...activeBatches].sort(
 (a, b) => a.expiryDate.getTime() - b.expiryDate.getTime()
 );

 // Compute total available active stock
 const totalAvailable = sortedBatches.reduce(
 (sum, b) => sum + b.currentRemainingQuantity,
 0
 );

 if (totalAvailable < requestedQty) {
 const drugMasterId = batches.length > 0 ? batches[0].drugMasterId : "unknown";
 throw new InsufficientActiveStockError(drugMasterId, requestedQty, totalAvailable);
 }

 // 3. Sequentially allocate the requested quantity
 const allocations: { batchId: string; quantityToDeduct: number }[] = [];
 let remainingToAllocate = requestedQty;

 for (const batch of sortedBatches) {
 if (remainingToAllocate <= 0) break;

 const quantityToTake = Math.min(batch.currentRemainingQuantity, remainingToAllocate);
 allocations.push({
 batchId: batch.id,
 quantityToDeduct: quantityToTake
 });
 remainingToAllocate -= quantityToTake;
 }

 return allocations;
 }
}

export * from "./AntiFraudEngine";
