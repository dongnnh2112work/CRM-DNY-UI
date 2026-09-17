# Frontend handoff — emit in-app notifications

> Dành cho **backend**: FE đã có inbox (`GET /notifications` + `POST /:id/read`).  
> FE **không** POST tạo thông báo. Backend **tự insert** khi event thành công và khi cron chạy.  
> Contract list/read: [`notifications.md`](./notifications.md)  
> Base: `/api/v1/notifications` · quyền inbox: `notification.view_own`

---

## Bảng nhanh — khi nào tạo & ai nhận

Mỗi dòng = **1 loại**. Mỗi người nhận = **1 record** (`recipientUserId`).

| `type` | Tạo ngay khi API này **thành công** | Người nhận (`recipientUserId`) | Bỏ qua (không insert) |
|--------|-------------------------------------|--------------------------------|------------------------|
| `task_assigned` | `POST /orders` (body có `assignedUserId`) | `assignedUserId` **mới** | Assignee trống · assignee = **actor** (tự gán cho mình) |
| `task_assigned` | `POST /orders/:id/assign` (`{ assignedUserId }`) | `assignedUserId` **mới** | `assignedUserId` không đổi · assignee = actor |
| `expense_pending` | `POST /expenses` → status `PENDING` | Mọi user **ACTIVE** có quyền `expense.approve` | Chính requester (`requestedByUserId`) · user không ACTIVE |
| `expense_reviewed` | `POST /expenses/:id/approve` **hoặc** `POST /expenses/:id/reject` | `requestedByUserId` (người tạo đề nghị) | Requester = reviewer (tự duyệt) · expense không còn `PENDING` |
| `order_overdue` | **Cron daily 07:00** `Asia/Ho_Chi_Minh` | `order.assignedUserId` | Đơn `cancelled`/`completed` · không có deadline · chưa quá hạn · không có assignee |
| `vat_deadline_approaching` | Cron daily (cùng job) | `order.assignedUserId` | Không `needsVat` · không có `vatIssueDeadline` · ngoài `0…vatIssueWarnDays` · cancelled/completed · không assignee |
| `vat_overdue` | Cron daily (cùng job) | `order.assignedUserId` | `vatIssueDeadline` chưa qua · không `needsVat` · cancelled/completed · không assignee |
| `payment_overdue` | Cron daily (cùng job) | `order.assignedUserId` | Đợt đã paid · `dueDate` chưa tới · đơn cancelled/completed · không assignee |
| `license_expiring` | Cron daily (cùng job) | `order.assignedUserId` | Không có GP / không `expiresAt` · GP còn xa hơn `warnMonths` · cancelled/completed · không assignee |
| `user_pending` | User mới `PENDING_APPROVAL` (Google OAuth lần đầu) **hoặc** admin park user về chờ duyệt | Mọi user **ACTIVE** có `user.manage` | Chính user đang chờ (chưa vào được CRM) · actor nếu là admin vừa park |
| `user_approved` | Admin gán role + `PATCH` status `ACTIVE` | Chính user vừa được duyệt | Actor (admin duyệt) · user chưa ACTIVE |
| `email_sent` | Outbound mail **campaign** gửi **thành công** | Người bấm Gửi / `sentByUserId` (**không trừ actor**) | Mail hệ thống cron hạn (đã có notif hạn) · lưu nháp / lên lịch chưa gửi |
| `email_failed` | Outbound mail **thất bại** (SMTP/provider) | Campaign: `sentByUserId`. Mail hệ thống: `assignedUserId` của đơn | Lưu nháp |

**Actor** = user trong JWT của request vừa thành công. Cron / OAuth provision **không** có actor.

---

## Quy tắc người nhận (bắt buộc)

```
recipients = unique(candidates)
  - bỏ null / empty
  - bỏ actor (nếu có)  — NGOẠI LỆ: email_sent, email_failed  (người gửi chính là người cần biết)
  - bỏ user status ≠ ACTIVE  (SUSPENDED, DEACTIVATED, PENDING_APPROVAL, …)
    NGOẠI LỆ: user_approved insert SAU khi đã ACTIVE nên recipient hợp lệ
```

