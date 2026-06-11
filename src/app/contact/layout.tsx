import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "יצירת קשר",
  description: "טלפון, וואטסאפ ומייל ליצירת קשר עם מאסטר וידאו",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
