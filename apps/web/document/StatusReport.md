# Báo cáo tình hình — DYN CRM Backend API

> Ngày: **2026-09-07**  
> Mục tiêu: NestJS modular monolith + Prisma + Supabase; FE Next.js consume `/api/v1`.

---

## 1. Tổng quan

| Hạng mục | Trạng thái |
|----------|------------|
| DB contract (schema.sql / Prisma migrate) | **Done** — Supabase Postgres |
| Nest foundation (guards, RBAC, Swagger, errors) | **Done** |
| Auth BFF (Supabase signup/login/…) | **Done** |
| CRM APIs | **Done** (gồm Import C7) |
| Service / Legal / Finance / CTV / Comms / Config | **Done** |
| Admin Identity CRUD (users/roles UI APIs) | **Done** (B2–B5) |
| Document upload (Supabase Storage) | **Done** — `POST /documents/upload` + signed download |
| Unit tests | 28 tests (Auth/RBAC/Customer/Lead) — chưa cover đủ mọi module mới |
| Production Auth (chỉ JWT, tắt test tokens) | Cấu hình `AUTH_MODE=supabase` khi sẵn sàng |

**Build:** `pnpm --filter @dyn-crm/backend build` — **PASS**  
**Swagger:** https://apidyn.otcayxe.com/docs (local: http://localhost:3000/docs)  
**FE docs:** `docs/04-development/api/` · integrate prompt: [`FRONTEND_INTEGRATION_PROMPT.md`](./api/FRONTEND_INTEGRATION_PROMPT.md)

---

## 2. Tiến độ theo Phase (ApiRoadmap)

| Phase | Nội dung | Status |
|-------|----------|--------|
| A | Foundation | **DONE** |
| B0–B1 | Auth session + `/auth/me` | **DONE** |
| B0b | Google OAuth BFF | **DONE** |
| B2–B5 | Admin users/roles/permissions APIs | **DONE** |
| C1–C7 | CRM (Customer→Import) | **DONE** |
| D | Service | **DONE** |
| E | Legal (Contract/Workflow/Task/Document) | **DONE** |
| F | Finance (Order…Commission) | **DONE** |
| G | Collaboration / CTV | **DONE** |
| H | Notifications / Reminders / Config | **DONE** |

---

## 3. Handoff Frontend — thứ tự đề xuất

### Bước 1 — Auth (làm trước)

Doc: [`api/FRONTEND_HANDOFF_AUTH.md`](./api/FRONTEND_HANDOFF_AUTH.md) + [`api/auth.md`](./api/auth.md)

- Signup / Login / Me / Refresh / Logout  
- Lưu `accessToken` → gọi smoke: `/customers`, `/services`, `/notifications`

### Bước 2 — CRM core

`customers` · `leads` (+ convert) · `contacts` · followers/notes/activities

### Bước 3 — Master + Legal

`services` · `contracts` · workflows · `tasks` · `documents`

### Bước 4 — Finance commands

`orders` (+ assign/stage/approve) · `payments` (verify/void) · VAT · expenses · commissions

### Bước 5 — CTV + Comms

`collaborators` · `contract-requests` · notifications · reminders · config

Index đầy đủ: [`api/README.md`](./api/README.md)

---

## 4. Kiến trúc gọi API (nhắc FE)

```text
Next.js  →  Nest /api/v1  →  AuthPort (Supabase Auth)
                         →  Prisma  →  Supabase PostgreSQL
```

- **Không** gọi Supabase Auth trực tiếp cho business session (BFF).  
- Capability = permission `resource.action`; Scope = policy OWN/TEAM/ALL (MVP heuristics).  
- State transition nhạy cảm = **POST command**, không chỉ PATCH.

---

## 5. Rủi ro / việc còn lại

1. **Scope TEAM** vẫn nới (gần ALL) chờ org model.  
2. **Notes/Activities** đang reuse `customer.*` permissions (OPEN).  
3. **Tests** chưa đủ cho Finance/Legal/CTV / Identity admin — cần bổ sung trước prod.  
4. **Email confirm** Supabase: tắt khi dev hoặc handle `requiresEmailConfirmation`.  
5. Upload file: **đã live** — FE dùng [`api/documents.md`](./api/documents.md); BE cần `SUPABASE_SERVICE_ROLE_KEY` + `STORAGE_BUCKET` khớp bucket thật (vd. `DNY_BUCKET`).  
6. Import Excel: MVP API commit rows → leads; chưa parse file Excel binary.  
7. Admin **create user** không tự tạo Supabase Auth account — cần signup hoặc gắn `authSubjectId`.  
8. **H3** `outbound_email_logs` — SKIP/TODO.  
9. Rotate secrets nếu từng lộ `service_role` / DB password trên chat.

---

## 6. Cách chạy local (BE)

```bash
pnpm install
pnpm prisma:generate
# DATABASE_URL đã trỏ Supabase
pnpm --filter @dyn-crm/backend prisma:seed   # optional reset demo data
pnpm dev:backend
```

---

## 7. Kết luận

Backend đã **đủ bề mặt API MVP theo roadmap domain (A–H, trừ H3)** để FE integrate:

1. Auth theo [`api/FRONTEND_HANDOFF_AUTH.md`](./api/FRONTEND_HANDOFF_AUTH.md).  
2. Domain theo [`api/README.md`](./api/README.md) — gồm Documents upload.  
3. Hardening còn lại: tests, Scope TEAM, Excel binary, H3 email logs.