- **Không broadcast** cả công ty, admin, hay cả team — trừ khi họ nằm trong `candidates`.
- **Không** gửi `submitterUserId` / `reviewerUserId` của đơn chỉ vì họ submit/review — trừ khi họ **chính là** assignee hoặc requester.
- User `PENDING_APPROVAL` **không đọc được inbox CRM** → không gửi notif cho họ (trừ `user_approved` lúc đã ACTIVE).
- 0 recipient sau filter → **không insert**, không lỗi.
- 1 type × 1 event × N recipient = N row.

Seed quyền:

| Permission | Role mặc định |
|------------|----------------|
| `expense.approve` | `SUPER_ADMIN`, `ADMIN`, `ACCOUNTING` (group `finance.full`). `MANAGER` không có mặc định |
| `user.manage` | `SUPER_ADMIN`, `ADMIN` (identity admin) |

Vẫn lấy **permission thật trên user**, không hardcode role.

---

## Không tạo notif cho các API này

FE **không** emit. Backend cũng **không** emit:

| API | Lý do |
|-----|--------|
| `PATCH /orders/:id` | Đổi giá/ghi chú; **không** đổi phụ trách. Đổi phụ trách đi `POST /assign`. |
| `POST /orders/:id/change-stage` | Đổi giai đoạn đơn |
| `POST /orders/:id/approve` | Duyệt đơn (module order — đã bỏ khỏi UI; không phải duyệt chi) |
| Tạo/sửa customer, payment, VAT invoice, contract | Không có loại notif tương ứng |
| `POST /users` kèm role + `ACTIVE` (admin tạo staff) | User vào CRM luôn — **không** `user_pending` |
| `POST /auth/signup` email/password (có role mặc định) | Không cửa chờ duyệt — xem [`BACKEND_GAPS.md`](../BACKEND_GAPS.md) mục 1 |
| `PATCH /users/:id` `{ status: SUSPENDED }` (từ chối tài khoản chờ) | User không vào CRM được — **không** in-app. Có thể mail Gmail riêng, ngoài inbox |
| Lưu nháp / lên lịch email (`draft` / `scheduled`) | Chưa gửi — chờ job gửi xong mới `email_sent` / `email_failed` |
| `POST /reminders` | Module nhắc việc cá nhân — khác inbox này |

---

## Payload 1 record

```ts
interface Notification {
  id: string;
  recipientUserId: string;     // đúng 1 user
  type: NotificationType;      // đúng enum dưới — type lạ FE map sai thành task_assigned
  title: string;               // tiếng Việt
  body: string | null;
  readAt: string | null;       // null = chưa đọc
  sourceType: "order" | "expense" | "payment" | "user" | "email" | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

type NotificationType =
  | "task_assigned"
  | "expense_pending"
  | "expense_reviewed"
  | "order_overdue"
  | "vat_deadline_approaching"
  | "vat_overdue"
  | "payment_overdue"
  | "license_expiring"
  | "user_pending"
  | "user_approved"
  | "email_sent"
  | "email_failed";
```

FE deep-link:

| `sourceType` | `sourceId` | Mở |
|--------------|------------|-----|
| `order` | `orderId` | `/orders/{orderId}` |
| `expense` | `expenseId` | `/expense-approvals` |
| `payment` | `paymentId` | `/payments/{paymentId}` |
| `user` | `userId` (user chờ / vừa duyệt) | `user_pending` → `/users/pending` · `user_approved` → `/dashboard` |
| `email` | `emailId` | `/emails` |

API inbox (không đổi):

| Method | Path |
|--------|------|
| GET | `/notifications?page&pageSize` — chỉ `recipientUserId = current` |
| POST | `/notifications/:id/read` — set `readAt` |

Không có POST create từ FE.

