export class SerialLockCollisionError extends Error {
 constructor(
 public readonly packageSerial: string,
 message?: string
 ) {
 const defaultMsg = `Serial lock collision detected for package serial: "${packageSerial}". Another register tab is currently locking this item to prevent duplicate selling.`;
 super(message || defaultMsg);
 this.name = "SerialLockCollisionError";
 Object.setPrototypeOf(this, SerialLockCollisionError.prototype);
 }
}

export class BrowserTabLockManager {
 /**
 * Executes an asynchronous action under an exclusive browser-wide lock for the given package serial.
 * Utilizes the native Web Locks API to prevent multi-tab/multi-register duplicate selling while offline.
 * Immediately throws a SerialLockCollisionError if the lock is held by another context.
 */
 public async executeWithPackageLock(
 packageSerial: string,
 action: () => Promise<void>
 ): Promise<void> {
 if (!packageSerial || packageSerial.trim() === "") {
 throw new Error("executeWithPackageLock failed: Package serial cannot be empty.");
 }

 const lockName = `package_serial:${packageSerial}`;

 // Fallback if the browser does not support Web Locks API
 if (!navigator.locks || !navigator.locks.request) {
 console.warn("Web Locks API is not supported in this browser. Falling back to direct execution.");
 return await action();
 }

 return new Promise<void>((resolve, reject) => {
 navigator.locks.request(
 lockName,
 { ifAvailable: true },
 async (lock) => {
 if (lock === null) {
 // Lock was not available, meaning another tab/register holds it!
 reject(new SerialLockCollisionError(packageSerial));
 return;
 }

 try {
 await action();
 resolve();
 } catch (err) {
 reject(err);
 }
 }
 ).catch((err) => {
 reject(err);
 });
 });
 }
}
