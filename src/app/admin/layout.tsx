import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "פאנל ניהול",
  description: "ניהול משתמשים, קרדיט, תוכן ומיתוג",
  path: "/admin",
  noindex: true, // private — don't index
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
