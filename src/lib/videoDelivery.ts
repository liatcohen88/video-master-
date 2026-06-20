/**
 * Shared video-delivery helpers — hand an MP4 to the OS the same way the
 * export badge does: gallery share-sheet on a real mobile device, plain
 * download on desktop. Used by the dashboard "my videos" re-download button.
 */

function canShareVideoFiles(): boolean {
  try {
    const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof n.share !== "function" || typeof n.canShare !== "function") return false;
    return n.canShare({ files: [new File([new Uint8Array([0])], "p.mp4", { type: "video/mp4" })] });
  } catch { return false; }
}

// Real mobile device — NOT just "browser can share files" (desktop Chrome/Edge
// on Windows can too). Keep in sync with ExportJobBadge.isMobileDevice().
export function isMobileDevice(): boolean {
  try {
    const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
    if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPod/i.test(ua)) return true;
    if (/iPad/i.test(ua)) return true;
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
    return false;
  } catch { return false; }
}

/** Returns true if handed to the mobile share-sheet, false if downloaded. */
export async function deliverVideoFile(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "video/mp4" });
  const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (isMobileDevice() && typeof n.share === "function" && typeof n.canShare === "function" && n.canShare({ files: [file] })) {
    try { await n.share({ files: [file], title: filename }); return true; }
    catch (e) { if (!(e instanceof Error) || e.name !== "AbortError") console.warn("[video] share failed", e); }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  return false;
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { browserClient } = await import("@/lib/supabase");
    const token = (await browserClient()?.auth.getSession())?.data.session?.access_token;
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type DeliverResult = "shared" | "downloaded" | "gone" | "error";

/**
 * Re-download a previously exported video by its render jobId. The rendered
 * MP4 lives on the server for ~24h (and is lost on redeploy), so a 404/410
 * means it's no longer available → "gone" (caller shows a gentle message).
 */
export async function downloadExportedVideo(jobId: string, filename: string): Promise<DeliverResult> {
  try {
    const res = await fetch(`/api/render-result/${jobId}`, { headers: await authHeader() });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) return "error";
    const blob = await res.blob();
    const shared = await deliverVideoFile(blob, filename);
    return shared ? "shared" : "downloaded";
  } catch { return "error"; }
}
