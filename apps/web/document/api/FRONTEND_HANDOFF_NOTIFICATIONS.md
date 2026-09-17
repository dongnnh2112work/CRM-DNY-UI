# Frontend handoff — emit in-app notifications

> Dành cho **backend**: FE đã có inbox (`GET /notifications` + `POST /:id/read`).  
> FE **không** POST tạo thông báo. Backend cần **emit** khi event xảy ra và **cron** nhắc hạn.  
> Contract list/read: [`notifications.md`](./notifications.md)  
> Base: `/api/v1/notifications` · quyền: `notification.view_own`

## Nguyên tắc

1. **Chỉ gửi user liên quan** — không broadcast cả công ty.
2. **Không gửi cho người đang thao tác** (actor) nếu họ cũng nằm trong danh sách nhận.
3. `title` / `body` lưu **tiếng Việt** (CRM mặc định VI). Copy mẫu ở dưới.
4. `sourceType` + `sourceId` bắt buộc để FE deep-link.
5. Cron: **1 lần / ngày / user / đơn / loại** (dedupe). Event: 1 lần theo key bên dưới.

FE map href:

| `sourceType` | `sourceId` | FE mở |
|--------------|------------|--------|
| `order` | `orderId` | `/orders/{orderId}` |
| `expense` | `expenseId` | `/expense-approvals` |
| `payment` | `paymentId` | `/payments/{paymentId}` (chưa dùng) |

---

## Payload tạo 1 notification

Mỗi recipient = **1 record**. `GET /notifications` chỉ trả inbox của user đang login (`recipientUserId = current`).

```ts
interface Notification {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  readAt: string | null;       // null = chưa đọc
  sourceType: "order" | "expense" | "payment" | null;
  sourceId: string | null;
  createdAt: string;           // ISO
  updatedAt: string;
}

type NotificationType =
  | "task_assigned"
  | "expense_pending"
  | "expense_reviewed"
  | "order_overdue"
  | "vat_deadline_approaching"
  | "license_expiring";
```

`type` phải đúng 6 giá trị trên. FE không nhận type lạ (sẽ fallback sai thành `task_assigned`).

API hiện có (không đổi):

| Method | Path | Việc BE cần làm thêm |
|--------|------|----------------------|
| GET | `/notifications?page&pageSize` | Đã live — inbox user hiện tại |
| POST | `/notifications/:id/read` | Đã live — set `readAt` |
| — | **không có POST create từ FE** | BE tự insert khi emit / cron |

---

## A. Event — emit ngay khi thao tác

### 1. `task_assigned` — được giao đơn

**Khi:** tạo đơn có người phụ trách · đổi `assignedUserId` · gán hàng loạt.

**Người nhận:** `assignedUserId` mới, **trừ** user đang gán.

**Không gửi** nếu gán cho chính mình, hoặc `assignedUserId` không đổi.

| Field | Value |
|-------|--------|
| `sourceType` | `order` |
| `sourceId` | `orderId` |
| Dedupe | `task_assigned:{orderId}` (ghi đè / skip nếu đã có unread cùng key) |

**Copy VI**

- title: `Được giao đơn {orderNumber}`
- body: `{customerName} — {serviceName}`

Ví dụ: title `Được giao đơn DNY260856` · body `Công ty ABC — Dịch vụ visa`

---

### 2. `expense_pending` — đề nghị chờ duyệt

**Khi:** `POST /expenses` thành công, status `PENDING`.

**Người nhận:** user có quyền `expense.approve`, **trừ** `requestedByUserId`.

> FE local từng gửi nhầm cho requester — **BE làm đúng: gửi approver**.

| Field | Value |
|-------|--------|
| `sourceType` | `expense` |
| `sourceId` | `expenseId` |
| Dedupe | `expense_pending:{expenseId}` |

**Copy VI**

- `{project}` = tên dự án / `orderNumber` / fallback `Dự án`
- title: `Đề nghị thanh toán — {project}`
- body: `{requesterName}: {expenseTitle} ({amount VND})`

Ví dụ: `Đề nghị thanh toán — DNY260856` · `Nguyễn Văn A: Tạm ứng phí dịch thuật (1.500.000 ₫)`

---

### 3. `expense_reviewed` — duyệt / từ chối

**Khi:** `POST /expenses/:id/approve` hoặc `POST /expenses/:id/reject`.

**Người nhận:** `requestedByUserId`, **trừ** reviewer.

