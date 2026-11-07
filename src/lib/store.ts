// Swing operations on top of the database: saving, the rolling rule, label changes, model swing, deleting.
// Video files in the video folder follow the swing records.

import { STORES, getMeta, openDb, req, setMeta, txDone } from './db';
import { planInsert } from './rolling';
import { type Rating, type SwingTypeId, SWING_TYPES } from './swingTypes';
import type { BallResult } from './ballResult';
import {
  DEFAULT_SETTINGS,
  type Settings,
  type Swing,
  type UploadCounter,
  type UploadLogEntry,
  UPLOADED_RESULTS,
} from './types';
import * as folder from './videoFolder';
import { activeProfile, updateActiveProfile, type Profile } from './profiles';

export const UNLOCK_UPLOADS = 5;

// ---------- profile and settings ----------

export const getProfile = async (): Promise<Profile | undefined> => activeProfile() ?? undefined;
export const setProfile = (p: Pick<Profile, 'name' | 'handedness'>) => updateActiveProfile(p);

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await getMeta<Partial<Settings>>('settings')) ?? {}) };
}
export const setSettings = (s: Settings) => setMeta('settings', s);

// ---------- reading ----------

export async function allSwings(): Promise<Swing[]> {
  const db = await openDb();
  return req(db.transaction(STORES.swings).objectStore(STORES.swings).getAll()) as Promise<Swing[]>;
}

export async function getSwing(id: string): Promise<Swing | undefined> {
  const db = await openDb();
  return req(db.transaction(STORES.swings).objectStore(STORES.swings).get(id)) as Promise<Swing | undefined>;
}

export async function uploadCounts(): Promise<Record<SwingTypeId, number>> {
  const db = await openDb();
  const rows = (await req(
    db.transaction(STORES.uploadCounters).objectStore(STORES.uploadCounters).getAll(),
  )) as UploadCounter[];
  const out = Object.fromEntries(SWING_TYPES.map((t) => [t.id, 0])) as Record<SwingTypeId, number>;
  for (const r of rows) out[r.swingType] = r.count;
  return out;
}

export async function uploadLog(): Promise<UploadLogEntry[]> {
  const db = await openDb();
  const rows = (await req(db.transaction(STORES.uploadLog).objectStore(STORES.uploadLog).getAll())) as UploadLogEntry[];
  return rows.reverse();
}

/** True if a file with this name, size, and date was uploaded before. */
export async function wasUploaded(dupKey: string): Promise<boolean> {
  const db = await openDb();
  const rows = (await req(
    db.transaction(STORES.uploadLog).objectStore(STORES.uploadLog).index('dupKey').getAll(dupKey),
  )) as UploadLogEntry[];
  return rows.some((r) => UPLOADED_RESULTS.includes(r.result));
}

export async function addLog(entry: Omit<UploadLogEntry, 'id'>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORES.uploadLog, 'readwrite');
  tx.objectStore(STORES.uploadLog).add(entry);
  await txDone(tx);
}

// ---------- saving ----------

export interface AddResult {
  swing: Swing;
  /** False when the swing was older than five stored swings and was dropped at once. */
  kept: boolean;
  evicted: Swing[];
}

type LogFields = Pick<UploadLogEntry, 'fileName' | 'fileSize' | 'fileLastModified' | 'dupKey'>;

/** Saves a new swing, applies the rolling rule, counts the upload, and logs it, all in one step. */
export async function addSwing(swing: Swing, log: LogFields): Promise<AddResult> {
  const db = await openDb();
  const tx = db.transaction(
    [STORES.swings, STORES.uploadCounters, STORES.uploadLog, STORES.jointData, STORES.metrics, STORES.frameSheets],
    'readwrite',
  );
  const done = txDone(tx);
  const swings = tx.objectStore(STORES.swings);
  const existing = (await req(swings.index('set').getAll([swing.swingType, swing.rating]))) as Swing[];
  const plan = planInsert(existing, { ...swing, isModel: false });
  if (plan.incomingKept) swings.put({ ...swing, isModel: false });
  for (const old of plan.evict) if (old.id !== swing.id) deleteSwingRecords(tx, old.id);

  const counters = tx.objectStore(STORES.uploadCounters);
  const c = ((await req(counters.get(swing.swingType))) as UploadCounter | undefined) ?? {
    swingType: swing.swingType,
    count: 0,
  };
  counters.put({ ...c, count: c.count + 1 });

  tx.objectStore(STORES.uploadLog).add({
    ...log,
    time: Date.now(),
    result: plan.incomingKept ? 'saved' : 'saved-dropped',
    message: plan.incomingKept ? '' : 'Older than the five swings already stored for this swing type and rating.',
    swingId: swing.id,
  } satisfies Omit<UploadLogEntry, 'id'>);
  await done;

  const evicted = plan.evict.filter((s) => s.id !== swing.id);
  await removeVideos(evicted);
  return { swing, kept: plan.incomingKept, evicted };
}

