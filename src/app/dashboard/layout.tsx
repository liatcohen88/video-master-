import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "החשבון שלי",
  description: "יתרת קרדיט, הסרטונים שלי, התראות והיסטוריית קניות",
  path: "/dashboard",
  noindex: true, // user-specific — don't index
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
