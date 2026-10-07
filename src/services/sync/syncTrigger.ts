// Lets stores ask for a sync without importing the sync service, which itself
// depends on those stores.

let handler: (() => void) | null = null;

export function setSyncHandler(fn: () => void): void {
  handler = fn;
}

// Fire-and-forget: local writes never wait on the network.
export function requestSync(): void {
  handler?.();
}
