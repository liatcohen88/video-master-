import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "הרשמה — 25 מאסטרים במתנה",
  description:
    "הרשמה חינמית ל-Master Video וקבלת 25 מאסטרים במתנה — תמלול עברית, כתוביות " +
    "לרילס וטיקטוק, אפקטים ויראליים וייצוא MP4.",
  path: "/signup",
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
