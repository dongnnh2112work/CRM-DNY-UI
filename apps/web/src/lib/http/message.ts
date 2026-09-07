import { ApiError } from "@/lib/http/errors";

export function apiErrorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.messages.filter(Boolean).join(" ") || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
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
