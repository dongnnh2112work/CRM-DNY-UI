# DNY CRM — đặc tả UX/UI

Tài liệu này mô tả giao diện đang chạy ở nhánh `main` (`41ae742`) để một project khác dựng **cùng trải nghiệm**: bố cục, ngôn ngữ hình ảnh, luồng từng màn, và quy tắc ẩn/hiện. Đây là đặc tả UX, không phải contract API. Ảnh tham chiếu nằm ở `document/ui-screenshots/` (viewport 1440×900).

Stack UI hiện tại: Next.js App Router, Ant Design 6, font Inter. Nền tảng nhìn giống Notion hơn là dashboard admin cổ điển: nền xám ấm, bề mặt trắng, viền mỏng, bóng rất nhẹ, nút bo tròn viên thuốc.

---

## 1. Cá tính sản phẩm

- Ứng dụng web cho văn phòng luật: khách, đơn dịch vụ, công nợ, chi phí, VAT, lương, email, user.
- Ngôn ngữ mặc định **tiếng Việt**. Có English và 中文, đổi ở Cấu hình, lưu `localStorage`.
- Tiền hiện **VND**, có dấu phân cách; trục biểu đồ rút thành `K` / `M`. Ngày hiển thị dạng người đọc được, không ISO thô.
- User không đủ quyền thì **ẩn mục**, không hiện màn “cấm” giữa chừng. API vẫn có thể trả 403; UI không được crash.
- Nút xóa / hủy luôn danger và qua `Popconfirm`. Đổi giai đoạn đơn qua hộp xác nhận.
- Toast (Ant `message`) cho thành công/lỗi ngắn. Lỗi kỹ thuật API chỉ hiện khi bật **Developer debug** ở Cấu hình.

---

## 2. Hệ màu và chữ

Light:

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| Primary | `#0075de` | Nút chính, link, focus |
| Primary pressed | `#005bab` | Active |
| Canvas | `#ffffff` | Sider, header, card |
| Nền app | `#f6f5f4` | Vùng ngoài page shell |
| Chữ | `#000000` / secondary `#31302e` | Title / body |
| Chữ phụ | `#615d59` | Caption, hint |
| Chữ mờ | `#a39e98` | Placeholder, icon phụ |
| Hairline | `#e6e6e6` | Viền, divider |
| Hover | `rgba(0,0,0,0.04)` | Hàng, menu |
| Selected | `rgba(0,117,222,0.08)` | Menu đang chọn |
| Danger | `#e03e3e` | Xóa, hủy, quá hạn |
| Success | `#1aae39` | Đã xong, đã duyệt |
| Warning | `#dd5b00` | Chờ, sắp hạn |

Dark: nền `#191919`, bề mặt `#202020`, chữ trắng, viền `#333`. Primary giữ `#0075de`. Selected đậm hơn (`rgba(0,117,222,0.2)`).

Cỡ chữ: caption 12, body nhỏ 14, body 16, heading 20 / 24 / 32. Body app 16, line-height 1.5. Font: Inter, fallback system.

Bo góc: input 4, card/page 12, modal 16, **nút 9999 (pill)**. Nút cao 36, nút large 40. Không đổ bóng nút. Bóng card: `0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04)`.

Status badge là tag tròn theo nhóm màu Ant: success, warning, processing, error, default. Màu giai đoạn đơn có thể là hex do admin cấu hình; chart dùng đúng màu đó.

---

## 3. Khung ứng dụng (sau khi đã vào CRM)

Toàn màn `min-height: 100vh`. Không có footer.

```
┌──────── sider 280px ────────┬── header cao 48 ──────────────────────────┐
│ DNY CRM                      │ [≡] [tìm kiếm max 360]     sync ↻ ☾ 🔔 tên │
│ menu inline                  ├────────────────────────────────────────────┤
│                              │  margin 16                                                │
│                              │  ┌ page shell (card trắng, radius 12) ──┐ │
│                              │  │ breadcrumb + toolbar                 │ │
│                              │  │ nội dung                             │ │
│                              │  └──────────────────────────────────────┘ │
└──────────────────────────────┴────────────────────────────────────────────┘
```

