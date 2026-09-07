# Payments API — FE contract

> **Status: LIVE** · Module: `finance` · Swagger tag: `payments`  
> Base: `/api/v1/payments`

## Permissions

| Method | Path | Permission |
|--------|------|------------|
| POST | `/payments` | `payment.create` |
| GET | `/payments` | `payment.view` |
| GET | `/payments/:id` | `payment.view` |
| POST | `/payments/:id/verify` | `payment.verify` |
| POST | `/payments/:id/void` | `payment.void` |

Payment schedules live under orders: see [orders.md](./orders.md).

---

## Types

```ts
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'QR_PAYMENT';
type PaymentVerificationStatus = 'RECORDED' | 'VERIFIED' | 'VOIDED';

interface Payment {
  id: string;
  orderId: string;
  scheduleLineId: string | null;
  amount: string;
  method: PaymentMethod;
  recordedAt: string;
  verificationStatus: PaymentVerificationStatus;
  createdAt: string;
  updatedAt: string;
}
```

---

## POST `/payments`

| Field | Required |
|-------|----------|
| orderId | yes |
| amount | yes |
| method | yes |
| scheduleLineId | no |

Creates with `verificationStatus: RECORDED`.

## GET `/payments`

**Query:** `page`, `pageSize`, `orderId`

## Commands

- **verify** → `VERIFIED` (fails if VOIDED)
- **void** → `VOIDED`
