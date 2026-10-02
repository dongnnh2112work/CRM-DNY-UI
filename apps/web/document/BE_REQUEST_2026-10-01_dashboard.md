# BE request — 2026-10-01

Gửi BE: request FE hôm nay (dashboard speed + bug Phân quyền).  
Không thay `BACKEND_GAPS.md` — file này chỉ để handoff hôm nay.

**Nội dung:**
1. Dashboard summary (perf)
2. Filter `from`/`to` payments (optional)
3. **Bug: `PUT /roles/:id/permission-groups` không persist (prod)**
4. **Order detail finance — payments chậm / schedule 404 (prod)**

---

## Bối cảnh FE

Sau login / reload, user vào `/dashboard`. Hiện FE phải gọi:

| Call | Mục đích |
|------|----------|
| `GET /auth/me` | Quyền + session |
| `GET /orders?page=1&pageSize=20` | `total` + đơn gần đây |
| `GET /payments?page=1&pageSize=20` | `total` + thanh toán sắp tới |
| `GET /customers?page=1&pageSize=1` | Chỉ lấy `total` |

Đo trên prod API (Railway): mỗi call ~2.5–3s → cards sẵn ~5–6s sau `me`.  
Doanh thu tháng / biểu đồ FE **không** cộng từ preview 20 dòng (sai số). Chỉ hiện khi `loaded >= total`, hoặc khi có summary từ BE.

`GET /widgeto/summary` **không dùng được**: auth bằng shared secret, bỏ qua RBAC, không đưa secret xuống browser.

---

## Request 1 (ưu tiên) — `GET /api/v1/dashboard/summary`

### Auth

- Header: `Authorization: Bearer <accessToken>` (cùng JWT với các API CRM khác).
- **Không** dùng shared secret / API key kiểu widgeto.

### Authorization

- Tôn trọng **RBAC** + **data scope** của user đang login (`OWN` / `TEAM` / `ALL`), giống list orders / customers / payments.
- User thiếu quyền xem entity nào thì field tương ứng = `0` / `[]`, **không** 403 cả response nếu vẫn xem được dashboard (hoặc 403 nếu không có quyền dashboard — BE chọn một convention và ghi rõ).

### Response (tối thiểu)

```json
{
  "orderTotal": 0,
  "customerTotal": 1,
  "paymentTotal": 4,
  "revenueThisMonth": 0,
  "revenueByMonth": [
    { "month": "2026-01", "value": 0 }
  ],
  "ordersByStage": [
    { "stage": "draft", "count": 0 }
  ]
}
```

| Field | Ý nghĩa |
|-------|---------|
| `orderTotal` | Tổng đơn trong scope user (card “Tổng đơn hàng”) |
| `customerTotal` | Tổng khách trong scope |
| `paymentTotal` | Tổng bản ghi thanh toán trong scope (optional nếu FE không cần card) |
| `revenueThisMonth` | Doanh thu tháng hiện tại (theo định nghĩa BE — ghi rõ: verified only? timezone?) |
| `revenueByMonth` | Chuỗi 6–12 tháng gần nhất cho chart |
| `ordersByStage` | Đếm theo stage/status cho pie chart |

Timezone / quy ước “tháng này”: ghi trong response docs (vd. `Asia/Ho_Chi_Minh`).

### FE sẽ làm gì khi có endpoint

1. Login/reload dashboard: `auth/me` + **`dashboard/summary`** (song song với `config` nếu cần).
2. Bỏ 3 list call trên critical path của cards / charts.
3. Preview “đơn gần đây” / “thanh toán sắp tới”: lazy `pageSize=20` **sau** khi cards đã hiện (hoặc song song không chặn summary).

---

## Request 2 (optional, cùng đợt nếu tiện) — filter `from` / `to` trên payments

`GET /api/v1/payments?from=<ISO>&to=<ISO>` (và giữ các filter hiện có).

Giúp FE lọc doanh thu theo khoảng ngày mà không kéo full list khi chưa có (hoặc bổ sung) summary.

---

## Request 3 (bug prod) — `PUT /roles/:id/permission-groups` không ghi DB

### Hiện tượng (đã reproduce trên prod)

1. Admin mở **Phân quyền** (`/users/permissions`) hoặc modal **Nhóm quyền** trên role.
2. Tick / bỏ tick nhóm quyền → **Lưu**.
3. `PUT /api/v1/roles/:id/permission-groups` trả **200** và body echo đúng `permissionGroupCodes` gửi lên.
4. Ngay sau đó (hoặc F5): `GET /api/v1/roles/:id` → `permissionGroupCodes` / `permissionGroups` **vẫn cũ** (thường `[]` hoặc danh sách trước khi sửa).
5. User `/auth/me.permissions` **không đổi** sau khi gán lại group cho role của họ.

FE trước đây tin echo của PUT → toast success giả. Hiện FE **chỉ** coi là thành công khi `GET /roles/:id` khớp đúng codes vừa gửi; nếu không khớp → toast lỗi `roleGroupsNotPersisted`, không báo success.

