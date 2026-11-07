// IndexedDB data layer with versioned schemas.
// Every change to the stored layout is a new entry in MIGRATIONS. Never edit an old entry.

export const DB_NAME = 'hacker';

export const STORES = {
  meta: 'meta', // key-value: profile, settings, video folder handle
  swings: 'swings',
  jointData: 'jointData', // milestone 2
  metrics: 'metrics', // milestone 3
  frameSheets: 'frameSheets', // milestone 3
  uploadCounters: 'uploadCounters',
  uploadLog: 'uploadLog',
} as const;

type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

const MIGRATIONS: Migration[] = [
  // Version 1: first layout.
  (db) => {
    db.createObjectStore(STORES.meta);
    const swings = db.createObjectStore(STORES.swings, { keyPath: 'id' });
    swings.createIndex('set', ['swingType', 'rating']);
    swings.createIndex('swingType', 'swingType');
    db.createObjectStore(STORES.jointData, { keyPath: 'swingId' });
    const metrics = db.createObjectStore(STORES.metrics, { keyPath: ['swingId', 'name'] });
    metrics.createIndex('swingId', 'swingId');
    db.createObjectStore(STORES.frameSheets, { keyPath: 'swingId' });
    db.createObjectStore(STORES.uploadCounters, { keyPath: 'swingType' });
    const log = db.createObjectStore(STORES.uploadLog, { keyPath: 'id', autoIncrement: true });
    log.createIndex('dupKey', 'dupKey');
  },
];

export const DB_VERSION = MIGRATIONS.length;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = (e) => {
        const db = open.result;
        const tx = open.transaction!;
        // A backup before migrating arrives with backup support in milestone 5.
        for (let v = e.oldVersion; v < DB_VERSION; v++) MIGRATIONS[v](db, tx);
      };
      open.onsuccess = () => {
        const db = open.result;
        // If another tab upgrades the database, close ours so it can proceed.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error('Hacker is open in another tab with an older version. Close it and reload.'));
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

export function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return req(db.transaction(STORES.meta).objectStore(STORES.meta).get(key)) as Promise<T | undefined>;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORES.meta, 'readwrite');
  tx.objectStore(STORES.meta).put(value, key);
  await txDone(tx);
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORES.meta, 'readwrite');
  tx.objectStore(STORES.meta).delete(key);
  await txDone(tx);
}

/** True when an error means the browser's storage is full or blocked. */
export function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'UnknownError');
}
