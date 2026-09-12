# Chỉ mục màn hình UI — DNY CRM

Chụp ngày 12/09/2026 trên `http://localhost:3001`, viewport **1440×900**.

Mỗi ảnh có banner trên cùng:

**`index · tên màn hình · route · chức năng`**

Dữ liệu trên các màn dashboard là **dữ liệu demo** (mock) để thấy layout/chức năng; khi đăng nhập API thật, số liệu sẽ khác.

| # | Ảnh | Route | Màn hình | Chức năng |
|---|-----|-------|----------|-----------|
| 01 | [01-login.png](./01-login.png) | `/login` | Đăng nhập | Đăng nhập email/mật khẩu hoặc Google OAuth |
| 02 | [02-pending-approval.png](./02-pending-approval.png) | `/pending-approval` | Chờ duyệt tài khoản | User Google/mới chưa có role — chờ admin gán quyền |
| 03 | [03-auth-callback.png](./03-auth-callback.png) | `/auth/callback` | OAuth callback | Nhận token từ Google rồi chuyển vào hệ thống |
| 04 | [04-auth-callback-error.png](./04-auth-callback-error.png) | `/auth/callback` | OAuth callback — lỗi | Hiển thị lỗi đăng nhập Google và quay về login |
| 05 | [05-dashboard.png](./05-dashboard.png) | `/dashboard` | Dashboard | Tổng quan KPI: đơn, khách, doanh thu, cảnh báo |
| 06 | [06-orders.png](./06-orders.png) | `/orders` | Danh sách đơn hàng | Tìm, lọc, theo dõi tiến độ đơn (kanban / bảng) |
| 07 | [07-orders-new.png](./07-orders-new.png) | `/orders/new` | Tạo đơn hàng | Tạo đơn mới: khách, dịch vụ, phụ trách, giai đoạn |
| 08 | [08-order-detail.png](./08-order-detail.png) | `/orders/:id` | Chi tiết đơn hàng | Hồ sơ đơn: giai đoạn, tài liệu, công nợ, chi phí |
| 09 | [09-customers.png](./09-customers.png) | `/customers` | Danh sách khách hàng | Quản lý khách, trạng thái, tìm kiếm, import Excel |
| 10 | [10-customers-new.png](./10-customers-new.png) | `/customers/new` | Tạo khách hàng | Nhập hồ sơ khách mới (tên, liên hệ, công ty, MST) |
| 11 | [11-customer-detail.png](./11-customer-detail.png) | `/customers/:id` | Hồ sơ khách hàng | Chi tiết khách, đơn liên quan, cập nhật trạng thái |
| 12 | [12-payments.png](./12-payments.png) | `/payments` | Thanh toán / công nợ | Theo dõi đợt thanh toán, quá hạn, đã thu |
| 13 | [13-payment-detail.png](./13-payment-detail.png) | `/payments/:id` | Chi tiết thanh toán | Các đợt thu của một đơn: thêm đợt, đánh dấu đã thu |
| 14 | [14-expense-approvals.png](./14-expense-approvals.png) | `/expense-approvals` | Duyệt đề nghị thanh toán | Reviewer duyệt/từ chối chi phí gắn đơn |
| 15 | [15-payroll.png](./15-payroll.png) | `/payroll` | Bảng lương | Tổng hợp lương / hoa hồng theo nhân sự (theo tháng) |
| 16 | [16-payroll-user.png](./16-payroll-user.png) | `/payroll/:userId` | Chi tiết lương nhân viên | Phiếu lương một user: đơn, hoa hồng, kỳ lương |
| 17 | [17-vat.png](./17-vat.png) | `/vat` | Hóa đơn VAT | Danh sách hóa đơn VAT và hạn xuất |
| 18 | [18-vat-new.png](./18-vat-new.png) | `/vat/new` | Tạo hóa đơn VAT | Lập hóa đơn VAT gắn đơn / khách |
| 19 | [19-services.png](./19-services.png) | `/services` | Danh mục dịch vụ | Catalog dịch vụ pháp lý: giá, thời gian, trạng thái |
| 20 | [20-services-new.png](./20-services-new.png) | `/services/new` | Tạo dịch vụ | Thêm dịch vụ mới vào catalog |
| 21 | [21-service-detail.png](./21-service-detail.png) | `/services/:id` | Chi tiết dịch vụ | Sửa thông tin / lưu trữ dịch vụ |
| 22 | [22-emails.png](./22-emails.png) | `/emails` | Email | Danh sách email: nháp, lên lịch, đã gửi, thất bại |
| 23 | [23-emails-new.png](./23-emails-new.png) | `/emails/new` | Soạn email | Tạo / gửi / lên lịch email tới khách |
| 24 | [24-users.png](./24-users.png) | `/users` | Người dùng & phân quyền | Danh sách user, vai trò, ma trận quyền trang |
| 25 | [25-config.png](./25-config.png) | `/config` | Cài đặt hệ thống | Ngôn ngữ, giao diện, nhắc hạn VAT, phiên bản |
| 26 | [26-profile.png](./26-profile.png) | `/profile` | Hồ sơ cá nhân | Thông tin tài khoản, avatar, đổi mật khẩu |
| 27 | [27-notifications.png](./27-notifications.png) | `/notifications` | Thông báo | Hộp thông báo nội bộ / nhắc việc |

## Gallery

### Auth

![01 Đăng nhập](./01-login.png)

![02 Chờ duyệt](./02-pending-approval.png)

![03 OAuth callback](./03-auth-callback.png)

![04 OAuth lỗi](./04-auth-callback-error.png)

### Vận hành

![05 Dashboard](./05-dashboard.png)

![06 Đơn hàng](./06-orders.png)

![07 Tạo đơn](./07-orders-new.png)

![08 Chi tiết đơn](./08-order-detail.png)

![09 Khách hàng](./09-customers.png)

![10 Tạo khách](./10-customers-new.png)

![11 Hồ sơ khách](./11-customer-detail.png)

### Tài chính

![12 Thanh toán](./12-payments.png)

![13 Chi tiết thanh toán](./13-payment-detail.png)

![14 Đề nghị thanh toán](./14-expense-approvals.png)

![15 Bảng lương](./15-payroll.png)

![16 Lương nhân viên](./16-payroll-user.png)

![17 VAT](./17-vat.png)

![18 Tạo VAT](./18-vat-new.png)

### Catalog & hệ thống

![19 Dịch vụ](./19-services.png)

![20 Tạo dịch vụ](./20-services-new.png)

![21 Chi tiết dịch vụ](./21-service-detail.png)

![22 Email](./22-emails.png)

![23 Soạn email](./23-emails-new.png)

![24 Người dùng](./24-users.png)

![25 Cấu hình](./25-config.png)

![26 Hồ sơ](./26-profile.png)

![27 Thông báo](./27-notifications.png)

Chụp lại: `node _capture.mjs` (cần Playwright + tạm bypass AuthGate như ghi chú trong script).
