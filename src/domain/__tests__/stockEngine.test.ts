import { describe, it, expect } from 'vitest';
import { DrugBatch } from '../inventory';
import { planNetDeltas, planFEFOOps, PendingDelta } from '../../domain/services/StockEngine';
import { FEFOStockAllocator } from '../../domain/services';

function batch(id: string, expiry: string, stock: number): DrugBatch {
  return new DrugBatch(id, 'med', 'BN-' + id, new Date(expiry), 10, stock, false);
}

describe('StockEngine planning', () => {
  it('planNetDeltas merges queued deltas per medicine', () => {
    const q = new Map<string, PendingDelta>();
    q.set('a', { delta: -5, clicks: 5, notes: ['Quick inventory reduction'] });
    q.set('b', { delta: 3, clicks: 3, notes: ['Quick inventory injection'] });
    const net = planNetDeltas(q);
    expect(net.get('a')!.netDelta).toBe(-5);
    expect(net.get('b')!.netDelta).toBe(3);
  });

  it('positive net delta plans a corrective batch + aggregate increment', () => {
    const plan = planFEFOOps([batch('x', '2099-01-01', 10)], 4);
    expect(plan.aggregateDelta).toBe(4);
    expect(plan.correctiveBatch?.stock).toBe(4);
    expect(plan.batchOps).toHaveLength(0);
  });

  it('negative net delta plans FEFO deductions oldest-expiry first', () => {
    const batches = [
      batch('newer', '2030-01-01', 10),
      batch('older', '2027-01-01', 6)
    ];
    const plan = planFEFOOps(batches, -8);
    expect(plan.aggregateDelta).toBe(-8);
    // FEFO: older expires first
    expect(plan.batchOps[0]).toEqual({ batchId: 'older', deduct: 6 });
    expect(plan.batchOps[1]).toEqual({ batchId: 'newer', deduct: 2 });
  });

  it('zero net delta (equal adds and subtracts) produces a no-op plan', () => {
    const plan = planFEFOOps([batch('x', '2099-01-01', 10)], 0);
    expect(plan.aggregateDelta).toBe(0);
    expect(plan.correctiveBatch).toBeUndefined();
    expect(plan.batchOps).toHaveLength(0);
  });

  it('insufficient active stock still throws (never partial)', () => {
    expect(() => FEFOStockAllocator.allocateStock([batch('a', '2029-01-01', 2)], 5)).toThrow();
  });

  it('expired batches are excluded from deduction planning', () => {
    const batches = [
      batch('expired', '2020-01-01', 50),
      batch('good', '2099-01-01', 4)
    ];
    const plan = planFEFOOps(batches, -3);
    expect(plan.batchOps).toHaveLength(1);
    expect(plan.batchOps[0].batchId).toBe('good');
  });
});
