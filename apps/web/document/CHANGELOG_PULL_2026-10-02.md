# Tổng hợp thay đổi `main` — sau commit mail/hoa hồng (`41ae742` → `47082de`)

> Pull ngày **2026-10-02**. ~19 commit, chủ yếu Ivan + PR hướng dẫn (#11/#12).  
> Thống kê: **+5456 / −1360** dòng, ~111 file.

## Đánh giá nhanh

| Hạng mục | Thêm | Bớt / rủi ro |
|----------|------|----------------|
| Hướng dẫn trong app | `/huong-dan` + MD + ảnh | — |
| UI/UX | a11y, mobile shell, tên thay vì id, kanban/list rõ hơn | Commit lớn dễ lẫn nhiều việc |
| Phân quyền | Verify lưu role/group bằng GET sau PUT | **`1787fa8` gỡ nút Tạo/Sửa nhóm** (cố ý rút gọn UI) |
| Users / role | Map role codes đúng BE | Trang users rút gọn nhiều |
| Hydrator / KPI | Gate theo quyền route, dashboard KPI “thật” hơn | Phức tạp hydrate; cần BE dashboard (doc request) |
| Services | Category select + store | Phụ thuộc config/API |
| Finance | Hủy payment/expense nhầm tại chỗ | — |
| Docs BE | `UX_UI.md`, `BE_REQUEST_…dashboard.md`, cập nhật gaps | — |

**Kết luận:** Prod lệch local vì local chưa pull; mất nút tạo/sửa nhóm **không phải thiếu quyền**, mà UI bị gỡ ở `1787fa8`. Phần còn lại chủ yếu cải thiện UX + hydrate + hướng dẫn.

---

## Timeline commit (cũ → mới)

| Commit | Ai | Nội dung chính |
|--------|----|----------------|
| `41a1afa`…`ea68252` | Triết / Pham | Hướng dẫn sử dụng trong CRM (`/huong-dan`), ảnh, scroll mobile |
| `8f20bb5` | Ivan | A11y, mobile shell, list/detail rõ hơn |
| **`1787fa8`** | **Ivan** | **List readable + gán nhóm không tick từng perm → gỡ Tạo/Sửa nhóm**; hủy payment/expense nhầm |
| `1dee7b8`…`378f99a` | Ivan | Hydrate/route scopes, dashboard typecheck, tách chart |
| `31277f2` | Ivan | Gán role user gửi đúng `roleCodes` BE |
| `719e4bd`…`dcc4c07` | Ivan | Xác nhận lưu nhóm role bằng GET; toast chỉ khi persist thật; OAuth login message |
| `b3a9c20` | Ivan | Gate trang theo quyền; dashboard KPI; hydrator lớn |
| `b3dc67a` | Ivan | Fix card lương dashboard |
| `361552b`…`a69056c` | Ivan | Service category UI/store |
| `fbd48df`…`47082de` | Ivan | Users page + hydrator/API list polish |

---

## Chi tiết theo nhóm

### 1. Hướng dẫn (`feat/huong-dan`)

- **Thêm:** `document/huong-dan/*`, `public/huong-dan/*`, route `/huong-dan`, `GuideMarkdown` / `GuideShell`, mục menu.
- Mục đích: đọc tài liệu bàn giao trong CRM.

### 2. Phân quyền / users — **điểm gây mất nút**

**Commit gây mất:** `1787fa8`  
Message: *assign permission groups without per-permission ticks*.

**Bớt trên UI `/users/permissions`:**

- Nút **Tạo nhóm quyền**
- Nút **Sửa** từng nhóm
- `PermissionGroupEditor` (file còn, không còn được gọi)
- Load catalog `GET /permissions` (+ fallback `ALL_PERMISSION_CODES`)

**Giữ:** tick gắn nhóm vào role, Lưu (`role.manage`), Xóa nhóm (`permission.manage`).

**Thêm sau đó (tốt):**

- `719e4bd` / `dcc4c07`: sau PUT đọc lại `GET /roles/:id`, chỉ toast success khi DB khớp.
- `31277f2`: map role code gửi BE đúng.

**Quyền API (không đổi):**

| Việc | Cần |
|------|-----|
| Tạo/sửa/xóa nhóm, tick capability trong nhóm | `permission.manage` |
| Gắn nhóm vào role | `role.manage` |
| Vào trang phân quyền | một trong hai |

### 3. Hydrator / dashboard / gate

- `b3a9c20`: 403 nếu không đủ quyền trang; `/users/permissions` cần `role.manage` **hoặc** `permission.manage`.
- Dashboard KPI tách chart/count; có request BE `BE_REQUEST_2026-10-01_dashboard.md`.
- Hydrator/load-api-data mở rộng nhiều lần (scopes, lookups, service category…).

### 4. UI finance / list

- Hiện tên catalog thay id.
- Hủy đề nghị thanh toán / payment nhầm trên UI.
- Payroll card không cắt hint.

### 5. Services

- Thêm chọn/quản lý **category** dịch vụ (`service-category-store`, select component).

---

## Việc FE sau pull

1. ✅ **Đã khôi phục** nút Tạo nhóm + Sửa nhóm trên `/users/permissions` (giữ verify lưu của Ivan).
2. Kiểm tra sau deploy: admin có `permission.manage` thấy Tạo/Sửa; chỉ `role.manage` vẫn gán nhóm nhưng không sửa nội dung nhóm.

---

## Không nằm trong khoảng pull này (đã có từ trước)

- Trang email nối API Resend (`41ae742`).
- Handoff `commissionPercent` cho BE.