---

## A. Event — emit **sau** commit API (không chung transaction)

### 1. `task_assigned` — được giao đơn

**Người nhận luôn là người phụ trách mới.** Không gửi người phụ trách cũ, không gửi người tạo đơn (`submitterUserId`) trừ khi họ = assignee.

#### Hook 1 — tạo đơn

| | |
|--|--|
| API | `POST /orders` **201** |
| Actor | user tạo đơn |
| Candidates | `[body.assignedUserId]` |
| Recipients | assignee **trừ actor** |
| `sourceType` / `sourceId` | `order` / `order.id` mới |
| Dedupe | `task_assigned:{orderId}` |

Form tạo đơn FE **bắt buộc** chọn người phụ trách → hầu hết lần tạo đều emit, trừ khi admin tự gán cho chính mình.

**Ví dụ:** Admin `u2` tạo đơn, chọn Staff `u3` phụ trách → **1 notif cho `u3`**.  
Nếu `u2` tự chọn mình → **0 notif**.

#### Hook 2 — đổi / gán phụ trách

| | |
|--|--|
| API | `POST /orders/:id/assign` **200** body `{ assignedUserId }` |
| Actor | user bấm gán (list hàng loạt hoặc sửa đơn) |
| Candidates | `[body.assignedUserId]` (giá trị **mới**) |
| Recipients | assignee mới **trừ actor** |
| Skip | `assignedUserId` mới === `assignedUserId` cũ trên đơn |

FE gọi hook này khi:

1. List đơn → chọn nhiều dòng → Gán nhân viên.
2. Chi tiết đơn → Sửa → đổi field người phụ trách (sau `PATCH` thông tin khác).

**Không** emit lần hai trên `PATCH /orders`.

**Ví dụ:** Đơn đang `u3`, admin `u2` gán sang `u5` → **1 notif cho `u5`**.  
Gán lại cho `u3` (không đổi) → **0**. Gán cho `u2` (chính actor) → **0**.

**Copy VI**

- title: `Được giao đơn {orderNumber}`
- body: `{customerName} — {serviceName}`

---

### 2. `expense_pending` — đề nghị chờ duyệt

Gửi **người có quyền duyệt chi**, không gửi người nộp.

| | |
|--|--|
| API | `POST /expenses` **201**, `status = PENDING` |
| Actor | `requestedByUserId` (= user JWT; FE không cho chọn hộ) |
| Candidates | `GET` user ACTIVE có `'expense.approve' ∈ permissions` |
| Recipients | candidates **trừ** `requestedByUserId` |
| `sourceType` / `sourceId` | `expense` / `expense.id` |
| Dedupe | `expense_pending:{expenseId}` |

Không lọc theo “cùng team” hay `order.assignedUserId`. Ai duyệt được đề nghị thì nhận — khớp UI trang Duyệt chi (`expense.approve`).

Nếu requester cũng là approver (vd. ADMIN tự nộp) → **không** gửi cho chính họ; vẫn gửi các approver khác.

**Ví dụ:** Staff `u3` nộp đề nghị. Approver ACTIVE: `u1` (SUPER_ADMIN), `u2` (ADMIN), `u8` (ACCOUNTING) → **3 notif**: `u1`, `u2`, `u8`. `u3` không nhận.

**Copy VI**

- `{project}` = `orderNumber` hoặc tên dự án; fallback `Dự án`
- title: `Đề nghị thanh toán — {project}`
- body: `{requesterDisplayName}: {expenseTitle} ({amount VND})`

---

### 3. `expense_reviewed` — đã duyệt / từ chối

Gửi **người đã nộp** đề nghị, không gửi người duyệt, không gửi các approver còn lại.

| | |
|--|--|
| API | `POST /expenses/:id/approve` **hoặc** `POST /expenses/:id/reject` **200** |
| Actor | reviewer (`reviewedByUserId`) |
| Candidates | `[expense.requestedByUserId]` |
| Recipients | requester **trừ actor** |
| Skip | expense không `PENDING` (API đã 4xx) |
| `sourceType` / `sourceId` | `expense` / `expense.id` |
| Dedupe | `expense_reviewed:{expenseId}:{approved\|rejected}` |

