# CRM extras — Followers / Notes / Activities

> **Status: LIVE** (MVP permissions reuse `customer.*`)

## Followers

| Method | Path | Permission |
|--------|------|------------|
| GET | `/customers/:customerId/followers` | `customer.view` |
| POST | `/customers/:customerId/followers` | `customer.update` body `{ userId }` |
| DELETE | `/customers/:customerId/followers/:userId` | `customer.update` |

## Notes

| Method | Path | Permission |
|--------|------|------------|
| POST | `/notes` | `customer.update` |
| GET | `/notes?subjectType=&subjectId=` | `customer.view` |
| PATCH | `/notes/:id` | `customer.update` |
| DELETE | `/notes/:id` | `customer.update` |

Body create: `{ subjectType: 'CUSTOMER'|'LEAD', subjectId, content }`

## Activities

| Method | Path | Permission |
|--------|------|------------|
| POST | `/activities` | `customer.update` |
| GET | `/activities?subjectType=&subjectId=` | `customer.view` |

Body create: `{ subjectType, subjectId, type: 'CALL'|…, payload?, occurredAt? }`

## Not yet

- Import batches (`import_batches` / `import_rows`) — Phase C7  
- Dedicated `note.*` / `activity.*` permissions (OPEN)  
