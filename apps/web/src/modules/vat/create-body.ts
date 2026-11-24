export type VatDraftInput = {
  invoiceNumber: string;
  orderId: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  customerName?: string;
  customerTaxCode?: string;
  vatRate?: number;
};

/**
 * POST /vat-invoices body.
 *
 * `document/api/vat.md` types `lines` as optional. The live API `@IsObject()`
 * rejects the array this form used to send (`lines must be an object`).
 * Omit `lines` until BE accepts an array. Do not wrap `{ items: [...] }`.
 * Amounts already travel as netAmount / vatAmount / grossAmount.
 */
export function buildVatDraftBody(input: VatDraftInput): {
  invoiceNumber: string;
  orderId: string;
  sourceType: "ORDER";
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  customerName?: string;
  customerTaxCode?: string;
  vatRate?: number;
} {
  return {
    invoiceNumber: input.invoiceNumber,
    orderId: input.orderId,
    sourceType: "ORDER",
    netAmount: input.netAmount,
    vatAmount: input.vatAmount,
    grossAmount: input.grossAmount,
    ...(input.customerName ? { customerName: input.customerName } : {}),
    ...(input.customerTaxCode ? { customerTaxCode: input.customerTaxCode } : {}),
    ...(input.vatRate != null ? { vatRate: input.vatRate } : {}),
  };
}
