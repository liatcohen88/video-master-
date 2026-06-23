import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "הצהרת נגישות",
  description: "הצהרת הנגישות של Master Video — מחויבות לנגישות האתר לכלל המשתמשים.",
  path: "/accessibility-statement",
});

export default function AccessibilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
