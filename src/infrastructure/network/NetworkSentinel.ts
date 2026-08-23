export class NetworkSentinel {
 private static instance: NetworkSentinel | null = null;
 private listeners: ((isOnline: boolean) => void)[] = [];
 private isOnlineState: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;

 private constructor() {
 if (typeof window !== "undefined") {
 window.addEventListener("online", () => this.handleNetworkEvent(true));
 window.addEventListener("offline", () => this.handleNetworkEvent(false));
 }
 }

 public static getInstance(): NetworkSentinel {
 if (!this.instance) {
 this.instance = new NetworkSentinel();
 }
 return this.instance;
 }

 /**
 * Performs an active, lightweight health check against our backend or a reliable endpoint
 * with a strict timeout of 3000ms to verify authentic internet connectivity rather than
 * simply being connected to a local router or sandboxed loopback.
 */
 public async verifyTrueInternetHealth(): Promise<boolean> {
 if (typeof navigator !== "undefined" && !navigator.onLine) {
 this.isOnlineState = false;
 return false;
 }

 const controller = new AbortController();
 const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
  // Probe the app's own origin: unlike a fixed /api/health path, this endpoint exists
  // wherever the app is served (static host or dev server), and only a genuine success
  // response is treated as healthy. HTTP error responses no longer count as "online".
  const response = await fetch(`${window.location.origin}/`, {
  method: "HEAD",
  signal: controller.signal,
  cache: "no-store",
  });
  clearTimeout(timeoutId);

  const healthy = response.ok;
  if (this.isOnlineState !== healthy) {
  this.handleNetworkEvent(healthy);
  }
  return healthy;
 } catch (err) {
 clearTimeout(timeoutId);
 if (this.isOnlineState !== false) {
 this.handleNetworkEvent(false);
 }
 return false;
 }
 }

 /**
 * Registers a subscriber callback that fires immediately when the network status changes.
 */
 public onStatusChange(callback: (isOnline: boolean) => void): () => void {
 this.listeners.push(callback);
 // Execute immediately with current cached state
 callback(this.isOnlineState);

 // Return unsubscriber function
 return () => {
 this.listeners = this.listeners.filter(l => l !== callback);
 };
 }

 private handleNetworkEvent(status: boolean): void {
 this.isOnlineState = status;
 for (const listener of this.listeners) {
 try {
 listener(status);
 } catch (err) {
 console.error("Error executing network status listener callback:", err);
 }
 }
 }

 public getCachedStatus(): boolean {
 return this.isOnlineState;
 }
}
