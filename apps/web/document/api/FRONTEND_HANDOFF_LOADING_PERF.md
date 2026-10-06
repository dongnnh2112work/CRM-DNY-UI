# Frontend handoff — BE đã ship hydrate names + order detail (2026-10-06)

> Copy từ BE. FE đã adapt (xem § FE status).  
> API prod: `https://apidyn.otcayxe.com/api/v1`

## Đã ship trên BE

1. **List/detail hydrate display names** (batch JOIN, không cần N+1):
   - `GET /orders`, `GET /orders/:id` → `customerName`, `serviceName`, `assignedUserName`, `submitterName`, `reviewerName`, `collaboratorName`
   - `GET /expenses` → `requestedByName`, `reviewedByName`, `orderNumber`
   - `GET /payments` → `orderNumber`, `customerId`, `customerName`
2. **Payment schedule empty = 200** (không còn 404):  
   `GET /orders/:orderId/payment-schedule` → `{ id: null, orderId, lines: [], empty: true, … }`
3. **Aggregate chi tiết đơn:** `GET /orders/:id/detail`  
   → `{ order, paymentSchedule, payments, expenses, documents }`
4. `commissionPercent` trên Order đã có (persist POST/PATCH/GET).

`GET /users` đã trả `roleCodes` — không cần N× `GET /users/:id` chỉ để lấy role.

## FE status (CRM-DNY-UI)

- [x] Types `ApiOrder` / `ApiExpense` / `ApiPayment` + `ApiOrderDetail`
- [x] `resolveEntityLookups` chỉ gọi khi field *Name còn thiếu / UUID
- [x] `/orders/:id` primary `GET .../detail`; fallback get+finance nếu detail 404
- [x] `unwrapSchedule` đọc `lines` / `empty`; không coi 404 là empty
- [x] Map UI ưu tiên *Name trước lookup

## Acceptance

- [ ] `/orders` pageSize=20: 0 call `GET /customers/:id` / `GET /users/:id` chỉ để lấy tên
- [ ] User không `user.manage` vẫn thấy `assignedUserName`
- [ ] `/orders/:id`: critical path 1× `.../detail`
- [ ] Order chưa có schedule: không spam 404
