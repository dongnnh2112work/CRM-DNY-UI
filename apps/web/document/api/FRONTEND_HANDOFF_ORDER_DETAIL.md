# Frontend handoff — Order Detail aggregate API (optimize)

> Dành cho **backend execution**.  
> Mục tiêu: **1 request** khi mở chi tiết đơn (`/orders/:id`) vẫn đủ data cho **đơn lẻ** và **đơn gộp nhiều dịch vụ cùng HĐ**.  
> Mọi **tính toán** (tổng HĐ, đã thu / còn lại, status, chia thu theo dịch vụ, cashflow theo tháng) thực hiện ở **backend**. FE chỉ render.

Liên quan:

- Orders: [`orders.md`](./orders.md)
- Payments: [`payments.md`](./payments.md)
- Expenses: [`expenses.md`](./expenses.md)
- Documents: [`documents.md`](./documents.md) · [`FRONTEND_HANDOFF_DOCUMENTS.md`](./FRONTEND_HANDOFF_DOCUMENTS.md)
- Contracts: [`contracts.md`](./contracts.md)

Base API: `/api/v1` · Prod FE: CRM UI · API: `https://apidyn.otcayxe.com/api/v1`

---

## 1. Context — vì sao cần API này

### 1.1 Mô hình nghiệp vụ hiện tại (FE đã ship)

- Backend vẫn **1 order = 1 service**.
- FE tạo **nhiều order** cùng `contractId` (HĐ chung):
  - Primary: `DNY260913`
  - Sibling: `DNY260913-1`, `DNY260913-2`, …
- **Thanh toán chung cả HĐ** (1 payment record / nhóm), không tách từng dịch vụ trên UI thanh toán.
- **Chi phí (expenses)** vẫn theo **từng `orderId`** (đơn đang mở).
- Trang chi tiết cần: thông tin đơn + siblings HĐ + payment HĐ + expenses + documents + cashflow thu/chi.

### 1.2 Pain hiện tại (đã đo trên FE)

Khi user click 1 đơn trong **Quản lý đơn hàng**, FE phải gọi nhiều API:

| Call | Vấn đề |
|------|--------|
| `GET /orders/:id` | OK |
| `GET /documents?orderId=` | OK |
| `GET /payments?orderId=` × mỗi sibling | N+1 |
| `GET /orders/:siblingId/payment-schedule` × mỗi sibling | N+1; nhiều case **404** vẫn tốn RTT |
| `GET /expenses?orderId=` | OK |

Với HĐ **4 dịch vụ** ≈ **9–13** finance/detail calls; HĐ **~13–14** dịch vụ ≈ **~30** request → UI lag mạnh (API Railway ~2–5s/request + waterfall).

FE đã giảm tạm (chỉ fetch primary + UI trước finance). **Endpoint aggregate này là hướng tối ưu đúng** (1 RTT, tính đúng ở BE).

### 1.3 Nguyên tắc optimize (bắt buộc khi design)

1. **1 round-trip** cho first paint trang chi tiết.
2. **Không N+1** theo số sibling trong response path (JOIN / batch trong BE).
3. **Resolve tên** (customer / service / user) trong response — FE không phụ thuộc catalog lúc mở detail.
4. **Tính sẵn số liệu hiển thị** — FE không `Σ`, không chia tỷ lệ, không suy status.
5. **404 schedule** không lộ ra FE: trả `installments: []`.
6. Endpoint **không thay** list `GET /orders` (pagination giữ nguyên).

---

## 2. Endpoint yêu cầu

### 2.1 Spec

| | |
|--|--|
| Method / Path | `GET /api/v1/orders/:id/detail` |
| Permission | Giống `GET /orders/:id` → `order.view` + scope OWN/ALL hiện có |
| Auth | Bearer (giống các API CRM khác) |
| `:id` | UUID của **bất kỳ** order trong nhóm (primary hoặc sibling) |
| Success | `200` + body dưới đây |
| Not found / ngoài scope | `404` hoặc `403` (giống get order hiện tại) |

**Không** bắt buộc query params ở v1. Nếu cần mở rộng sau:

| Query (optional, sau này) | Mặc định |
|---------------------------|----------|
| `includeDocuments=true` | true |
| `includeExpenses=true` | true |

v1: **luôn include đủ** các block trong §3.

### 2.2 Idempotent / cache (khuyến nghị BE)

