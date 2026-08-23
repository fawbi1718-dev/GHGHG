import { IInventoryRepository } from "../domain/inventory/IInventoryRepository";
import { IndexedDbInventoryRepository } from "../infrastructure/storage/IndexedDbInventoryRepository";
import { BrowserTabLockManager } from "../infrastructure/concurrency/WebLockManager";
import { BackgroundSyncEngine } from "../infrastructure/sync/BackgroundSyncEngine";
import { FEFOStockAllocator } from "../domain/services";
import { AntiFraudEngine, FraudAnalysisResult } from "../domain/services/AntiFraudEngine";
import { LedgerEntry } from "../domain/ledger";
import { DrugBatch, DrugMaster, InventoryAction } from "../domain/inventory";

export interface CheckoutItemRequest {
 drugMasterId: string;
 quantity: number;
 reportedWholesaleCost?: number; // if omitted, uses the owner base cost
 reportedRetailPrice: number;
}

export interface CheckoutResult {
 success: boolean;
 ledgerEntries: LedgerEntry[];
 fraudWarnings: { entryId: string; reasons: string[] }[];
 error?: string;
}

export class RegisterApplicationService {
 private repository: IInventoryRepository;
 private lockManager: BrowserTabLockManager;
 private syncEngine: BackgroundSyncEngine;

 constructor(
 repository?: IInventoryRepository,
 lockManager?: BrowserTabLockManager,
 syncEngine?: BackgroundSyncEngine
 ) {
 this.repository = repository || new IndexedDbInventoryRepository();
 this.lockManager = lockManager || new BrowserTabLockManager();
 this.syncEngine = syncEngine || BackgroundSyncEngine.getInstance(this.repository);
 }

 /**
 * Initializes the database by populating it with initial drug masters and batches.
 */
 public async initializeAndPopulate(drugMasters: DrugMaster[], batches: DrugBatch[]): Promise<void> {
 for (const dm of drugMasters) {
 await this.repository.saveDrugMaster(dm);
 }
 for (const batch of batches) {
 await this.repository.saveDrugBatch(batch);
 }
 console.log("RegisterApplicationService: Local IndexedDB database successfully initialized and populated.");
 }

 /**
 * Fetches valid, unspoiled, and unexpired batches for a given drug.
 */
 public async getValidBatches(drugMasterId: string): Promise<DrugBatch[]> {
 return await this.repository.getValidBatchesForDrug(drugMasterId);
 }

 /**
 * Executes an atomic POS checkout transaction for a single item under exclusive lock protection.
 */
 public async executeSingleCheckout(
 employeeId: string,
 item: CheckoutItemRequest,
 isOnline: boolean,
 simulateSuccess: boolean = true
 ): Promise<CheckoutResult> {
 const lockKey = `pos_lock:${item.drugMasterId}`;
 const ledgerEntries: LedgerEntry[] = [];
 const fraudWarnings: { entryId: string; reasons: string[] }[] = [];
 let checkoutError: string | undefined;

 // Execute within a multi-tab exclusive web lock
 try {
 await this.lockManager.executeWithPackageLock(lockKey, async () => {
 // 1. Fetch valid, active batches for this drug
 const validBatches = await this.repository.getValidBatchesForDrug(item.drugMasterId);
 
 // 2. Perform FEFO stock allocation
 const allocations = FEFOStockAllocator.allocateStock(validBatches, item.quantity);

 const updatedBatches: DrugBatch[] = [];

 // 3. Construct ledger entries and update batch quantities
 for (const allocation of allocations) {
 const batch = validBatches.find((b) => b.id === allocation.batchId);
 if (!batch) {
 throw new Error(`Allocated batch with ID ${allocation.batchId} not found in valid batches.`);
 }

 // Deduct stock from the batch entity
 batch.deductStock(allocation.quantityToDeduct);
 updatedBatches.push(batch);

 // Determine costs
 const baseCost = batch.ownerBaseCost;
 const wholesaleCost = item.reportedWholesaleCost !== undefined ? item.reportedWholesaleCost : baseCost;

 // Create ledger entry
 const entryId = `entry-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
 const entry = new LedgerEntry(
 entryId,
 batch.id,
 employeeId,
 new Date(),
 InventoryAction.SALE,
 allocation.quantityToDeduct,
 wholesaleCost,
 item.reportedRetailPrice,
 baseCost
 );

 ledgerEntries.push(entry);

 // Run Anti-Fraud analysis
 const fraudResult = AntiFraudEngine.analyzeLedgerEntry(entry);
 if (fraudResult.isSuspicious) {
 fraudWarnings.push({
 entryId: entry.id,
 reasons: fraudResult.reasons
 });
 }
 }

 // 4. Commit atomic ledger transaction to the repository (IndexedDB)
 for (const entry of ledgerEntries) {
 await this.repository.commitLedgerTransaction(entry, updatedBatches);
 }

 // Legacy Background Sync Engine payload enqueueing removed from POS transaction path.
 // POS transactions are now directly synchronized via Firestore native offline persistence
 // at the UI level (RootNavigator.tsx).
 
 });

 // Legacy trigger loop removed from POS transaction path.
 
 return {
 success: true,
 ledgerEntries,
 fraudWarnings
 };

 } catch (err: any) {
 console.error("Checkout execution halted/rolled back:", err);
 return {
 success: false,
 ledgerEntries: [],
 fraudWarnings: [],
 error: err.message || "An unexpected error occurred during checkout."
 };
 }
 }

 /**
 * Executes a bulk POS checkout transaction for multiple cart items sequentially.
 */
 public async executeBulkCheckout(
 employeeId: string,
 items: CheckoutItemRequest[],
 isOnline: boolean,
 simulateSuccess: boolean = true
 ): Promise<CheckoutResult> {
 const totalLedgerEntries: LedgerEntry[] = [];
 const totalFraudWarnings: { entryId: string; reasons: string[] }[] = [];

 for (const item of items) {
 const result = await this.executeSingleCheckout(employeeId, item, isOnline, simulateSuccess);
 if (!result.success) {
 return {
 success: false,
 ledgerEntries: [],
 fraudWarnings: [],
 error: `Checkout failed for item ${item.drugMasterId}: ${result.error}`
 };
 }
 totalLedgerEntries.push(...result.ledgerEntries);
 totalFraudWarnings.push(...result.fraudWarnings);
 }

 return {
 success: true,
 ledgerEntries: totalLedgerEntries,
 fraudWarnings: totalFraudWarnings
 };
 }
}
