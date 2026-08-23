import { describe, it, expect } from 'vitest';
import { FEFOStockAllocator } from '../services';
import { DrugBatch } from '../inventory';

function batch(id: string, expiry: string, qty: number, spoiled = false): DrugBatch {
  return new DrugBatch(id, 'med-1', `BN-${id}`, new Date(expiry), 100, qty, spoiled);
}

describe('FEFOStockAllocator', () => {
  it('allocates nearest-expiry batches first', () => {
    const allocations = FEFOStockAllocator.allocateStock([
      batch('far', '2030-01-01', 10),
      batch('near', '2027-01-01', 5),
    ], 12);
    expect(allocations).toEqual([
      { batchId: 'near', quantityToDeduct: 5 },
      { batchId: 'far', quantityToDeduct: 7 },
    ]);
  });

  it('never allocates expired or spoiled stock', () => {
    const allocations = FEFOStockAllocator.allocateStock([
      batch('expired', '2020-01-01', 50),
      batch('spoiled', '2030-01-01', 50, true),
      batch('good', '2029-06-01', 4),
    ], 4);
    expect(allocations).toEqual([{ batchId: 'good', quantityToDeduct: 4 }]);
  });

  it('throws InsufficientActiveStockError when active stock cannot cover the request', () => {
    expect(() =>
      FEFOStockAllocator.allocateStock([batch('a', '2029-01-01', 2)], 3)
    ).toThrow(/Insufficient active/i);
  });

  it('ignores zero-quantity batches', () => {
    const allocations = FEFOStockAllocator.allocateStock([
      batch('empty', '2029-01-01', 0),
      batch('full', '2028-01-01', 6),
    ], 6);
    expect(allocations).toEqual([{ batchId: 'full', quantityToDeduct: 6 }]);
  });
});
