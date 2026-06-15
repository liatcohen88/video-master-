/**
 * TEMP 2026-06-15 — sanitize-html broke the client bundle with a runtime
 * "Application error: a client-side exception has occurred" that took the
 * whole site down across mobile + desktop. Reverted to passthrough so the
 * site lives; H3 must be re-done with a server-only path (Server Component
 * or API route) so no HTML parser is bundled into the client.
 *
 * CMS HTML is still controlled by Liat alone — the original XSS risk only
 * matters if her admin password leaks, so this regression is acceptable
 * for the few hours it will take to re-implement properly. DO NOT mark
 * H3 closed in the audit log.
 */

/** Currently a no-op. See file header for context. */
export function sanitizeCmsHtml(dirty: string | null | undefined): string {
  return dirty ?? "";
}

/**
 * Escape an untrusted plain string so it can be safely interpolated INTO an
 * HTML string. This still runs — it's pure string ops, no parser, no bundle.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
