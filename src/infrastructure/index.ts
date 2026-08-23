import { DrugBatch, InventoryAction } from "../domain/inventory";
import { LedgerEntry } from "../domain/ledger";
import { FEFOStockAllocator } from "../domain/services";

export class TransactionRollbackError extends Error {
 constructor(
 public readonly originalError: any,
 message?: string
 ) {
 const errorMsg = originalError instanceof Error ? originalError.message : String(originalError);
 super(message || `Transaction failed and rolled back safely. Underlying cause: ${errorMsg}`);
 this.name = "TransactionRollbackError";
 Object.setPrototypeOf(this, TransactionRollbackError.prototype);
 }
}

export class InventoryTransactionRepository {
 private _batches: Map<string, DrugBatch> = new Map();
 private _ledger: LedgerEntry[] = [];

 constructor(initialBatches: DrugBatch[] = []) {
 for (const batch of initialBatches) {
 this._batches.set(batch.id, batch.clone());
 }
 }

 /**
 * Retrieves defensive copies of all batches currently in-memory.
 */
 public getBatches(): DrugBatch[] {
 return Array.from(this._batches.values()).map(b => b.clone());
 }

 /**
 * Retrieves defensive copies of the ledger records.
 */
 public getLedger(): LedgerEntry[] {
 return [...this._ledger];
 }

 /**
 * Executes a highly secure checkout sale in an atomic, transaction-guaranteed block.
 * If any step fails (e.g. stock shortages, corrupted batch IDs), the entire operation rolls back.
 */
 public executeSecureSale(
 drugMasterId: string,
 requestedQty: number,
 checkoutPayload: { employeeId: string; reportedCost: number; reportedPrice: number }
 ): { ledgerEntries: LedgerEntry[] } {
 if (requestedQty <= 0) {
 throw new Error("executeSecureSale failed: requested quantity must be positive.");
 }

 // 1. Snapshot database state before modifying
 const snapshotBatches = new Map<string, DrugBatch>();
 for (const [id, batch] of this._batches.entries()) {
 snapshotBatches.set(id, batch.clone());
 }
 const snapshotLedger = [...this._ledger];

 try {
 // 2. Fetch all batches bound to the requested DrugMaster ID
 const targetBatches = Array.from(this._batches.values()).filter(
 b => b.drugMasterId === drugMasterId
 );

 if (targetBatches.length === 0) {
 throw new Error(`Database lookup failed: No batches found for DrugMaster ID ${drugMasterId}.`);
 }

 // 3. Delegate to the deterministic FEFO Allocation Service
 const allocations = FEFOStockAllocator.allocateStock(targetBatches, requestedQty);

 const generatedEntries: LedgerEntry[] = [];
 const timestamp = new Date();

 // 4. Update batches and generate secure anti-fraud ledger logs
 for (const alloc of allocations) {
 const batch = this._batches.get(alloc.batchId);
 if (!batch) {
 throw new Error(`Referenced batch ${alloc.batchId} disappeared from database cache during execution.`);
 }

 // Cache original base cost to prevent concurrent modifications
 const originalOwnerBaseCost = batch.ownerBaseCost;

 // Perform deduction with full domain validation
 batch.deductStock(alloc.quantityToDeduct);

 // Build Ledger Entry
 const entryId = `entry-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
 const ledgerEntry = new LedgerEntry(
 entryId,
 batch.id,
 checkoutPayload.employeeId,
 timestamp,
 InventoryAction.SALE,
 alloc.quantityToDeduct,
 checkoutPayload.reportedCost,
 checkoutPayload.reportedPrice,
 originalOwnerBaseCost
 );

 generatedEntries.push(ledgerEntry);
 }

 // 5. Commit transaction and append entries to ledger
 this._ledger.push(...generatedEntries);

 return { ledgerEntries: generatedEntries };
 } catch (error) {
 // 6. Roll back state on failure
 this._batches = snapshotBatches;
 this._ledger = snapshotLedger;
 throw new TransactionRollbackError(error);
 }
 }

 /**
 * Manually ingests or registers a batch in the repository.
 */
 public addBatch(batch: DrugBatch): void {
 this._batches.set(batch.id, batch.clone());
 }

 /**
 * Manually clears state for isolated testing blocks.
 */
 public clearState(): void {
 this._batches.clear();
 this._ledger = [];
 }
}

export * from "./storage/IndexedDBStore";
export * from "./storage/IndexedDbInventoryRepository";

