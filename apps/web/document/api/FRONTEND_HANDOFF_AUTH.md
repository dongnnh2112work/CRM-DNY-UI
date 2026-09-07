# Frontend handoff — ưu tiên Auth (test trước)

> Dành cho Next.js: **làm Auth trước**, call nhẹ vài API, rồi mở rộng theo domain.  
> Plan + prompt module API: [`FRONTEND_INTEGRATION_PROMPT.md`](./FRONTEND_INTEGRATION_PROMPT.md)

## 1. Kết nối

| Item | Value |
|------|--------|
| Base URL (production) | `https://apidyn.otcayxe.com/api/v1` |
| Swagger (production) | https://apidyn.otcayxe.com/docs |
| Base URL (local) | `http://localhost:3000/api/v1` |
| Swagger (local) | http://localhost:3000/docs |
| Contract chi tiết | [`auth.md`](./auth.md) |

```env
NEXT_PUBLIC_API_URL=https://apidyn.otcayxe.com/api/v1
```

## 2. Flow Auth tối thiểu

```text
POST /auth/signup  →  SessionResponse | { requiresEmailConfirmation, user }
POST /auth/login   →  SessionResponse { accessToken, refreshToken, user }
GET  /auth/oauth/google?redirectTo=…  →  302 Google → Nest callback → FE #tokens
GET  /auth/me      →  AuthUser { permissions, roleCodes, … }
POST /auth/refresh →  SessionResponse
POST /auth/logout  →  { success: true }
```

Header mọi API sau login:

```http
Authorization: Bearer <accessToken>
```

Nếu signup trả `requiresEmailConfirmation: true` → confirm email trên Supabase (hoặc tắt Confirm email trong Dashboard khi dev) → rồi `login`.

### Google / Gmail

1. Nút “Đăng nhập Google” → `window.location = API + '/auth/oauth/google?redirectTo=' + encodeURIComponent(origin + '/auth/callback')`  
2. Trang `/auth/callback` đọc `location.hash` → lưu `access_token` / `refresh_token` như sau `/auth/login` → xóa hash → `GET /auth/me`.  
3. Chi tiết + setup Dashboard: [`auth.md`](./auth.md) (section Google OAuth).

## 3. Smoke test sau Auth (nhẹ)

Dùng `accessToken` từ login/signup:

1. `GET /auth/me` — kiểm tra `permissions`  
2. `GET /customers?page=1&pageSize=5` — CRM list  
3. `GET /services` — master data  
4. `GET /notifications` — hộp thư user  

Dev bypass (không cần password): khi backend `AUTH_MODE=test`:

```text
Authorization: Bearer test:11111111-1111-4111-8111-111111111103
```

(Sales seed — xem [`README.md`](./README.md))

## 4. Error shape

```json
{ "success": false, "statusCode": 401|403|400, "error": ["…"], "timestamp": "…" }
```

- **401** — token sai / user suspended  
- **403** — thiếu permission hoặc ngoài data scope  

## 5. Tài liệu domain đầy đủ (sau Auth)

Index: [`README.md`](./README.md) · Roadmap: [`../ApiRoadmap.md`](../ApiRoadmap.md)