### Sider

- Rộng 280, thu gọn chỉ còn icon. Logo trái: `DNY CRM`; khi thu: `DNY`. Font 700, letter-spacing `-0.3px`.
- Menu inline, nền trong suốt, item cao 40, chữ 14, weight 500, padding ngang 8.
- Item chọn: nền xanh rất nhạt, không thanh active bên trái.
- Có divider giữa các cụm (xem mục menu).
- Menu lọc theo quyền. Không hiện mục user không được vào.

### Header

Trái sang phải:

1. Nút icon thu/mở sider.
2. Ô search header, max-width 360. Placeholder đổi theo trang (tìm đơn, tìm khách…). Enter đẩy `?q=` sang trang danh sách tương ứng. Trang không có list thì toast “Trang này không có danh sách để tìm.”
3. Caption “Cập nhật {giờ}” hoặc “Chưa đồng bộ”.
4. Nút reload (icon xoay khi đang tải).
5. Nút đổi sáng/tối (mặt trời / mặt trăng). Lưu `app_theme`.
6. Chuông: badge số chưa đọc. Dropdown rộng 360, cao tối đa 420. Tiêu đề “Thông báo”, link “Đọc tất cả” và “Xem tất cả” → `/notifications`. Item chưa đọc nền `colorPrimaryBg`. Click đánh dấu đọc và đi href.
7. Avatar + tên. Menu: “Cập nhật thông tin” → `/profile`, divider, “Đăng xuất” (danger) → `/login`.

### Page shell

Khối trắng bo 12, viền hairline, bóng nhẹ, `min-height: calc(100vh - 112px)`, `overflow: hidden`. Mọi trang dashboard nằm trong khối này.

### Page header (mọi list/detail)

- Padding `12px 16px`, viền dưới hairline.
- Breadcrumb dòng trên. Mục có `href` là link primary; mục cuối là chữ hiện tại.
- Hàng toolbar: search bảng (rộng 280, lọc khi gõ), filter phụ, date range (nếu có), rồi spacer, **một nút primary** bên phải (tạo mới). Nút primary pill.
- Không đặt title H1 trùng breadcrumb. Title lớn chỉ xuất hiện trên trang chi tiết, dưới header.

---

## 4. Menu (thứ tự cố định)

| Cụm | Mục | Route | Ẩn khi |
|-----|-----|-------|--------|
| | Tổng quan | `/dashboard` | — |
| | Khách hàng | `/customers` | thiếu `customer.view` |
| | Đơn hàng | `/orders` | thiếu `order.view` |
| | Thanh toán | `/payments` | thiếu `payment.view` |
| | Đề nghị thanh toán | `/expense-approvals` | thiếu `expense.view` |
| | Tính lương / Lương của tôi | `/payroll` | scope lương = none |
| | VAT | `/vat` | thiếu `vat.view` |
| | Dịch vụ | `/services` | thiếu `service.view` |
| | Email | `/emails` | thiếu `email.template.manage` |
| submenu Người dùng | Danh sách | `/users` | thiếu `user.manage` |
| | Tài khoản chờ duyệt | `/users/pending` | thiếu `user.manage` |
| | Phân quyền | `/users/permissions` | thiếu `role.manage` và `permission.manage` |
| | Cấu hình | `/config` | — |

Submenu Người dùng mở sẵn, và tự mở khi đang ở `/users*`. Không có mục thì bỏ cả submenu. Lương: có quyền xem cả công ty thì nhãn “Tính lương”; chỉ xem mình thì “Lương của tôi”.

---

## 5. Pattern lặp lại

### Danh sách

