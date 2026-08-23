/**
 * Coalescing localStorage mirror.
 *
 * Many code paths persist the tenant inventory/sales mirrors (Firestore
 * snapshot handlers + optimistic handlers). Writing a full JSON.stringify of
 * these arrays synchronously on EVERY emission causes main-thread jank and
 * redundant quota pressure during bursts.
 *
 * persistMirror():
 *  - serializes once per call
 *  - skips the write entirely when the serialized payload is unchanged
 *    (across writers AND across reloads)
 *  - coalesces rapid successive writes into one trailing localStorage.setItem
 *  - flushes immediately on page hide so durability matches the old
 *    synchronous behavior
 *
 * The localStorage contract (keys + JSON shape) is preserved exactly.
 */

const DEFAULT_DELAY_MS = 800;

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSerialized = new Map<string, string>();

export function persistMirror(key: string, value: unknown, delayMs: number = DEFAULT_DELAY_MS): void {
  if (typeof window === 'undefined') return;

  const serialized = JSON.stringify(value);

  // Lazily seed the change-detector with what is already stored so that an
  // identical first write after a reload is skipped as well.
  if (!lastSerialized.has(key)) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(key);
    } catch {
      stored = null;
    }
    lastSerialized.set(key, stored ?? '');
  }

  // No-op write (identical content from any writer).
  if (lastSerialized.get(key) === serialized) return;

  lastSerialized.set(key, serialized);

  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key);
      try {
        localStorage.setItem(key, serialized);
      } catch {
        // Quota/unavailable storage: prior behavior swallowed this too.
        // Forget the cache entry so future calls retry the real store.
        lastSerialized.delete(key);
      }
    }, delayMs)
  );
}

/** Write-through any pending mirrored values (used on page hide). */
function flushPendingMirrors(): void {
  for (const [key, timer] of Array.from(pendingTimers.entries())) {
    clearTimeout(timer);
    pendingTimers.delete(key);
    // lastSerialized still holds the newest payload for this key.
    try {
      const payload = lastSerialized.get(key);
      if (payload !== undefined) {
        localStorage.setItem(key, payload);
      }
    } catch {
      /* ignore */
    }
  }
}

if (typeof window !== 'undefined') {
  // Durability parity with the previous synchronous writes: never lose the
  // trailing debounced update just because the user closed/reloaded fast.
  window.addEventListener('pagehide', flushPendingMirrors);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingMirrors();
  });
}
