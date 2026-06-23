import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "מילון מונחים — עריכת וידאו וכתוביות",
  description:
    "מילון מונחים לעריכת וידאו: כתוביות אוטומטיות, תמלול עברית, רילס, טיקטוק, " +
    "אפקטים ויראליים, ייצוא MP4 ועוד — כל המושגים בעברית פשוטה.",
  path: "/glossary",
});

export default function GlossaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
