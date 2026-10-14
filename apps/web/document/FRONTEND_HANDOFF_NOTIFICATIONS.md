# Frontend handoff — inbox do server ghi (2026-10-14)

> Copy **§ Prompt**.  
> API: `https://apidyn.otcayxe.com/api/v1` · Contract: [`notifications.md`](./notifications.md)

## Khác request FE

Không có `POST /notifications`. Backend tự insert khi command nghiệp vụ thành công. FE không chọn recipient và không gửi title.

Lý do: user thường không liệt kê được ai có `expense.approve`; client cũng không được tự gửi notif cho người khác.

Job quá hạn (đơn, VAT, thanh toán, giấy phép) **chưa** có.

## FE làm gì

1. Giữ `GET /notifications` và `POST /notifications/:id/read`.
2. Sau `POST /orders`, `POST /orders/:id/assign`, `POST /expenses`, approve/reject expense → refetch inbox.
3. Không tạo id `n-…`. Không gọi API tạo notif.
4. Chuông dùng `href` (`/orders/:id` hoặc `/expense-approvals`). `type` chỉ `task_assigned` | `expense_pending` | `expense_reviewed`.

---

## § Prompt (copy)

```text
Bạn là Frontend lead (Next.js) của DYN CRM (CRM-DNY-UI).
Backend đã ghi inbox trên server. KHÔNG có POST /notifications.

Contract: docs/04-development/api/notifications.md
Handoff: docs/04-development/api/FRONTEND_HANDOFF_NOTIFICATIONS.md
API: https://apidyn.otcayxe.com/api/v1

## Giữ
- GET /notifications?page&pageSize — chỉ inbox user hiện tại (notification.view_own).
- POST /notifications/:id/read — 404 thì bỏ qua; 403 nếu không phải recipient.

## Bỏ
- Mọi lời gọi POST /notifications (không tồn tại).
- Id local dạng n-…
- Quét cảnh báo trên client (quá hạn đơn, VAT, giấy phép). Backend chưa có job đó.

## Sau command thành công, refetch GET /notifications
- POST /orders (nếu có phụ trách khác người tạo)
- POST /orders/:id/assign khi phụ trách đổi
- POST /expenses
- POST /expenses/:id/approve và reject

PATCH /orders, change-stage, approve order KHÔNG tạo notif.

## Type + href
- task_assigned → href /orders/{id} — người được giao (không tự gán)
- expense_pending → href /expense-approvals — user ACTIVE có expense.approve, trừ người tạo
- expense_reviewed → href /expense-approvals — người xin duyệt, trừ khi tự duyệt

Response thêm href và dedupeKey (nullable).

## Acceptance
- [ ] Tạo/gán đơn cho user khác → user đó GET thấy task_assigned; người tự gán không thấy row của chính mình.
- [ ] Tạo expense PENDING → user có expense.approve (khác requester) thấy expense_pending.
- [ ] Duyệt/từ chối → requester thấy expense_reviewed.
- [ ] Reload vẫn còn row. Mark-read dùng id server.
- [ ] Không còn scanner client cho overdue/VAT/license.
```