Duyệt và từ chối là **hai** notif khác nhau (dedupe khác `approved` vs `rejected`).

**Không** gửi `order.assignedUserId` trừ khi họ chính là requester.

**Ví dụ:** `u3` nộp, ADMIN `u2` duyệt → **1 notif cho `u3`**.  
Nếu `u2` tự nộp rồi tự duyệt → **0 notif**.

**Copy VI**

- title duyệt: `Đã duyệt đề nghị — {project}`
- title từ chối: `Từ chối đề nghị — {project}`
- body: `{reviewerDisplayName} đã duyệt: {title} ({amount})`  
  hoặc `{reviewerDisplayName} đã từ chối: {title} ({amount})`

---

### 4. `user_pending` — tài khoản chờ duyệt

Admin cần biết có người đang kẹt ở `/users/pending`. User chờ **không** nhận inbox (chưa vào CRM; họ thấy trang `/pending-approval`).

Chỉ **Google OAuth lần đầu** (và user bị park lại `PENDING_APPROVAL`). Signup email/password có role mặc định → **không** emit.

#### Hook 1 — user mới chờ duyệt

| | |
|--|--|
| Khi | Provision user Google: `status = PENDING_APPROVAL` (hoặc `INVITED`), `roleCodes = []` |
| Actor | không có (OAuth) |
| Candidates | user **ACTIVE** có `'user.manage' ∈ permissions` |
| Recipients | toàn bộ candidates |
| `sourceType` / `sourceId` | `user` / id user đang chờ |
| Dedupe | `user_pending:{pendingUserId}` — **một lần** lúc tạo user, không emit lại mỗi lần họ login |

**Ví dụ:** Gmail mới `minh@…` vào CRM lần đầu → status `PENDING_APPROVAL`. Admin ACTIVE `u1`, `u2` có `user.manage` → **2 notif**: `u1`, `u2`. Minh không nhận.

#### Hook 2 — park user về chờ duyệt

| | |
|--|--|
| Khi | `PUT /users/:id/roles` `{ roleCodes: [] }` **và** `PATCH /users/:id` `{ status: "PENDING_APPROVAL" }` |
| Actor | admin đang thao tác |
| Candidates | ACTIVE `user.manage` |
| Recipients | candidates **trừ actor** |

**Copy VI**

- title: `Tài khoản chờ duyệt`
- body: `{email}` · `{displayName || "—"}`

---

### 5. `user_approved` — tài khoản đã được duyệt

User vừa được mở cửa CRM. Insert **sau** khi status đã `ACTIVE` + đã có role.

| | |
|--|--|
| API | `PUT /users/:id/roles` `{ roleCodes: [...] }` rồi `PATCH /users/:id` `{ status: "ACTIVE" }` (đúng flow trang `/users/pending`) |
| Actor | admin duyệt |
| Candidates | `[userId vừa duyệt]` |
| Recipients | user đó (**trừ actor** nếu admin tự duyệt chính mình — hiếm) |
| Skip | `roleCodes` vẫn rỗng · status chưa `ACTIVE` |
| `sourceType` / `sourceId` | `user` / `userId` |
| Dedupe | `user_approved:{userId}` |

Từ chối (`PATCH` `SUSPENDED`) → **không** in-app (họ không vào được CRM).

**Ví dụ:** Admin `u2` duyệt `minh` role `SALES` + ACTIVE → **1 notif cho minh**. Minh login/refresh lần sau thấy inbox: tài khoản đã duyệt.

**Copy VI**

- title: `Tài khoản đã được duyệt`
- body: `Bạn có thể vào CRM. Vai trò: {roleCode}.`

---

### 6. `email_sent` / `email_failed` — gửi mail thành công / thất bại

