import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/components/raffila/public-pages";

const canonicalBase = "https://raffila.com";
const ogImageDefault = "https://raffila.com/og-default.png";

export const Route = createFileRoute("/how-it-works")({
  head: () => {
    const pathname = "/how-it-works";
    const canonical = `${canonicalBase}${pathname}`;
    const title = "How it works — Enter → Draw → Win · Raffila";
    const description =
      "How Raffila works: browse competitions, pick entries, checkout securely via Paystack, follow live verified draws, claim your prize. Step-by-step process, fully transparent. raffila.com";

    const howArticleJsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      author: {
        "@type": "Organization",
        name: "Raffila",
        url: canonicalBase,
      },
      publisher: {
        "@type": "Organization",
        name: "Raffila",
        url: canonicalBase,
      },
      datePublished: "2025-01-01",
      dateModified: "2025-10-26",
      mainEntityOfPage: canonical,
      image: ogImageDefault,
      articleBody:
        "Step 1: Browse and select competitions. Step 2: Choose entries. Step 3: Checkout securely. Step 4: Watch live verified draw. Step 5: Claim prize if you win.",
    });

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { property: "og:site_name", content: "Raffila" },
        { property: "og:image", content: ogImageDefault },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:locale", content: "en_NG" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImageDefault },
        { name: "twitter:site", content: "@raffilang" },
        { name: "twitter:creator", content: "@raffilang" },
        {
          "data-head-children": true,
          __html: `<script type="application/ld+json">${howArticleJsonLd}</script>`,
        } as any,
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hrefLang: "en", href: canonical },
      ],
    };
  },
  component: HowItWorksPage,
});
