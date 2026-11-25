import type { MetadataRoute } from "next";

/** Internal CRM — keep every path out of search indexes. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
