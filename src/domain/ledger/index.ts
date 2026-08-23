import { InventoryAction } from "../inventory";

export class LedgerEntry {
 public readonly costVariance: number;
 public readonly expectedProfit: number;

 constructor(
 public readonly id: string,
 public readonly batchId: string,
 public readonly employeeId: string,
 public readonly timestamp: Date,
 public readonly action: InventoryAction,
 public readonly quantity: number,
 public readonly reportedWholesaleCost: number,
 public readonly reportedRetailPrice: number,
 public readonly ownerBaseCost: number
 ) {
 if (!id || id.trim() === "") {
 throw new Error("LedgerEntry validation failed: id is required.");
 }
 if (!batchId || batchId.trim() === "") {
 throw new Error("LedgerEntry validation failed: batchId is required.");
 }
 if (!employeeId || employeeId.trim() === "") {
 throw new Error("LedgerEntry validation failed: employeeId is required.");
 }
 if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
 throw new Error("LedgerEntry validation failed: timestamp must be a valid Date.");
 }
 if (quantity <= 0) {
 throw new Error("LedgerEntry validation failed: quantity must be greater than zero.");
 }
 if (reportedWholesaleCost < 0) {
 throw new Error("LedgerEntry validation failed: reportedWholesaleCost cannot be negative.");
 }
 if (reportedRetailPrice < 0) {
 throw new Error("LedgerEntry validation failed: reportedRetailPrice cannot be negative.");
 }
 if (ownerBaseCost < 0) {
 throw new Error("LedgerEntry validation failed: ownerBaseCost cannot be negative.");
 }

 // costVariance = reportedWholesaleCost - DrugBatch.ownerBaseCost
 // Detects if an employee is over-reporting cost relative to the actual owner base cost.
 this.costVariance = reportedWholesaleCost - ownerBaseCost;

 // expectedProfit = (reportedRetailPrice - DrugBatch.ownerBaseCost) * quantity
 this.expectedProfit = (reportedRetailPrice - ownerBaseCost) * quantity;
 }
}

export interface SealedDailyReport {
 readonly date: string; // Format YYYY-MM-DD
 readonly entries: readonly LedgerEntry[];
 readonly totalDailyProfit: number;
 readonly totalEmployeeCostVariance: number;
 readonly sealedAt: Date;
 readonly isReadOnly: boolean;
}

export class ImmutableHistoricalBlock {
 /**
 * Seals list of LedgerEntry instances into a deep-frozen, read-only SealedDailyReport.
 */
 public static sealDailyTransactions(dateStr: string, entries: LedgerEntry[]): SealedDailyReport {
 if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
 throw new Error("Seal failed: Date must be provided in YYYY-MM-DD format.");
 }

 // Create a pristine defensive copy first
 const copiedEntries = entries.map(entry => {
 const copy = new LedgerEntry(
 entry.id,
 entry.batchId,
 entry.employeeId,
 new Date(entry.timestamp.getTime()),
 entry.action,
 entry.quantity,
 entry.reportedWholesaleCost,
 entry.reportedRetailPrice,
 entry.ownerBaseCost
 );
 return Object.freeze(copy);
 });

 const totalDailyProfit = copiedEntries.reduce((sum, entry) => sum + entry.expectedProfit, 0);
 const totalEmployeeCostVariance = copiedEntries.reduce((sum, entry) => sum + entry.costVariance, 0);

 const report: SealedDailyReport = {
 date: dateStr,
 entries: Object.freeze(copiedEntries),
 totalDailyProfit,
 totalEmployeeCostVariance,
 sealedAt: new Date(),
 isReadOnly: true
 };

 // Deep freeze the entire report structure to guarantee zero post-checkout tampering
 return Object.freeze(report);
 }
}
