# Backend gaps — chỉ việc cần làm

Nguồn: rà soát UI hiện tại vs contract `apps/web/document/api/*`.  
FE đã sửa phần không cần API mới. **Không** thêm endpoint/dashboard/websocket/import pipeline nếu không ghi ở đây.

---

## 1. Google OAuth — user mới phải chờ duyệt

**Hiện tượng:** login Gmail xong vào CRM luôn (hoặc 403 hàng loạt) vì user được gán role mặc định.

**UI đã làm:** nếu `GET /auth/me` trả `status` ∈ `INVITED | PENDING_APPROVAL | PENDING | WAITING_APPROVAL`, hoặc `ACTIVE` nhưng `roleCodes` + `permissions` đều rỗng → redirect `/pending-approval`, không hydrate API.

**BE cần (bắt buộc):**

1. User tạo lần đầu qua Google: `status = PENDING_APPROVAL` (hoặc `INVITED`). **Không** gán `DEFAULT_SIGNUP_ROLE` / SALES.
2. `GET /auth/me` trả đúng `status`, `roleCodes: []`, `permissions: []` cho user này.
3. Admin gán quyền: `PUT /users/:id/roles` `{ roleCodes }` **và** `PATCH /users/:id` `{ status: "ACTIVE" }`. Lần login sau `/auth/me` mới có permission.
4. OAuth env (không phải việc FE):
   - `OAUTH_REDIRECT_ALLOW_PREFIX` không được `https://https://…`
   - Redirect URI Google/Supabase khớp origin FE thật (`http://localhost:3001`, Vercel)
   - Nest callback đổi `code` → token thành công (lỗi `Unable to exchange external code` là Supabase/Google, không phải UI)

**Không làm:** màn hình approve riêng, email workflow, role tạm.

---

## 2. Catalog + ma trận trang — `PATCH /config/:key` phải persist thật

UI gọi đúng Swagger (`UpdateConfigDto`): `PATCH /api/v1/config/{key}` body `{ valueJson }`.  
**Hiện tượng FE:** đổi View/Edit tab → toast/cache đổi → F5 về mặc định. Không cần API mới.

| Key | `valueJson` |
|-----|-------------|
| `crm.orderStages` | `{ stages: [{ key, label, color }] }` |
| `crm.customerStatusCatalog` | `{ statuses: [{ key, label, color }] }` |
| `crm.pagePermissions` | `{ [roleKey]: { [pageKey]: { view, edit } } }` |

`pageKey`: `dashboard` `orders` `customers` `payments` `expense_approvals` `payroll` `vat` `services` `emails` `users` `config` `order_statuses`.  
`roleKey` FE: `super_admin` `admin` `staff` `accountant` `ctv_role` (+ custom).

**BE cần (bắt buộc) — test 4 bước:**

1. Role admin có `config.manage`. Thiếu → PATCH 403; FE không được giả lưu.
2. `PATCH /config/crm.pagePermissions` **upsert** đúng key (dấu `.` là **một** key, không cắt thành `crm`). Lưu **nguyên** `valueJson`, không allowlist bỏ key, không ghi `{}`.
3. Ngay sau đó `GET /config/crm.pagePermissions` **và** `GET /config` (list) phải trả cùng `valueJson` vừa ghi. 200 mà GET ra seed/cũ = bug (F5 mất quyền).
4. Không wrap hai lần (`{ valueJson: { valueJson: … } }`) và không stringify rồi quên parse — FE đọc `valueJson` object.

```http
PATCH /api/v1/config/crm.pagePermissions
{ "valueJson": { "staff": { "vat": { "view": true, "edit": false } } } }

GET /api/v1/config/crm.pagePermissions
→ 200, valueJson.staff.vat.view === true
```

**Không làm:** API catalog mới, websocket, map matrix → RBAC trong PATCH này (xem mục 5).

Admin không có `config.manage` thì gán permission đó cho SUPER_ADMIN/ADMIN là đủ.

---

## 3. Status trên từng khách hàng

Contract `Customer` **chưa** có `status`. UI đang `PATCH /customers/:id` `{ status }` (key catalog: `active` / `lead` / `archived` / custom slug). Reload mất nếu BE strip field.

**BE cần:**

- Thêm `status: string` (nullable, default `"active"`) trên GET/POST/PATCH customer.
- **Không** enum cứng 3 giá trị — catalog UI cho thêm key tùy ý.
- Không cần API status riêng.

---

## 4. `POST /orders/:id/change-stage`

UI gửi đúng `stage` string (kể cả stage custom). Reload nhảy giai đoạn khác = BE normalize/enum sai.

