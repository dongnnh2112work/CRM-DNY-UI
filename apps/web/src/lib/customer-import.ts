import { vnPhoneIssue, vnTaxIssue } from "@/lib/input-validators";

export function isBlankImportRow(row: Record<string, unknown>) {
  const name = String(row.Name ?? row.name ?? "").trim();
  const phone = String(row.Phone ?? row.phone ?? "").trim();
  const email = String(row.Email ?? row.email ?? "").trim();
  const company = String(row.Company ?? row.company ?? "").trim();
  return !name && !phone && !email && !company;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerImportRow(row: Record<string, unknown>): string | null {
  if (isBlankImportRow(row)) return "empty";
  const name = String(row.Name ?? row.name ?? "").trim();
  if (!name) return "name";
  const email = String(row.Email ?? row.email ?? "").trim();
  if (email && !EMAIL_RE.test(email)) return "email";
  const phone = String(row.Phone ?? row.phone ?? "").trim();
  if (phone && vnPhoneIssue(phone)) return "phone";
  const tax = String(row["Tax Code"] ?? row.taxCode ?? "").trim();
  if (tax && vnTaxIssue(tax)) return "tax";
  return null;
}
