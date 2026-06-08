// Helper: convert template fontFamily (human name) to CSS className that uses the loaded Google Font.
export function fontClassFor(fontFamily: string): string {
  const slug = fontFamily.replace(/\s+/g, "-");
  return `tpl-font-${slug}`;
}