**BE cần:** lưu **nguyên** `stage` nhận được. Cho phép string ngoài `new|processing|…`.  
Không gắn `order.approve` vào đổi stage / thanh toán. Nút Duyệt đơn đã bỏ; `STAGE_TRANSITION_REQUIRES_APPROVAL = false`.

---

## 5. Phân quyền trang (UI) vs RBAC (BE)

UI: ma trận View/Edit theo `SYSTEM_PAGES` (dashboard, orders, customers, payments, expense_approvals, payroll, vat, services, emails, users, config, order_statuses). Lưu `crm.pagePermissions`. Menu FE đọc matrix này.

BE thật: User → Role → PermissionGroup → Permission (`resource.action` trên `/auth/me`). Lưu matrix **không** đổi 403 API.

**Chọn một** (đừng làm cả hai):

**A (nhỏ hơn):** Admin seed/map group sao cho role sau `PUT /users/:id/roles` khớp việc user được vào trang. FE matrix chỉ là UX; API vẫn permission hiện có.

**B:** Khi admin lưu matrix, BE (hoặc FE sau khi BE expose `PUT /roles/:id/permission-groups`) map page→permission. Gợi ý map, không thêm permission mới trừ chỗ thiếu:

| Page `edit` | Permission tối thiểu |
|-------------|----------------------|
| customers | `customer.update` (+ create/delete/assign/import/export tùy ô) |
| orders | `order.update` + `order.change_stage` |
| payments | `payment.create` / `payment.verify` |
| expense_approvals | `expense.approve` (view = `expense.view`) |
| services | `service.update` / `service.archive` |
| vat | `vat.issue` |
| users | `user.manage` + `role.manage` |
| config / order_statuses | `config.manage` |
| dashboard | không cần permission mới (đã authenticated) |
| payroll | `commission.view` |
| emails | **chưa có API email** — đừng seed permission giả |

User phải **refresh `/auth/me`** sau khi gán role. Không xây RBAC thứ hai.

**UI nhóm quyền (đã làm):** `/users` → **Nhóm quyền** gọi `GET /permission-groups` + `PUT /roles/:id/permission-groups`.  
`GET /roles/:id` nên trả `permissionGroups` hoặc `permissionGroupCodes` để FE không ghi đè mù.

---

## 6. Đề nghị thanh toán — chỉ người được chọn trên đơn

UI: `order.reviewerUserId` phải = user hiện tại **và** có quyền trang. Nếu chưa chọn reviewer → không duyệt.

**BE cần:** `POST /expenses/:id/approve|reject` từ chối nếu `currentUser.id !== order.reviewerUserId`. `expense.approve` không đủ để duyệt hộ người khác.

Không thêm field reviewer trên expense nếu đơn đã có `reviewerUserId`.

---

## 7. Dịch vụ — status lưu qua PATCH / archive

UI gửi `status: ACTIVE | ARCHIVED` trên PATCH; inactive thì gọi `POST /services/:id/archive` nếu PATCH không đổi status.

**BE cần:** `PATCH /services/:id` `{ status: "ARCHIVED" }` phải persist (hoặc archive endpoint là nguồn sự thật — GET sau đó trả `ARCHIVED`). Không reset về ACTIVE.

---

## 8. Import khách Excel

UI **không** dùng `/imports/batches` (pipeline đó là **leads**). UI `POST /customers` từng dòng hợp lệ (bỏ dòng trống, reject email/SĐT sai).

**Không** bắt buộc API import mới. Chỉ cần `POST /customers` nhận `status` (mục 3). Batch import khách = out of scope.

---

## 9. Dashboard / realtime / documents

| Việc | Quyết định |
|------|------------|
| KPI dashboard | FE gộp từ `GET /customers`, `GET /orders`, `GET /payments` (installment VERIFIED). **Không** cần `/dashboard`. |
| Phải reload mới thấy data | FE poll 45s + focus trên list hiện có. **Không** websocket. |
| Documents | Upload/list/delete/download-url đã đủ. Ngày GP nhét `fileType` `license\|issued\|expires`. **Không** cần PATCH metadata trừ khi muốn tách field. |

---

## 10. OAuth / signup password (không đụng Google wait)

`POST /auth/signup` email/password **được** gán role mặc định như hiện tại. Chỉ Google (và user không có role) đi cửa chờ duyệt.

---

## Checklist BE (thứ tự)

1. Google user: pending + không role; admin `PUT roles` + `ACTIVE`.
2. Customer `status` string trên GET/POST/PATCH.
3. `change-stage` persist đúng string.
4. Expense approve chỉ `order.reviewerUserId`.
5. `PATCH /config/:key` nhận 3 key mục 2 (đã upsert thì chỉ seed `config.manage`).
6. Service PATCH/archive giữ ARCHIVED.
7. Map role/permission (mục 5A hoặc 5B) — một lần, không song song hai hệ.
