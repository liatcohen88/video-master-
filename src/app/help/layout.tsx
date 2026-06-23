import { pageMetadata } from "@/lib/seo";
import { CONTENT_DEFAULTS } from "@/lib/contentStore";

export const metadata = pageMetadata({
  title: "שאלות נפוצות",
  description: "תשובות לשאלות נפוצות על סטודיו כתוביות — תמלול, ייצוא, קרדיט, פתרון בעיות, פיצ'רים מתקדמים.",
  path: "/help",
});

// FAQPage structured data → eligible for Google's FAQ rich result. Built from
// the canonical FAQ defaults so it mirrors what the page renders.
function faqJsonLd() {
  const faqs = (CONTENT_DEFAULTS["help.faqs"] as { q: string; a: string }[] | undefined) ?? [];
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      {children}
    </>
  );
}
