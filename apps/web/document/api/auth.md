# Auth API — FE contract (Next.js)

> **Status: LIVE** · Module: `identity` · Swagger tag: `auth`  
> Base: `/api/v1/auth`  
> IdP: **Supabase Auth** via NestJS BFF (`AuthPort`) — FE **không** gọi Supabase Auth trực tiếp cho business session (Architecture AD-A3).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | Public | Đăng ký + tạo `users` local + gán role mặc định |
| POST | `/auth/login` | Public | Đăng nhập email/password |
| POST | `/auth/refresh` | Public | Đổi access token bằng refresh token |
| POST | `/auth/forgot-password` | Public | Gửi email reset (Supabase) |
| POST | `/auth/logout` | Bearer | Sign-out global phía IdP |
| POST | `/auth/change-password` | Bearer | Đổi mật khẩu session hiện tại |
| GET | `/auth/me` | Bearer | User + roles + permissions |

---

## Session response (signup / login / refresh)

```ts
interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  status: string; // ACTIVE | …
  permissions: string[];
  roleCodes: string[];
}

interface SessionResponse {
  accessToken: string;   // dùng làm Bearer cho mọi API
  refreshToken: string;
  expiresIn: number;     // seconds
  expiresAt?: number;    // unix seconds (nếu IdP trả)
  tokenType: string;     // "bearer"
  user: AuthUser;
}
```

FE lưu `accessToken` + `refreshToken` (memory / httpOnly cookie — khuyến nghị cookie qua BFF sau này). Mỗi request business:

```http
Authorization: Bearer <accessToken>
```

---

## POST `/auth/signup`

**Body**

| Field | Type | Rules |
|-------|------|--------|
| email | string | email |
| password | string | min 8 |
| displayName | string | 1–200 |

**Response**

- Có session ngay → `SessionResponse` (như login)
- Supabase bật **Confirm email** →:

```json
{
  "requiresEmailConfirmation": true,
  "message": "Account created. Confirm email… then POST /auth/login",
  "user": { "id": "…", "email": "…", "permissions": [], "roleCodes": ["SALES"], … }
}
```

FE: nếu `requiresEmailConfirmation === true` → hiện “check email”, chưa lưu token.

**Dev tip (Swagger test nhanh):**  
Supabase Dashboard → **Authentication** → **Providers** → **Email** → tắt **Confirm email** → signup email mới → nhận `accessToken` ngay.

**Errors:** `400` validation / Supabase; `409` email already registered

---

## POST `/auth/login`

**Body:** `{ email, password }`  
**Response:** `SessionResponse`  
**401** sai credentials / user SUSPENDED|DEACTIVATED trên Nest

Nếu IdP OK nhưng chưa có `users` local → auto-provision (same as signup role).

---

## POST `/auth/refresh`

**Body:** `{ refreshToken: string }`  
**Response:** `SessionResponse` (token mới + user)

---

## POST `/auth/forgot-password`

**Body:** `{ email, redirectTo? }`  
`redirectTo` phải nằm trong Supabase Auth redirect allow-list (URL trang reset Next.js).

**Response:** luôn `{ success: true }` (tránh email enumeration).

---

## POST `/auth/logout`

**Header:** `Authorization: Bearer <accessToken>`  
**Response:** `{ success: true }`  
FE phải xóa token local sau khi gọi.

---

## POST `/auth/change-password`

**Header:** Bearer  
**Body:** `{ newPassword: string }` (min 8)  
**Response:** `{ success: true }`

---

## GET `/auth/me`

**Header:** Bearer (Supabase JWT **hoặc** dev `test:<userId>` khi `AUTH_MODE=test`)  
**Response:** `AuthUser`

Dùng `permissions` để ẩn/hiện UI — vẫn phải dựa vào 403 từ API.

---

## Next.js sketch

```ts
const API = process.env.NEXT_PUBLIC_API_URL!;

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SessionResponse>;
}

export async function apiFetch(path: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 401) {
    // TODO: gọi /auth/refresh rồi retry
  }
  return res;
}
```

---

## Dev tokens (Swagger / QA không cần password)

Khi `AUTH_MODE=test` (default local):

| Role | Bearer |
|------|--------|
| Admin | `test:11111111-1111-4111-8111-111111111101` |
| Sales | `test:11111111-1111-4111-8111-111111111103` |

Seed users **chưa** có password Supabase — muốn login thật: dùng `/auth/signup` tạo user mới, hoặc tạo user trên Supabase Dashboard rồi `/auth/login` (Nest sẽ provision).

---

## Env (backend)

| Var | Purpose |
|-----|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Auth client key |
| `AUTH_MODE` | `test` = cho phép `test:` tokens + JWT; set `supabase` để chỉ JWT |
| `DEFAULT_SIGNUP_ROLE` | default `SALES` |
| `PASSWORD_RESET_REDIRECT_URL` | optional default redirect |

---

## Not in this slice

- Admin user/role CRUD (B2–B5)  
- OAuth social login  
- Invite-only signup gate (OPEN — hiện open signup + default role)  