1. Page header: breadcrumb, search trong bảng, filter (Select), CTA phải.
2. Bảng Ant, header nền canvas soft, chữ muted, hover hàng rất nhạt.
3. Cột tên/mã là link (không gạch chân đậm), weight 500, mở chi tiết.
4. Cột trạng thái là badge/tag, không chữ thô.
5. Cột tiền canh giữa hoặc phải, format VND. Trống hiện `—`.
6. Sort client trên cột chữ/số. Phân trang mặc định 10, có đổi page size.
7. “Quản lý cột”: ẩn/hiện cột, chỉ áp dụng sau khi bấm Lưu. Lưu theo key trang.
8. Dưới bảng: “Đã tải {n} / {tổng}” và nút “Tải thêm” nếu còn trang server.
9. Empty: câu tiếng Việt ngắn + CTA tạo nếu có quyền. Đang search mà không ra: “Không tìm thấy kết quả phù hợp.” không kèm nút tạo.
10. Chọn nhiều hàng thì thanh bulk nổi phía trên bảng: đếm đã chọn, hành động, nút nguy hiểm có confirm.
11. Ô search header và ô search bảng là hai việc khác nhau. Search bảng lọc ngay; search header điều hướng.

### Form tạo (trang riêng)

- Route `/…/new`. Rộng tối đa **640px**, padding 16, form vertical, `requiredMark={false}`.
- Label ngắn. Lỗi validate ngay dưới field.
- Cuối form: Hủy (về list) và nút primary Lưu/Tạo. Dirty khi hủy thì confirm bỏ thay đổi.
- Có thể là modal rộng 560, body max-height 70vh scroll, footer tự render trong form (không dùng footer Ant mặc định) khi sửa nhanh từ list.

### Chi tiết

- Breadcrumb: list (link) / mã hoặc tên.
- Hàng action ngay trong page header, wrap khi hẹp.
- Dưới header, padding 16: title level 4 + badge trạng thái + tag ngữ cảnh trên một hàng.
- `Descriptions` bordered, 1 cột mobile / 2 cột từ `sm`, size small.
- Phần phụ (file, chi phí, lịch sử) là **Tabs**, không phải trang mới.
- Link chéo giữa thực thể: khách ↔ đơn ↔ thanh toán ↔ VAT.

### Trạng thái tải

- Vào app / đổi route khi chưa có session: full page spinner giữa màn, không skeleton shell.
- Số liệu chưa về trên detail: skeleton input nhỏ ngay tại câu mô tả, không nhảy 0₫ rồi sửa.
- Bảng remote: spinner Ant trên table khi load more.
- Modal confirm loading trên nút OK khi đang gọi API.

---

## 6. Auth — nằm ngoài shell

Không sider, không header CRM. Nền `colorBgLayout`, căn giữa, padding 24.

### `/` và chưa login

`/` redirect `/login`. Route dashboard không có session redirect `/login`.

### `/login`

Card 400px, nền container, viền, radius lớn, shadow, padding 32.

- Title `DNY CRM` (level 3, weight 700, letter-spacing -0.5), căn giữa.
- Dòng phụ: “Hệ thống quản lý dịch vụ pháp lý”.
- Alert lỗi (nếu có) phía trên nút, showIcon.
- Nút full width, cao 40, pill, icon Google: “Đăng nhập bằng Google”.
- Divider chữ “hoặc đăng nhập bằng email”.
- Form: email (prefix mail), mật khẩu (prefix khóa), nút primary full “Đăng nhập”.
- Đang session hợp lệ thì không ở lại login: vào `/dashboard` hoặc `/pending-approval`.

Lỗi tách lời, không chung một câu “đăng nhập thất bại”:

- Hủy Google / OAuth lỗi / thiếu token
- Sai email mật khẩu
- Tài khoản khóa
- Mạng / máy chủ

### `/auth/callback`

