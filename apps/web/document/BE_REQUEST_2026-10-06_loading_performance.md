# Backend request — Loading chậm CRM UI (rà soát FE 2026-10-06)

> **Status 2026-10-06:** BE đã ship hydrate names + `GET /orders/:id/detail` + schedule 200 empty.  
> FE đã adapt — xem [api/FRONTEND_HANDOFF_LOADING_PERF.md](./api/FRONTEND_HANDOFF_LOADING_PERF.md).  
> File này giữ làm bối cảnh điều tra; checklist P0/P1 coi như done phía contract.

> Dành cho **backend review**. FE đã đo / đọc hydrator + inventory call path.  
> Mục tiêu: BE điều chỉnh payload & latency để FE **bỏ N+1 lookup** và giảm RTT trên critical path.  
> Không yêu cầu API tính lương mới, websocket, hay bỏ RBAC.

**Liên quan (đã có handoff):**

- [FRONTEND_HANDOFF_ORDER_DETAIL.md](./api/FRONTEND_HANDOFF_ORDER_DETAIL.md) — `GET /orders/:id/detail`
- [BE_REQUEST_2026-10-01_dashboard.md](./BE_REQUEST_2026-10-01_dashboard.md) — dashboard + schedule 404
- [FRONTEND_HANDOFF_ORDER_COMMISSION.md](./api/FRONTEND_HANDOFF_ORDER_COMMISSION.md) — `commissionPercent` (đã ship FE; cần BE persist)

---

## 1. Kết luận điều tra FE

| Giả thuyết | Kết luận |
|------------|----------|
| FE map JSON chậm | **Không** — map sync, không đáng kể |
| API thiếu display names → FE tự resolve | **Có — nguyên nhân #1 phía FE** |
| Phân quyền khiến FE “tính toán” nặng | **Không** — check permission là sync rẻ |
| Phân quyền / thiếu JOIN khiến FE N+1 | **Có — nguyên nhân khuếch đại** |
| Latency từng API call cao | **Có — nguyên nhân #2 hạ tầng/query** |

**Tóm lại:** Cảm giác “load lâu” = **(list thiếu tên → nhiều GET `:id`) × (RTT BE ~200–450ms, đôi khi vài giây)** + vài critical path còn chồng RTT (config, chi tiết đơn / Thu chi, payroll).

---

## 2. Bằng chứng đo được (từ máy FE → `apidyn.otcayxe.com`)

Đo unauthenticated (chỉ RTT/status; không phụ thuộc data user):

| Call | Quan sát |
|------|----------|
| `GET /orders?page=1&pageSize=20` | ~230–450ms (401); lần cold từng thấy ~2.7s |
| `GET /config`, `/customers`, `/auth/me` | ~200–480ms / call |
| 10 GET tuần tự giả lập lookup | **~1.4s** |
| 10 GET song song | ~213ms |

→ Chỉ bước resolve tên sau 1 trang list đã dễ thêm **1–3s** cảm nhận, trước khi kể cold path / 404 schedule.

---

## 3. FE đang làm gì hôm nay (để BE hiểu fan-out)

### 3.1 Boot session (mọi trang sau login)

1. `GET /auth/me` (bắt buộc — permissions).
2. Song song: `GET /config` (+ đôi khi `GET /config/crm.pagePermissions`).
3. List theo route (vd `/orders` → `GET /orders?page&pageSize=20`).
4. Idle: `GET /notifications`.

### 3.2 Sau mỗi trang list có entity (orders / payments / expenses / vat / payroll)

FE chạy `resolveEntityLookups` (pool concurrency **6**):

| Thiếu trên row | FE gọi thêm |
|----------------|-------------|
| `customerName` | `GET /customers/:id` |
| `serviceName` | `GET /services/:id` |
| `assignedUserName` / submitter / reviewer | `GET /users/:id` |
| (mode full) contract / CTV | `GET /contracts/:id`, `GET /collaborators/:id` |

**Lưu ý:** FE **cố ý không** preload full catalog customers/users trên `/orders` (`deferredScopes = []`) — chiến lược hiện tại phụ thuộc JOIN trên list hoặc N+1.

