export type SecurityHeader = { key: string; value: string };

function apiOrigin(apiUrl: string | undefined): string {
  const raw = apiUrl?.trim() || "https://apidyn.otcayxe.com/api/v1";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://apidyn.otcayxe.com";
  }
}

/**
 * UI response headers (H1). Cookie auth is a BE change and is not done here.
 * script-src stays on this origin. Signed file URLs are on storage hosts the
 * UI does not control, so images and frames allow https (and http for local
 * signed URLs) without allowing remote scripts.
 */
export function uiSecurityHeaders(
  env: { apiUrl?: string; nodeEnv?: string } = {},
): SecurityHeader[] {
  const origin = apiOrigin(env.apiUrl ?? process.env.NEXT_PUBLIC_API_URL);
  const dev = (env.nodeEnv ?? process.env.NODE_ENV) !== "production";
  const scriptSrc = ["'self'", "'unsafe-inline'", dev ? "'unsafe-eval'" : ""]
    .filter(Boolean)
    .join(" ");
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    `connect-src 'self' ${origin}`,
    "frame-src 'self' https://view.officeapps.live.com https: http:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ];
}
