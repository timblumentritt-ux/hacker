// Optional video folder on the golfer's computer (see SPEC.md, "Video folder").
// Hacker reads, writes, and deletes only inside the "Hacker Data" subfolder.

import { deleteMeta, getMeta, setMeta } from './db';

export const SUBFOLDER = 'Hacker Data';
const HANDLE_KEY = 'videoFolderHandle';

// Parts of the File System Access API that TypeScript's DOM types leave out.
type PermissionMode = { mode: 'read' | 'readwrite' };
interface PermissionHandle {
  queryPermission(d: PermissionMode): Promise<PermissionState>;
  requestPermission(d: PermissionMode): Promise<PermissionState>;
}
declare global {
  interface Window {
    showDirectoryPicker?: (o?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}
const RW: PermissionMode = { mode: 'readwrite' };

export type FolderStatus =
  | { state: 'unsupported'; message: string }
  | { state: 'none' }
  | { state: 'needs-permission'; name: string }
  | { state: 'ready'; name: string }
  | { state: 'error'; name: string; message: string };

export function isSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

async function storedHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return getMeta<FileSystemDirectoryHandle>(HANDLE_KEY);
}

export async function getStatus(): Promise<FolderStatus> {
  if (!isSupported()) {
    return {
      state: 'unsupported',
      message: 'This browser cannot open folders. Use current Chrome or Edge to keep videos.',
    };
  }
  const handle = await storedHandle();
  if (!handle) return { state: 'none' };
  try {
    const p = await (handle as unknown as PermissionHandle).queryPermission(RW);
    if (p !== 'granted') return { state: 'needs-permission', name: handle.name };
    await handle.getDirectoryHandle(SUBFOLDER, { create: true });
    return { state: 'ready', name: handle.name };
  } catch (e) {
    return { state: 'error', name: handle.name, message: errorText(e) };
  }
}

/** Opens the browser's folder picker. Must be called from a click. */
export async function chooseFolder(): Promise<FolderStatus> {
  if (!isSupported()) return getStatus();
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await window.showDirectoryPicker!({ id: 'hacker-videos', mode: 'readwrite' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return getStatus(); // golfer cancelled
    throw e;
  }
  await handle.getDirectoryHandle(SUBFOLDER, { create: true });
  await setMeta(HANDLE_KEY, handle);
  return getStatus();
}

/** Asks the browser for permission again. Must be called from a click. */
export async function reconnect(): Promise<FolderStatus> {
  const handle = await storedHandle();
  if (!handle) return { state: 'none' };
  try {
    await (handle as unknown as PermissionHandle).requestPermission(RW);
  } catch {
    // Fall through to report the state.
  }
  return getStatus();
}

/** Forgets the folder. Files already in it are left alone. */
export async function forgetFolder(): Promise<void> {
  await deleteMeta(HANDLE_KEY);
}

/** The Hacker Data subfolder, or null if the folder is not ready. */
async function dataDir(): Promise<FileSystemDirectoryHandle | null> {
  const status = await getStatus();
  if (status.state !== 'ready') return null;
  const handle = await storedHandle();
  return handle!.getDirectoryHandle(SUBFOLDER, { create: true });
}

export function videoFileNameFor(swingId: string, originalName: string): string {
  const ext = /\.[a-z0-9]{1,5}$/i.exec(originalName)?.[0].toLowerCase() ?? '.mov';
  return `${swingId}${ext}`;
}

export type WriteResult = { ok: true } | { ok: false; reason: 'not-ready' | 'disk-full' | 'error'; message: string };

/** Copies a video into the Hacker Data folder. Removes any partial file on failure. */
export async function writeFile(name: string, data: Blob): Promise<WriteResult> {
  const dir = await dataDir();
  if (!dir) return { ok: false, reason: 'not-ready', message: 'The video folder is not connected.' };
  try {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    try {
      await data.stream().pipeTo(w);
    } catch (e) {
      await w.abort().catch(() => {});
      throw e;
    }
    return { ok: true };
  } catch (e) {
    await dir.removeEntry(name).catch(() => {});
    const full = e instanceof DOMException && e.name === 'QuotaExceededError';
    return { ok: false, reason: full ? 'disk-full' : 'error', message: errorText(e) };
  }
}

export async function readFile(name: string): Promise<File | null> {
  const dir = await dataDir();
  if (!dir) return null;
  try {
    return await (await dir.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
}

/** Deletes a file in Hacker Data. Returns false if the folder is not connected. Missing files count as deleted. */
export async function deleteFile(name: string): Promise<boolean> {
  const dir = await dataDir();
  if (!dir) return false;
  try {
    await dir.removeEntry(name);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e;
  }
  return true;
}

/** Total size of the files in Hacker Data, in bytes, and how many there are. */
export async function folderSize(): Promise<{ bytes: number; files: number } | null> {
  const dir = await dataDir();
  if (!dir) return null;
  let bytes = 0;
  let files = 0;
  // values() is in Chrome and Edge but missing from TypeScript's DOM types.
  const entries = (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
  for await (const entry of entries) {
    if (entry.kind === 'file') {
      bytes += (await (entry as FileSystemFileHandle).getFile()).size;
      files++;
    }
  }
  return { bytes, files };
}

function errorText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
