import { describe, it, expect } from 'vitest';
import { resolveUnitCost, computeMargin } from '../../utils/cost';

describe('resolveUnitCost', () => {
  it('returns real batch acquisition cost with provenance=batch', () => {
    expect(resolveUnitCost(1250)).toEqual({ unitCost: 1250, provenance: 'batch' });
  });

  it('marks missing / zero / invalid cost as unavailable with unitCost 0', () => {
    expect(resolveUnitCost(0)).toEqual({ unitCost: 0, provenance: 'unavailable' });
    expect(resolveUnitCost(undefined)).toEqual({ unitCost: 0, provenance: 'unavailable' });
    expect(resolveUnitCost(null)).toEqual({ unitCost: 0, provenance: 'unavailable' });
    expect(resolveUnitCost(NaN)).toEqual({ unitCost: 0, provenance: 'unavailable' });
    expect(resolveUnitCost(-5)).toEqual({ unitCost: 0, provenance: 'unavailable' });
  });

  it('NEVER fabricates a percentage-based estimate', () => {
    // The old bug: price * 0.7 silently presented as cost.
    const price = 1000;
    const resolved = resolveUnitCost(undefined);
    expect(resolved.unitCost).not.toBe(price * 0.7);
    expect(resolved.provenance).toBe('unavailable');
  });
});

describe('computeMargin', () => {
  it('computes profit and margin from known costs only', () => {
    const m = computeMargin(3000, [
      { quantity: 2, resolved: resolveUnitCost(500) },
      { quantity: 1, resolved: resolveUnitCost(750) },
    ]);
    expect(m.grossProfit).toBe(1250);
    expect(m.marginPct).toBeCloseTo((1250 / 3000) * 100, 6);
    expect(m.unavailableCostLines).toBe(0);
  });

  it('treats unavailable-cost lines as 0 and flags them', () => {
    const m = computeMargin(2000, [
      { quantity: 1, resolved: resolveUnitCost(600) },
      { quantity: 3, resolved: resolveUnitCost(undefined) },
    ]);
    expect(m.grossProfit).toBe(1400); // upper bound
    expect(m.unavailableCostLines).toBe(1);
  });

  it('returns null margin when revenue is zero', () => {
    const m = computeMargin(0, [{ quantity: 1, resolved: resolveUnitCost(10) }]);
    expect(m.marginPct).toBeNull();
    expect(m.grossProfit).toBe(-10);
  });
});
