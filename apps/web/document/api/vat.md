# VAT Invoices API — FE contract

> **Status: LIVE** · Module: `finance` · Swagger tag: `vat-invoices`  
> Base: `/api/v1/vat-invoices`

## Permissions

| Method | Path | Permission |
|--------|------|------------|
| POST | `/vat-invoices` | `vat.create` |
| GET | `/vat-invoices` | `vat.view` |
| GET | `/vat-invoices/:id` | `vat.view` |
| POST | `/vat-invoices/:id/issue` | `vat.issue` |
| POST | `/vat-invoices/:id/cancel` | `vat.cancel` |

---

## Types

```ts
type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

interface VatInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  paymentId: string | null;
  sourceType: string;
  customerName: string | null;
  customerTaxCode: string | null;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  grossAmount: string;
  status: InvoiceStatus;
  issueDate: string | null;
  lines: unknown;
  createdAt: string;
  updatedAt: string;
}
```

---

## POST `/vat-invoices`

Creates as **DRAFT**. `issueDate` is **not** required on create.

Required: `invoiceNumber`, `orderId`, `sourceType`, `netAmount`, `vatAmount`, `grossAmount`.  
Optional: `paymentId`, `customerName`, `customerTaxCode`, `vatRate` (default 10), `lines`.

## Commands

- **issue** `{ issueDate? }` — defaults issue date to now; only from DRAFT
- **cancel** — sets CANCELLED
