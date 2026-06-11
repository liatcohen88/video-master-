"use client";

/**
 * IndexedDB-backed persistence for the editor.
 *
 * Stores things that don't fit in localStorage:
 *   - The uploaded video File (binary blob, up to ~GB)
 *   - The transcription result, keyed by file content hash so the
 *     same video doesn't get re-transcribed (saves minutes + cost)
 *   - Project snapshots (manual + 5-min auto), keeping the 10 latest
 *
 * Why IndexedDB and not localStorage:
 *   - localStorage: ~5MB cap, strings only, blocks the main thread
 *   - IndexedDB:    multi-GB cap, blobs supported, async
 *
 * All operations are best-effort: if IDB is unavailable (private mode,
 * Safari quirks) the calls resolve with null/undefined rather than throw.
 */

import type { Subtitle, SubtitleStyle, SubtitleSettings, VideoEffects, EditMode, ExportFormat } from "./types";

const DB_NAME    = "vm_editor";
const DB_VERSION = 1;

const STORE_VIDEO         = "current_video";    // single record under key "current"
const STORE_TRANSCRIPTION = "transcriptions";   // keyed by file hash
const STORE_SNAPSHOTS     = "snapshots";        // keyed by auto-increment id

export type ProjectSnapshot = {
  id?: number;
  at: number;           // unix ms — caller must supply (workflow-safe), or Date.now() at call site
  label: string;        // "אוטומטי" | "ידני" | user-supplied
  videoHash: string;    // links to the transcription cache + identifies which video
  payload: {
    mode: EditMode;
    exportFormat: ExportFormat;
    settings: SubtitleSettings;
    templateId: string;
    style: SubtitleStyle;
    subtitles: Subtitle[];
    effects: VideoEffects;
    whisperModel: string;
  };
};

export type StoredVideo = {
  blob: Blob;
  name: string;
  type: string;
  size: number;
  hash: string;
  storedAt: number;
};

/* ──────────────────────────── DB plumbing ──────────────────────────── */

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VIDEO))
        db.createObjectStore(STORE_VIDEO);
      if (!db.objectStoreNames.contains(STORE_TRANSCRIPTION))
        db.createObjectStore(STORE_TRANSCRIPTION); // keyed manually by hash
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS))
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(null);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDB().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const r = fn(s);
      r.onsuccess = () => resolve(r.result as T);
      r.onerror   = () => resolve(null);
    });
  });
}

/* ──────────────────────────── Hashing ──────────────────────────── */

/**
 * Cheap, deterministic file fingerprint: SHA-256 of the first 1MB + size + name.
 * Full-file hash on a 500MB video would freeze the UI; the prefix is enough
 * to detect "same file uploaded again" with effectively zero collision risk.
 */
export async function hashVideoFile(file: File): Promise<string> {
  const prefixSize = Math.min(file.size, 1024 * 1024);
  const head = await file.slice(0, prefixSize).arrayBuffer();
  const buf  = await crypto.subtle.digest("SHA-256", head);
  const hex  = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 16)}_${file.size}_${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
}

/* ──────────────────────────── Video blob ──────────────────────────── */

export async function saveCurrentVideo(file: File, hash: string): Promise<void> {
  const record: StoredVideo = {
    blob: file,
    name: file.name,
    type: file.type,
    size: file.size,
    hash,
    storedAt: Date.now(),
  };
  await tx(STORE_VIDEO, "readwrite", (s) => s.put(record, "current"));
}

export async function loadCurrentVideo(): Promise<StoredVideo | null> {
  return (await tx<StoredVideo>(STORE_VIDEO, "readonly", (s) => s.get("current"))) ?? null;
}

export async function clearCurrentVideo(): Promise<void> {
  await tx(STORE_VIDEO, "readwrite", (s) => s.delete("current"));
}

/** Convert a stored blob back to a File so it can flow through the upload pipeline unchanged. */
export function storedToFile(v: StoredVideo): File {
  return new File([v.blob], v.name, { type: v.type || "video/mp4" });
}

/* ──────────────────────────── Transcription cache ──────────────────────────── */

export async function saveTranscription(hash: string, subtitles: Subtitle[]): Promise<void> {
  await tx(STORE_TRANSCRIPTION, "readwrite", (s) => s.put({ subtitles, at: Date.now() }, hash));
}

export async function loadTranscription(hash: string): Promise<Subtitle[] | null> {
  const rec = await tx<{ subtitles: Subtitle[]; at: number }>(STORE_TRANSCRIPTION, "readonly", (s) => s.get(hash));
  return rec?.subtitles ?? null;
}

/* ──────────────────────────── Snapshots ──────────────────────────── */

const MAX_SNAPSHOTS = 10;

export async function saveSnapshot(snap: Omit<ProjectSnapshot, "id">): Promise<void> {
  await tx(STORE_SNAPSHOTS, "readwrite", (s) => s.add(snap));
  // Trim to MAX_SNAPSHOTS keeping the newest.
  const all = await listSnapshots();
  if (all.length > MAX_SNAPSHOTS) {
    const drop = all.slice(MAX_SNAPSHOTS);
    await Promise.all(drop.map((d) => deleteSnapshot(d.id!)));
  }
}

export async function listSnapshots(): Promise<ProjectSnapshot[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    const t = db.transaction(STORE_SNAPSHOTS, "readonly");
    const s = t.objectStore(STORE_SNAPSHOTS);
    const r = s.getAll();
    r.onsuccess = () => {
      const arr = (r.result as ProjectSnapshot[]) ?? [];
      arr.sort((a, b) => b.at - a.at);
      resolve(arr);
    };
    r.onerror = () => resolve([]);
  });
}

export async function deleteSnapshot(id: number): Promise<void> {
  await tx(STORE_SNAPSHOTS, "readwrite", (s) => s.delete(id));
}

export async function clearAllSnapshots(): Promise<void> {
  await tx(STORE_SNAPSHOTS, "readwrite", (s) => s.clear());
}

/** Nuke everything — used by "start fresh" / logout. */
export async function wipeAllProjectStorage(): Promise<void> {
  await Promise.all([
    clearCurrentVideo(),
    clearAllSnapshots(),
    tx(STORE_TRANSCRIPTION, "readwrite", (s) => s.clear()),
  ]);
}

/** Clear ONLY the transcription cache — keeps the saved video + snapshots.
 *  Use when Liat wants to re-run AI transcription on the same video (e.g.
 *  she upgraded the model, or wants to test the latest fixes). */
export async function clearAllTranscriptions(): Promise<void> {
  await tx(STORE_TRANSCRIPTION, "readwrite", (s) => s.clear());
}

/** Clear the transcription for ONE specific video hash. Lets the next
 *  upload of that file run a fresh transcription pass. */
export async function clearTranscriptionForHash(hash: string): Promise<void> {
  await tx(STORE_TRANSCRIPTION, "readwrite", (s) => s.delete(hash));
}
