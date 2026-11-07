// Golfer profiles. Several golfers can share one browser; each profile's swings live in its own database.
// There are no passwords: profiles keep golfers' data apart, not private from others using the same browser.

import type { Handedness } from './ballResult';
import {
  LEGACY_DB_NAME, deleteDatabase, getMeta, openDatabase, req, txDone, useDatabase, type Migration,
} from './db';

export interface Profile {
  id: string;
  name: string;
  handedness: Handedness;
  /** The profile's own database. */
  dbName: string;
  /** Folder inside "Hacker Data" for this profile's videos. Set once, so renaming the profile does not break it. */
  folderName: string;
  createdAt: number;
}

const REGISTRY_DB = 'hacker-profiles';
const CURRENT_KEY = 'currentProfileId';

const REGISTRY_MIGRATIONS: Migration[] = [
  (db) => {
    db.createObjectStore('profiles', { keyPath: 'id' });
    db.createObjectStore('meta');
  },
];

let registry: Promise<IDBDatabase> | null = null;
function openRegistry(): Promise<IDBDatabase> {
  if (!registry) {
    registry = openDatabase(REGISTRY_DB, REGISTRY_MIGRATIONS);
    registry.catch(() => (registry = null));
  }
  return registry;
}

let active: Profile | null = null;

/** Makes a folder name that is safe on Mac and Windows, such as "Tim (3f2a)". */
export function folderNameFor(name: string, id: string): string {
  const clean = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[. ]+$/, '').trim().slice(0, 40) || 'Golfer';
  return `${clean} (${id.slice(0, 4)})`;
}

export async function listProfiles(): Promise<Profile[]> {
  const db = await openRegistry();
  const all = (await req(db.transaction('profiles').objectStore('profiles').getAll())) as Profile[];
  return all.sort((a, b) => a.name.localeCompare(b.name) || a.createdAt - b.createdAt);
}

export function activeProfile(): Profile | null {
  return active;
}

async function putProfile(p: Profile): Promise<void> {
  const db = await openRegistry();
  const tx = db.transaction('profiles', 'readwrite');
  tx.objectStore('profiles').put(p);
  await txDone(tx);
}

async function setCurrentId(id: string | null): Promise<void> {
  const db = await openRegistry();
  const tx = db.transaction('meta', 'readwrite');
  if (id) tx.objectStore('meta').put(id, CURRENT_KEY);
  else tx.objectStore('meta').delete(CURRENT_KEY);
  await txDone(tx);
}

async function activate(p: Profile | null): Promise<void> {
  active = p;
  await useDatabase(p?.dbName ?? null);
  await setCurrentId(p?.id ?? null);
}

/** Before profiles existed, one golfer's data lived in the "hacker" database. Turn it into a profile. */
async function adoptLegacy(): Promise<Profile | null> {
  const names = (await indexedDB.databases?.()) ?? [];
  if (!names.some((d) => d.name === LEGACY_DB_NAME)) return null;
  await useDatabase(LEGACY_DB_NAME);
  const old = await getMeta<{ name: string; handedness: Handedness }>('profile').catch(() => undefined);
  await useDatabase(null);
  if (!old?.name) return null;
  const id = crypto.randomUUID();
  const p: Profile = {
    id, name: old.name, handedness: old.handedness, dbName: LEGACY_DB_NAME,
    folderName: folderNameFor(old.name, id), createdAt: Date.now(),
  };
  await putProfile(p);
  return p;
}

/** Call once at startup. Opens the profile used last time, if any. */
export async function initProfiles(): Promise<Profile | null> {
  let profiles = await listProfiles();
  if (profiles.length === 0) {
    const adopted = await adoptLegacy();
    if (adopted) {
      await activate(adopted);
      return adopted;
    }
  }
  const db = await openRegistry();
  const currentId = (await req(db.transaction('meta').objectStore('meta').get(CURRENT_KEY))) as string | undefined;
  profiles = await listProfiles();
  const current = profiles.find((p) => p.id === currentId) ?? (profiles.length === 1 ? profiles[0] : null);
  await activate(current);
  return current;
}

export async function createProfile(input: { name: string; handedness: Handedness }): Promise<Profile> {
  const id = crypto.randomUUID();
  const p: Profile = {
    id, name: input.name, handedness: input.handedness, dbName: `hacker-golfer-${id}`,
    folderName: folderNameFor(input.name, id), createdAt: Date.now(),
  };
  await putProfile(p);
  await activate(p);
  return p;
}

export async function switchProfile(id: string): Promise<Profile> {
  const p = (await listProfiles()).find((x) => x.id === id);
  if (!p) throw new Error('That profile no longer exists.');
  await activate(p);
  return p;
}

/** Changes the name or hand of the active profile. */
export async function updateActiveProfile(change: { name: string; handedness: Handedness }): Promise<Profile> {
  if (!active) throw new Error('No golfer profile is selected.');
  const p = { ...active, ...change };
  await putProfile(p);
  active = p;
  return p;
}

/** Deletes the active profile and all its swings. The screen must confirm first. */
export async function deleteActiveProfile(): Promise<void> {
  if (!active) return;
  const p = active;
  await activate(null);
  await deleteDatabase(p.dbName);
  const db = await openRegistry();
  const tx = db.transaction('profiles', 'readwrite');
  tx.objectStore('profiles').delete(p.id);
  await txDone(tx);
}