Type `ApiOrder` đã có optional: `customerName`, `serviceName`, `assignedUserName`, `submitterName`, `reviewerName`, `collaboratorName`.  
Khi list **không** trả các field này (hoặc trả null), UI hiện UUID / `—` rồi mới fill sau lookup.

### 3.3 Chi tiết đơn `/orders/:id`

Critical path hiện tại (đã giảm N+1 theo sibling, vẫn nhiều RTT):

1. Boot: `GET /orders/:id` + `GET /documents?orderId=` (+ lookup names nếu thiếu).
2. Finance: song song  
   - `GET /payments?orderId=<primary>`  
   - `GET /expenses?orderId=`  
   - (khi cần) `GET /orders/:id/payment-schedule` — **404 khi chưa có lịch vẫn tốn full RTT** (từng đo ~3s).

Handoff aggregate: `GET /orders/:id/detail`.

### 3.4 Payroll

FE auto `loadMore` tới **10 trang × 3 scope** (`orders`, `payments`, `expenses`) để tính lương tháng trên client.  
Mỗi trang lại kích hoạt name lookup nếu thiếu JOIN.

### 3.5 Users admin

Nếu `GET /users` thiếu `roleCodes` → FE `GET /users/:id` từng user (`fillMissingRoleCodes`).

### 3.6 Việc phân quyền FE **không** làm

- Không loop permission matrix trên mỗi row.
- `canLoadScope` chỉ quyết định **có gọi list scope đó hay không**.
- User thiếu `user.manage` → không có catalog users → **phụ thuộc hoàn toàn** `assignedUserName` trên order hoặc `GET /users/:id` (có thể 403 → vẫn mất 1 RTT).

---

## 4. Root causes cần BE xử lý (ưu tiên)

### P0 — List entities phải trả display names (JOIN)

**Endpoints:** ít nhất

- `GET /orders`, `GET /orders/:id`
- `GET /payments` (customer / order number nếu có)
- `GET /expenses` (`requestedByName`, `reviewedByName`, project/order label)
- `GET /vat` (nếu có FK customer/order)

**Fields bắt buộc trên order list/detail (string, không bắt FE map):**

| Field | Ý nghĩa |
|-------|---------|
| `customerName` | JOIN customers |
| `serviceName` | JOIN services |
| `assignedUserName` | JOIN identity users |
| `submitterName` | JOIN |
| `reviewerName` | JOIN nếu có `reviewerUserId` |
| `collaboratorName` | JOIN nếu có CTV |

**Acceptance**

1. `GET /orders?page=1&pageSize=20` — mỗi item có đủ name trên; FE DevTools **0** call `GET /customers/:id` / `GET /users/:id` chỉ để lấy tên.
2. User **không** có `user.manage` vẫn thấy tên phụ trách (không cần list `/users`).
3. P95 list ấm &lt; **500ms** (nội bộ); tránh 2–3s cho payload nhỏ.

**Không làm:** bắt FE preload toàn bộ users/customers chỉ để gắn tên.

---

### P0 — `payment-schedule` empty không được 404

| Trường hợp | Hiện tại (pain) | Cần |
|------------|-----------------|-----|
| Chưa có lịch | 404 + RTT dài | **200** + `{ items: [] }` |
| Có lịch | 200 + lines | giữ |
| Order không tồn tại / ngoài scope | 404 / 403 | giữ |

Chi tiết: [BE_REQUEST_2026-10-01_dashboard.md](./BE_REQUEST_2026-10-01_dashboard.md) § schedule.

---

### P1 — Aggregate chi tiết đơn

`GET /api/v1/orders/:id/detail` — 1 RTT: order (đã hydrate names) + contract group + payment HĐ + cashflow + expenses + documents.

Contract: [FRONTEND_HANDOFF_ORDER_DETAIL.md](./api/FRONTEND_HANDOFF_ORDER_DETAIL.md).

**Acceptance:** mở `/orders/:id` tab Thu chi không cần chuỗi 3–4 call finance trên critical path.

---

### P1 — Latency / query từng list theo filter

Các call theo `orderId` / page nhỏ:

