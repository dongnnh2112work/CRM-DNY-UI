/** Local `next dev` only. Requires NEXT_PUBLIC_DEV_AUTH_BYPASS=1 in .env.local. */
export function isDevAuthBypass(): boolean {
  return process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";
}