- Response có thể gắn `ETag` / `Cache-Control: private, max-age=15` (ngắn) — FE vẫn có thể ignore.
- Không cache lâu phía CDN public (có PII / money).

---

## 3. Response contract

Decimals: **string** (đồng bộ orders/payments hiện tại) **hoặc** number nhất quán trong toàn response — chọn 1 và ghi rõ Swagger. FE ưu tiên **string** như API hiện có.

```ts
type Money = string; // VND, decimal string e.g. "10000000"
type IsoDate = string; // YYYY-MM-DD
type IsoDateTime = string;

type PaymentUiStatus = "unpaid" | "partial" | "paid" | "overdue";
type InstallmentUiStatus = "pending" | "paid" | "overdue";

interface OrderDetailResponse {
  order: OrderDetailOrder;
  contractGroup: ContractGroupSummary;
  payment: ContractPaymentSummary;
  cashflow: OrderCashflowSummary;
  expenses: ExpenseLine[];
  documents: DocumentsBundle;
  meta?: OrderDetailMeta;
}
```

### 3.1 `order` — đơn đang mở (`:id`)

Giống payload `GET /orders/:id` **và** đã hydrate display names:

| Field | Bắt buộc | Nguồn / note |
|-------|----------|--------------|
| `id` | ✅ | |
| `orderNumber` | ✅ | |
| `contractId` | ✅ (nullable nếu chưa gắn HĐ) | |
| `customerId` | ✅ | |
| `customerName` | ✅ | JOIN customers |
| `serviceId` | ✅ | |
| `serviceName` | ✅ | JOIN services |
| `stage` | ✅ | |
| `channel` | ✅ | |
| `value` | ✅ | Money |
| `totalNet`, `vatRate`, `totalGross`, `currency` | ✅ | như orders API |
| `collaboratorId` | | |
| `collaboratorName` | | nếu có CTV |
| `collaboratorPrice` | | |
| `assignedUserId` | ✅ | |
| `assignedUserName` | ✅ | |
| `submitterUserId` | ✅ | |
| `submitterName` | ✅ | |
| `reviewerUserId` | | |
| `reviewerName` | | |
| `approvalStatus` | ✅ | |
| `notes` | | |
| `contractNumber` | | từ bảng contracts nếu có |
| `createdAt`, `updatedAt` | ✅ | |

Optional nếu BE đã lưu trên order / extension: `deadline`, `needsVat`, `commissionPercent`, `zaloGroupUrl`, `vatIssueDeadline`.

### 3.2 `contractGroup` — nhóm dịch vụ cùng HĐ

**Luôn có.** Đơn lẻ = 1 phần tử trong `lines`.

| Field | Bắt buộc | Cách tính / rule |
|-------|----------|------------------|
| `contractId` | | `order.contractId` (null nếu chưa có) |
| `primaryOrderId` | ✅ | Order trong nhóm có `orderNumber` **không** match suffix `-[1-9][0-9]*`; fallback order nhỏ nhất theo `orderNumber` |
| `groupTotal` | ✅ | `Σ value` mọi order cùng `contractId`. Nếu không có `contractId` → = `order.value` |
| `serviceCount` | ✅ | `lines.length` |
| `lines[]` | ✅ | Mọi order cùng `contractId`, sort `orderNumber` numeric. Nếu không `contractId` → chỉ `[order]` |
| `nextOrderNumber` | khuyến nghị | Mã gợi ý thêm dịch vụ: `{base}-N` (N nhỏ nhất chưa dùng). Base = primary `orderNumber` bỏ suffix child |

Mỗi phần tử `lines[]`:

| Field | Bắt buộc |
|-------|----------|
| `id` | ✅ |
| `orderNumber` | ✅ |
| `serviceId` | ✅ |
| `serviceName` | ✅ |
| `value` | ✅ Money |
| `stage` | ✅ |
| `assignedUserId` | |
| `assignedUserName` | |
| `isCurrent` | ✅ `true` khi `id === :id` |

**Nhóm theo:** `contractId` (không group theo customer).  
Order không `contractId` = nhóm 1 phần tử (chính nó).

### 3.3 `payment` — thanh toán **chung cả HĐ** (BE tính)

Một object / nhóm HĐ. Không trả N payment theo từng sibling.

