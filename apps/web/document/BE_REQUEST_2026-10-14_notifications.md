# Yêu cầu backend — notification lưu theo user, API frontend gọi được

> **Đã thay bằng emit phía server.** Không có `POST /notifications`. Contract đang dùng: [`FRONTEND_HANDOFF_NOTIFICATIONS.md`](./FRONTEND_HANDOFF_NOTIFICATIONS.md).

Ngày: 2026-10-14  
Module: `communication` · base `/api/v1/notifications`  
Liên quan: [`api/notifications.md`](./api/notifications.md), [`api/FRONTEND_HANDOFF_NOTIFICATIONS.md`](./api/FRONTEND_HANDOFF_NOTIFICATIONS.md)

## Việc frontend vừa làm

Mọi thao tác **tạo** thông báo chỉ nằm trong bộ nhớ trình duyệt đã gỡ. Reload là mất, user khác không thấy, và không khớp inbox trên server.

Đã xoá:

- `addNotifications` / `addNotification` (id dạng `n-…`, chỉ React state)
- Quét cảnh báo trên client (`scanOrderAlerts`: đơn quá hạn, VAT, giấy phép)
- Draft local khi tạo/gán đơn, tạo đề nghị chi, duyệt/từ chối chi

Inbox còn lại **chỉ đọc dữ liệu server**:

| Method | Path | Việc FE đang làm |
|--------|------|------------------|
| GET | `/notifications?page&pageSize` | Hydrate chuông + trang Thông báo |
| POST | `/notifications/:id/read` | Đánh dấu đã đọc (optimistic, lỗi thì bỏ qua) |

FE **chưa** gọi API tạo. Không có endpoint tạo trong contract hiện tại. Sau khi backend chốt contract bên dưới, FE sẽ gọi đúng path đó — không tự bịa.

## Cần backend

Mỗi thông báo là **một dòng cho đúng một user** (`recipientUserId`). Không broadcast cả tổ chức trong một record. `GET /notifications` của user A không được trả dòng của user B (giữ `notification.view_own`, lọc `recipientUserId = current user`).

Cần lưu DB (không chỉ cache request) và API frontend **gọi được** để tạo dòng đó.

### 1. Giữ API đã live

- `GET /notifications` — chỉ dòng của user đang đăng nhập. Query `page`, `pageSize`.
- `POST /notifications/:id/read` — set `readAt`. 403 nếu không phải recipient. 404 nếu id không tồn tại (FE bỏ qua).

### 2. API tạo — lưu và cho FE gọi

```
POST /api/v1/notifications
```

Quyền gợi ý: `notification.create` (user thường **không** tự gửi cho cả công ty; chỉ gửi cho danh sách recipient hợp lệ bên dưới).

Body:

```json
{
  "type": "task_assigned",
  "title": "Đơn DH-001 được giao cho bạn",
  "body": "Công ty A — Thành lập DN",
  "sourceType": "order",
  "sourceId": "<order uuid>",
  "href": "/orders/<order uuid>",
  "dedupeKey": "task_assigned:<order uuid>",
  "recipientUserIds": ["<user uuid>"]
}
```

Quy tắc server:

- `recipientUserIds` bắt buộc, tối thiểu 1 id. Mỗi id = **một row** `recipientUserId`.
- Bỏ qua id không tồn tại hoặc user không `ACTIVE`. Bỏ qua chính actor nếu rule loại đó cấm tự nhận (bảng dưới).
- `dedupeKey` unique cùng `(recipientUserId, dedupeKey)`. Trùng thì không insert lần hai, trả row cũ, **không** 500.
- Insert xong trả danh sách row đã lưu (kể cả row dedupe).
- `GET` sau đó của từng recipient phải thấy đúng row của họ.

Response 201 (mảng hoặc `{ items: Notification[] }`):

```json
{
  "items": [
    {
      "id": "<uuid server>",
      "recipientUserId": "<user uuid>",
      "type": "task_assigned",
      "title": "…",
      "body": "…",
      "readAt": null,
      "sourceType": "order",
      "sourceId": "<order uuid>",
      "href": "/orders/<order uuid>",
      "dedupeKey": "task_assigned:<order uuid>",
      "createdAt": "2026-10-14T05:00:00.000Z",
      "updatedAt": "2026-10-14T05:00:00.000Z"
    }
  ]
}
```

`type` phải nằm trong enum. Type lạ khiến FE map sai.

| `type` | Khi FE sẽ gọi | `recipientUserIds` | Không gửi |
|--------|----------------|--------------------|-----------|
| `task_assigned` | Sau `POST /orders` thành công và có phụ trách mới; sau `POST /orders/:id/assign` khi phụ trách đổi | `assignedUserId` mới | Assignee trống; assignee = actor (tự gán) |
| `expense_pending` | Sau `POST /expenses` ra `PENDING` | Mọi user `ACTIVE` có `expense.approve` | Chính `requestedByUserId`; user không ACTIVE |
| `expense_reviewed` | Sau `POST /expenses/:id/approve` hoặc `reject` thành công | `requestedByUserId` | Requester = reviewer |

`title` / `body` FE gửi tiếng Việt theo UI. Backend lưu nguyên văn, không ghi đè.

`href` để chuông bấm vào đúng màn (`/orders/:id` hoặc `/expense-approvals`).

### 3. Việc FE không gọi được — backend tự insert

Các loại này trước đây FE quét trong bộ nhớ lúc mở app. Đã xoá. Cần job server (gợi ý 07:00 `Asia/Ho_Chi_Minh`), mỗi recipient một row, dedupe theo ngày `(recipientUserId, dedupeKey)`.

| `type` | Điều kiện | Người nhận |
|--------|-----------|------------|
| `order_overdue` | Đơn quá hạn xử lý | Phụ trách đơn (`assignedUserId`) |
| `vat_deadline_approaching` | Sắp đến hạn xuất VAT | Phụ trách đơn |
| `vat_overdue` | Quá hạn VAT | Phụ trách đơn |
| `payment_overdue` | Kỳ thanh toán quá hạn | Phụ trách đơn |
| `license_expiring` | Giấy phép sắp hết hạn | Phụ trách đơn |

Các loại tùy chọn (chỉ khi product yêu cầu): `user_pending`, `user_approved`, `email_sent`, `email_failed`. Không gắn vào `POST /users` admin tạo staff đã ACTIVE, và không gắn `POST /reminders` (nhắc việc cá nhân là module khác).

## Không tạo notif

- `PATCH /orders/:id` (đổi giá/ghi chú). Đổi phụ trách đi `POST /orders/:id/assign`.
- `POST /orders/:id/change-stage`, `POST /orders/:id/approve`.

## Việc FE sẽ làm sau khi API tạo live

1. Sau assign / tạo đơn có phụ trách / tạo expense / duyệt expense thành công → `POST /notifications` với `recipientUserIds` đúng bảng trên.
2. Refetch `GET /notifications` (hoặc nhận `items` response) để chuông và trang Thông báo hiện row server.
3. Không còn id `n-…`. Mark-read chỉ gửi id server.

Cho đến lúc contract này có trên `https://apidyn.otcayxe.com/api/v1`, FE chỉ list + đánh dấu đã đọc.
