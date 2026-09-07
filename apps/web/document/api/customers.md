# Customers API — FE contract

> **Status: LIVE** · Module: `crm` · Swagger tag: `customers`  
> Base: `/api/v1/customers`

## Permissions

| Method | Path | Permission | Scope |
|--------|------|------------|-------|
| POST | `/customers` | `customer.create` | Owner = current user (or `ownerId` if `customer.assign`) |
| GET | `/customers` | `customer.view` | OWN → filter `ownerId`; TEAM/ALL → no owner filter |
| GET | `/customers/:id` | `customer.view` | Must be in scope |
| PATCH | `/customers/:id` | `customer.update` | Must be in scope; reassign needs `customer.assign` |
| DELETE | `/customers/:id` | `customer.delete` | Soft-delete; must be in scope |

**MVP scope heuristic** (see Authorization.md):

- OWN: basic CRM perms  
- TEAM: has `customer.assign`  
- ALL: has `customer.assign` + `customer.delete` + `customer.export` (Admin-like)

---

## Types

```ts
type CustomerType = 'INDIVIDUAL' | 'COMPANY';

interface Customer {
  id: string; // uuid
  type: CustomerType;
  ownerId: string;
  industryOrField: string | null;
  legalName: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  createdAt: string; // ISO
  updatedAt: string;
}

interface CustomerListResponse {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

## POST `/customers`

**Body**

| Field | Type | Required |
|-------|------|----------|
| type | `INDIVIDUAL` \| `COMPANY` | yes |
| legalName | string ≤500 | yes |
| displayName | string ≤500 | yes |
| industryOrField | string | no |
| phone | string | no |
| email | string | no |
| taxId | string | no |
| ownerId | uuid | no (needs `customer.assign`) |

**Response** `201`/`200` → `Customer`

```bash
curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer test:11111111-1111-4111-8111-111111111103" \
  -H "Content-Type: application/json" \
  -d '{"type":"COMPANY","legalName":"Công ty Test","displayName":"Test Co"}'
```

---

## GET `/customers`

**Query**

| Param | Type | Default |
|-------|------|---------|
| page | int ≥1 | 1 |
| pageSize | int 1–100 | 20 |
| search | string | — (legalName, displayName, email, phone, taxId) |

**Response** → `CustomerListResponse`

---

## GET `/customers/:id`

**Response** → `Customer`  
**404** if missing · **403** if out of scope

---

## PATCH `/customers/:id`

**Body** — all fields optional (same as create, minus required).  
**Response** → `Customer`

---

## DELETE `/customers/:id`

Soft-delete (`deletedAt`).  
**Response** `204 No Content`

---

## Next.js usage sketch

```ts
const API = process.env.NEXT_PUBLIC_API_URL; // e.g. http://localhost:3000/api/v1

export async function listCustomers(token: string, page = 1) {
  const res = await fetch(`${API}/customers?page=${page}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<CustomerListResponse>;
}
```

---

## Not in this slice (later)

- Followers nested routes  
- Notes / activities on customer  
- Lead → Customer convert (Phase C2)  