- `GET /payments?orderId=`
- `GET /expenses?orderId=`
- `GET /documents?orderId=`

Cần index + tránh full-scan. Payload nhỏ mà **vài giây** = vấn đề query/connection, không phải JSON size.

---

### P2 — Users list đủ `roleCodes`

`GET /users` (paged) trả `roleCodes` (hoặc tương đương) trên từng item → FE bỏ N× `GET /users/:id` khi vào trang phân quyền / users.

---

### P2 — (Optional) Dashboard summary

Nếu product muốn dashboard không phụ thuộc 3 list FE: endpoint summary đã phác trong `BE_REQUEST_2026-10-01_dashboard.md`.  
Không chặn P0 names.

---

### P2 — `commissionPercent` trên Order

Đã có handoff riêng. FE đã wire POST/PATCH/GET. BE cần persist + trả trên list/detail.

---

## 5. Việc FE **không** đổ lỗi cho BE (để tránh scope creep)

| Việc | Owner |
|------|--------|
| Prefetch catalog / cache lookup phía FE (mitigation tạm) | FE |
| Giảm auto `loadMore` payroll | FE |
| Freshness 30s refetch khi đổi route | FE (có thể nới) |
| Map UUID → `—` khi thiếu tên (tránh vỡ UI) | FE (đã làm một phần) |
| Ma trận menu `crm.pagePermissions` (UX) vs RBAC thật | đã tách; không liên quan latency list |

---

## 6. Ma trận “trang → call hôm nay → call sau khi BE xong”

| Trang | Hôm nay (rút gọn) | Sau P0 names | Sau P1 detail |
|-------|-------------------|--------------|---------------|
| `/orders` | 1× list + N× GET entity | **1× list** | giữ |
| `/orders/:id` | get order + docs + lookups + payments + expenses (+ schedule) | get + docs + finance (ít lookup) | **1× detail** (+ optional docs nếu đã nhúng) |
| `/payroll` | nhiều page list ×3 + lookups | nhiều page list, **0 lookup tên** | + optional summary sau |
| Login shell | me + config + list route | giữ (config nhẹ) | giữ |

---

## 7. Checklist review cho BE

- [ ] `GET /orders` (và `:id`) luôn JOIN / embed display names (bảng mục 4 / P0).
- [ ] Cùng pattern cho expenses requester/reviewer names trên list.
- [ ] Empty `payment-schedule` → 200 + `[]`.
- [ ] Đo p95: list orders, payments-by-orderId, expenses-by-orderId, schedule (ấm + cold).
- [ ] Xác nhận user chỉ có `order.view` (không `user.manage`) vẫn đọc được `assignedUserName` trên order (không 403 field).
- [ ] (P1) Spec + ship `GET /orders/:id/detail`.
- [ ] (P2) `GET /users` có `roleCodes` đủ dùng.
- [ ] (P2) `commissionPercent` persist theo handoff riêng.

---

## 8. Gợi ý thứ tự làm BE

1. **Tuần này:** P0 names trên orders (+ expenses names) + schedule 200 empty + đo latency.  
   → FE gần như tắt `resolveEntityLookups` trên `/orders`.
2. **Tiếp:** P1 `orders/:id/detail` + index filter `orderId`.
3. **Sau:** users `roleCodes`, dashboard summary, commissionPercent nếu chưa xong.

FE sẵn sàng bỏ/ rút gọn N+1 ngay khi P0 có trên staging (feature-detect: item có `customerName` & `assignedUserName` non-null → skip lookup id đó).

---

## 9. Liên hệ FE

Repo: `CRM-DNY-UI`  
Hydrator: `apps/web/src/components/api-hydrator.tsx`  
Lookup N+1: `apps/web/src/lib/entity-lookups.ts`  
Map order: `apps/web/src/modules/orders/map-to-ui.ts`  
Load lists: `apps/web/src/lib/load-api-data.ts`

**Câu trả lời một dòng cho BE:**  
Load chậm không phải FE map chậm hay check RBAC nặng — mà vì **list thiếu tên bắt FE N+1**, nhân với **RTT/query BE**, cộng critical path chi tiết đơn còn nhiều call / schedule 404.
