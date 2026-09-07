# Services API — FE contract

> **Status: LIVE** · Module: `service` · Swagger tag: `services`  
> Base: `/api/v1/services`

## Permissions

| Method | Path | Permission | Scope |
|--------|------|------------|-------|
| POST | `/services` | `service.create` | Creator = current user |
| GET | `/services` | `service.view` | ALL if `service.archive`; else OWN by `createdByUserId` |
| GET | `/services/:id` | `service.view` | Must be in scope |
| PATCH | `/services/:id` | `service.update` | Must be in scope |
| POST | `/services/:id/archive` | `service.archive` | Sets `status` → `ARCHIVED` |

---

## Types

```ts
interface Service {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unitPrice: string | null; // decimal as string
  processingDays: number | null;
  status: string; // ACTIVE | ARCHIVED | …
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface ServiceListResponse {
  items: Service[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

## POST `/services`

| Field | Type | Required |
|-------|------|----------|
| name | string ≤500 | yes |
| code | string | no |
| description | string | no |
| category | string | no |
| unitPrice | number | no |
| processingDays | number | no |
| status | string | no (default `ACTIVE`) |
| customFields | object | no |

**Response** → `Service`

---

## GET `/services`

**Query:** `page`, `pageSize`, `search`, `status`, `category`  
**Response** → `ServiceListResponse`

---

## GET `/services/:id`

**Response** → `Service` · **404** / **403**

---

## PATCH `/services/:id`

Partial update of create fields. **Response** → `Service`

---

## POST `/services/:id/archive`

Command: sets `status = ARCHIVED`. **Response** → `Service`
