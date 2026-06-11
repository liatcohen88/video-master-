import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "שאלות נפוצות",
  description: "תשובות לשאלות נפוצות על סטודיו כתוביות — תמלול, ייצוא, קרדיט, פתרון בעיות, פיצ'רים מתקדמים.",
  path: "/help",
});

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
