// Persistent storage and storage use (see SPEC.md, "Project basics").

export interface StorageInfo {
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

/** Asks the browser not to clear Hacker's data. Chrome and Edge decide on their own and may say no at first. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function storageInfo(): Promise<StorageInfo> {
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const est = await navigator.storage?.estimate?.();
  return { persisted, usageBytes: est?.usage ?? null, quotaBytes: est?.quota ?? null };
}

export function formatBytes(n: number | null): string {
  if (n === null) return 'unknown';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