UI `/emails` hiện **mock** (chưa có API email). Khi BE gửi outbound thật, **bắt buộc** emit hai loại này — toast FE không thay inbox.

**Không trừ actor:** người bấm Gửi chính là người cần biết kết quả.

#### Campaign / soạn từ CRM (`/emails`)

| | `email_sent` | `email_failed` |
|--|--------------|----------------|
| Khi | Provider/SMTP **accepted** (Send now hoặc job lịch tới giờ) | Provider/SMTP **lỗi** (timeout, bounce hard, 4xx/5xx) |
| Recipients | `sentByUserId` (người soạn / bấm Gửi) | cùng |
| Skip | status `draft` hoặc `scheduled` chưa chạy job | — |
| `sourceType` / `sourceId` | `email` / id bản ghi mail | cùng |
| Dedupe | `email_sent:{emailId}` | `email_failed:{emailId}` |

**Không** tạo notif CRM cho từng địa chỉ khách trong `recipients[]` — họ đã nhận (hoặc không nhận) email thật.

**Ví dụ:** Staff `u3` gửi 12 khách, SMTP OK → **1 notif `email_sent` cho `u3`**. SMTP fail → **1 notif `email_failed` cho `u3`**. 12 khách không có inbox CRM.

#### Mail hệ thống (cron hạn đơn / VAT / GP)

Đã có in-app `order_overdue` / `vat_deadline_approaching` / `license_expiring`.

- Gửi mail hệ thống **thành công** → **không** thêm `email_sent` (trùng).
- Gửi mail hệ thống **thất bại** → `email_failed` cho `assignedUserId` của đơn (họ biết nhắc hạn không tới khách).

**Copy VI**

- `email_sent` title: `Đã gửi email`  
  body: `{subject} — {n} người nhận`
- `email_failed` title: `Gửi email thất bại`  
  body: `{subject} — {n} người nhận. {errorMessage ngắn}`

---

## B. Cron daily — 07:00 `Asia/Ho_Chi_Minh`

Một job. **Người nhận luôn là người phụ trách đơn** (`assignedUserId`).

Không gửi submitter, reviewer, kế toán, hay admin — trừ khi họ **đang** là `assignedUserId`.

Bỏ đơn nếu:

- `assignedUserId` trống hoặc user không ACTIVE
- `stage` ∈ `cancelled` | `completed` (và alias BE: `CANCELLED` / `COMPLETED`)

`vat_deadline_approaching` và `vat_overdue` **loại trừ nhau** cùng ngày (còn hạn vs đã quá).

Dedupe **theo ngày** + recipient: unique `(recipientUserId, dedupeKey)`. Cùng nguồn cùng loại **không spam** trong cùng ngày; ngày hôm sau (vẫn còn điều kiện) được gửi lại.

### 7. `order_overdue`

| Điều kiện đơn | `deadline` có giá trị **và** `deadline < hôm nay` (so sánh date, không giờ) |
| Người nhận | `assignedUserId` |
| `sourceType` / `sourceId` | `order` / `order.id` |
| Dedupe | `order_overdue:{orderId}:{YYYY-MM-DD}` |

`n` = số ngày đã quá hạn (`hôm nay - deadline`).

- title: `Đơn {orderNumber} quá hạn xử lý`
- body: `Deadline {deadline} đã qua {n} ngày.`

### 8. `vat_deadline_approaching`

| Điều kiện đơn | `needsVat = true` **và** có `vatIssueDeadline` **và** `0 ≤ (vatIssueDeadline - hôm nay) ≤ vatIssueWarnDays` |
| Người nhận | `assignedUserId` |
| Dedupe | `vat_deadline:{orderId}:{YYYY-MM-DD}` |

Config: key `crm.reminders` → `vatIssueWarnDays`. Mặc định **30**, clamp **7–90**. [`config.md`](./config.md).

