const NOTICE_KEY = "dyn-auth-notice";

export type AuthNoticeKind =
  | "blocked"
  | "unauthorized"
  | "oauth_failed"
  | "oauth_denied"
  | "oauth_invalid"
  | "server"
  | "network";

export type AuthNotice = {
  kind: AuthNoticeKind;
  debugDetail?: string;
};

export function writeAuthNotice(kind: AuthNoticeKind, debugDetail?: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NOTICE_KEY, JSON.stringify({ kind, debugDetail } satisfies AuthNotice));
  } catch {
    /* ignore */
  }
}

export function consumeAuthNotice(): AuthNotice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthNotice;
    if (!parsed?.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}
