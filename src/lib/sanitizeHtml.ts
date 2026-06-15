/**
 * HTML sanitizer for CMS-sourced strings rendered via dangerouslySetInnerHTML.
 *
 * Audit finding H3: Liat's admin can paste arbitrary HTML into CMS overrides
 * (so she can bold a word or insert markup). That HTML is rendered raw on
 * the public site. If her admin password ever leaks — or a future team
 * member is added — they could inject <script> or `onerror` payloads that
 * would run for every visitor. Sanitize at the render boundary.
 *
 * Why sanitize-html (not isomorphic-dompurify): the latter pulls in jsdom
 * which trips Next.js prerender on its ESM/CJS interop (encoding-lite.js).
 * sanitize-html is plain CommonJS and works in both Node SSR and the
 * browser — no special bundling needed.
 *
 * Allow-list: common inline formatting + links. Forbids: scripts, iframes,
 * forms, embeds, every on* event handler, and javascript:/data: URIs.
 */

import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a", "b", "br", "em", "i", "li", "ol", "p", "small", "span", "strong",
    "sub", "sup", "u", "ul",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    span: ["class", "style"],
    p: ["style"],
    strong: ["style"],
    em: ["style"],
    "*": ["title"],
  },
  // Only allow safe URL schemes — blocks javascript:, data:, vbscript:.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowedSchemesByTag: {},
  allowProtocolRelative: true,
  // Drop attributes whose names look like event handlers — defense in depth
  // in case an attribute slips through the tag/attr allow-list.
  exclusiveFilter: (frame) => {
    for (const [name] of Object.entries(frame.attribs ?? {})) {
      if (/^on/i.test(name)) return true;
    }
    return false;
  },
  // Strip any inline style that contains url()/expression()/javascript:/import.
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb/i, /^[a-z]+$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb/i, /^[a-z]+$/i],
      "font-weight": [/^(normal|bold|\d{3})$/i],
      "font-style": [/^(normal|italic|oblique)$/i],
      "text-decoration": [/^(none|underline|line-through)$/i],
      "text-align": [/^(left|right|center|justify)$/i],
    },
  },
};

export function sanitizeCmsHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return sanitizeHtml(dirty, OPTIONS);
}

/**
 * Escape an untrusted plain string so it can be safely interpolated INTO an
 * HTML string before sanitization. Use this for values like user filenames
 * or email addresses that get spliced into a CMS template (e.g. "Hello
 * {{name}}, your file …") — the CMS template itself goes through
 * sanitizeCmsHtml, but values we splice in have to be escaped FIRST or the
 * sanitizer will see them as part of the template and pass them through.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