| Field | Bắt buộc | Cách tính |
|-------|----------|-----------|
| `id` | ✅ | ID ổn định FE deep-link được. Đề xuất: UUID thật nếu có bảng aggregate; hoặc `pay-{primaryOrderId}` (FE đang dùng pattern này) |
| `primaryOrderId` | ✅ | |
| `groupedOrderIds` | ✅ | `lines[].id` |
| `totalAmount` | ✅ | **Ưu tiên** = `contractGroup.groupTotal`. Nếu business gắn schedule bắt buộc: max(groupTotal, Σ schedule lines) — **document rõ** trong Swagger |
| `paidAmount` | ✅ | Σ amount các payment `verificationStatus = VERIFIED` thuộc **mọi** `orderId` trong `groupedOrderIds` |
| `remaining` | ✅ | `max(0, totalAmount - paidAmount)` |
| `status` | ✅ | xem §4.1 |
| `installments[]` | ✅ | xem §4.2; không có schedule → `[]` (không 404) |
| `shareForCurrent` | ✅ | phần thu phân bổ cho **đơn `:id`** — xem §4.3 |

Mỗi `installments[]`:

| Field | Bắt buộc |
|-------|----------|
| `id` | ✅ payment id hoặc schedule line id |
| `amount` | ✅ Money |
| `dueDate` | ✅ IsoDate |
| `paidDate` | | IsoDate khi đã VERIFIED |
| `method` | | `CASH` \| `BANK_TRANSFER` \| `QR_PAYMENT` |
| `status` | ✅ `pending` \| `paid` \| `overdue` |

### 3.4 `cashflow` — tab Thu chi (BE tính)

Scope mặc định: **đơn đang mở** (`:id`), không gộp chi cả HĐ.

| Field | Bắt buộc | Cách tính |
|-------|----------|-----------|
| `scope` | ✅ | luôn `"order"` ở v1 |
| `totalThu` | ✅ | = `payment.shareForCurrent.paidAmount` (hoặc thu đã verify phân bổ) |
| `totalChiApproved` | ✅ | Σ `expenses` của `:id` có status đã duyệt (map từ `APPROVED` / tương đương FE `approved`) |
| `net` | ✅ | `totalThu - totalChiApproved` |
| `byMonth[]` | ✅ | gộp theo `YYYY-MM` từ (1) installment paidDate / recordedAt đã verify phân bổ + (2) expense approved date. Mỗi phần tử: `{ month, thu, chi, net }` |

Nếu tháng không có phát sinh → **không** bắt buộc trả tháng rỗng (FE đang empty-state).

### 3.5 `expenses[]` — đề nghị thanh toán của đơn `:id`

Chỉ expenses thuộc `orderId = :id` (không kéo sibling).

| Field | Bắt buộc |
|-------|----------|
| `id` | ✅ |
| `title` / nội dung | ✅ |
| `amount` | ✅ Money |
| `status` | ✅ enum BE hiện tại + map FE nếu khác tên |
| `payeeName` | |
| `bankAccount` | |
| `bankName` | |
| `requestedByUserId` | ✅ |
| `requestedByName` | ✅ |
| `reviewedByUserId` | |
| `reviewedByName` | |
| `createdAt` | ✅ |

### 3.6 `documents`

| Field | Bắt buộc |
|-------|----------|
| `work[]` | ✅ hồ sơ làm việc (non-license) |
| `licenses[]` | ✅ giấy phép final |
| `counts.work` | ✅ |
| `counts.licenses` | ✅ |

Mỗi document (tối thiểu):

| Field | Bắt buộc |
|-------|----------|
| `id` | ✅ |
| `fileName` | ✅ |
| `url` hoặc path download được | ✅ |
| `uploadedByUserId` | |
| `uploadedByName` | |
| `uploadedAt` / `createdAt` | ✅ |
| `kind` hoặc flag license | ✅ để FE tách tab |

Chỉ documents của **`:id`**, không merge cả HĐ (trừ khi product đổi — v1 không merge).

### 3.7 `meta` (optional v1)

| Field | |
|-------|--|
| `canCreateVat` | rule VAT hiện tại (có HĐ số, needsVat, …) |
| `licenseSummary` | `{ status: "none"\|"ok"\|"warn"\|"expired", expiryDate?: IsoDate }` nếu BE muốn — không bắt buộc nếu FE tự tính từ licenses |

---

## 4. Quy tắc tính toán (BE phải implement)

### 4.1 `payment.status`

```
if totalAmount <= 0 → unpaid
if paidAmount <= 0 → overdue nếu có installment overdue; else unpaid
if paidAmount >= totalAmount → paid
else → overdue nếu có đợt quá hạn chưa paid; else partial
```

