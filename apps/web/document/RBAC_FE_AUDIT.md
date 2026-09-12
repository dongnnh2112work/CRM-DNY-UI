# Audit FE phân quyền (A)

Đối chiếu `FRONTEND_HANDOFF_RBAC.md` + `Authorization.md`. Phương án **A**: matrix trang chỉ UX; API = `permissions[]`.

| Hạng mục | Kết luận | File |
|----------|----------|------|
| Session gọi `/auth/me`, lưu `permissions` | **ĐÃ KHỚP** | `session-provider.tsx`, `auth/api.ts` |
| `can(code)` = `permissions.includes` | **ĐÃ KHỚP** | `session-provider.tsx` |
| Pending: status + roles/perms rỗng | **ĐÃ KHỚP** | `access-gate.ts`, `auth-gate.tsx` |
| Menu / matrix dùng như quyền API | **LỆCH** → đã sửa | `app-shell.tsx`, `expense-approvals`, `order-expenses-panel` |
| Duyệt chi: matrix `edit` thay vì `expense.approve` | **LỆCH** → đã sửa | cộng `reviewerUserId` |
| `if (role === staff)` cho payroll / capability | **LỆCH** → đã sửa | `payroll.ts` |
| Gán role xong refresh `/auth/me` (user đang login) | **THIẾU** → đã sửa | `users/page.tsx` |
| UX chọn `reviewerUserId` trên đơn | **THIẾU** → đã sửa | `orders/new`, `orders/[id]` |
| 401 logout / 403 không silent | **ĐÃ KHỚP** (toast tại call site) | `http/client.ts`, `apiErrorMessage` |
| Upload tài liệu theo `document.upload` | **THIẾU** → đã sửa | `order-documents.tsx`, `license-upload.tsx` |

Không invent catalog permission mới. Emails vẫn không có API permission — menu theo matrix UX.
