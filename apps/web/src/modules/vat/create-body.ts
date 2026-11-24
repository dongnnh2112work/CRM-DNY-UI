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

export type VatCreateOrder = {
  id: string;
  stage?: string | null;
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

/** Cancelled orders must not produce a VAT create body, even via `/vat/new?orderId=`. */
export function vatCreateBlockReason(order: Pick<VatCreateOrder, "stage"> | null | undefined): "cancelled" | null {
  return order?.stage === "cancelled" ? "cancelled" : null;
}

export function buildVatDraftBodyForOrder(
  order: VatCreateOrder,
  input: Omit<VatDraftInput, "orderId">,
):
  | { ok: true; body: ReturnType<typeof buildVatDraftBody> }
  | { ok: false; reason: "cancelled" } {
  const reason = vatCreateBlockReason(order);
  if (reason) return { ok: false, reason };
  return { ok: true, body: buildVatDraftBody({ ...input, orderId: order.id }) };
}
