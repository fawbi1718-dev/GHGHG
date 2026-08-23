export class DrugMaster {
 constructor(
 public readonly id: string,
 public readonly gtin: string,
 public readonly englishName: string,
 public readonly arabicName: string,
 public readonly requiresColdChain: boolean,
 public readonly maxSafeTemperature: number
 ) {
 if (!id || id.trim() === "") {
 throw new Error("DrugMaster validation failed: id cannot be empty.");
 }
 if (!gtin || gtin.trim() === "") {
 throw new Error("DrugMaster validation failed: GTIN cannot be empty.");
 }
 if (!englishName || englishName.trim() === "") {
 throw new Error("DrugMaster validation failed: English name cannot be empty.");
 }
 if (!arabicName || arabicName.trim() === "") {
 throw new Error("DrugMaster validation failed: Arabic name cannot be empty.");
 }
 }
}

export class DrugBatch {
 private _currentRemainingQuantity: number;
 private _isSpoiled: boolean;

 constructor(
 public readonly id: string,
 public readonly drugMasterId: string,
 public readonly batchNumber: string,
 public readonly expiryDate: Date,
 public readonly ownerBaseCost: number,
 initialQuantity: number,
 isSpoiled: boolean = false
 ) {
 if (!id || id.trim() === "") {
 throw new Error("DrugBatch validation failed: id cannot be empty.");
 }
 if (!drugMasterId || drugMasterId.trim() === "") {
 throw new Error("DrugBatch validation failed: drugMasterId cannot be empty.");
 }
 if (!batchNumber || batchNumber.trim() === "") {
 throw new Error("DrugBatch validation failed: batchNumber cannot be empty.");
 }
 if (!(expiryDate instanceof Date) || isNaN(expiryDate.getTime())) {
 throw new Error("DrugBatch validation failed: expiryDate must be a valid Date object.");
 }
 if (ownerBaseCost < 0) {
 throw new Error("DrugBatch validation failed: ownerBaseCost cannot be negative.");
 }

 this._currentRemainingQuantity = initialQuantity;
 this._isSpoiled = isSpoiled;
 }

 get currentRemainingQuantity(): number {
 return this._currentRemainingQuantity;
 }

 get isSpoiled(): boolean {
 return this._isSpoiled;
 }

 public spoilLot(): void {
 this._isSpoiled = true;
 }

 public deductStock(qty: number): void {
 if (qty < 0) {
 throw new Error("Stock deduction failed: Quantity cannot be negative.");
 }
 if (this._isSpoiled) {
 throw new Error(`Stock deduction failed: Batch ${this.batchNumber} is marked as spoiled.`);
 }
 // Allow stock to go negative for offline reconciliation
 this._currentRemainingQuantity -= qty;
 }

 public clone(): DrugBatch {
 return new DrugBatch(
 this.id,
 this.drugMasterId,
 this.batchNumber,
 new Date(this.expiryDate.getTime()),
 this.ownerBaseCost,
 this._currentRemainingQuantity,
 this._isSpoiled
 );
 }
}

export enum InventoryAction {
 SALE = "SALE",
 RETURN = "RETURN",
 WASTE = "WASTE",
 INGESTION = "INGESTION"
}

export * from "./IInventoryRepository";

