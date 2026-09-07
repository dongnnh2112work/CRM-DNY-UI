# FE inventory — Screen → API

> Chỉ endpoint **có trong** `apps/web/document/api/*.md` và **có màn hình** trong App Router.  
> HTTP: `lib/http/client.ts` · session: `lib/session` · domain: `modules/<domain>/api.ts` (+ `map-to-ui.ts`).  
> UI **không** `fetch` path thô. Hydrate lúc login: `components/api-hydrator.tsx`.

## Cây thư mục API modules

```text
apps/web/src/
  lib/http/
    client.ts          # baseURL, Bearer, refresh, error shape
    tokens.ts
    errors.ts
    paging.ts
    message.ts
  lib/session/
    session-provider.tsx
  modules/
    auth/api.ts
    identity-admin/api.ts + map-to-ui.ts
    customers/api.ts + map-to-ui.ts
    services/api.ts + map-to-ui.ts
    contracts/api.ts
    orders/api.ts + map-to-ui.ts
    documents/api.ts + map-to-ui.ts
    payments/api.ts + map-to-ui.ts
    expenses/api.ts + map-to-ui.ts
    vat/api.ts + map-to-ui.ts
    commissions/api.ts
    collaborators/api.ts + map-to-ui.ts
    notifications/api.ts + map-to-ui.ts
    config/api.ts
    # chưa có màn FE → chưa module:
    # leads, contacts, crm-extras, imports, workflows, tasks,
    # contract-requests, reminders
```

## Bảng Screen → API

| Screen / route FE | User actions | Domain | API module | Endpoints (contract) | Priority |
|-------------------|--------------|--------|------------|----------------------|----------|
| `/login` | Email login, Google | Auth | `authApi` | `POST /auth/login`, `GET /auth/oauth/google` | **P0** |
| `/auth/callback` | Parse hash tokens | Auth | `authApi` | hash + `GET /auth/me` | **P0** |
| Header logout | Sign out | Auth | `authApi` | `POST /auth/logout` | **P0** |
| Session restore | Reload app | Auth | `authApi` | `POST /auth/refresh`, `GET /auth/me` | **P0** |
| `/profile` Bảo mật | Đổi mật khẩu | Auth | `authApi` | `POST /auth/change-password` | P2 |
| `/dashboard` | Xem KPI | — | *(chưa có dashboard.md)* | mock | P3 |
| `/customers` | List, search, xóa, gán | CRM | `customersApi` | `GET/PATCH/DELETE /customers` | **P0** |
| `/customers/new` | Tạo | CRM | `customersApi` | `POST /customers` | P1 |
| `/customers/:id` | Xem / sửa / xóa | CRM | `customersApi` | `GET/PATCH/DELETE /customers/:id` | P1 |
| `/customers` import | Import Excel | CRM | `importsApi` | UI import **customer**; contract là **lead import** | P2 |
| `/orders` | List, kanban, gán, đổi stage | Finance | `ordersApi` | `GET /orders`, `POST …/assign`, `POST …/change-stage` | P1 |
| `/orders/new` | Tạo đơn | Finance | `contractsApi` + `ordersApi` | `POST /contracts` rồi `POST /orders`; `PATCH` `channel` (CreateOrderDto không có channel) | P1 |
| `/orders/:id` | Sửa, duyệt, lịch TT, file | Finance + Docs | `ordersApi`, `documentsApi` | `PATCH` theo **UpdateOrderDto** (`value`, `channel`, `collaboratorId`, `notes`, totals); `POST …/assign` `…/approve`; `POST /documents/upload` | P1 |
| `/payments` | List | Finance | `paymentsApi` + schedule | `GET /payments` + `GET /orders/:id/payment-schedule` | P1 |
| `/payments/:id` | Verify / void / tạo đợt | Finance | `paymentsApi` | `POST /payments`, `POST …/verify`, `POST …/void` | P1 |
| `/expense-approvals` | List, duyệt/từ chối, tạo | Finance | `expensesApi` | `GET/POST /expenses`, `POST …/approve`, `POST …/reject` | P1 |
| `/vat`, `/vat/new` | List, tạo, issue, cancel | Finance | `vatApi` | `GET/POST /vat-invoices`, `POST …/issue`, `POST …/cancel` | P1 |
| `/services` | List, tạo, sửa, archive | Service | `servicesApi` | `GET/POST /services`, `PATCH`, `POST …/archive` | P1 |
| `/users` | CRUD user, roles | Identity | `identityAdminApi` | `GET/POST /users`, `PUT /users/:id/roles`, `GET/POST /roles` | P1 |
| `/config` | Đọc/sửa key | System | `configApi` | `GET /config`, `PATCH /config/:key` | P2 |
| `/notifications` | List, đánh dấu đọc | Comms | `notificationsApi` | `GET /notifications`, `POST …/read` | P1 |
| `/payroll` | Lương NV (mock cashflow) | Finance | `commissionsApi` *(CTV/payment commission — khác công thức UI)* | `GET /commissions` khi map payroll | P2 |
| `/emails` | Soạn / list mail | — | *(không có emails.md)* | mock | — |
| CTV select trên đơn | Chọn CTV | Collab | `collaboratorsApi` | `GET /collaborators` | P2 |

## Field chỉ có trên UI (không có trong contract)

Giữ overlay local; **mất khi hydrate lại** từ API:

- `order.commissionPercent`, `zaloGroupUrl`, `deadline`, `vatIssueDeadline`
- `order.ctvPrice` — entity có `collaboratorPrice` nhưng **UpdateOrderDto không nhận** field này
- `customer.status` / địa chỉ / usedServiceIds (API customer không có)
- `expense.bankAccount` / `bankName` — gửi kèm `description` (`Ngân hàng · STK`)

## Commands (không PATCH lung tung)

| UI action | API |
|-----------|-----|
| Đổi phụ trách đơn | `POST /orders/:id/assign` |
| Đổi giai đoạn | `POST /orders/:id/change-stage` |
| Duyệt đơn | `POST /orders/:id/approve` |
| Xác nhận / hủy TT | `POST /payments/:id/verify` \| `void` |
| Duyệt / từ chối chi | `POST /expenses/:id/approve` \| `reject` |
| Phát hành / hủy VAT | `POST /vat-invoices/:id/issue` \| `cancel` |
| Archive dịch vụ | `POST /services/:id/archive` |

## Milestone

| # | Slice | Status |
|---|--------|--------|
| M0 Auth + HTTP | Login, Google, refresh, gate | **wired** |
| M0b–M1 CRM | customers list/CUD | **wired** |
| M2 Services | `/services` | **wired** |
| M3 Orders + docs | `/orders*` | **wired** (map lại DTO 2026-09-07) |
| M4 Finance | payments, expenses, vat | **wired** (schedule + expense names) |
| M5 Identity | `/users` | **wired** |
| M6 Comms + config | notifications, config | **wired** |
| M7 CTV / commission | collaborators list; `commissionsApi` sẵn, payroll UI vẫn cashflow | partial |

**Không bịa API.** Emails / dashboard metrics / payroll staff-salary giữ logic UI cho đến khi product map 1-1 `commissions`.