| Field | Value |
|-------|--------|
| `sourceType` | `expense` |
| `sourceId` | `expenseId` |
| Dedupe | `expense_reviewed:{expenseId}:{approved\|rejected}` |

**Copy VI**

- title duyệt: `Đã duyệt đề nghị — {project}`
- title từ chối: `Từ chối đề nghị — {project}`
- body: `{reviewerName} đã duyệt: {expenseTitle} ({amount})`  
  hoặc `{reviewerName} đã từ chối: {expenseTitle} ({amount})`

---

## B. Cron — quét mỗi ngày (timezone VN, `Asia/Ho_Chi_Minh`)

Chạy **1 lần/ngày** (gợi ý 07:00). Bỏ đơn `cancelled` / `completed`.

**Người nhận:** `assignedUserId` (người phụ trách đơn). Không gửi nếu đơn không có assignee.

Dedupe **theo ngày** — không spam cùng loại cùng đơn trong cùng ngày.

### 4. `order_overdue` — đơn quá hạn xử lý

**Điều kiện:** có `deadline` và `deadline < hôm nay` (`daysUntil < 0`).

| Field | Value |
|-------|--------|
| `sourceType` | `order` |
| `sourceId` | `orderId` |
| Dedupe | `order_overdue:{orderId}:{YYYY-MM-DD}` |

**Copy VI**

- title: `Đơn {orderNumber} quá hạn xử lý`
- body: `Deadline {deadline} đã qua {n} ngày.`

---

### 5. `vat_deadline_approaching` — sắp hết hạn xuất VAT

**Điều kiện:**

- đơn `needsVat = true`
- có `vatIssueDeadline`
- `0 ≤ daysUntil(vatIssueDeadline) ≤ vatIssueWarnDays`

Config: key `crm.reminders` → `vatIssueWarnDays`  
Mặc định **30**, clamp **7–90**. Xem [`config.md`](./config.md).

| Field | Value |
|-------|--------|
| `sourceType` | `order` |
| `sourceId` | `orderId` |
| Dedupe | `vat_deadline:{orderId}:{YYYY-MM-DD}` |

**Copy VI**

- title: `Sắp hết hạn xuất VAT — {orderNumber}`
- body: `Hạn xuất VAT: {vatIssueDeadline} (còn {n} ngày).`

---

### 6. `license_expiring` — GP sắp hết / đã hết hạn

**Điều kiện:** lấy ngày hết hạn **sớm nhất** của giấy phép đơn (attachment chưa xóa, có `expiresAt`).

- `expired`: `expiresAt < hôm nay`
- `expiring`: `hôm nay ≤ expiresAt ≤ hôm nay + warnMonths`

`warnMonths` lấy từ dịch vụ của đơn: `licenseExpiryWarnMonths`  
Mặc định **2**, clamp **1–24**.

Không gửi nếu đơn không có GP / không có `expiresAt`.

| Field | Value |
|-------|--------|
| `sourceType` | `order` |
| `sourceId` | `orderId` |
| Dedupe | `license_expiring:{orderId}:{YYYY-MM-DD}` |

**Copy VI**

- title hết hạn: `Giấy phép hết hạn — {orderNumber}`
- title sắp hết: `Giấy phép sắp hết hạn — {orderNumber}`
- body: `Khách {customerName}: hạn GP {earliestExpiresAt}. Nhắc gia hạn.`

---

## Checklist implement

- [ ] Insert notification server-side khi gán đơn (`task_assigned`)
- [ ] Insert khi tạo expense PENDING — recipients = users có `expense.approve` trừ requester
- [ ] Insert khi approve/reject expense — recipient = requester trừ reviewer
- [ ] Cron daily: overdue / VAT window / license expiring|expired
- [ ] Dedupe theo key (unique constraint gợi ý: `recipientUserId + dedupeKey`)
- [ ] `type` đúng enum 6 giá trị; `sourceType`/`sourceId` đủ để FE mở đúng trang
- [ ] `GET /notifications` vẫn chỉ inbox của current user; unread = `readAt IS NULL`

## Không nằm trong scope này

- Module **Reminders** (`/reminders`) — CRUD nhắc việc cá nhân, khác 6 loại trên. Xem [`reminders.md`](./reminders.md).
- Email thật: FE đang mock log email từ scan hạn. Nếu cần mail, gửi **kèm** in-app cho nhóm cron (cùng title/body), không thay inbox.

## FE đang gọi

```http
GET  /api/v1/notifications?page=1&pageSize=50
POST /api/v1/notifications/:id/read
Authorization: Bearer <accessToken>
```
