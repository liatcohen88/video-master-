import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "החשבון שלי",
  description: "ניהול החשבון, הסיסמה והפרטים האישיים ב-Master Video.",
  path: "/account",
  noindex: true, // private user page
});

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
