import { DrugMaster, DrugBatch } from "./index";
import { LedgerEntry } from "../ledger";

export interface IInventoryRepository {
 saveDrugMaster(drug: DrugMaster): Promise<void>;
 saveDrugBatch(batch: DrugBatch): Promise<void>;
 getValidBatchesForDrug(drugMasterId: string): Promise<DrugBatch[]>;
 hydrateReactState(): Promise<any[]>;
 commitLedgerTransaction(entry: LedgerEntry, updatedBatches: DrugBatch[]): Promise<void>;
 enqueuePayload(payload: {
 id: string;
 timestamp: Date;
 vectorClock: { [nodeId: string]: number };
 data: any;
 }): Promise<void>;
 getSyncQueue(): Promise<{
 id: string;
 timestamp: Date;
 vectorClock: { [nodeId: string]: number };
 data: any;
 }[]>;
 dequeuePayload(id: string): Promise<void>;
}
