import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "מולטי-וידאו AI Editor",
  description: "העלי כמה סרטונים + תסריט, ה-AI יחתוך ויאחד לסרטון אחד מקצועי. חינמי, בעברית, מותאם לרילס וטיקטוק.",
  path: "/multi",
});

export default function MultiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
