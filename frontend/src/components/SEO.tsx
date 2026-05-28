import { Helmet } from "react-helmet-async";
import { SEO_CONFIG } from "../lib/seo-config";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  path?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  noindex?: boolean;
}

/**
 * Build a clean canonical URL: lowercase path, no query params or hash.
 */
function buildCanonicalUrl(path: string): string {
  let clean = path.split("?")[0].split("#")[0];
  clean = clean.toLowerCase();
  return `${SEO_CONFIG.SITE_URL}${clean}`;
}

export default function SEO({
  title,
  description,
  keywords,
  path = "/",
  ogImage,
  ogType = "website",
  noindex,
}: SEOProps) {
  const fullTitle = title ? `${title} — ${SEO_CONFIG.SITE_NAME}` : SEO_CONFIG.DEFAULT_TITLE;
  const desc = description || SEO_CONFIG.DEFAULT_DESCRIPTION;
  const canonicalUrl = buildCanonicalUrl(path);
  const image = ogImage || SEO_CONFIG.DEFAULT_OG_IMAGE;

  // Combine page-specific keywords with target keywords
  const allKeywords = keywords
    ? `${keywords}, ${SEO_CONFIG.TARGET_KEYWORDS.join(", ")}`
    : SEO_CONFIG.TARGET_KEYWORDS.join(", ");

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="keywords" content={allKeywords} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SEO_CONFIG.SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />

      {/* Conditional noindex */}
      {noindex && <meta name="robots" content="noindex" />}
    </Helmet>
  );
}
