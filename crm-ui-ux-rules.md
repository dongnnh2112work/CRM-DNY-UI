# CRM UI/UX Rules — Cursor Project Rules

> Mục đích: Đảm bảo mọi màn hình/component trong hệ thống CRM được xây dựng nhất quán, dễ dùng và tinh tế. Cursor phải đọc và tuân theo file này khi generate hoặc sửa bất kỳ UI code nào trong project.

---

## 1. Design Tokens (bắt buộc dùng, không hardcode)

### Spacing
- Chỉ dùng thang: `4, 8, 12, 16, 24, 32, 48, 64` (px hoặc rem tương ứng).
- Không dùng giá trị lẻ như `13px`, `22px`, `sm-ish`.
- Padding trong component (button, input, card) phải nhất quán trên toàn hệ thống.

### Typography
- Tối đa 6 cỡ chữ: `12, 14, 16, 20, 24, 32`.
- Font-weight chỉ dùng: `400 (regular), 500 (medium), 600 (semibold), 700 (bold)`.
- Heading, body, caption phải map cố định vào token (ví dụ `text-heading-1`, `text-body`, `text-caption`), không tự set inline.

### Color
- Mỗi màu gắn cố định 1 ý nghĩa nghiệp vụ, dùng xuyên suốt:
  - `success` (xanh lá) → hoàn thành / đã thanh toán / active
  - `warning` (vàng/cam) → chờ xử lý / sắp đến hạn
  - `danger` (đỏ) → lỗi / quá hạn / hủy
  - `info` (xanh dương) → thông tin trung tính
  - `neutral` (xám) → disabled / draft
- Không dùng màu ngoài palette đã định nghĩa trong `theme` / `tailwind.config`.
- Contrast tối thiểu WCAG AA (4.5:1 cho text thường, 3:1 cho text lớn/icon).

### Border radius, shadow, transition
- Radius: chỉ 2-3 mức (ví dụ `4px` cho input/button, `8-12px` cho card/modal).
- Transition: `150–250ms ease` cho hover/focus/state change. Không transition > 300ms cho micro-interaction.

---

## 2. Component Consistency

- Trước khi tạo component mới, **kiểm tra component tương tự đã tồn tại chưa** (button, badge, table, modal, dropdown, empty state...). Nếu có, tái sử dụng hoặc extend — không tạo bản mới trùng chức năng.
- Table, filter bar, pagination, search box: nếu đã có pattern ở 1 module (VD: Contacts), **bắt buộc dùng lại y hệt** ở module khác (Deals, Tasks, Companies...) — cùng vị trí, cùng icon, cùng hành vi.
- **List tables (bắt buộc — hướng B, 2026-08-13):** mọi **list page** dùng `DataTable` (`components/shared/data-table.tsx`) — pagination + `showSizeChanger`, `scroll.x`, EmptyState, loading, selection/bulk, sort qua `columns.sorter`. Không dùng Ant `Table` trực tiếp trên list.
  - Module custom fields (customers, services): `DynamicTable` → render qua `DataTable`.
  - **Ngoại lệ được phép Ant `Table` raw:** bảng lồng / preview / detail phụ (installments, CTV jobs, order documents, Excel import preview) — không phải list module.
- Button hierarchy rõ ràng: `Primary` (1 cái/màn hình cho hành động chính), `Secondary`, `Tertiary/Ghost`, `Destructive` (đỏ, cho delete/cancel nguy hiểm).
- Icon: dùng 1 bộ icon set duy nhất (không trộn nhiều icon library khác style).

---

## 3. Information Hierarchy (quan trọng vì CRM nhiều dữ liệu)

- Áp dụng **progressive disclosure**: chỉ hiện field quan trọng nhất mặc định (tên, trạng thái, giá trị, deadline). Field phụ (ghi chú, lịch sử, metadata) đặt trong tab/accordion/expand.
- Group field theo logic nghiệp vụ (thông tin liên hệ / công ty / lịch sử tương tác), không liệt kê phẳng.
- Số liệu quan trọng (doanh thu, deadline, trạng thái) phải có visual weight cao hơn (đậm hơn, to hơn, contrast hơn) field phụ.

---

## 4. Feedback & State Design

Mỗi component/màn hình xử lý dữ liệu bắt buộc có đủ các state sau — không được bỏ sót:
- `Loading` (skeleton hoặc spinner, không để trắng trơn)
- `Empty` (có message + gợi ý hành động tiếp theo, không chỉ "No data")
- `Error` (message rõ ràng, không show raw error/exception ra UI)
- `Success` (toast/inline confirmation sau khi save/update/delete)
- `Disabled` (rõ ràng bằng màu + cursor, không chỉ giảm opacity mập mờ)

