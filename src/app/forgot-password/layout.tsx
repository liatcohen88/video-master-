import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "איפוס סיסמה",
  description: "איפוס סיסמה לחשבון Master Video.",
  path: "/forgot-password",
  noindex: true, // utility page — no SEO value, keep out of the index
});

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
