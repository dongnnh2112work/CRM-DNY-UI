# Leads API — FE contract

> **Status: LIVE** · Swagger tag: `leads` · Base: `/api/v1/leads`

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| POST | `/leads` | `lead.create` |
| GET | `/leads` | `lead.view` (+ OWN/TEAM/ALL scope) |
| GET | `/leads/:id` | `lead.view` |
| PATCH | `/leads/:id` | `lead.update` |
| DELETE | `/leads/:id` | `lead.delete` (blocked if CONVERTED) |
| POST | `/leads/:id/convert` | `lead.convert` |

## Status (string, not PG enum)

Suggested: `NEW` · `IN_PROGRESS` · `QUALIFIED` · `DISQUALIFIED` · `CONVERTED`

## Types

```ts
interface Lead {
  id: string;
  source: string;
  status: string;
  ownerId: string | null;
  convertedCustomerId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## POST `/leads/:id/convert` (command)

**Body**

```ts
{ type: 'INDIVIDUAL' | 'COMPANY'; legalName?: string; displayName?: string; industryOrField?: string }
```

**Response**

```ts
{ lead: Lead; customer: Customer }
```

Rules: cannot convert twice; contacts on lead are re-linked to new customer; lead.status → `CONVERTED`.

## List query

`page`, `pageSize`, `search`, `status`
