import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "התשלום אושר",
  description: "אישור רכישת מאסטרים ב-Master Video.",
  noindex: true, // post-payment confirmation — keep out of the index
});

export default function CreditsSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
