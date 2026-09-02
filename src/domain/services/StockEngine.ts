import { DrugBatch } from '../inventory';
import { FEFOStockAllocator } from './index';

/**
 * StockEngine — debounced, coalescing quantity-adjustment pipeline.
 *
 * WHY: rapid UI taps (+/-) previously fired one Firestore batch PER click,
 * hammering the backend and making the ledger feel laggy. Since the app is
 * offline-first, local state can lead confidently; the engine collects raw
 * deltas per medicine and commits ONE atomic batch per medicine shortly
 * after the last click (quiet period), FEFO-resolved against fresh data.
 *
 * Durability: pending deltas persist to localStorage per tenant and are
 * resumed on boot, so closing the tab mid-burst loses nothing.
 *
 * Pure planning logic (planNetDeltas / planFEFOOps) is exported for tests;
 * I/O is injected (defaultFirestoreExecutor) so vitest needs no mocks.
 */

export interface PendingDelta {
  delta: number;
  clicks: number;
  notes: string[];
}

/** Pure: merge queued deltas into net per-med totals. */
export function planNetDeltas(queue: Map<string, PendingDelta>): Map<string, { netDelta: number; clicks: number; notes: string[] }> {
  const out = new Map<string, { netDelta: number; clicks: number; notes: string[] }>();
  queue.forEach((v, medId) => {
    out.set(medId, { netDelta: v.delta, clicks: v.clicks, notes: v.notes });
  });
  return out;
}

export interface BatchOp { batchId: string; deduct: number }
export interface AdjustmentPlan {
  aggregateDelta: number;
  correctiveBatch?: { stock: number };
  batchOps: BatchOp[];
}

/** Pure: given current active batches and a net delta, produce write ops. Throws InsufficientActiveStockError via allocator. */
export function planFEFOOps(batches: DrugBatch[], netDelta: number): AdjustmentPlan {
  if (netDelta > 0) {
    return { aggregateDelta: netDelta, correctiveBatch: { stock: netDelta }, batchOps: [] };
  }
  if (netDelta < 0) {
    const allocations = FEFOStockAllocator.allocateStock(batches, -netDelta);
    return {
      aggregateDelta: netDelta,
      batchOps: allocations.map(a => ({ batchId: a.batchId, deduct: a.quantityToDeduct }))
    };
  }
  return { aggregateDelta: 0, batchOps: [] };
}

type Executor = (args: {
  tenantId: string;
  medId: string;
  plan: AdjustmentPlan;
  note: string;
}) => Promise<void>;

const FLUSH_MS = 1100;
const STORE_KEY = (t: string) => `pending_stock_adj_${t}`;

export class StockEngine {
  private queues = new Map<string, Map<string, PendingDelta>>(); // key `${tenantId}::${medId}`
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private executor: Executor;

  constructor(executor: Executor) {
    this.executor = executor;
  }

  /** Re-arm pending deltas saved before an unload/tab kill. */
  resume(tenantId: string): number {
    try {
      const raw = localStorage.getItem(STORE_KEY(tenantId));
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as Record<string, PendingDelta>;
      const q = this.queueFor(tenantId);
      let n = 0;
      Object.entries(parsed).forEach(([medId, d]) => {
        q.set(medId, d);
        n++;
      });
      localStorage.removeItem(STORE_KEY(tenantId));
      if (n > 0) this.schedule(tenantId);
      return n;
    } catch {
      return 0;
    }
  }

  enqueue(tenantId: string, medId: string, delta: number, note: string): void {
    const key = `${tenantId}::${medId}`;
    const q = this.queueFor(tenantId);
    const cur = q.get(medId) || { delta: 0, clicks: 0, notes: [] };
    cur.delta += delta;
    cur.clicks += 1;
    if (note && !cur.notes.includes(note)) cur.notes.push(note);
    q.set(medId, cur);
    this.persist(tenantId);
    this.schedule(tenantId);
  }

  pendingCount(tenantId: string): number {
    return this.queueFor(tenantId).size;
  }

  private queueFor(tenantId: string): Map<string, PendingDelta> {
    let q = this.queues.get(tenantId);
    if (!q) { q = new Map(); this.queues.set(tenantId, q); }
    return q;
  }

  private schedule(tenantId: string): void {
    const existing = this.timers.get(tenantId);
    if (existing) clearTimeout(existing);
    this.timers.set(tenantId, setTimeout(() => {
      this.timers.delete(tenantId);
      this.flush(tenantId).catch(console.error);
    }, FLUSH_MS));
  }

  async flush(tenantId: string): Promise<void> {
    const q = this.queueFor(tenantId);
    if (q.size === 0) return;
    const entries = Array.from(q.entries());
    q.clear();
    this.persist(tenantId);

    // Read fresh batches per affected med and commit each net adjustment atomically.
    for (const [medId, pending] of entries) {
      try {
        const net = planNetDeltas(new Map([[medId, pending]])).get(medId)!;
        if (net.netDelta === 0) continue;
        const batches = await this.readBatches(tenantId, medId);
        const plan = planFEFOOps(batches, net.netDelta);
        if (plan.aggregateDelta === 0 && plan.batchOps.length === 0) continue;
        await this.executor({
          tenantId,
          medId,
          plan,
          note: net.notes.join(' · ') || 'Quick adjustments'
        });
      } catch (err: any) {
        // Re-queue failed item for the next burst (never silently dropped).
        console.warn('StockEngine flush item failed, re-queued:', err?.message);
        const rq = this.queueFor(tenantId);
        const cur = rq.get(medId) || { delta: 0, clicks: 0, notes: [] };
        cur.delta += pending.delta;
        cur.clicks += pending.clicks;
        cur.notes = Array.from(new Set([...cur.notes, ...pending.notes]));
        rq.set(medId, cur);
        this.persist(tenantId);
        this.schedule(tenantId);
      }
    }
  }

  protected readBatches(_tenantId: string, _medId: string): Promise<DrugBatch[]> {
    // Overridden by the wired instance (Firestore-backed). Kept abstract so
    // unit tests can inject deterministic batch states.
    return Promise.resolve([]);
  }

  protected persist(tenantId: string): void {
    try {
      const q = this.queueFor(tenantId);
      const obj: Record<string, PendingDelta> = {};
      q.forEach((v, k) => { obj[k] = v; });
      if (Object.keys(obj).length === 0) localStorage.removeItem(STORE_KEY(tenantId));
      else localStorage.setItem(STORE_KEY(tenantId), JSON.stringify(obj));
    } catch { /* storage unavailable: in-memory queue still valid */ }
  }
}
