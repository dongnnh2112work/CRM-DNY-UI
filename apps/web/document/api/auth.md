# Auth API — FE contract (Next.js)

> **Status: LIVE** · Module: `identity` · Swagger tag: `auth`  
> Base: `/api/v1/auth`  
> IdP: **Supabase Auth** via NestJS BFF (`AuthPort`) — FE **không** gọi Supabase Auth trực tiếp cho business session (Architecture AD-A3).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | Public | Đăng ký + tạo `users` local + gán role mặc định |
| POST | `/auth/login` | Public | Đăng nhập email/password |
| GET | `/auth/oauth/google` | Public | **302** bắt đầu Google OAuth (browser) |
| GET | `/auth/oauth/callback` | Public | Callback Supabase → Nest → **302** FE (hash tokens) |
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

| Dev tip (Swagger test nhanh):  
Supabase Dashboard → **Authentication** → **Providers** → **Email** → tắt **Confirm email** → signup email mới → nhận `accessToken` ngay.

**Production base:** `https://apidyn.otcayxe.com/api/v1` · Swagger: https://apidyn.otcayxe.com/docs

**Errors:** `400` validation / Supabase; `409` email already registered

---

## POST `/auth/login`

**Body:** `{ email, password }`  
**Response:** `SessionResponse`  
**401** sai credentials / user SUSPENDED|DEACTIVATED trên Nest

Nếu IdP OK nhưng chưa có `users` local → auto-provision (same as signup role).

---

## Google / Gmail OAuth (Nest BFF)

FE **không** gọi Supabase Auth / Google SDK. Browser chỉ redirect qua Nest.

```text
FE  →  GET /auth/oauth/google?redirectTo=<FE_callback>
    →  302 Google (via Supabase)
    →  Google consent
    →  GET /auth/oauth/callback?code=…   (Nest; PKCE cookie)
    →  302 <FE_callback>#access_token=…&refresh_token=…&expires_in=…&token_type=bearer
```

### Setup (một lần — BE / Dashboard)

1. Google Cloud Console → OAuth 2.0 Client (Web) → Client ID + Secret.  
2. Supabase → Authentication → Providers → **Google** → bật + dán credentials.  
3. Supabase → URL Configuration → Redirect URLs thêm:
   - `http://localhost:3000/api/v1/auth/oauth/callback`
4. Backend `.env`: `OAUTH_REDIRECT_ALLOW_PREFIX`, `OAUTH_SUCCESS_REDIRECT_URL` (xem bảng Env).

### GET `/auth/oauth/google`

| Query | Required | Notes |
|-------|----------|--------|
| `redirectTo` | no | FE URL sau login; mặc định `OAUTH_SUCCESS_REDIRECT_URL`. Phải **bắt đầu bằng** một prefix trong `OAUTH_REDIRECT_ALLOW_PREFIX` |

Response: **302** tới Google/Supabase. Set httpOnly cookie PKCE (`dyn_oauth_pkce`, path `/api/v1/auth`, TTL 10 phút).

### GET `/auth/oauth/callback`

Supabase gọi endpoint này (không phải FE). Nest exchange code → `ensureLocalUser` (role `DEFAULT_SIGNUP_ROLE`) → **302** về `redirectTo` với **hash**:

| Hash param | Meaning |
|------------|---------|
| `access_token` | Bearer cho API |
| `refresh_token` | `/auth/refresh` |
| `expires_in` | seconds |
| `token_type` | `bearer` |
| `expires_at` | optional unix seconds |
| `error` / `error_description` | nếu OAuth thất bại |

**MVP note:** tokens trong URL hash — FE parse một lần rồi xóa hash; tránh log XSS. Phase sau có thể chuyển httpOnly cookie BFF.

User Google lần đầu → provision local như login; email trùng user password khác `authSubjectId` **chưa** merge (OPEN).

### Next.js sketch

```ts
const API = process.env.NEXT_PUBLIC_API_URL!; // http://localhost:3000/api/v1

export function loginWithGoogle() {
  const redirectTo = `${window.location.origin}/auth/callback`;
  window.location.href =
    `${API}/auth/oauth/google?redirectTo=${encodeURIComponent(redirectTo)}`;
}

// app/auth/callback/page.tsx (client)
useEffect(() => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const err = params.get('error');
  if (err) {
    // show error_description
    return;
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn = Number(params.get('expires_in') ?? 0);
  if (!accessToken || !refreshToken) return;
  // save like after POST /auth/login
  window.history.replaceState(null, '', window.location.pathname);
  // optional: GET /auth/me with accessToken
}, []);
```

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
| `DEFAULT_SIGNUP_ROLE` | default `SALES` (cả signup + Google lần đầu) |
| `PASSWORD_RESET_REDIRECT_URL` | optional default redirect |
| `OAUTH_REDIRECT_ALLOW_PREFIX` | Prefix(es) cho phép của FE `redirectTo` (comma-separated) |
| `OAUTH_SUCCESS_REDIRECT_URL` | Default FE callback nếu không truyền `redirectTo` |
| `API_PUBLIC_URL` | Optional absolute API origin cho Nest OAuth callback URL |

---

## Not in this slice

- Invite-only signup gate (OPEN — hiện open signup + default role)  
- Link Google ↔ email/password cùng email (conflict `authSubjectId`)  
- Apple / Facebook OAuth  
- HttpOnly session cookie BFF (thay hash fragment)  
