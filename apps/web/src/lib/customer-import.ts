import { vnPhoneIssue, vnTaxIssue } from "@/lib/input-validators";

export function isBlankImportRow(row: Record<string, unknown>) {
  const name = String(row.Name ?? row.name ?? "").trim();
  const phone = String(row.Phone ?? row.phone ?? "").trim();
  const email = String(row.Email ?? row.email ?? "").trim();
  const company = String(row.Company ?? row.company ?? "").trim();
  return !name && !phone && !email && !company;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CustomerImportSummary = {
  empty: number;
  blankName: number;
  invalid: number;
  ok: number;
};

/** TEST-only sample. No real customer phone, email, or name. */
export const CUSTOMER_IMPORT_TEMPLATE_ROW = {
  Name: "TEST Bee",
  Phone: "0900000000",
  Email: "test.bee@example.invalid",
  Company: "TEST Co",
  "Tax Code": "",
};

export function summarizeCustomerImport(rows: Record<string, unknown>[]): CustomerImportSummary {
  const summary: CustomerImportSummary = { empty: 0, blankName: 0, invalid: 0, ok: 0 };
  for (const row of rows) {
    if (isBlankImportRow(row)) {
      summary.empty += 1;
      continue;
    }
    const reason = validateCustomerImportRow(row);
    if (reason === "name") summary.blankName += 1;
    else if (reason) summary.invalid += 1;
    else summary.ok += 1;
  }
  return summary;
}

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