### Endpoint liên quan

| Method | Path | Body |
|--------|------|------|
| `PUT` | `/api/v1/roles/:id/permission-groups` | `{ "permissionGroupCodes": ["sales.core", ...] }` — **replace toàn bộ** danh sách group của role |
| `GET` | `/api/v1/roles/:id` | Phải trả `permissionGroupCodes` và/hoặc `permissionGroups` **sau khi persist** |

Quyền: `role.manage` (Bearer JWT admin).

### BE cần sửa

1. **Persist thật** quan hệ Role ↔ PermissionGroup khi `PUT .../permission-groups` (transaction commit trước khi trả 200).
2. Response PUT nên phản ánh **state đã lưu** (hoặc FE sẽ ignore body PUT và chỉ tin GET).
3. `GET /roles/:id` và `GET /roles` (nếu list có field groups) phải đọc cùng nguồn đã persist — không cache stale / không bỏ qua join table.
4. Sau khi group của role đổi, user đang gắn role đó: lần `GET /auth/me` kế tiếp phải có `permissions` union mới từ các groups (có thể cần invalidate cache permission nếu BE cache theo role).

### Không nhầm với

- Ma trận trang UI (`crm.pagePermissions` / config) — đó là UX menu, **không** thay RBAC thật.
- `PUT /users/:id/roles` — gán **role cho user**, khác với gán **group cho role**.

### Acceptance

1. `PUT /roles/:id/permission-groups` với `["A","B"]` → 200.
2. Ngay lập tức `GET /roles/:id` → `permissionGroupCodes` chứa đúng `A`, `B` (order không bắt buộc, so sánh set).
3. Reload trang Phân quyền → checkbox khớp `A`, `B`.
4. User có role đó: `GET /auth/me` → `permissions` gồm union quyền của group A+B (trừ khi status user không ACTIVE).
5. `PUT` với `[]` → gỡ hết group; GET confirm `[]`.

### Gợi ý debug phía BE

- PUT 200 nhưng GET cũ → thường: quên `save`/`commit`, ghi nhầm table, soft-delete join, hoặc GET đọc DTO không map relation.
- So sánh DB join table trước/sau PUT trên môi trường prod/staging.

---

## Request 4 (perf prod) — Order detail finance: payments chậm + `payment-schedule` 404

### Hiện tượng (đã đo trên prod — tab **Thu chi** `/orders/:id`)

| Call | Payload | Thời gian (Railway) |
|------|---------|---------------------|
| `GET /payments?orderId=<primary>&page=1&pageSize=100` | ~0.5 kB / 200 hoặc 304 | **~3.3–3.5s** |
| `GET /orders/:id/payment-schedule` | **404** Not Found | **~3.3–3.4s** (vẫn full RTT) |
| `GET /expenses?orderId=` | nhỏ | **~2.7–3s** |
| `GET /documents?orderId=` | nhỏ | **~3.3s** |

Payload nhỏ / 404 mà vẫn ~3s → **không phải FE tính toán chậm**. Bottleneck = **latency từng request BE** (+ waterfall FE: boot order/docs xong mới gọi finance).

### Cách FE đang gọi (đã tối ưu tạm)

Khi mở chi tiết đơn:

1. **Boot:** `GET /orders/:id` + `GET /documents?orderId=` (song song).
2. **Finance (sau boot):** song song 3 call trên **primary** của nhóm HĐ (không fan-out mọi sibling nữa):
   - `GET /payments?orderId=<primaryId>&page=1&pageSize=100`
   - `GET /orders/<primaryId>/payment-schedule` — 404 được FE nuốt → coi như `installments: []`
   - `GET /expenses?orderId=<order đang mở>` (chi phí theo đơn đang xem, không theo cả HĐ)

Mô hình nghiệp vụ: **1 order API = 1 service**; nhiều order cùng `contractId` = 1 HĐ; **thanh toán chung HĐ** (gắn primary); expenses theo từng `orderId`.

Pain còn lại dù đã bỏ N+1 sibling:

- Vẫn **3–4 RTT tuần tự/chồng** × ~3s → Thu chi cảm nhận ~6–10s.
- `payment-schedule` **404** khi chưa có lịch = anti-pattern: FE bắt buộc gọi, BE vẫn tốn full round-trip thay vì `200` + list rỗng.

### Hướng call / xử lý phía BE (ưu tiên)

#### A. Endpoint aggregate (đúng hướng dài hạn)

```http
GET /api/v1/orders/:id/detail
Authorization: Bearer <accessToken>
```

- Quyền / scope: giống `GET /orders/:id` (`order.view` + OWN/TEAM/ALL).
- `:id` = UUID **bất kỳ** order trong nhóm (primary hoặc sibling) — BE tự resolve nhóm HĐ.
- **1 RTT** trả đủ first paint chi tiết + Thu chi (order hydrated names + contract group + payment HĐ + cashflow + expenses + documents).

FE sẽ: bỏ chuỗi `payments` + `payment-schedule` + `expenses` (+ ideally `documents`) trên critical path khi có endpoint này.

