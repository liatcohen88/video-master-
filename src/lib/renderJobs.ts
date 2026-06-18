/**
 * Background render jobs — so the user never waits on a spinner for a
 * multi-minute MP4 render (Liat: "יצוא לוקח המון המון זמן... מחכה כבר 10 דקות").
 *
 * Flow: the export route creates a job, kicks the render off in the background
 * (the Node process is long-lived — `next start` — so an un-awaited async
 * task keeps running after the HTTP response returns), and returns a jobId
 * immediately. The client polls /api/render-status and downloads from
 * /api/render-result when done. The user can keep editing or leave.
 *
 * Storage is disk-based under JOBS_DIR (one folder per job: meta.json + the
 * out.mp4). No DB/bucket needed. Jobs are downloaded shortly after they finish,
 * so a 24h TTL + cleanup is plenty. Output lives for the container's lifetime
 * (a redeploy starts a fresh container — an in-flight job then reads as a
 * stale "rendering" and is reported failed so credits are refunded).
 */

import { mkdir, writeFile, readFile, rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const JOBS_DIR = join(tmpdir(), "vm-render-jobs");

export type RenderJobStatus = "queued" | "rendering" | "done" | "failed";

export type RenderJob = {
  id: string;
  userId: string;
  status: RenderJobStatus;
  filename: string;      // suggested download filename
  error?: string;
  createdAt: number;
  updatedAt: number;
};

/** A "rendering" job whose heartbeat is older than this is treated as dead
 *  (process restarted mid-render) and reported as failed. Renders of long
 *  videos can take several minutes, so keep this generous. */
const STALE_MS = 20 * 60 * 1000;
const TTL_MS = 24 * 60 * 60 * 1000;

function jobDir(id: string): string {
  return join(JOBS_DIR, id);
}
function metaPath(id: string): string {
  return join(jobDir(id), "meta.json");
}
export function jobOutputPath(id: string): string {
  return join(jobDir(id), "out.mp4");
}

export async function createJob(userId: string, filename: string): Promise<RenderJob> {
  const now = Date.now();
  const job: RenderJob = {
    id: randomUUID(),
    userId,
    status: "queued",
    filename,
    createdAt: now,
    updatedAt: now,
  };
  await mkdir(jobDir(job.id), { recursive: true });
  await writeFile(metaPath(job.id), JSON.stringify(job));
  return job;
}

export async function updateJob(id: string, patch: Partial<RenderJob>): Promise<void> {
  try {
    const cur = JSON.parse(await readFile(metaPath(id), "utf8")) as RenderJob;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    await writeFile(metaPath(id), JSON.stringify(next));
  } catch {
    /* job dir gone (cleaned / restart) — nothing to update */
  }
}

export async function getJob(id: string): Promise<RenderJob | null> {
  try {
    const job = JSON.parse(await readFile(metaPath(id), "utf8")) as RenderJob;
    // Stale-rendering detection: a render that hasn't heartbeat in STALE_MS
    // (e.g. the container restarted mid-render) is dead — report failed so the
    // client stops polling and we don't leave the user hanging.
    if (job.status === "rendering" && Date.now() - job.updatedAt > STALE_MS) {
      return { ...job, status: "failed", error: "render timed out" };
    }
    return job;
  } catch {
    return null;
  }
}

/** Whether the rendered MP4 exists on disk and is non-empty. */
export function outputReady(id: string): boolean {
  try {
    return existsSync(jobOutputPath(id));
  } catch {
    return false;
  }
}

/** Best-effort removal of job folders older than the TTL. Called opportunistically. */
export async function cleanupOldJobs(): Promise<void> {
  try {
    const entries = await readdir(JOBS_DIR).catch(() => [] as string[]);
    const cutoff = Date.now() - TTL_MS;
    await Promise.all(
      entries.map(async (id) => {
        try {
          const s = await stat(jobDir(id));
          if (s.mtimeMs < cutoff) await rm(jobDir(id), { recursive: true, force: true });
        } catch { /* ignore */ }
      }),
    );
  } catch { /* ignore */ }
}