Mọi action ghi dữ liệu (save/update/delete) phải có:
- Immediate feedback (loading state trên button, disable trong lúc xử lý)
- Confirmation cho hành động phá hủy (delete, bulk action)

---

## 5. Interaction Patterns cho CRM

- Ưu tiên **inline edit** cho thao tác đơn giản (đổi status, đổi ngày, đổi assignee) thay vì bắt buộc mở modal.
- **Bulk actions**: mọi bảng danh sách (leads, deals, contacts) phải hỗ trợ chọn nhiều dòng + hành động hàng loạt.
- Filter & Search: cố định vị trí trên đầu bảng, luôn dễ thấy — không giấu trong menu phụ.
- Default filter/sort phải phản ánh hành vi phổ biến nhất (VD: sort theo deadline gần nhất, mặc định filter "của tôi").
- Modal chỉ dùng cho: tạo mới record phức tạp, xác nhận hành động nguy hiểm, hoặc form dài. Không dùng modal cho thao tác đơn giản.

---

## 6. Accessibility & Polish

- Mọi input/button phải có focus state rõ ràng (keyboard navigation phải dùng được).
- Alignment: số liệu canh giữa, text canh trái, icon căn giữa theo baseline — kiểm tra pixel-level.
- Không dùng màu làm cách duy nhất để truyền đạt thông tin (thêm icon/label cho colorblind users).
- Responsive: table/dashboard phải có fallback hợp lý ở tablet/mobile (không vỡ layout).

---

## 7. Quy tắc khi Cursor generate code

1. Trước khi viết component mới, **tự kiểm tra trong codebase** xem đã có component/pattern tương tự chưa (search theo tên, theo folder `components/`).
2. Không hardcode màu, spacing, font-size — luôn dùng token/theme variable.
3. Khi thêm 1 màn hình/table mới, đối chiếu với rule Section 2 & 5 để đảm bảo pattern giống các module đã có.
4. Nếu không chắc chắn 1 quyết định UI có đúng rule không — **hỏi lại thay vì tự đoán**.
5. Sau khi code xong 1 component, tự review lại theo checklist Section 4 (đủ 5 state chưa).

---

## 8. Change log
- Cập nhật file này mỗi khi có quyết định design mới (thêm token, thêm pattern) để giữ đồng bộ toàn team.
- StatusBadge + `status-config`: badge trạng thái dùng chung theo module (customer, payment, orderStage, approval…).
- PageLoading / EmptyState: loading và empty state chuẩn cho list/detail.
- formatVndDisplay + align center: số / số tiền canh giữa trên table.
- BulkActionBar: thanh hành động hàng loạt khi chọn nhiều dòng.
- `ds.fontSize` tokens: caption 12, bodySm 14, body 16, h3 20, h2 24, h1 32 — không hardcode fontSize inline.
- `ds.danger`: màu đỏ chuẩn cho lỗi / hủy / PDF icon.
- **2026-08-13 — DataTable unification (hướng B):**
  - **Quyết định:** tạo `DataTable` bọc Ant Table làm chrome list dùng chung; `DynamicTable` chỉ lo custom fields và render qua `DataTable`. Không mở rộng `DynamicTable` thành wrapper mọi list (hướng A bị loại).
  - **Lý do:** tách concern (list chrome vs field engine); migrate 6 list raw dễ hơn; tránh god-component; mở rộng loading/sort/pagination 1 chỗ.
  - **Đã migrate list:** VAT → Emails → Payments → CTV → Users → Orders (pilot từng module). Customers/Services qua `DynamicTable` → `DataTable`.
  - **Không còn** pattern Ant `Table` raw trên list page. Ant `Table` chỉ còn ở bảng phụ/detail/preview (xem §2 ngoại lệ).
- **2026-08-13 — User profile & phân quyền View/Edit:**
  - Header avatar: Dropdown **thông tin** + **Đăng xuất**; form hồ sơ (họ tên, SĐT, email, ngày sinh, địa chỉ, upload avatar).
  - `AppUser` mở rộng phone / dateOfBirth / address / avatar; `UsersProvider` session + list + ma trận quyền.
  - Users: click **tên** mở drawer xem/sửa; click **vai trò** mở ma trận checkbox **Xem | Sửa** theo từng trang hệ thống (lưu được).
  - Thay `PERMISSIONS` dạng `module.action` bằng `SYSTEM_PAGES` + `ROLE_PAGE_PERMISSIONS` (View/Edit).
  - **Custom roles + per-user override:** thêm vai trò tùy chỉnh (không xóa được role hệ thống); trên user bật “Phân quyền tùy chỉnh” để ghi đè ma trận Xem/Sửa cho case đặc biệt (tag Custom trên list).