Giữa màn, một dòng “Đang hoàn tất đăng nhập…”. Lỗi thì Alert + nút về login. Hash token xóa ngay, không hiện token.

### `/pending-approval`

Căn giữa, max-width 440, text-align center.

- Title: “Tài khoản đang chờ duyệt” hoặc “Tài khoản đang chờ kích hoạt” hoặc “Tài khoản đã bị khóa”.
- Đoạn phụ giải thích admin phải gán vai trò.
- Email user, chữ secondary.
- Nút “Kiểm tra lại” (chỉ khi đang chờ) và “Đăng xuất”.
- Tự hỏi lại hồ sơ khoảng 15 giây. Khi đã đủ quyền thì sang `/dashboard`.

Điều kiện vào CRM: `status === ACTIVE` **và** có role **và** có permission. Không thì giữ màn này, không tải khách/đơn.

---

## 7. Tổng quan `/dashboard`

Breadcrumb: Tổng quan. Không có CTA tạo.

Hàng 4 stat card (icon + label + số):

1. Đơn (trong kỳ / scope nhìn thấy)
2. Khách
3. Doanh thu đã thu
4. Lương/hoa hồng tháng nếu user được xem lương

Dưới: lưới 2 cột.

- Trái: biểu đồ cột doanh thu theo tháng (Recharts). Trục Y dạng `1.2M`. Card có link “Xem tất cả” → `/payments` hoặc tương đương.
- Phải: donut/pie đơn theo giai đoạn, màu đúng catalog giai đoạn, chỉ lát có số > 0. Link “Xem tất cả” → `/orders`.

Bên dưới hoặc cạnh: danh sách đơn mới nhất, mỗi dòng có mã, khách, badge giai đoạn. Click sang chi tiết đơn.

Số đang tải: skeleton thay card, không nháy 0.

---

## 8. Khách hàng

### List `/customers`

- Search, lọc trạng thái, lọc người phụ trách.
- Nếu có quyền: Import Excel, Export, nút “+ Khách hàng mới”.
- Cột chính: tên (link), SĐT, email, công ty, MST, phụ trách, trạng thái (select badge — đổi ngay nếu có `customer.update`), dịch vụ đã dùng (tag).
- Chọn dòng: bulk đổi trạng thái, gán phụ trách (chỉ `customer.assign`), export, xóa (chỉ `customer.delete`). Xóa confirm.
- Empty + nút tạo chỉ khi `customer.create`.

### Tạo `/customers/new`

Form 640: họ tên, SĐT, email, công ty, MST, địa chỉ, phụ trách, trạng thái, kênh. Trường phụ nếu catalog field có thêm. Lưu về hồ sơ hoặc list.

### Hồ sơ `/customers/:id`

- Breadcrumb Khách hàng / tên.
- Action: Sửa (modal), Tạo đơn (nếu `order.create`), Lưu trữ, Xóa. Ẩn theo permission.
- Descriptions: liên hệ, công ty, MST, phụ trách, trạng thái, ngày tạo.
- Tab hoặc bảng con: đơn của khách (mã link, dịch vụ, giai đoạn, giá trị, phụ trách), dịch vụ đã dùng (từ đơn + ghi tay).
- Sửa mở modal form, không rời trang.

---

## 9. Đơn hàng

### List `/orders`

Hai mode, Segmented góc toolbar:

- **Kanban** (mặc định): cột = giai đoạn. Thẻ: mã đơn, khách, dịch vụ, tag tiền thu/chi rút gọn, hạn. Kéo thả đổi giai đoạn nếu được `order.change_stage`.
- **Bảng**: mã, khách, dịch vụ, giai đoạn (select), phụ trách, hạn, dòng tiền.

Filter: người phụ trách, tháng, search. Bulk gán người (nếu `order.assign`). Nút cấu hình giai đoạn (nhãn/màu) chỉ user được sửa catalog. CTA “+ Đơn mới”.

### Tạo `/orders/new`

