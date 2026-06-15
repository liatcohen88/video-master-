/**
 * CMS HTML sanitizer — server + client safe, no parser dependency.
 *
 * History: We tried `isomorphic-dompurify` first (jsdom-based) — broke
 * Next.js prerender with ERR_REQUIRE_ESM. We tried `sanitize-html` second
 * (htmlparser2-based) — broke the client bundle at runtime with
 * "Application error". Both took the site down.
 *
 * Third try (this one): a tiny regex-based sanitizer with NO dependencies.
 * It can'\''t parse a full HTML document, but the CMS strings it has to
 * clean are ~1-line snippets (e.g. "<strong>תוספת</strong> — text...").
 * For that shape, regex is plenty.
 *
 * What it strips (defense in depth — anything that can execute JS):
 *   - <script>...</script> blocks (and their content)
 *   - <iframe>, <object>, <embed>, <form>, <input>, <button>, <style>,
 *     <link>, <meta> blocks (and their content)
 *   - All on* event handler attributes (onerror, onclick, onload, ...)
 *   - javascript:, vbscript:, data: URIs in href/src
 *   - srcdoc/formaction/style="expression(...)"
 *
 * What it preserves: every other tag and attribute. The CMS author still
 * controls the page — this just blocks the JS-execution vectors.
 *
 * Closes audit H3 without the bundle catastrophes of the previous attempts.
 */

const SCRIPTY_TAGS = [
  "script", "iframe", "object", "embed", "form", "input", "button",
  "style", "link", "meta", "noscript", "frame", "frameset",
];

const DANGEROUS_SCHEMES = /(?:javascript|vbscript|data|file|about):/i;

export function sanitizeCmsHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  let s = String(dirty);

  // 1. Strip dangerous tag blocks INCLUDING their inner content. Two passes
  //    handle minor case + whitespace variants — repeating until clean
  //    defeats common bypass tricks like <scr<script>ipt>.
  for (let i = 0; i < 3; i++) {
    const before = s;
    for (const tag of SCRIPTY_TAGS) {
      const re = new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*/\\s*${tag}\\s*>`, "gi");
      s = s.replace(re, "");
      // self-closing or unmatched opens of the same tag
      s = s.replace(new RegExp(`<\\s*/?${tag}\\b[^>]*>`, "gi"), "");
    }
    if (s === before) break;
  }

  // 2. Strip on* event handler attributes, in any quoting style.
  //    e.g. onerror="x", onload='x', onclick=x, ONERROR=`x`.
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // 3. Strip srcdoc + formaction + style="...expression(...)..."
  s = s.replace(/\ssrcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/\sformaction\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/\sstyle\s*=\s*"([^"]*)"/gi, (_m, css) =>
    /expression\s*\(|javascript:|@import/i.test(css) ? "" : ` style="${css}"`);
  s = s.replace(/\sstyle\s*=\s*'([^']*)'/gi, (_m, css) =>
    /expression\s*\(|javascript:|@import/i.test(css) ? "" : ` style='${css}'`);

  // 4. Neutralize href/src that use dangerous schemes.
  s = s.replace(/\s(href|src)\s*=\s*"([^"]*)"/gi, (m, attr, url) =>
    DANGEROUS_SCHEMES.test(url.trim()) ? "" : m);
  s = s.replace(/\s(href|src)\s*=\s*'([^']*)'/gi, (m, attr, url) =>
    DANGEROUS_SCHEMES.test(url.trim()) ? "" : m);
  s = s.replace(/\s(href|src)\s*=\s*([^\s>]+)/gi, (m, attr, url) =>
    DANGEROUS_SCHEMES.test(url.trim()) ? "" : m);

  return s;
}

/**
 * HTML-escape a plain string before splicing it into an HTML template.
 * Use for values like user filenames that come from outside the CMS.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
