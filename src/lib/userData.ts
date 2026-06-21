"use client";

/**
 * Per-account persistence (Supabase) for the dashboard's videos + notifications,
 * so they follow the USER across devices instead of living in one browser's
 * localStorage. Every call is BEST-EFFORT: if the tables don't exist yet (the
 * 20260621_user_data.sql migration hasn't been applied) or the user is a guest,
 * reads return null and writes no-op — callers fall back to localStorage, so
 * nothing breaks before/without the migration.
 */

import { browserClient } from "./supabase";
import type { UserVideo, UserNotification } from "./userStore";

async function currentUserId(): Promise<string | null> {
  const sb = browserClient();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

export async function pushVideoRow(v: UserVideo): Promise<void> {
  try {
    const sb = browserClient(); if (!sb) return;
    const uid = await currentUserId(); if (!uid) return;
    await sb.from("user_videos").upsert({
      id: v.id, user_id: uid, title: v.title, thumbnail_emoji: v.thumbnailEmoji,
      duration_sec: v.durationSec, mode: v.mode, credits_used: v.creditsUsed,
      status: v.status, created_at: v.createdAt,
    });
  } catch { /* table missing / offline — localStorage copy is the fallback */ }
}

export async function setVideoRowStatus(id: string, status: UserVideo["status"]): Promise<void> {
  try {
    const sb = browserClient(); if (!sb) return;
    await sb.from("user_videos").update({ status }).eq("id", id);
  } catch { /* noop */ }
}

/** Returns null if unavailable (guest / no table / error) → caller uses local. */
export async function fetchVideoRows(): Promise<UserVideo[] | null> {
  try {
    const sb = browserClient(); if (!sb) return null;
    const uid = await currentUserId(); if (!uid) return null;
    const { data, error } = await sb.from("user_videos")
      .select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (error || !data) return null;
    return data.map((r) => ({
      id: r.id, title: r.title, thumbnailEmoji: r.thumbnail_emoji,
      durationSec: r.duration_sec, mode: r.mode, creditsUsed: r.credits_used,
      status: r.status, createdAt: r.created_at,
    })) as UserVideo[];
  } catch { return null; }
}

export async function pushNotifRow(n: { id: string; kind?: string; title: string; body?: string }): Promise<void> {
  try {
    const sb = browserClient(); if (!sb) return;
    const uid = await currentUserId(); if (!uid) return;
    await sb.from("user_notifications").upsert(
      { user_id: uid, id: n.id, kind: n.kind ?? "feature", title: n.title, body: n.body ?? "" },
      { onConflict: "user_id,id", ignoreDuplicates: true },
    );
  } catch { /* noop */ }
}

export async function fetchNotifRows(): Promise<UserNotification[] | null> {
  try {
    const sb = browserClient(); if (!sb) return null;
    const uid = await currentUserId(); if (!uid) return null;
    const { data, error } = await sb.from("user_notifications")
      .select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (error || !data) return null;
    return data.map((r) => ({
      id: r.id, kind: r.kind, title: r.title, body: r.body,
      read: r.read, createdAt: r.created_at,
    })) as UserNotification[];
  } catch { return null; }
}

export async function markNotifRowRead(id: string): Promise<void> {
  try {
    const sb = browserClient(); if (!sb) return;
    const uid = await currentUserId(); if (!uid) return;
    await sb.from("user_notifications").update({ read: true }).eq("user_id", uid).eq("id", id);
  } catch { /* noop */ }
}
