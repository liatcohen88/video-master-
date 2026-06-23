import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "תשלום מאובטח",
  description: "השלמת רכישת מאסטרים ב-Master Video.",
  noindex: true, // transactional checkout — keep out of the index
});

export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