/** Records the kept video's file name on a swing. */
export async function setVideoFileName(id: string, name: string | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORES.swings, 'readwrite');
  const store = tx.objectStore(STORES.swings);
  const s = (await req(store.get(id))) as Swing | undefined;
  if (s) store.put({ ...s, videoFileName: name });
  await txDone(tx);
}

/** Copies the video for a newly saved swing into the video folder if the settings say to. */
export async function keepVideo(swing: Swing, file: File): Promise<folder.WriteResult | null> {
  const settings = await getSettings();
  if (settings.keepVideo === 'model-only' && !swing.isModel) return null;
  const name = folder.videoFileNameFor(swing.id, file.name);
  const result = await folder.writeFile(name, file);
  if (result.ok) await setVideoFileName(swing.id, name);
  return result;
}

// ---------- changing labels ----------

export interface LabelChange {
  swingType: SwingTypeId;
  rating: Rating;
  note: string;
  ballResult: BallResult | null;
}

export interface LabelPlan {
  movesSet: boolean;
  /** Other swings the rolling rule would delete in the new set. */
  evicted: Swing[];
  /** True when the moved swing itself is older than five stored swings and would be deleted. */
  selfDropped: boolean;
  /** True when this swing is the model and stops being one. */
  losesModel: boolean;
}

async function planChange(swing: Swing, change: LabelChange): Promise<{ plan: LabelPlan; updated: Swing }> {
  const movesSet = swing.swingType !== change.swingType || swing.rating !== change.rating;
  const losesModel = swing.isModel && (change.rating !== 5 || change.swingType !== swing.swingType);
  const updated: Swing = { ...swing, ...change, isModel: swing.isModel && !losesModel };
  if (!movesSet) return { plan: { movesSet, evicted: [], selfDropped: false, losesModel }, updated };
  const db = await openDb();
  const existing = (await req(
    db.transaction(STORES.swings).objectStore(STORES.swings).index('set').getAll([change.swingType, change.rating]),
  )) as Swing[];
  const p = planInsert(existing, updated);
  return { plan: { movesSet, evicted: p.evict.filter((s) => s.id !== swing.id), selfDropped: !p.incomingKept, losesModel }, updated };
}

/** What a label change would do, so the screen can ask before anything is deleted. */
export async function previewLabelChange(id: string, change: LabelChange): Promise<LabelPlan> {
  const swing = await getSwing(id);
  if (!swing) throw new Error('Swing not found');
  return (await planChange(swing, change)).plan;
}

export async function applyLabelChange(id: string, change: LabelChange): Promise<LabelPlan> {
  const swing = await getSwing(id);
  if (!swing) throw new Error('Swing not found');
  const { plan, updated } = await planChange(swing, change);
  const db = await openDb();
  const tx = db.transaction([STORES.swings, STORES.jointData, STORES.metrics, STORES.frameSheets], 'readwrite');
  const done = txDone(tx);
  if (plan.selfDropped) deleteSwingRecords(tx, id);
  else tx.objectStore(STORES.swings).put(updated);
  for (const s of plan.evicted) deleteSwingRecords(tx, s.id);
  await done;
  await removeVideos(plan.selfDropped ? [swing, ...plan.evicted] : plan.evicted);
  if (plan.losesModel && !plan.selfDropped) await dropVideoIfModelOnly(updated);
  return plan;
}

// ---------- model swing ----------

