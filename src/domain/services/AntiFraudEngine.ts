import { LedgerEntry } from "../ledger";

export interface FraudAnalysisResult {
 isSuspicious: boolean;
 reasons: string[];
}

export class AntiFraudEngine {
 /**
 * Analyzes a single LedgerEntry for potential fraudulent patterns,
 * such as cost variances (employee reporting higher wholesale cost than base)
 * or pricing discrepancies (selling below cost).
 */
 public static analyzeLedgerEntry(entry: LedgerEntry): FraudAnalysisResult {
 const reasons: string[] = [];

 // 1. Check for cost variance (employee reported cost vs owner base cost)
 if (entry.costVariance > 0) {
 reasons.push(
 `Cost variance detected: Employee reported wholesale cost (${entry.reportedWholesaleCost} SYP) is higher than actual base cost (${entry.ownerBaseCost} SYP). Potential kickback or inflated reporting.`
 );
 } else if (entry.costVariance < 0) {
 reasons.push(
 `Negative cost variance: Reported cost (${entry.reportedWholesaleCost} SYP) is below actual base cost (${entry.ownerBaseCost} SYP).`
 );
 }

 // 2. Check for retail price below wholesale cost or base cost
 if (entry.reportedRetailPrice < entry.reportedWholesaleCost) {
 reasons.push(
 `Negative margin: Reported retail price (${entry.reportedRetailPrice} SYP) is below the reported wholesale cost (${entry.reportedWholesaleCost} SYP).`
 );
 }

 if (entry.reportedRetailPrice < entry.ownerBaseCost) {
 reasons.push(
 `Loss-making price: Reported retail price (${entry.reportedRetailPrice} SYP) is below the actual owner base cost (${entry.ownerBaseCost} SYP).`
 );
 }

 // 3. Suspect high quantities or weird ratios
 if (entry.quantity >= 100) {
 reasons.push(`Unusual bulk transaction quantity: ${entry.quantity} items sold in a single checkout.`);
 }

 return {
 isSuspicious: reasons.length > 0,
 reasons,
 };
 }

 /**
 * Performs an audit on a collection of ledger entries to identify any anomalies.
 */
 public static auditTransactions(entries: LedgerEntry[]): {
 suspiciousEntriesCount: number;
 totalExpectedProfit: number;
 totalCostVariance: number;
 anomalies: { entryId: string; reasons: string[] }[];
 } {
 let totalExpectedProfit = 0;
 let totalCostVariance = 0;
 const anomalies: { entryId: string; reasons: string[] }[] = [];

 for (const entry of entries) {
 totalExpectedProfit += entry.expectedProfit;
 totalCostVariance += entry.costVariance;

 const analysis = this.analyzeLedgerEntry(entry);
 if (analysis.isSuspicious) {
 anomalies.push({
 entryId: entry.id,
 reasons: analysis.reasons,
 });
 }
 }

 return {
 suspiciousEntriesCount: anomalies.length,
 totalExpectedProfit,
 totalCostVariance,
 anomalies,
 };
 }
}
