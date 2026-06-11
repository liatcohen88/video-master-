import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "תקנון ומדיניות פרטיות",
  description: "תנאי השימוש ומדיניות הפרטיות של מאסטר וידאו. אנחנו לא שומרים את הסרטונים שלכם.",
  path: "/policy",
});

export default function PolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