/** Makes a 5-rated swing the model for its swing type. Returns the previous model, if any. */
export async function setModel(id: string): Promise<Swing | null> {
  const db = await openDb();
  const tx = db.transaction(STORES.swings, 'readwrite');
  const done = txDone(tx);
  const store = tx.objectStore(STORES.swings);
  const swing = (await req(store.get(id))) as Swing | undefined;
  if (!swing) throw new Error('Swing not found');
  if (swing.rating !== 5) throw new Error('Only a 5-rated swing can be the model swing.');
  const sameType = (await req(store.index('swingType').getAll(swing.swingType))) as Swing[];
  let previous: Swing | null = null;
  for (const s of sameType) {
    if (s.isModel && s.id !== id) {
      previous = { ...s, isModel: false };
      store.put(previous);
    }
  }
  store.put({ ...swing, isModel: true });
  await done;
  if (previous) await dropVideoIfModelOnly(previous);
  return previous;
}

export async function clearModel(id: string): Promise<void> {
  const swing = await getSwing(id);
  if (!swing?.isModel) return;
  const updated = { ...swing, isModel: false };
  const db = await openDb();
  const tx = db.transaction(STORES.swings, 'readwrite');
  tx.objectStore(STORES.swings).put(updated);
  await txDone(tx);
  await dropVideoIfModelOnly(updated);
}

// ---------- deleting ----------

/** Deletes a swing, its data, and its kept video. The screen must confirm first. */
export async function deleteSwing(id: string): Promise<void> {
  const swing = await getSwing(id);
  if (!swing) return;
  const db = await openDb();
  const tx = db.transaction([STORES.swings, STORES.jointData, STORES.metrics, STORES.frameSheets], 'readwrite');
  const done = txDone(tx);
  deleteSwingRecords(tx, id);
  await done;
  await removeVideos([swing]);
}

function deleteSwingRecords(tx: IDBTransaction, id: string): void {
  tx.objectStore(STORES.swings).delete(id);
  tx.objectStore(STORES.jointData).delete(id);
  tx.objectStore(STORES.frameSheets).delete(id);
  const metrics = tx.objectStore(STORES.metrics);
  metrics.index('swingId').getAllKeys(id).onsuccess = (e) => {
    for (const key of (e.target as IDBRequest<IDBValidKey[]>).result) metrics.delete(key);
  };
}

// ---------- video files ----------

const PENDING_KEY = 'pendingVideoDeletes';

/** Deletes kept videos. If the folder is not connected, remembers them and deletes them later. */
async function removeVideos(swings: Swing[]): Promise<void> {
  const names = swings.map((s) => s.videoFileName).filter((n): n is string => !!n);
  if (names.length === 0) return;
  const pending = new Set((await getMeta<string[]>(PENDING_KEY)) ?? []);
  for (const n of names) pending.add(n);
  await setMeta(PENDING_KEY, [...pending]);
  await flushVideoDeletes();
}

/** Deletes videos that were left behind while the folder was not connected. Call when the folder becomes ready. */
export async function flushVideoDeletes(): Promise<void> {
  const pending = (await getMeta<string[]>(PENDING_KEY)) ?? [];
  if (pending.length === 0) return;
  const left: string[] = [];
  for (const name of pending) {
    try {
      if (!(await folder.deleteFile(name))) left.push(name);
    } catch {
      left.push(name);
    }
  }
  await setMeta(PENDING_KEY, left);
}

async function dropVideoIfModelOnly(swing: Swing): Promise<void> {
  if (swing.isModel || !swing.videoFileName) return;
  if ((await getSettings()).keepVideo !== 'model-only') return;
  await removeVideos([swing]);
  await setVideoFileName(swing.id, null);
}

/** Swings whose videos would be deleted by switching to model-only. */
export async function videosOutsideModels(): Promise<Swing[]> {
  return (await allSwings()).filter((s) => s.videoFileName && !s.isModel);
}

/** Switches the keep-video setting. Switching to model-only deletes the other kept videos; confirm first. */
export async function setKeepVideo(mode: Settings['keepVideo']): Promise<void> {
  await setSettings({ ...(await getSettings()), keepVideo: mode });
  if (mode === 'model-only') {
    for (const s of await videosOutsideModels()) await dropVideoIfModelOnly(s);
  }
}
