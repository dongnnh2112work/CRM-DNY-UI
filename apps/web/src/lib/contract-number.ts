/**
 * Contract numbers live on Contract as strings (`"990002"`, `"DH-…"`).
 * Only an all-digit value is a Số HĐ that can unlock VAT. Never run `Number()`
 * on the raw text — `Number("DH-…")` is NaN and the UI was showing "—".
 */

export function contractNumberLabel(value: string | number | null | undefined): string | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return String(value);
  }
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text ? text : undefined;
}

/** Positive integer Số HĐ. Non-numeric labels such as `DH-…` stay unparsed. */
export function numericContractNumber(value: string | number | null | undefined): number | undefined {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1) return undefined;
    return value;
  }
  const text = contractNumberLabel(value);
  if (!text || !/^[1-9]\d*$/.test(text)) return undefined;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : undefined;
}

export function formatContractNumber(value: string | number | null | undefined): string {
  return contractNumberLabel(value) ?? "—";
}

export function compareContractNumbers(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  const na = numericContractNumber(a);
  const nb = numericContractNumber(b);
  if (na != null && nb != null && na !== nb) return na - nb;
  const la = contractNumberLabel(a) ?? "";
  const lb = contractNumberLabel(b) ?? "";
  return la.localeCompare(lb, "vi", { numeric: true });
}