Contract đầy đủ: [`api/FRONTEND_HANDOFF_ORDER_DETAIL.md`](./api/FRONTEND_HANDOFF_ORDER_DETAIL.md).

#### B. Xử lý `payment-schedule` (làm ngay, kể cả chưa có aggregate)

| Trường hợp | Hiện tại | BE nên trả |
|------------|----------|------------|
| Chưa tạo lịch thanh toán | **404** + ~3s | **200** + `{ "items": [] }` (hoặc `installments: []`) |
| Có lịch | 200 + lines | Giữ nguyên |
| Order không tồn tại / ngoài scope | 404 / 403 | Giữ (chỉ khi **order** invalid, không phải “chưa có schedule”) |

Không bắt FE gọi schedule nếu aggregate đã nhúng payment; nếu giữ endpoint riêng thì **không 404 vì empty**.

#### C. Perf từng list (payments / expenses / documents theo `orderId`)

1. Index / query path theo `orderId` — list filtered không full-scan.
2. `pageSize` nhỏ (20) đủ cho 1 đơn; FE hiện gửi 100 vì sợ thiếu trang — BE nhanh thì FE hạ xuống.
3. Tránh cold-path nặng (N+1 query, thiếu index) — 0.5 kB mà 3.5s là tín hiệu query/connection, không phải serialize JSON.
4. Optional ngắn hạn: `Cache-Control: private, max-age=15` / `ETag` cho GET theo `orderId` (PII — không CDN public).

#### D. Tính sẵn số liệu trên aggregate (FE không Σ)

Trong block `payment` / `cashflow` của `GET /orders/:id/detail`:

- `totalAmount`, `paidAmount`, `remaining`, `status` (unpaid/partial/paid/overdue) cho **cả HĐ**.
- `installments[]` đã merge schedule line + payment verify/void (thiếu schedule → `[]`, vẫn có payment ad-hoc nếu có).
- `cashflow`: tổng thu (verified), tổng chi (approved) của đơn đang mở / theo convention đã ghi trong handoff — FE chỉ render.

### Acceptance (Request 4)

**Ngắn hạn (schedule empty)**  
1. Order chưa có schedule → `GET .../payment-schedule` = **200** + items rỗng (không 404).  
2. Thời gian p95 prod cho call này và `GET /payments?orderId=` nên **≪ 3s** (target nội bộ BE: &lt; 500ms khi DB ấm).

**Dài hạn (aggregate)**  
3. `GET /orders/:id/detail` 200 với đủ block order + payment + expenses + documents (+ cashflow).  
4. FE mở `/orders/:id` tab Thu chi: **1** finance round-trip (hoặc gộp trong detail), không cần N call payments/schedule/expenses.  
5. Số liệu Thu chi (tổng thu / chi / chênh lệch) khớp nếu gọi rời các API cũ (regression).

### Không làm / tránh (Request 4)

- Không bắt FE N+1 `payments` / `payment-schedule` theo từng sibling.
- Không dùng 404 để diễn đạt “chưa có schedule”.
- Không đưa shared secret / bỏ RBAC trên endpoint detail.

---

## Không làm / tránh

- Không yêu cầu FE nhúng secret widgeto.
- Không trả data ngoài data-scope của user.
- Không bắt FE phải load full catalog để ra KPI.
- Không coi body echo của PUT là nguồn sự thật nếu chưa persist (FE đã verify bằng GET).
- Không 404 `payment-schedule` khi order hợp lệ nhưng chưa có lịch (xem Request 4).

---

## Acceptance nhanh (tổng)

**Dashboard**
1. Sales login → `GET /dashboard/summary` 200, số khớp list scoped của Sales.
2. Super Admin → totals khớp scope admin.
3. FE: sau `me`, cards hiện sau **1** round-trip summary.

**Phân quyền**
4. `PUT` group → `GET` role khớp; reload UI không mất tick.
5. `/auth/me` của user thuộc role đó phản ánh permission mới.

**Order detail finance**
6. Schedule trống → 200 + `[]` (không 404).
7. (Khi có) `GET /orders/:id/detail` đủ Thu chi trong 1 RTT; payments/expenses theo `orderId` không còn ~3s/payload nhỏ trên prod ấm.

---

## Liên quan

- Dashboard dài hạn: [`BACKEND_GAPS.md`](./BACKEND_GAPS.md) mục **12**.
- RBAC contract: [`api/identity-admin.md`](./api/identity-admin.md), [`api/FRONTEND_HANDOFF_RBAC.md`](./api/FRONTEND_HANDOFF_RBAC.md).
- Order detail aggregate (spec đầy đủ): [`api/FRONTEND_HANDOFF_ORDER_DETAIL.md`](./api/FRONTEND_HANDOFF_ORDER_DETAIL.md).
- Payments / schedule: [`api/payments.md`](./api/payments.md), [`api/orders.md`](./api/orders.md).
- File này = bản gửi BE ngày **2026-10-01** (+ bổ sung Request 4 finance perf).
