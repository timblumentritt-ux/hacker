// IndexedDB data layer with versioned schemas.
// Each golfer profile has its own database (see profiles.ts); all of them share the layout below.
// Every change to the stored layout is a new entry in MIGRATIONS. Never edit an old entry.

/** Name of the database used before profiles existed. It is adopted as the first profile's database. */
export const LEGACY_DB_NAME = 'hacker';

export const STORES = {
  meta: 'meta', // key-value: settings, video folder handle
  swings: 'swings',
  jointData: 'jointData', // milestone 2
  metrics: 'metrics', // milestone 3
  frameSheets: 'frameSheets', // milestone 3
  uploadCounters: 'uploadCounters',
  uploadLog: 'uploadLog',
} as const;

export type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

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

/** Opens a database and runs any migrations it has not had yet. */
export function openDatabase(name: string, migrations: Migration[]): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, migrations.length);
    open.onupgradeneeded = (e) => {
      const db = open.result;
      const tx = open.transaction!;
      // A backup before migrating arrives with backup support in milestone 5.
      for (let v = e.oldVersion; v < migrations.length; v++) migrations[v](db, tx);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('Hacker is open in another tab with an older version. Close it and reload.'));
  });
}

let activeName: string | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/** Points the data layer at a profile's database. Closes the previous one. */
export async function useDatabase(name: string | null): Promise<void> {
  if (name === activeName) return;
  const old = dbPromise;
  activeName = name;
  dbPromise = null;
  if (old) (await old.catch(() => null))?.close();
}

export function activeDatabaseName(): string | null {
  return activeName;
}

/** The active profile's database. */
export function openDb(): Promise<IDBDatabase> {
  if (!activeName) return Promise.reject(new Error('No golfer profile is selected.'));
  if (!dbPromise) {
    const name = activeName;
    const p = openDatabase(name, MIGRATIONS).then((db) => {
      const forget = () => {
        if (dbPromise === p) dbPromise = null;
      };
      // If another tab upgrades or deletes this database, close ours so it can proceed.
      db.onversionchange = () => {
        db.close();
        forget();
      };
      db.onclose = forget;
      return db;
    });
    p.catch(() => {
      if (dbPromise === p) dbPromise = null;
    });
    dbPromise = p;
  }
  return dbPromise;
}

/** Deletes a whole database. */
export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('This profile is open in another tab. Close the other Hacker tabs and try again.'));
  });
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
