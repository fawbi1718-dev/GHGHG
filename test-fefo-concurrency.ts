import { DrugBatch } from './src/domain/inventory/index';
import { FEFOStockAllocator } from './src/domain/services/index';

console.log("=== PHASE 3G: CONCURRENCY TEST ===");

// Initial State
const batchA = new DrugBatch('batch-A', 'med-1', 'A1', new Date('2029-01-01'), 10, 10, false);
const batchB = new DrugBatch('batch-B', 'med-1', 'B1', new Date('2030-01-01'), 10, 10, false);

let aggregateStock = 20;

console.log(`Initial: Aggregate = ${aggregateStock}, Batch A = ${batchA.currentRemainingQuantity}, Batch B = ${batchB.currentRemainingQuantity}`);

// Device A offline sale: 6
const deviceABatches = [batchA.clone(), batchB.clone()];
const allocA = FEFOStockAllocator.allocateStock(deviceABatches, 6);
console.log(`Device A allocates:`, allocA);

// Device B offline sale: 8
const deviceBBatches = [batchA.clone(), batchB.clone()];
const allocB = FEFOStockAllocator.allocateStock(deviceBBatches, 8);
console.log(`Device B allocates:`, allocB);

// Synchronization (simulating Firestore increment)
// Firestore increment(-N) is atomic
let dbBatchAQuantity = batchA.currentRemainingQuantity;
let dbBatchBQuantity = batchB.currentRemainingQuantity;
let dbAggregate = aggregateStock;

// Apply Device A writes
for (const alloc of allocA) {
    if (alloc.batchId === 'batch-A') dbBatchAQuantity -= alloc.quantityToDeduct;
    if (alloc.batchId === 'batch-B') dbBatchBQuantity -= alloc.quantityToDeduct;
}
dbAggregate -= 6;

// Apply Device B writes
for (const alloc of allocB) {
    if (alloc.batchId === 'batch-A') dbBatchAQuantity -= alloc.quantityToDeduct;
    if (alloc.batchId === 'batch-B') dbBatchBQuantity -= alloc.quantityToDeduct;
}
dbAggregate -= 8;

console.log(`After synchronization:`);
console.log(`Aggregate = ${dbAggregate}`);
console.log(`Batch A = ${dbBatchAQuantity}`);
console.log(`Batch B = ${dbBatchBQuantity}`);

if (dbAggregate === 6 && dbBatchAQuantity === -4 && dbBatchBQuantity === 10) {
    console.log("Test Passed!");
} else {
    console.log("Test Failed!");
}
