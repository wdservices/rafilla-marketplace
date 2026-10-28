import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/raffila/public-pages";

const canonicalBase = "https://raffila.com";
const ogImageDefault = "https://raffila.com/og-default.png";

export const Route = createFileRoute("/about")({
  head: () => {
    const pathname = "/about";
    const canonical = `${canonicalBase}${pathname}`;
    const title = "About us — Fair draws, real prizes, Africa-built · Raffila";
    const description =
      "About Raffila — an African prize marketplace dedicated to fair, publicly verifiable draws, premium prizes, and transparent delivery. raffila.com";

    const aboutArticleJsonLd = JSON.stringify({
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
        "Raffila is Africa's most trusted premium prize competition platform with publicly verifiable draws, HMAC_DRBG algorithm, insured prizes, and happy winners across the nation.",
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
          __html: `<script type="application/ld+json">${aboutArticleJsonLd}</script>`,
        } as any,
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hrefLang: "en", href: canonical },
      ],
    };
  },
  component: AboutPage,
});