Hết hạn **đúng hôm nay** (`n = 0`) **vẫn gửi**. Đã quá hạn (`n < 0`) → dùng `vat_overdue`, **không** loại này.

- title: `Sắp hết hạn xuất VAT — {orderNumber}`
- body: `Hạn xuất VAT: {vatIssueDeadline} (còn {n} ngày).`

### 9. `vat_overdue` — hạn xuất VAT đã qua

UI đơn có hạn VAT; cron approaching **im** khi `n < 0`. Loại này bù lỗ đó.

| Điều kiện đơn | `needsVat = true` **và** `vatIssueDeadline < hôm nay` |
| Người nhận | `assignedUserId` |
| `sourceType` / `sourceId` | `order` / `order.id` |
| Dedupe | `vat_overdue:{orderId}:{YYYY-MM-DD}` |

`n` = số ngày đã quá hạn VAT.

- title: `Quá hạn xuất VAT — {orderNumber}`
- body: `Hạn xuất VAT {vatIssueDeadline} đã qua {n} ngày.`

### 10. `payment_overdue` — đợt thanh toán quá hạn

List `/payments` đã tag đợt `overdue` khi `dueDate < hôm nay` và chưa paid. Inbox phải nhắc người phụ trách đơn.

| Điều kiện | Đợt TT `dueDate < hôm nay` **và** chưa `paid` (status pending/overdue) · đơn không cancelled/completed |
| Người nhận | `order.assignedUserId` |
| `sourceType` / `sourceId` | `payment` / `paymentId` (bản ghi thanh toán của đơn) |
| Dedupe | `payment_overdue:{paymentId}:{installmentId}:{YYYY-MM-DD}` |

Nhiều đợt quá hạn trên cùng đơn → **1 notif / đợt / ngày**.

- title: `Đợt thanh toán quá hạn — {orderNumber}`
- body: `Hạn TT {dueDate} đã qua {n} ngày. Số tiền: {amount VND}.`

### 11. `license_expiring`

Lấy `expiresAt` **sớm nhất** của GP đơn (attachment chưa xóa, có ngày).

| Tone | Điều kiện | Title |
|------|-----------|--------|
| expired | `earliestExpiresAt < hôm nay` | `Giấy phép hết hạn — {orderNumber}` |
| expiring | `hôm nay ≤ earliestExpiresAt ≤ hôm nay + warnMonths` | `Giấy phép sắp hết hạn — {orderNumber}` |

`warnMonths` = `service.licenseExpiryWarnMonths` của `order.serviceId`. Mặc định **2**, clamp **1–24**.

Không GP / không `expiresAt` / còn xa hơn cửa sổ → không gửi.

Cùng type `license_expiring` cho cả hai tone (FE phân biệt bằng title).

- body: `Khách {customerName}: hạn GP {earliestExpiresAt}. Nhắc gia hạn.`
- Dedupe: `license_expiring:{orderId}:{YYYY-MM-DD}`
- `sourceType` / `sourceId`: `order` / `order.id`

---

## C. Tùy chọn — không emit trừ khi product yêu cầu

| Ý tưởng | Lý do chưa mặc định |
|---------|----------------------|
| Đơn *sắp* đến hạn (chưa `order_overdue`) | Config chỉ có `vatIssueWarnDays`, không có cửa sổ deadline đơn |
| Gán khách hàng (`ownerId`) | Không có loại “được giao khách” trên inbox |
| Ghi nhận thanh toán / xuất VAT (actor đang làm) | Toast form đủ; inbox dành người khác / cron |
| Hoa hồng duyệt/chi | API commissions live, **không** có màn CRM |
| Tasks / contract-requests | API live, **không** có màn CRM |
| Reminder tới giờ | [`reminders.md`](./reminders.md) CRUD riêng, FE không dùng |

---

## E. Error handling

Nguyên tắc: **nghiệp vụ không chết vì notif**. Insert inbox / gửi mail là best-effort, idempotent, log được.

### BE — emit lúc API

