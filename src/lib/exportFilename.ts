/**
 * Suggested download name for an exported MP4.
 *
 * Liat: the file should be named in Hebrew — "מאסטר וידאו" — with the date AND
 * time (was the English "video-master-26-6-2026"). The app is Hebrew/Israel-only,
 * so the timestamp is formatted in Asia/Jerusalem (the render runs server-side
 * where the clock is UTC — without this the time would be off by 2-3h).
 *
 * Characters are filename-safe: no ":" (invalid on Windows) — time uses "-".
 * Result: "מאסטר וידאו 26-06-2026 14-30.mp4".
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
  return `מאסטר וידאו ${get("day")}-${get("month")}-${get("year")} ${get("hour")}-${get("minute")}.mp4`;
}
