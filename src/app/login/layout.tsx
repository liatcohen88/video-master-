import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "התחברות",
  description: "התחברות לחשבון Master Video — להמשיך לערוך סרטונים, כתוביות ואפקטים בעברית.",
  path: "/login",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