- Insert **sau** commit domain (không chung transaction với `POST /orders` / expenses / users). Fail notif **không** rollback đơn/expense/duyệt user.
- Unique `(recipientUserId, dedupeKey)`: conflict = đã gửi, coi **thành công**, không 500.
- 0 recipient / user không ACTIVE / id rỗng: **không insert, không lỗi** API.
- N recipient: insert từng row; 1 row fail thì các row khác vẫn xong; log `type`, `sourceId`, `recipientUserId`.
- Payload thiếu `type` / `sourceType` sai enum: **không insert**, log; không bịa type.
- Không có `POST /notifications` từ FE — client không retry emit.

### BE — cron 07:00 ICT

- Idempotent qua dedupe theo ngày. Chạy trùng / retry = skip row đã có.
- 1 đơn/đợt TT lỗi parse ngày → log, **quét tiếp** (không abort job).
- Overlap (job trước chưa xong): skip lần sau hoặc advisory lock.
- Config `vatIssueWarnDays` thiếu/invalid → fallback 30, clamp 7–90; không crash job.
- License/service thiếu `warnMonths` → mặc định 2.

### BE — mail

- Cron hạn: SMTP fail vẫn **giữ** in-app `order_overdue` / VAT / GP / `payment_overdue`; thêm `email_failed` cho assignee.
- Campaign: SMTP fail → chỉ `email_failed` cho người gửi; **không** rollback bản ghi mail (status `failed`).
- Mail đã gửi xong rồi insert inbox fail → **không gửi lại** SMTP; log orphan.
- Bounce: campaign đánh `failed` + `email_failed` khi job kết thúc không accepted; không spam mỗi retry (dedupe `email_failed:{emailId}`).

### HTTP inbox (FE đã gọi)

| Case | BE | FE / contract |
|------|----|----------------|
| `GET /notifications` 401 | như auth | client logout sẵn |
| `GET` 403 thiếu `notification.view_own` | 403 | hydrator nuốt lỗi. **Không** `replaceNotifications([])` khi GET fail — giữ list cũ |
| `GET` 500 / network | 500 | giữ list cũ; bell không chặn CRM |
| `POST /:id/read` 404 (id local hoặc đã xóa) | 404 | optimistic mark-read; 404 bỏ qua |
| `POST /:id/read` 403 không phải recipient | 403 | giữ optimistic; không crash |
| Type lạ | đừng gửi | FE fallback `task_assigned` nhưng **vẫn hiện title/body** BE gửi |

User `PENDING_APPROVAL`: **không** gọi list notif. `user_approved` chỉ tồn tại sau khi ACTIVE.

Toast `message.error` khi **form đang fail** là feedback người bấm — không tạo inbox. Inbox chỉ khi domain **đã thành công** (hoặc cron/mail fail như trên).

---

## Pseudo-code gợi ý

