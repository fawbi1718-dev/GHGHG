console.log("=== PHASE 3E: RECONCILIATION TEST ===");

let currentBatchStock = -4;
let currentAggregateStock = 6;

let physicalCount = 0; // manager counts 0 in physical shelf
let difference = physicalCount - currentBatchStock; // 0 - (-4) = +4

// apply reconciliation
currentBatchStock = physicalCount;
currentAggregateStock += difference;

console.log(`After reconciliation:`);
console.log(`Aggregate = ${currentAggregateStock}`);
console.log(`Batch = ${currentBatchStock}`);

if (currentAggregateStock === 10 && currentBatchStock === 0) {
    console.log("Test Passed!");
} else {
    console.log("Test Failed!");
}