Form: khách (select, tìm được), dịch vụ, giá trị, % hoa hồng, cần VAT, số hợp đồng, hạn, phụ trách, người nộp, ghi chú, link nhóm Zalo. Có thể nhận `?customerId=`. Thiếu field bắt buộc thì chặn submit, không gọi API.

### Chi tiết `/orders/:id`

Header actions (wrap):

- Sửa (modal 560) nếu `order.update`
- Thêm dịch vụ vào cùng hợp đồng
- Thanh toán — primary, label kèm số còn lại khi đã tải xong (`Còn 1.200.000₫`). Đang tải thì ` …`, không hiện `0₫`
- Tạo VAT — disable + tooltip nếu đơn chưa có số hợp đồng
- Hủy đơn (Popconfirm danger)
- Xóa (Popconfirm danger) nếu được phép xóa

Dòng title: mã đơn + dropdown giai đoạn + tag VAT/không VAT + tag số HĐ + tag hạn giấy phép (màu theo mức) + tag số hồ sơ + tag số giấy phép.

Alert info: các đơn cùng hợp đồng (link chéo), gợi ý thanh toán dùng chung, nút thêm dòng dịch vụ.

Descriptions: khách (link), dịch vụ, giá niêm yết, % hoa hồng, Zalo, xuất VAT, số HĐ, hạn, phụ trách, người nộp, ngày tạo, ghi chú.

Tabs:

1. **Chi phí** — bảng đề nghị chi của đơn. Thêm đề nghị (drawer). Duyệt/từ chối chỉ khi có `expense.approve`. Không đủ quyền thì tag “Chỉ xem”, không nút.
2. **Hồ sơ làm việc (n)** — upload tài liệu. Cho phép PDF, Word, Excel. Xem file trong modal, không mở tab bừa.
3. **Giấy phép / kết quả (n)** — upload file kết quả, ngày cấp, ngày hết hạn. Bắt buộc hạn khi lưu giấy phép.

Đổi giai đoạn: confirm “Chuyển sang {tên}?”. Hủy đơn set stage `cancelled`.

---

## 10. Thanh toán

### List `/payments`

Theo đơn/hợp đồng đã có lịch thu. Cột: mã, khách, tổng, đã thu, còn lại, trạng thái (Chưa TT / Một phần / Đã TT / Quá hạn). Quá hạn màu danger. Search + khoảng ngày.

### Chi tiết `/payments/:id`

- Tóm tắt: tổng, đã thu, còn lại.
- Bảng các đợt: kỳ, số tiền, hạn, ngày thu, trạng thái.
- “Thêm đợt” nếu `payment` được tạo. “Đánh dấu đã thu” là command (không sửa status bằng dropdown tự do).
- Link “Xem đơn”.

---

## 11. Đề nghị thanh toán `/expense-approvals`

List độc lập với tab chi phí trên đơn, cùng dữ liệu.

- Filter trạng thái: Chờ (mặc định) / Đã duyệt / Từ chối / Tất cả.
- Cột: đơn (link), nội dung, số tiền, người đề nghị, trạng thái, người duyệt.
- Hành động trên dòng chờ: Duyệt / Từ chối, đều Popconfirm. Thiếu `expense.approve` thì chỉ xem.
- CTA tạo đề nghị mở drawer: chọn đơn, số tiền, nội dung, file nếu có.
- Toast “Đã duyệt đề nghị” / lỗi API.

---

## 12. Lương `/payroll`

- Nếu xem cả công ty: bảng nhân sự theo tháng (chọn tháng). Cột tên (link), số đơn, thu, chi, net, lương. CTA không bắt buộc.
- Nếu chỉ lương mình: vào thẳng phiếu của mình, không list người khác.
- Phiếu `/payroll/:userId`: tên, tháng, các dòng theo đơn (mã, khách, dịch vụ, thu, chi, net, % , thành tiền). Empty: “Nhân sự này không có phát sinh trong tháng đã chọn.”

