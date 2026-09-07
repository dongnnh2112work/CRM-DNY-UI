# Identity admin APIs — FE contract

> **Status: LIVE** · Permissions: `user.manage` · `role.manage` · `permission.manage`  
> Swagger tags: `users`, `roles`, `permissions`  
> Chain: User → Role → PermissionGroup → Permission

Admin seed token: `test:11111111-1111-4111-8111-111111111101` (role ADMIN có `identity.admin` group).

---

## Users — `/api/v1/users` (`user.manage`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List (`page`, `pageSize`, `search`, `status`) |
| GET | `/users/:id` | Detail + `roleCodes` |
| POST | `/users` | Create local user |
| PATCH | `/users/:id` | Update profile / status |
| DELETE | `/users/:id` | Soft-delete → `DEACTIVATED` |
| PUT | `/users/:id/roles` | Replace roles `{ roleCodes: ["SALES"] }` |

### Create body

```ts
{
  email: string;
  displayName: string;
  status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  authSubjectId?: string; // default local:<uuid> — link Supabase id khi có
  roleCodes?: string[];
  phone?: string;
}
```

**Note:** Create user **không** tự tạo account Supabase Auth. Để login password: dùng `/auth/signup` hoặc tạo user trên Supabase rồi set `authSubjectId` = Supabase user id.

---

## Roles — `/api/v1/roles` (`role.manage`)

| Method | Path |
|--------|------|
| GET | `/roles` |
| GET | `/roles/:id` |
| POST | `/roles` `{ code, name }` |
| PATCH | `/roles/:id` `{ name? }` |
| PUT | `/roles/:id/permission-groups` `{ permissionGroupCodes: string[] }` |

---

## Permissions — (`permission.manage`)

| Method | Path |
|--------|------|
| GET | `/permissions` |
| POST | `/permissions` `{ code, description? }` |
| GET | `/permission-groups` |
| GET | `/permission-groups/:id` |
| POST | `/permission-groups` `{ code, name }` |
| PUT | `/permission-groups/:id/permissions` `{ permissionCodes: string[] }` |

---

## Typical admin flow (FE)

1. `GET /permissions` + `GET /permission-groups`  
2. Edit group: `PUT /permission-groups/:id/permissions`  
3. Attach groups to role: `PUT /roles/:id/permission-groups`  
4. Assign roles to user: `PUT /users/:id/roles`  
5. User re-login / refresh `/auth/me` để thấy `permissions` mới  
