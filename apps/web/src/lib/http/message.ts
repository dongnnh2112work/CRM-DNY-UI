import { isDevDebugEnabled } from "@/lib/dev-debug";
import { ApiError } from "@/lib/http/errors";

export function apiErrorMessage(err: unknown, fallback: string) {
  let raw = fallback;
  if (err instanceof ApiError) raw = err.messages.filter(Boolean).join(" ") || fallback;
  else if (err instanceof Error && err.message) raw = err.message;
  if (isDevDebugEnabled() && err instanceof ApiError) {
    return `[${err.statusCode}] ${raw}`;
  }
  return raw;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function num(value: string | number | null | undefined, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