**Overdue installment:** `status != paid` và `dueDate < today (Asia/Ho_Chi_Minh)`.

### 4.2 Build `installments[]`

1. Lấy payment-schedule của **primary** (và/hoặc mọi sibling nếu BE lưu schedule phân tán — **ưu tiên gộp về primary**).
2. Match payment rows qua `scheduleLineId` khi có.
3. Payment VERIFIED không dính schedule → thêm installment `paid`.
4. Payment VOIDED → bỏ.
5. Không có schedule → chỉ từ payment rows; hoặc `[]` nếu chưa thu.

**Không** trả HTTP 404 cho “schedule not found” ở endpoint detail — luôn `installments: []`.

### 4.3 `shareForCurrent` (chia thu theo giá trị dịch vụ)

Input: `payment` cấp HĐ + `lines` + đơn hiện tại `C`.

```
groupTotal = Σ lines.value
nếu n=1 hoặc groupTotal=0:
  share = toàn bộ payment (total/paid/remaining/installments) gắn order C
ngược lại:
  share_i = value_i / groupTotal
  totalAmount_i = round(payment.totalAmount * share_i)
  mỗi installment.amount_i = round(inst.amount * share_i)
  phần dư round-off → cộng vào **line cuối** (sort orderNumber) để Σ shares = payment.totalAmount
  paidAmount_i / remaining_i tính lại từ installments đã chia (hoặc tỷ lệ tương ứng)
```

FE hiện dùng logic này trong `allocatePaymentShare` — BE phải **tương đương** để số trên tab Thu chi khớp trang Thanh toán.

### 4.4 `paidAmount` nguồn payment

- Chỉ `verificationStatus = VERIFIED`.
- Aggregate **mọi** `orderId ∈ groupedOrderIds` (tránh sót payment gắn nhầm sibling).

### 4.5 Quyền & scope

- Nếu user OWN-scope chỉ xem được 1 sibling nhưng không xem primary: vẫn trả detail nếu `:id` in scope; `contractGroup.lines` **chỉ gồm** các order user được phép xem **hoặc** trả đủ group nếu policy HĐ là “thấy 1 thấy cả” — **BE chọn 1 policy và ghi Swagger**.  
  **Đề xuất:** thấy được 1 order trong HĐ → được xem **cả** `contractGroup` + payment HĐ (cần để UI “4 dịch vụ / còn lại” đúng). Expenses/documents vẫn chỉ `:id`.

---

## 5. Ví dụ response (rút gọn)

`GET /orders/be1c083a-.../detail` (primary DNY260913, 4 dịch vụ):

```json
{
  "order": {
    "id": "be1c083a-991a-4f60-a3e0-3ace5c530ca5",
    "orderNumber": "DNY260913",
    "contractId": "a13a2efd-ce6c-40ae-bbc6-fb252bc6a10c",
    "customerId": "4da529c3-072d-4fee-a78d-233425435fe8",
    "customerName": "Ngọc Hải Đông Nguyễn",
    "serviceId": "4489defd-e8c3-4e26-81be-dee69e20f927",
    "serviceName": "ỚT CAY XÈ - ACB",
    "stage": "new",
    "value": "10000000",
    "assignedUserId": "1abdb2cd-7954-4e77-9db7-3656aae98ae4",
    "assignedUserName": "Kim Ngân",
    "submitterUserId": "1abdb2cd-7954-4e77-9db7-3656aae98ae4",
    "submitterName": "Kim Ngân",
    "createdAt": "2026-09-19T09:17:44.633Z",
    "updatedAt": "2026-09-19T09:17:44.633Z"
  },
  "contractGroup": {
    "contractId": "a13a2efd-ce6c-40ae-bbc6-fb252bc6a10c",
    "primaryOrderId": "be1c083a-991a-4f60-a3e0-3ace5c530ca5",
    "groupTotal": "43100000",
    "serviceCount": 4,
    "nextOrderNumber": "DNY260913-4",
    "lines": [
      {
        "id": "be1c083a-991a-4f60-a3e0-3ace5c530ca5",
        "orderNumber": "DNY260913",
        "serviceName": "ỚT CAY XÈ - ACB",
        "value": "10000000",
        "stage": "new",
        "isCurrent": true
      },
      {
        "id": "95dff3be-4c20-4288-bcde-f816b3f671c5",
        "orderNumber": "DNY260913-1",
        "serviceName": "Tư vấn pháp lý doanh nghiệp",
        "value": "30000000",
        "stage": "new",
        "isCurrent": false
      }
    ]
  },
  "payment": {
    "id": "pay-be1c083a-991a-4f60-a3e0-3ace5c530ca5",
    "primaryOrderId": "be1c083a-991a-4f60-a3e0-3ace5c530ca5",
    "groupedOrderIds": ["be1c083a-...", "95dff3be-...", "a41b3f00-...", "d2a49365-..."],
    "totalAmount": "43100000",
    "paidAmount": "0",
    "remaining": "43100000",
    "status": "unpaid",
    "installments": [],
    "shareForCurrent": {
      "totalAmount": "10000000",
      "paidAmount": "0",
      "remaining": "10000000",
      "installments": []
    }
  },
  "cashflow": {
    "scope": "order",
    "totalThu": "0",
    "totalChiApproved": "0",
    "net": "0",
    "byMonth": []
  },
  "expenses": [],
  "documents": {
    "work": [],
    "licenses": [],
    "counts": { "work": 0, "licenses": 0 }
  }
}
```

