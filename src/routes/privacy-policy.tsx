import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicyPage } from "@/components/raffila/public-pages";

const canonicalBase = "https://raffila.com";
const ogImageDefault = "https://raffila.com/og-default.png";

export const Route = createFileRoute("/privacy-policy")({
  head: () => {
    const pathname = "/privacy-policy";
    const canonical = `${canonicalBase}${pathname}`;
    const title = "Privacy policy — Data collection, use, cookies, rights · Raffila";
    const description =
      "Raffila privacy policy: how we collect, process, store and protect your personal data. KYC requirements, cookies, marketing opt-outs, your data rights under NDPR 2019 Nigeria. raffila.com";

    const privacyArticleJsonLd = JSON.stringify({
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
          __html: `<script type="application/ld+json">${privacyArticleJsonLd}</script>`,
        } as any,
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hrefLang: "en", href: canonical },
      ],
    };
  },
  component: PrivacyPolicyPage,
});
