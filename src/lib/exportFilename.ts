/**
 * Suggested download name for an exported MP4.
 *
 * ASCII-only ("Master Video") — a Hebrew filename ("מאסטר וידאו") crashed the
 * download: HTTP Content-Disposition values are Latin-1 only, so Hebrew bytes
 * threw "Cannot convert argument to a ByteString" and every export failed at
 * delivery (Liat: "אם יש קריסה בגלל השם העברי תעשה לאנגלית"). Date AND time,
 * formatted in Asia/Jerusalem (render runs server-side on a UTC clock).
 *
 * Characters are filename-safe: no ":" (invalid on Windows) — time uses "-".
 * Result: "Master Video 26-06-2026 14-30.mp4".
 */
export function exportFileName(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `Master Video ${get("day")}-${get("month")}-${get("year")} ${get("hour")}-${get("minute")}.mp4`;
}