---

## 6. Acceptance criteria (BE checklist)

- [ ] `GET /orders/:id/detail` trả **một** JSON đủ 6 block: `order`, `contractGroup`, `payment`, `cashflow`, `expenses`, `documents`.
- [ ] Mở primary hoặc sibling **cùng HĐ** → `contractGroup.serviceCount` và `groupTotal` giống nhau; chỉ `isCurrent` / `shareForCurrent` đổi theo `:id`.
- [ ] HĐ 4+ dịch vụ: **không** phát sinh N query tuần tự kiểu “per sibling schedule” ra ngoài (batch/JOIN trong service).
- [ ] Không có schedule → `installments: []`, HTTP 200 (không 404).
- [ ] `payment.paidAmount` / `remaining` / `status` khớp số liệu nếu gọi rời `GET /payments` + verify rules.
- [ ] `shareForCurrent`: Σ `totalAmount` mọi sibling (nếu gọi detail lần lượt) ≈ `payment.totalAmount` (sai số round ≤ 1 VND × (n-1) chấp nhận nếu document).
- [ ] `customerName` / `serviceName` / user names luôn có (không trả raw UUID cho FE phải tự map).
- [ ] Permission/scope không lộ order ngoài quyền; policy nhóm HĐ đã chọn được document.
- [ ] Swagger cập nhật + example.
- [ ] P95 latency mục tiêu: **&lt; 500ms** trên dataset vừa (sau index); tránh N+1 SQL.

### Index / query gợi ý

- `orders(contract_id)`
- `payments(order_id)`, `payments(verification_status)`
- `expenses(order_id)`
- `documents(order_id)`
- payment_schedule theo `order_id`

---

## 7. Non-goals (không làm trong ticket này)

- Không đổi `GET /orders` list / kanban.
- Không bắt buộc gộp expenses cả HĐ.
- Không thay POST tạo payment / expense / document (mutation giữ endpoint cũ).
- Không yêu cầu GraphQL.
- Không bắt FE chờ endpoint này để ship hotfix (FE đã có P0 tạm).

---

## 8. FE integration (sau khi BE ready)

1. Thay boot trang `orders/[id]`: **1×** `GET /orders/:id/detail`.
2. Bỏ waterfall `reloadOrderFinance` + documents list riêng trên đường mở detail.
3. Map `payment` / `shareForCurrent` / `cashflow` thẳng vào store hoặc local state.
4. Giữ mutation API cũ; sau mutate → `GET .../detail` lại (hoặc invalidate).

Liên hệ FE: file trang [`apps/web/src/app/(dashboard)/orders/[id]/page.tsx`](../../src/app/(dashboard)/orders/[id]/page.tsx), helpers [`order-group.ts`](../../src/lib/order-group.ts).

---

## 9. Ưu tiên deliver

| Priority | Deliverable |
|----------|-------------|
| P0 | `GET /orders/:id/detail` với `order` + `contractGroup` + `payment` (kèm `shareForCurrent`) + `expenses` + `documents` |
| P0 | Rules §4.1–4.4 + không 404 schedule |
| P1 | `cashflow.byMonth` đầy đủ |
| P1 | `nextOrderNumber`, `meta.canCreateVat` / licenseSummary |
| P2 | ETag / short private cache |

**Done khi:** FE mở đơn gộp 4+ dịch vụ chỉ cần **1** call detail và số “còn lại / tổng HĐ / tab thu chi” khớp trang Thanh toán.
