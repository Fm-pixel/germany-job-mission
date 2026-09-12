import type { MetadataRoute } from 'next';

/**
 * A private tool: nothing here should be indexed, and the candidate portal
 * links in particular must never be crawled.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
