# Contracts API — FE contract

> **Status: LIVE** · Module: `legal` · Swagger tag: `contracts`  
> Base: `/api/v1/contracts`

## Permissions

| Method | Path | Permission | Scope |
|--------|------|------------|-------|
| POST | `/contracts` | `contract.create` | — |
| GET | `/contracts` | `contract.view` | ALL if `contract.delete`; else OWN via **customer.ownerId** |
| GET | `/contracts/:id` | `contract.view` | Must be in scope |
| PATCH | `/contracts/:id` | `contract.update` | Must be in scope |
| DELETE | `/contracts/:id` | `contract.delete` | Soft-delete; must be in scope |
| POST | `/contracts/:id/change-status` | `contract.change_status` | Must be in scope |

---

## Types

```ts
type ContractStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'WAITING_CUSTOMER'
  | 'SIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  status: ContractStatus;
  title: string | null;
  description: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## POST `/contracts`

Creates with `status: DRAFT`.

| Field | Type | Required |
|-------|------|----------|
| contractNumber | string (unique) | yes |
| customerId | uuid | yes |
| title | string | no |
| description | string | no |

---

## GET `/contracts`

**Query:** `page`, `pageSize`, `search`, `status`, `customerId`

---

## PATCH `/contracts/:id`

Partial: `contractNumber`, `customerId`, `title`, `description`  
(Status changes go through the command endpoint.)

---

## DELETE `/contracts/:id`

Soft-delete (`deletedAt`). **204**

---

## POST `/contracts/:id/change-status`

**Body:** `{ status: ContractStatus }`  
If `status === 'SIGNED'`, sets `signedAt` to now.