```
# Event: POST /orders
onOrderCreated(order, actorId):
  emitTaskAssigned(order, actorId)

# Event: POST /orders/:id/assign
onOrderAssigned(order, newAssigneeId, oldAssigneeId, actorId):
  if newAssigneeId == oldAssigneeId: return
  emitTaskAssigned({ ...order, assignedUserId: newAssigneeId }, actorId)

emitTaskAssigned(order, actorId):
  for uid in recipients([order.assignedUserId], actorId):
    insert type=task_assigned, recipient=uid, source=order/order.id

# Event: POST /expenses
onExpenseCreated(expense, actorId):
  approvers = users where status=ACTIVE and has permission expense.approve
  for uid in recipients(approvers.ids, actorId):  # actor = requestedByUserId
    insert type=expense_pending, recipient=uid, source=expense/expense.id

# Event: POST /expenses/:id/approve|reject
onExpenseReviewed(expense, actorId, decision):  # decision = approved|rejected
  for uid in recipients([expense.requestedByUserId], actorId):
    insert type=expense_reviewed, recipient=uid, source=expense/expense.id

# Cron 07:00 ICT
onDailyScan():
  today = today ICT
  for order in orders where stage not in (cancelled, completed):
    owner = order.assignedUserId
    if not active(owner): continue

    if order.deadline and order.deadline < today:
      insertOnce order_overdue, owner, key=order_overdue:{id}:{today}

    if order.needsVat and order.vatIssueDeadline:
      d = daysUntil(order.vatIssueDeadline)
      if 0 <= d <= vatIssueWarnDays:
        insertOnce vat_deadline_approaching, owner, key=vat_deadline:{id}:{today}

    lic = earliestLicenseExpiry(order)
    if lic is expired or expiring(warnMonths of service):
      insertOnce license_expiring, owner, key=license_expiring:{id}:{today}

# Event: Google OAuth provision PENDING_APPROVAL
onUserPending(pendingUser):
  managers = users where status=ACTIVE and has permission user.manage
  for uid in recipients(managers.ids, actorId=null):
    insertOnce user_pending, uid, key=user_pending:{pendingUser.id}, source=user/pendingUser.id

# Event: PUT roles + PATCH ACTIVE (trang /users/pending)
onUserApproved(user, actorId, roleCode):
  for uid in recipients([user.id], actorId):
    insertOnce user_approved, uid, key=user_approved:{user.id}, source=user/user.id

# Event: outbound campaign send finished
onCampaignEmailResult(email, sentByUserId, ok, errorMessage):
  # KHÔNG trừ actor
  if ok:
    insertOnce email_sent, sentByUserId, key=email_sent:{email.id}, source=email/email.id
  else:
    insertOnce email_failed, sentByUserId, key=email_failed:{email.id}, source=email/email.id

# Event: system reminder mail failed (cron)
onSystemReminderMailFailed(order, errorMessage):
  insertOnce email_failed, order.assignedUserId, key=email_failed:sys:{order.id}:{today}
```

`insertOnce` = skip nếu đã có row cùng `(recipientUserId, dedupeKey)`. Unique constraint gợi ý: `(recipient_user_id, dedupe_key)`.

---

## Checklist

- [ ] `POST /orders` → notif `task_assigned` cho assignee mới, trừ actor
- [ ] `POST /orders/:id/assign` → cùng rule; skip nếu không đổi assignee
- [ ] Không emit trên `PATCH /orders` / `change-stage`
- [ ] `POST /expenses` → notif `expense_pending` cho mọi ACTIVE `expense.approve`, trừ requester
- [ ] `POST /expenses/:id/approve|reject` → notif `expense_reviewed` cho requester, trừ reviewer
- [ ] Cron: 3 loại hạn → **chỉ** `assignedUserId`, skip cancelled/completed, dedupe theo ngày
- [ ] Google `PENDING_APPROVAL` → `user_pending` cho ACTIVE `user.manage` (không gửi user chờ, không spam mỗi login)
- [ ] Duyệt tài khoản (roles + ACTIVE) → `user_approved` cho user đó
- [ ] Từ chối / SUSPENDED → không in-app
- [ ] Campaign mail OK → `email_sent` cho người gửi (**không trừ actor**)
- [ ] Campaign mail fail → `email_failed` cho người gửi
- [ ] Mail hệ thống cron fail → `email_failed` cho assignee đơn; thành công thì không thêm `email_sent`
- [ ] `GET /notifications` vẫn chỉ inbox current user; unread = `readAt IS NULL`

## Ngoài scope

- [`reminders.md`](./reminders.md) — CRUD nhắc việc cá nhân, **không** phải các loại inbox trên.
- Mail Gmail tới user bị **từ chối** tài khoản (họ không có inbox CRM).
- API module `/emails` (soạn/gửi) — FE đang mock; **notif `email_sent`/`email_failed` vẫn làm** trên job gửi thật khi có.

## FE đang gọi

```http
GET  /api/v1/notifications?page=1&pageSize=50
POST /api/v1/notifications/:id/read
Authorization: Bearer <accessToken>
```