Không hiện menu nếu không thuộc diện xem lương.

---

## 13. VAT

### List `/vat`

Cột: số hóa đơn hoặc nháp, đơn/HĐ, khách, tiền, trạng thái Nháp / Đã xuất / Đã hủy, hạn xuất. Cảnh báo hạn dùng số ngày ở Cấu hình (mặc định 30).

### Tạo `/vat/new`

Form gắn một đơn (`?orderId=`). Đơn không có số hợp đồng thì chặn và báo. Lưu ra nháp.

### Chi tiết `/vat/:id`

Xem hóa đơn, file đính kèm nếu có, nút Xuất (`vat.issue`) và Hủy (`vat.cancel`). Không có dropdown sửa status tự do.

---

## 14. Dịch vụ

### List `/services`

Catalog: tên (link), mã, danh mục, đơn giá, số ngày xử lý, trạng thái Hoạt động/Ngừng. CTA tạo. Có thể lưu trữ thay vì xóa cứng.

### Tạo `/services/new` và chi tiết `/services/:id`

Form: tên, mã, danh mục, đơn giá, thời gian xử lý, số tháng nhắc hết hạn giấy phép, trạng thái, hồ sơ yêu cầu. Chi tiết có nút Sửa (modal hoặc cùng form) và Lưu trữ.

---

## 15. Email `/emails`

List theo trạng thái: Nháp, Đã lên lịch, Đã gửi, Thất bại. Cột tiêu đề, người nhận, trạng thái, thời điểm. CTA soạn.

`/emails/new`: người nhận, tiêu đề, lịch gửi hoặc gửi ngay, thân HTML. Upload file HTML; từ chối file không phải HTML hoặc quá lớn. Preview trước khi gửi.

Menu chỉ người có `email.template.manage`.

---

## 16. Người dùng

### Danh sách `/users`

Chỉ `user.manage`.

- Cột: avatar, họ tên (mở hồ sơ modal), SĐT, email, ngày sinh, địa chỉ, vai trò (tag, bấm để xem quyền), trạng thái.
- Tag Custom nếu user bị ghi đè ma trận trang.
- CTA “+ Người dùng mới” và lối sang “Tài khoản chờ duyệt”.
- Modal tạo/sửa rộng 560: tên, email, SĐT, ngày sinh, địa chỉ, vai trò, trạng thái. Tạo gửi kèm role. Đổi vai trò là thay cả bộ role, không cộng dồn.
- Modal “Phân quyền theo vai trò” là **UX ma trận trang** (ô xem). Quyền chạy thật nằm ở màn Phân quyền (group → role), không phải từng ô tick trên user.

### Chờ duyệt `/users/pending`

Bảng: email, tên, ngày tạo, status tag vàng, Duyệt / Từ chối.

Duyệt mở dialog: hiện email, chọn **một** role (mặc định SALES / Kinh doanh), Xác nhận. Từ chối có Popconfirm khóa tài khoản.

Toast: “Đã duyệt. User cần mở lại app hoặc refresh phiên để vào CRM.”

Không có quyền: câu chữ secondary, không gọi API.

### Phân quyền `/users/permissions`

Đây là màn admin RBAC, không phải bảng C/R/U/D trên từng trang.

- Chọn role.
- Danh sách **nhóm quyền** gắn vào role (checkbox / multi). Lưu = thay cả tập group của role.
- Panel nhóm: tên nhóm + các permission (`customer.view`, `order.create`, …) với nhãn người đọc được, không chỉ mã.
- Tạo nhóm mới. Xóa nhóm: nếu còn role đang dùng, modal bắt gán lại role cho user bị ảnh hưởng rồi mới xóa.
- User nhận quyền mới phải tải lại hồ sơ `/auth/me`.

Chỉ hiện khi có `role.manage` hoặc `permission.manage`. Thiếu quyền thì không thấy menu.

