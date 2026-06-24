/**
 * Screen Wake Lock — keep the phone/desktop screen ON during long operations
 * (transcription, export). Without this, a mobile screen dims and locks after
 * ~30s; the browser then throttles or suspends the tab, which can KILL an
 * in-flight upload/transcription mid-request (Liat: "שגיאה בתמלול... אולי בגלל
 * שהמסך בטלפון נכבה?"). The user shouldn't have to stare at the screen to keep
 * the job alive.
 *
 * Usage (paired, always release in a finally):
 *   const lock = await acquireWakeLock();
 *   try { ...long work... } finally { await releaseWakeLock(lock); }
 *
 * Notes:
 *  - Wake Lock is auto-released by the browser when the tab becomes hidden
 *    (user switches apps). We re-acquire on visibilitychange so coming back to
 *    the tab restores the lock for the rest of the job.
 *  - Unsupported browsers (older iOS Safari < 16.4) just resolve to null — the
 *    caller's try/finally still works, it's simply a no-op there.
 */

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (t: string, cb: () => void) => void;
};

export type WakeLockHandle = {
  sentinel: WakeLockSentinel | null;
  /** visibilitychange handler we registered, so we can remove it on release. */
  onVisible: (() => void) | null;
};

async function request(): Promise<WakeLockSentinel | null> {
  try {
    const nav = navigator as unknown as {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (!nav.wakeLock?.request) return null;
    return await nav.wakeLock.request("screen");
  } catch {
    // Throws if the document isn't visible/active or the user-agent blocks it.
    return null;
  }
}

export async function acquireWakeLock(): Promise<WakeLockHandle> {
  if (typeof navigator === "undefined" || typeof document === "undefined") {
    return { sentinel: null, onVisible: null };
  }
  const handle: WakeLockHandle = { sentinel: await request(), onVisible: null };

  // Re-acquire when the tab becomes visible again (the OS released our lock
  // while it was backgrounded). Only matters while the job is still running —
  // releaseWakeLock() removes this listener.
  const onVisible = async () => {
    if (document.visibilityState === "visible" && (!handle.sentinel || handle.sentinel.released)) {
      handle.sentinel = await request();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  handle.onVisible = onVisible;
  return handle;
}

export async function releaseWakeLock(handle: WakeLockHandle | null): Promise<void> {
  if (!handle) return;
  if (handle.onVisible && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handle.onVisible);
  }
  try {
    if (handle.sentinel && !handle.sentinel.released) await handle.sentinel.release();
  } catch {
    // Already released — ignore.
  }
}
