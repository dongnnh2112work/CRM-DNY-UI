# Contacts API — FE contract

> **Status: LIVE** · Swagger: `contacts` · `/api/v1/contacts`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/contacts` | `contact.create` |
| GET | `/contacts` | `contact.view` |
| GET | `/contacts/:id` | `contact.view` |
| PATCH | `/contacts/:id` | `contact.update` |
| DELETE | `/contacts/:id` | `contact.delete` |

Create requires **exactly one** of `customerId` | `leadId`. Scope follows parent Customer/Lead policy.

List query: `customerId`, `leadId`, `search`, `page`, `pageSize`.
