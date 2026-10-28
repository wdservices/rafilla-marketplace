import { createFileRoute } from "@tanstack/react-router";
import { TermsAndConditionsPage } from "@/components/raffila/public-pages";

const canonicalBase = "https://raffila.com";
const ogImageDefault = "https://raffila.com/og-default.png";

export const Route = createFileRoute("/terms-and-conditions")({
  head: () => {
    const pathname = "/terms-and-conditions";
    const canonical = `${canonicalBase}${pathname}`;
    const title = "Terms and conditions — User & platform agreement · Raffila";
    const description =
      "Raffila terms and conditions: account creation, wallet usage, competition entry, draws, prizes, liability, limitations, user conduct and the full legal agreement between you and Raffila. raffila.com";

    const termsArticleJsonLd = JSON.stringify({
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
          __html: `<script type="application/ld+json">${termsArticleJsonLd}</script>`,
        } as any,
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hrefLang: "en", href: canonical },
      ],
    };
  },
  component: TermsAndConditionsPage,
});
