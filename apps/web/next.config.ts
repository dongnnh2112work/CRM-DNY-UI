import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { uiSecurityHeaders } from "./src/lib/security-headers";

const root = path.dirname(fileURLToPath(import.meta.url));
const securityHeaders = uiSecurityHeaders();

const nextConfig: NextConfig = {
  turbopack: {
    root,
  },
  async headers() {
    // `/:path*` matches nested routes; `/` is listed so the login and root
    // documents get the same UI headers when the catch-all does not.
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
