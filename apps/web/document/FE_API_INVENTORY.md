# FE inventory — Screen → API

> Chỉ endpoint **có trong** `apps/web/document/api/*.md` và **có màn hình** trong App Router.  
> Slice đã code: **Auth + HTTP client + GET customers (smoke).**

## Cây thư mục API modules

```text
apps/web/src/
  lib/http/
    client.ts          # baseURL, Bearer, refresh, error shape
    tokens.ts          # access/refresh persistence
    errors.ts
  lib/session/
    session-provider.tsx
    permissions.ts
  modules/
    auth/api.ts        # authApi
    customers/api.ts   # customersApi
    customers/map-to-ui.ts
    # tiếp theo (chưa code):
    # identity-admin/api.ts
    # services/api.ts
    # orders/api.ts
    # payments/api.ts
    # expenses/api.ts
    # vat/api.ts
    # notifications/api.ts
    # documents/api.ts
    # collaborators/api.ts
    # commissions/api.ts
    # config/api.ts
    # …
```

## Bảng Screen → API

| Screen / route FE | User actions | Domain | API module | Endpoints (contract) | Priority |
|-------------------|--------------|--------|------------|----------------------|----------|
| `/login` | Email login, Google | Auth | `authApi` | `POST /auth/login`, `GET /auth/oauth/google` | **P0** |
| `/auth/callback` | Parse hash tokens | Auth | `authApi` | (browser hash) + `GET /auth/me` | **P0** |
| Header logout | Sign out | Auth | `authApi` | `POST /auth/logout` | **P0** |
| Session restore | Reload app | Auth | `authApi` | `POST /auth/refresh`, `GET /auth/me` | **P0** |
| `/profile` Bảo mật | Đổi mật khẩu | Auth | `authApi` | `POST /auth/change-password` | P2 |
| `/dashboard` | Xem KPI | — | *(chưa có dashboard.md)* | — mock | P3 |
| `/customers` | List, search | CRM | `customersApi` | `GET /customers` | **P0 smoke** |
| `/customers/new` | Tạo | CRM | `customersApi` | `POST /customers` | P1 |
| `/customers/:id` | Xem / sửa / xóa | CRM | `customersApi` | `GET/PATCH/DELETE /customers/:id` | P1 |
| `/customers` import | Import Excel | CRM | `importsApi` | `POST /imports/batches`… *(lead.import)* | P2 — UI đang import **customer**, contract là **lead import** |
| `/orders` | List, kanban, gán, đổi stage | Finance | `ordersApi` | `GET /orders`, `POST /orders/:id/assign`, `POST /orders/:id/change-stage` | P1 |
| `/orders/new` | Tạo đơn | Finance | `ordersApi` | `POST /orders` | P1 |
| `/orders/:id` | Sửa, duyệt, lịch TT, file | Finance + Docs | `ordersApi`, `documentsApi` | `GET/PATCH /orders/:id`, `POST /orders/:id/approve`, `GET/POST …/payment-schedule`, `POST /documents/upload` | P1 |
| `/payments` | List | Finance | `paymentsApi` | `GET /payments` | P1 |
| `/payments/:id` | Verify / void | Finance | `paymentsApi` | `GET /payments/:id`, `POST …/verify`, `POST …/void` | P1 |
| `/expense-approvals` | List, duyệt/từ chối, tạo | Finance | `expensesApi` | `GET /expenses`, `POST /expenses`, `POST …/approve`, `POST …/reject` | P1 |
| `/vat`, `/vat/new` | List, tạo, issue, cancel | Finance | `vatApi` | `GET/POST /vat-invoices`, `POST …/issue`, `POST …/cancel` | P1 |
| `/services` | List, tạo, sửa, archive | Service | `servicesApi` | `GET/POST /services`, `PATCH /services/:id`, `POST …/archive` | P1 |
| `/users` | CRUD user, roles | Identity | `identityAdminApi` | `GET/POST /users`, `PUT /users/:id/roles`, `GET/POST /roles` | P1 |
| `/config` | Đọc/sửa key | System | `configApi` | `GET /config`, `PATCH /config/:key` | P2 |
| `/notifications` | List, đánh dấu đọc | Comms | `notificationsApi` | `GET /notifications`, `POST /notifications/:id/read` | P1 |
| `/payroll` | Xem lương | — | *(không có contract)* | — | — |
| `/emails` | Soạn / list mail | — | *(không có emails.md)* | — | — |
| CTV select trên đơn | Chọn CTV | Collab | `collaboratorsApi` | `GET /collaborators` | P2 |
| Hoa hồng / payroll mock | | Finance | `commissionsApi` | `GET /commissions`, `POST …/calculate\|approve\|pay` | P2 |
| Lead (chưa có route riêng) | — | CRM | `leadsApi` | khi có màn | P2 |
| HĐ pháp lý (chưa có route) | — | Legal | `contractsApi`, `workflowsApi`, `tasksApi` | khi có màn | P2 |
| Đề nghị HĐ CTV (chưa tách rõ) | | Collab | `contractRequestsApi` | khi map UI | P2 |
| Nhắc hạn `/config` reminders | | Comms | `remindersApi` | `GET/PATCH /reminders` | P2 |

## Milestone implement

| # | Slice | Modules | UI |
|---|--------|---------|-----|
| **M0** | HTTP + Auth | `authApi`, session | Login, Google callback, logout, gate dashboard |
| **M0b** | Smoke CRM | `customersApi` | `/customers` list từ API |
| M1 | CRM write | `customersApi` CUD | new / detail |
| M2 | Services | `servicesApi` | `/services` |
| M3 | Orders | `ordersApi` + `documentsApi` | `/orders*` |
| M4 | Finance | `paymentsApi` `expensesApi` `vatApi` | payments, expenses, vat |
| M5 | Identity | `identityAdminApi` | `/users` |
| M6 | Comms + config | `notificationsApi` `configApi` | bell, `/config` |
| M7 | CTV / commission | `collaboratorsApi` `commissionsApi` | order CTV, payroll map |

**Không bịa API.** Emails / payroll / dashboard metrics giữ mock cho đến khi có contract.