---

## 17. Cấu hình `/config`

Một cột, max-width 600, các Card nhỏ chồng nhau, gap qua margin 16.

1. **Ngôn ngữ** — Segmented: Tiếng Việt | English | 中文. Đổi ngay cả menu.
2. **Giao diện** — Switch “Chế độ tối”.
3. **Nhắc hạn** — InputNumber “Cảnh báo hạn xuất VAT (ngày)”, min 7, max 90, mặc định 30.
4. **Nhà phát triển** — Switch “Hiện lỗi hệ thống (debug)” + dòng phụ: bật khi test, tắt trước golive. Khi bật, toast góc dưới phải: `[403 forbidden] /path — message`.
5. **Giới thiệu** — “DNY CRM” và “Phiên bản 1.0.0”.

---

## 18. Hồ sơ `/profile`

Trong shell, không phải trang login.

- Avatar lớn, tải ảnh / xóa ảnh.
- Form thông tin cá nhân (không tự đổi role).
- Khối đổi mật khẩu: mật khẩu mới, chặn nếu quá ngắn.
- Hiển thị vai trò và ghi chú nếu đang dùng quyền tùy chỉnh.

Vào từ menu avatar trên header.

---

## 19. Thông báo `/notifications`

Trang đầy đủ của dropdown chuông.

- Danh sách mới → cũ. Chưa đọc nổi bật.
- Mỗi dòng: tiêu đề, mô tả, thời điểm. Click đánh dấu đọc và đi tới đơn/khách liên quan.
- “Đọc tất cả”.
- Empty: “Chưa có thông báo”.

---

## 20. Quy tắc quyền trên UI

- Ẩn nút theo permission (`customer.create`, `order.update`, `expense.approve`, `user.manage`…). Không viết `if (role === 'SALES')` để quyết định nút.
- Role chỉ hiện dạng tag / badge.
- Menu dùng quy tắc ở mục 4. Dashboard và Cấu hình luôn có với user đã vào CRM.
- 403 ngoài phạm vi dữ liệu: toast hoặc trạng thái rỗng, không lộ record, không màn lỗi trắng.
- Duyệt user = gán role rồi kích hoạt. Không có nút gọi API “approve” riêng.
- Sửa quyền = sửa group, gán group vào role, gán role cho user.

---

## 21. Hành vi chung cần giữ

- Ba ngôn ngữ đủ chuỗi. Không trộn tiếng Anh vào UI Việt.
- Confirm trước: xóa, hủy đơn, từ chối chi, bỏ form bẩn, xóa nhóm quyền đang dùng.
- Một CTA chính mỗi header (nút primary). Nút phụ là default. Danger không bao giờ là primary.
- Link nội bộ dùng routing client, không full reload.
- Bảng không vỡ trên 1280. Toolbar wrap. Sider thu được.
- Dark mode phủ sider, header, card, bảng, modal, segmented.
- Không log token. Không để access token trên URL sau callback.
- File: chỉ PDF, Word, Excel trừ khi màn email yêu cầu HTML. Upload hiện tiến trình, lỗi loại file nói rõ.

---

## 22. Checklist để project kia “làm y vậy”

1. Khung sider 280 + header 48 + page shell card.
2. Token màu, pill button, Inter, light/dark.
3. Auth tách ba màn: login, callback, chờ duyệt.
4. List = breadcrumb + search + filter + một CTA + bảng + empty + load more.
5. Detail = actions trên header + title/badge + descriptions + tabs.
6. Form tạo rộng 640; sửa nhanh bằng modal 560.
7. Đủ các route ở mục 4 và luồng ở mục 7–19.
8. Ẩn menu và nút theo permission, không theo tên role.
9. Duyệt tài khoản và màn phân quyền group → role đúng mục 16.
10. i18n vi/en/zh và debug toggle ở Cấu hình.
