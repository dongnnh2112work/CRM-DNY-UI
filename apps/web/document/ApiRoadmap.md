# API Implementation Roadmap

> Base URL: `/api/v1`  
> Auth: Bearer (dev: `test:<userId>` · prod: Supabase JWT)  
> FE contracts: [`api/`](./api/) — update when a slice ships.

## Status legend

| Tag | Meaning |
|-----|---------|
| DONE | Live in Nest + documented for FE |
| NEXT | Current implementation target |
| TODO | Planned |
| SKIP | Not in MVP API surface yet |

---

## Phase A — Foundation — DONE

- [x] Nest bootstrap, `/api/v1`, ValidationPipe, exception filter
- [x] Prisma + Supabase Postgres
- [x] AuthGuard, RbacGuard, `@RequirePermission`, ResourcePolicy
- [x] Swagger `/docs`
- [x] Seed Identity + sample domain data

---

## Phase B — Identity / Auth context

| # | Table / capability | Endpoints | FE doc | Status |
|---|--------------------|-----------|--------|--------|
| B0 | Auth session (Supabase BFF) | `POST /auth/signup` `login` `logout` `refresh` `forgot-password` `change-password` | [auth.md](./api/auth.md) | **DONE** |
| B0b | Google OAuth (BFF) | `GET /auth/oauth/google` + `/auth/oauth/callback` | [auth.md](./api/auth.md) | **DONE** |
| B1 | Current user | `GET /auth/me` | [auth.md](./api/auth.md) | **DONE** |
| B2 | Users (admin) | `GET/POST/PATCH/DELETE /users` | [identity-admin.md](./api/identity-admin.md) | **DONE** |
| B3 | Roles | `GET/POST/PATCH /roles` + permission-groups | [identity-admin.md](./api/identity-admin.md) | **DONE** |
| B4 | Permissions / groups | `/permissions`, `/permission-groups` | [identity-admin.md](./api/identity-admin.md) | **DONE** |
| B5 | User ↔ Role | `PUT /users/:id/roles` | [identity-admin.md](./api/identity-admin.md) | **DONE** |

---

## Phase C — CRM

| # | Table | Endpoints (planned) | FE doc | Status |
|---|-------|---------------------|--------|--------|
| C1 | `customers` | CRUD `/customers` | [customers.md](./api/customers.md) | **DONE** |
| C2 | `leads` | CRUD + `POST /leads/:id/convert` | [leads.md](./api/leads.md) | **DONE** |
| C3 | `contacts` | CRUD `/contacts` | [contacts.md](./api/contacts.md) | **DONE** |
| C4 | `customer_followers` | nested under customers | [crm-extras.md](./api/crm-extras.md) | **DONE** |
| C5 | `notes` | `/notes` | [crm-extras.md](./api/crm-extras.md) | **DONE** |
| C6 | `activities` | `/activities` | [crm-extras.md](./api/crm-extras.md) | **DONE** |
| C7 | `import_batches` / `import_rows` | import preview + commit | [imports.md](./api/imports.md) | **DONE** |

---

## Phase D — Service — DONE

| # | Table | Endpoints | FE doc | Status |
|---|-------|-----------|--------|--------|
| D1 | `services` | CRUD + `POST /services/:id/archive` | [services.md](./api/services.md) | **DONE** |

---

## Phase E — Legal — DONE

| # | Table | Endpoints | FE doc | Status |
|---|-------|-----------|--------|--------|
| E1 | `contracts` | CRUD + `POST /contracts/:id/change-status` | [contracts.md](./api/contracts.md) | **DONE** |
| E2 | `workflow_templates` + stages | GET/POST/PATCH + stages | [workflows.md](./api/workflows.md) | **DONE** |
| E3 | `workflow_instances` | start / advance stage | [workflows.md](./api/workflows.md) | **DONE** |
| E4 | `tasks` | CRUD `/tasks` | [tasks.md](./api/tasks.md) | **DONE** |
| E5 | `document_metadata` + Storage | `POST /documents/upload`, CRUD `/documents`, `GET …/download-url` | [documents.md](./api/documents.md) | **DONE** |

---

## Phase F — Finance — DONE

| # | Table | Endpoints | FE doc | Status |
|---|-------|-----------|--------|--------|
| F1 | `orders` | CRUD + assign / change-stage / approve | [orders.md](./api/orders.md) | **DONE** |
| F2 | `payment_schedules` (+ lines) | get/create by order | [payments.md](./api/payments.md) / [orders.md](./api/orders.md) | **DONE** |
| F3 | `payments` | create + verify / void | [payments.md](./api/payments.md) | **DONE** |
| F4 | `vat_invoices` | create + issue / cancel | [vat.md](./api/vat.md) | **DONE** |
| F5 | `expenses` | create + approve / reject | [expenses.md](./api/expenses.md) | **DONE** |
| F6 | `commissions` | calculate / approve / pay | [commissions.md](./api/commissions.md) | **DONE** |

Outstanding = derived (`order.total_gross − Σ valid payments`) — **no Debt table**.

---

## Phase G — Collaboration / CTV — DONE

| # | Table | Endpoints | FE doc | Status |
|---|-------|-----------|--------|--------|
| G1 | `collaborators` | CRUD + deactivate | [collaborators.md](./api/collaborators.md) | **DONE** |
| G2 | `collaborator_customers` | assign / unassign | [collaborators.md](./api/collaborators.md) | **DONE** |
| G3 | `contract_requests` | CRUD + review / approve / reject | [contract-requests.md](./api/contract-requests.md) | **DONE** |

---

## Phase H — Communication / System — DONE

| # | Table | Endpoints | FE doc | Status |
|---|-------|-----------|--------|--------|
| H1 | `notifications` | list own / mark read | [notifications.md](./api/notifications.md) | **DONE** |
| H2 | `reminders` | CRUD / complete | [reminders.md](./api/reminders.md) | **DONE** |
| H3 | `outbound_email_logs` | admin list (read-only) | SKIP or later | TODO |
| H4 | `app_config` | get/patch keys (admin) | [config.md](./api/config.md) | **DONE** |

---

## Implementation order (locked)

```text
A Foundation ✓
 → B1 auth/me  → B2–B5 Identity admin (as needed)
 → C2 Leads → C3–C7 CRM rest ✓
 → D Service ✓
 → E Legal ✓
 → F Finance ✓
 → G CTV ✓
 → H Comms/Config ✓
```

Do **not** jump to Finance before CRM + Service + Contract basics exist (Order FKs).

---

## FE handoff checklist (each slice)

1. Nest endpoints + Swagger tags  
2. File `docs/04-development/api/<resource>.md` (request/response/errors/permissions)  
3. Update this roadmap status  
4. Update [api/README.md](./api/README.md) index  
5. Seed IDs / example tokens if useful for QA  
