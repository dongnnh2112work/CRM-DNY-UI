# Frontend integration prompt — DYN CRM API

> Dán prompt ở mục **§ Prompt (copy)** vào Cursor/agent FE.  
> Contract HTTP: folder này (`docs/04-development/api/`).  
> Authorization chi tiết: [`../Authorization.md`](../Authorization.md).

---

## Connection (đã deploy)

| Env | Base URL | Swagger |
|-----|----------|---------|
| **Production** | `https://apidyn.otcayxe.com/api/v1` | https://apidyn.otcayxe.com/docs |
| Local BE | `http://localhost:3000/api/v1` | http://localhost:3000/docs |

FE env gợi ý:

```env
NEXT_PUBLIC_API_URL=https://apidyn.otcayxe.com/api/v1
```

Auth: `Authorization: Bearer <accessToken>` sau `POST /auth/login` | signup | Google OAuth callback.  
Prod: **không** dùng `test:` tokens (`AUTH_MODE` trên Railway = JWT thật).

---

## Kiến trúc call API bắt buộc (module chuẩn)

```text
UI / features
    ↓ chỉ gọi
modules/<domain>/api/*.ts   (hoặc src/api/<domain>.ts)
    ↓ dùng chung
lib/http/client.ts          (baseURL, Bearer, refresh, error shape)
    ↓
Nest /api/v1
```

**Cấm:** `fetch`/`axios` rải trong component/page; hardcode path rải rác; một file “god” gọi hết mọi endpoint.

**Mỗi domain BE = một API module FE**, khớp doc:

| FE API module | Doc | Prefix chính |
|---------------|-----|----------------|
| `authApi` | [auth.md](./auth.md) | `/auth` |
| `identityAdminApi` | [identity-admin.md](./identity-admin.md) | `/users` `/roles` … |
| `customersApi` | [customers.md](./customers.md) | `/customers` |
| `leadsApi` | [leads.md](./leads.md) | `/leads` |
| `contactsApi` | [contacts.md](./contacts.md) | `/contacts` |
| `crmExtrasApi` | [crm-extras.md](./crm-extras.md) | followers / notes / activities |
| `importsApi` | [imports.md](./imports.md) | `/imports` |
| `servicesApi` | [services.md](./services.md) | `/services` |
| `contractsApi` | [contracts.md](./contracts.md) | `/contracts` |
| `workflowsApi` | [workflows.md](./workflows.md) | workflow-templates / instances |
| `tasksApi` | [tasks.md](./tasks.md) | `/tasks` |
| `documentsApi` | [documents.md](./documents.md) | `/documents` (+ multipart upload) |
| `ordersApi` | [orders.md](./orders.md) | `/orders` |
| `paymentsApi` | [payments.md](./payments.md) | `/payments` |
| `vatApi` | [vat.md](./vat.md) | `/vat-invoices` |
| `expensesApi` | [expenses.md](./expenses.md) | `/expenses` |
| `commissionsApi` | [commissions.md](./commissions.md) | `/commissions` |
| `collaboratorsApi` | [collaborators.md](./collaborators.md) | `/collaborators` |
| `contractRequestsApi` | [contract-requests.md](./contract-requests.md) | `/contract-requests` |
| `notificationsApi` | [notifications.md](./notifications.md) | `/notifications` |
| `remindersApi` | [reminders.md](./reminders.md) | `/reminders` |
| `configApi` | [config.md](./config.md) | `/config` |

Thứ tự integrate đề xuất: **Auth → CRM (customers/leads) → Services → Legal → Finance → CTV → Comms**.

---

## Prompt (copy)

```text
# ROLE
Bạn là Frontend lead (Next.js App Router) của DYN CRM. Nhiệm vụ: dựa trên **giao diện / routes / components hiện có** trong repo FE, lập plan rồi implement gọi Nest API theo **module API chuẩn** — không gọi API rải rác trong UI.

# BACKEND (source of truth)
- Production base: https://apidyn.otcayxe.com/api/v1
- Swagger: https://apidyn.otcayxe.com/docs
- Contract MD (đọc đúng file domain trước khi code): docs/04-development/api/*.md
  Index: docs/04-development/api/README.md
  Auth handoff: docs/04-development/api/FRONTEND_HANDOFF_AUTH.md
  Google OAuth + documents upload: auth.md, documents.md
- Error JSON: { success:false, statusCode, error:string[], timestamp }
- Header: Authorization: Bearer <accessToken>
- Không gọi Supabase Auth/Storage trực tiếp cho business session/upload (trừ khi doc nói rõ). Upload file chỉ qua Nest multipart.

# BẮT BUỘC — kiến trúc HTTP
1. Tạo `lib/http/client.ts` (hoặc tương đương):
   - baseURL từ NEXT_PUBLIC_API_URL
   - gắn Bearer từ session store
   - parse error shape BE
   - 401 → thử POST /auth/refresh rồi retry 1 lần; fail → logout
2. Mỗi domain BE = **một** module `*Api` (authApi, customersApi, …) export hàm typed (list/get/create/update/commands).
3. UI / React Query hooks / server actions **chỉ** import từ `*Api`, không `fetch` path thô.
4. Không tạo “api.ts” khổng lồ chứa mọi endpoint.
5. Map permission từ GET /auth/me (`permissions`, `roleCodes`) để ẩn/hiện UI — vẫn phải handle 403 từ API.

# VIỆC CẦN LÀM (theo thứ tự)
## A. Inventory UI → API
Quét app router / menu / pages hiện có. Xuất bảng:
| Screen / route FE | User actions | Domain | API module | Endpoints (từ MD) | Priority |
Chỉ lên endpoint **có trong contract MD** và **có màn hình thật**. Không bịa API.

## B. Plan theo module (không theo từng nút lẻ)
Với mỗi domain trong bảng (Auth trước):
- Files sẽ tạo: `api/<domain>.ts` + hooks nếu team đang dùng TanStack Query
- DTO/types khớp response trong MD
- Commands đặc biệt (convert lead, change-status, approve, upload…) — POST command, không PATCH lung tung
- Loading / empty / 403 UX

## C. Implement slice đầu
1. authApi: login, signup, me, refresh, logout, Google redirect + /auth/callback hash parse
2. Gắn session vào client
3. Smoke: me → 1 list của module tiếp theo trên UI thật (vd customers)

## D. Tiếp tục module theo priority UI
Mỗi PR/slice = 1–2 domain modules + màn liên quan. Không “wire all screens” một lần.

# OUTPUT
1. Bảng inventory Screen→API (markdown)
2. Cây thư mục api modules đề xuất
3. Plan implement theo milestone (Auth → …)
4. Rồi mới code — bắt đầu Auth + http client

# CONSTRAINTS
- Giữ design system / UI hiện tại; chỉ nối data
- Không đổi contract BE
- Không commit secrets; dùng env public cho base URL
```

---

## Checklist FE sau khi plan

- [ ] `NEXT_PUBLIC_API_URL` trỏ production (hoặc local khi dev BE)  
- [ ] `http` client + refresh  
- [ ] `authApi` + Google callback  
- [ ] Modules khớp màn hình (không gọi thừa)  
- [ ] Upload dùng `documentsApi.upload` (FormData, không set Content-Type tay)  
- [ ] 401/403 UX thống nhất  
