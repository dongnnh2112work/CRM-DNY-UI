# Commissions API — FE contract

> **Status: LIVE** · Module: `finance` · Swagger tag: `commissions`  
> Base: `/api/v1/commissions`

## Permissions

| Method | Path | Permission |
|--------|------|------------|
| POST | `/commissions` | `commission.calculate` |
| GET | `/commissions` | `commission.view` |
| GET | `/commissions/:id` | `commission.view` |
| POST | `/commissions/:id/calculate` | `commission.calculate` |
| POST | `/commissions/:id/approve` | `commission.approve` |
| POST | `/commissions/:id/pay` | `commission.pay` |

Commission is typically tied to a **payment** (`paymentId` optional on create).

---

## Types

```ts
type CommissionStatus =
  | 'PENDING'
  | 'CALCULATED'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED';

interface Commission {
  id: string;
  orderId: string;
  paymentId: string | null;
  collaboratorId: string | null;
  beneficiaryUserId: string | null;
  rate: string;
  baseAmount: string;
  commissionAmount: string; // baseAmount * rate / 100
  periodStart: string;
  periodEnd: string;
  status: CommissionStatus;
  calculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## POST `/commissions`

Required: `orderId`, `rate`, `baseAmount`, `periodStart`, `periodEnd`.  
Optional: `paymentId`, `collaboratorId`, `beneficiaryUserId`.

Creates with `status: CALCULATED`.

## Commands

- **calculate** `{ rate, baseAmount }` → recalculates amount, status CALCULATED
- **approve** — from CALCULATED or PENDING
- **pay** — from APPROVED only
