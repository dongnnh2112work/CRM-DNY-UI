# Frontend API index (Next.js)

> **Source of truth for HTTP contracts.**  
> Swagger explores interactively; these MD files are the stable FE contract.  
> **FE integrate guide + copy-paste prompt:** [FRONTEND_INTEGRATION_PROMPT.md](./FRONTEND_INTEGRATION_PROMPT.md)  
> **Screen → API inventory (FE):** [../FE_API_INVENTORY.md](../FE_API_INVENTORY.md)

## Connection

| Item | Value |
|------|--------|
| Base URL (**production**) | `https://apidyn.otcayxe.com/api/v1` |
| Swagger (production) | https://apidyn.otcayxe.com/docs |
| Base URL (local) | `http://localhost:3000/api/v1` |
| Swagger (local) | http://localhost:3000/docs |
| Auth header | `Authorization: Bearer <accessToken>` |
| Dev token | `test:<userId>` **chỉ** khi BE `AUTH_MODE=test` (local). **Prod: JWT thật** |
| Prod / real login | `POST /auth/login` hoặc Google OAuth → `accessToken` |
| Content-Type | `application/json` (riêng upload: `multipart/form-data` — xem [documents.md](./documents.md)) |

```env
NEXT_PUBLIC_API_URL=https://apidyn.otcayxe.com/api/v1
```

## Call convention (FE)

- **Một domain = một API module** (`authApi`, `customersApi`, …) — xem bảng trong [FRONTEND_INTEGRATION_PROMPT.md](./FRONTEND_INTEGRATION_PROMPT.md).  
- UI không `fetch` path trực tiếp; dùng shared HTTP client (Bearer + refresh + error shape).  
- Thứ tự: Auth → CRM → Service → Legal → Finance → CTV → Comms.

## Error shape

```json
{
  "success": false,
  "statusCode": 403,
  "error": ["Missing permission: customer.update"],
  "timestamp": "2026-09-06T00:00:00.000Z"
}
```

| Code | When |
|------|------|
| 400 | Validation failed |
| 401 | Missing/invalid token or suspended user |
| 403 | Missing permission **or** outside data scope |
| 404 | Resource not found |
| 500 | Unexpected |

## Capability vs scope

1. Missing `resource.action` → **403**  
2. Has permission but record outside OWN/TEAM/ALL → **403**  
3. See [Authorization.md](../Authorization.md)

## Live resources

> **FE start here:** [FRONTEND_HANDOFF_AUTH.md](./FRONTEND_HANDOFF_AUTH.md) · RBAC: [FRONTEND_HANDOFF_RBAC.md](./FRONTEND_HANDOFF_RBAC.md) · audit: [../RBAC_FE_AUDIT.md](../RBAC_FE_AUDIT.md)

| Resource | Doc | Status |
|----------|-----|--------|
| Auth (full session) | [auth.md](./auth.md) | **Live** |
| Identity admin (users/roles/permissions) | [identity-admin.md](./identity-admin.md) | **Live** |
| Customers | [customers.md](./customers.md) | **Live** |
| Leads | [leads.md](./leads.md) | **Live** |
| Contacts | [contacts.md](./contacts.md) | **Live** |
| Followers / Notes / Activities | [crm-extras.md](./crm-extras.md) | **Live** |
| Lead imports | [imports.md](./imports.md) | **Live** |
| Services | [services.md](./services.md) | **Live** |
| Contracts | [contracts.md](./contracts.md) | **Live** |
| Workflows | [workflows.md](./workflows.md) | **Live** |
| Tasks | [tasks.md](./tasks.md) | **Live** |
| Documents | [documents.md](./documents.md) | **Live** |
| Orders | [orders.md](./orders.md) | **Live** |
| Payments | [payments.md](./payments.md) | **Live** |
| VAT invoices | [vat.md](./vat.md) | **Live** |
| Expenses | [expenses.md](./expenses.md) | **Live** |
| Commissions | [commissions.md](./commissions.md) | **Live** |
| Collaborators | [collaborators.md](./collaborators.md) | **Live** |
| Contract requests | [contract-requests.md](./contract-requests.md) | **Live** |
| Notifications | [notifications.md](./notifications.md) | **Live** |
| Reminders | [reminders.md](./reminders.md) | **Live** |
| App config | [config.md](./config.md) | **Live** |

## Seed tokens (QA)

| Role | Bearer token |
|------|----------------|
| Admin | `test:11111111-1111-4111-8111-111111111101` |
| Manager | `test:11111111-1111-4111-8111-111111111102` |
| Sales | `test:11111111-1111-4111-8111-111111111103` |
| Sales Other | `test:11111111-1111-4111-8111-111111111104` |
| Suspended | `test:11111111-1111-4111-8111-111111111108` → 401 |

Sample customer (Sales owns): `22222222-2222-4222-8222-222222222201`  
Other owner (Sales deny): `22222222-2222-4222-8222-222222222202`

## Roadmap

Full phase checklist: [ApiRoadmap.md](../ApiRoadmap.md)
