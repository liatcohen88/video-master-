/**
 * HTML sanitizer for CMS-sourced strings rendered via dangerouslySetInnerHTML.
 *
 * Audit finding H3: Liat'\''s admin panel lets her paste arbitrary HTML into
 * CMS overrides (so she can bold a word or insert a brand name in markup).
 * That HTML is rendered raw on the public site. If her admin password ever
 * leaks — or one day she enables team members — anyone with admin access
 * could inject <script> or `onerror` payloads that would run for every
 * visitor. Sanitize at the render boundary so a compromised admin can'\''t
 * pivot into XSS against end users.
 *
 * Strips: scripts, iframes, on* event handlers, javascript: URLs, embed/
 * object/form tags. Preserves common formatting (b/strong/i/em/u/a/span/
 * br/p/ul/ol/li) and a few inline styles. DOMPurify defaults already cover
 * most of this; we just tighten the allow-list and disable form-action.
 */

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "a", "b", "br", "em", "i", "li", "ol", "p", "small", "span", "strong",
  "sub", "sup", "u", "ul",
];

const ALLOWED_ATTR = [
  // links + text styling
  "href", "target", "rel", "title", "style", "class",
];

// Block dangerous URL schemes — http(s)/mailto/tel only.
const URL_SAFE = /^(https?:|mailto:|tel:|\/|#|$)/i;

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

export function sanitizeCmsHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: URL_SAFE,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "style", "link", "meta"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onsubmit", "formaction"],
    // Strip data: URIs in images entirely — we don'\''t need them in CMS prose.
    ALLOW_DATA_ATTR: false,
  });
}
