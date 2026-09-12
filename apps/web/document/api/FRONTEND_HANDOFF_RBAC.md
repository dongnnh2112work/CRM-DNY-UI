# Frontend handoff — phân quyền (RBAC) + prompt audit

> Dán **§ Prompt (copy)** vào Cursor/agent FE.  
> Mục tiêu: đọc hết doc BE liên quan → rà setting phân quyền hiện tại trên UI → chỉnh cho khớp contract (không invent RBAC thứ hai).

---

## Docs bắt buộc đọc (theo thứ tự)

| # | File | Đọc vì |
|---|------|--------|
| 1 | [`../Authorization.md`](../Authorization.md) | Capability vs Scope vs Business rule; catalog `resource.action`; role→group |
| 2 | [`auth.md`](./auth.md) | Shape `/auth/me`; Google → `PENDING_APPROVAL`; refresh permission |
| 3 | [`FRONTEND_HANDOFF_AUTH.md`](./FRONTEND_HANDOFF_AUTH.md) | Flow login → token → `/auth/me` |
| 4 | [`identity-admin.md`](./identity-admin.md) | Admin `PUT /users/:id/roles`, `PUT /roles/:id/permission-groups` |
| 5 | [`../BACKEND_GAPS.md`](../BACKEND_GAPS.md) | Mục 5: matrix trang **≠** RBAC API (chọn A) |
| 6 | [`expenses.md`](./expenses.md) + [`orders.md`](./orders.md) | Ví dụ 2 lớp: `expense.approve` + `order.reviewerUserId` |
| 7 | [`README.md`](./README.md) | Index contract + error 401/403 |

Base API: `https://apidyn.otcayxe.com/api/v1` (prod) · Swagger: https://apidyn.otcayxe.com/docs

---

## Contract ngắn

### Nguồn sự thật API = `GET /auth/me`

```ts
interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  status: string; // ACTIVE | PENDING_APPROVAL | INVITED | SUSPENDED | DEACTIVATED
  roleCodes: string[];
  permissions: string[]; // "customer.view", "expense.approve", …
}
```

- Ẩn/disable nút **theo `permissions`**, vẫn phải handle **403** từ API.  
- Sau admin gán role → **gọi lại `/auth/me`** (hoặc login lại). Token cũ không tự refresh permission.

### Ba lớp (đừng gộp một điều kiện UI)

| Lớp | Câu hỏi | FE làm gì |
|-----|---------|-----------|
| Capability | Có `permissions` chứa `resource.action`? | Ẩn/disable; thiếu → API 403 |
| Data scope | OWN / TEAM / ALL (policy BE) | List có thể ngắn hơn; 403 = ngoài scope |
| Business rule | VD reviewer trên đơn | Đọc field dữ liệu (`order.reviewerUserId`), không chỉ permission |

### Hai hệ — không đồng bộ tự động (phương án A)

| | `crm.pagePermissions` (config) | `AuthUser.permissions` |
|--|-------------------------------|-------------------------|
| Mục đích | Menu / View-Edit trang trên UI | Chặn API thật (`RbacGuard`) |
| Đổi bằng | `PATCH /config/crm.pagePermissions` | Admin gán role / permission-group |
| Lưu xong | **Không** đổi 403 API | User refresh `/auth/me` |

**Cấm:** giả định lưu matrix trang xong là user gọi được `POST /expenses/:id/approve`.

### Chờ duyệt (Google)

- `status ∈ PENDING_APPROVAL | INVITED` **hoặc** `roleCodes` + `permissions` đều rỗng → `/pending-approval`, không hydrate API nghiệp vụ.  
- `/auth/me` vẫn **200** (có token).  
- `GET /config` **không** gắn permission — vẫn đọc được; **đừng** dùng làm tín hiệu đã duyệt.

### Ví dụ duyệt chi

Cần **cả hai**:

1. `'expense.approve' ∈ permissions`  
2. `currentUser.id === order.reviewerUserId` (set qua `PATCH /orders/:id { reviewerUserId }`)

Role seed có `expense.approve`: SUPER_ADMIN, ADMIN, ACCOUNTING (qua group `finance.full`). MANAGER **không** có mặc định.

Audit FE: [`../RBAC_FE_AUDIT.md`](../RBAC_FE_AUDIT.md)
