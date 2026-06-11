import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "חבילות קרדיט",
  description: "קני קרדיט לסטודיו כתוביות — חבילות מ-25 קרדיט (₪10) ועד 200 קרדיט (₪100). חיוב חד-פעמי, ללא חידוש אוטומטי.",
  path: "/credits",
});

export default function CreditsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
