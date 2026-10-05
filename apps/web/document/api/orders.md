# Orders API — FE contract

> **Status: LIVE** · Module: `finance` · Swagger tag: `orders`  
> Base: `/api/v1/orders`

## Permissions

| Method | Path | Permission | Scope |
|--------|------|------------|-------|
| POST | `/orders` | `order.create` | — |
| GET | `/orders` | `order.view` | OWN → `assignedUserId`; ALL if `order.assign` |
| GET | `/orders/:id` | `order.view` | Must be in scope |
| PATCH | `/orders/:id` | `order.update` | Must be in scope |
| POST | `/orders/:id/assign` | `order.assign` | Must be in scope |
| POST | `/orders/:id/change-stage` | `order.change_stage` | Must be in scope |
| POST | `/orders/:id/approve` | `order.approve` | Must be in scope |
| GET | `/orders/:orderId/payment-schedule` | `order.view` | Must be in scope |
| POST | `/orders/:orderId/payment-schedule` | `order.update` | Must be in scope |

Decimals returned as **strings**.

---

## Types

```ts
interface Order {
  id: string;
  orderNumber: string;
  contractId: string;
  customerId: string;
  serviceId: string;
  stage: string;
  channel: string;
  collaboratorId: string | null;
  value: string;
  collaboratorPrice: string | null;
  totalNet: string;
  vatRate: string;
  totalGross: string;
  currency: string;
  assignedUserId: string;
  submitterUserId: string;
  reviewerUserId: string | null;
  approvalStatus: string;
  notes: string | null;
  /** % hoa hồng NV phụ trách — number hoặc decimal string; null = chưa nhập */
  commissionPercent?: string | number | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## POST `/orders`

| Field | Required | Default |
|-------|----------|---------|
| orderNumber | yes | — |
| contractId, customerId, serviceId | yes | — |
| value, totalNet, totalGross | yes | — |
| assignedUserId | yes | — |
| submitterUserId | no | current user |
| collaboratorId | no | — |
| vatRate | no | `10` |
| currency | no | `VND` |
| stage | no | `new` |
| notes | no | — |
| commissionPercent | no | `null` — % hoa hồng NV phụ trách; xem [FRONTEND_HANDOFF_ORDER_COMMISSION.md](./FRONTEND_HANDOFF_ORDER_COMMISSION.md) |

**Không gửi `reviewerUserId` trên POST** — `CreateOrderDto` forbid field này (`property reviewerUserId should not exist`). Sau khi có `id`, gán người duyệt chi bằng `PATCH /orders/:id` `{ reviewerUserId }`.

**PATCH** nhận `commissionPercent` (number | null). `null` = xóa giá trị.

---

## Commands

- **assign** `{ assignedUserId }`
- **change-stage** `{ stage }`
- **approve** `{ note? }` → `approvalStatus: approved`

## Payment schedule

**POST** body: `{ lines: [{ dueDate?, amount, sortOrder }] }` — creates or replaces schedule.
