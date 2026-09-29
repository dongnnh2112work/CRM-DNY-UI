# 4. Đơn hàng

## 4.1 Danh sách

![Danh sách đơn](/huong-dan/06-orders.png)

Hình 4.1. Kanban theo giai đoạn, hoặc chuyển sang bảng

- **Kanban:** mỗi cột là một giai đoạn. Kéo thẻ nếu bạn được đổi giai đoạn.
- **Bảng:** mã, khách, dịch vụ, giai đoạn, phụ trách, hạn, tiền.

Bấm ==+ Đơn mới== để tạo. Lọc theo người phụ trách hoặc tháng.

## 4.2 Tạo đơn

![Form tạo đơn](/huong-dan/07-orders-new.png)

Hình 4.2. Chọn khách, dịch vụ, hạn và người phụ trách

Bắt buộc đủ khách, dịch vụ và các ô có dấu yêu cầu. Có thể tạo từ hồ sơ khách, hệ thống điền sẵn khách đó.

## 4.3 Chi tiết đơn

![Chi tiết đơn](/huong-dan/08-order-detail.png)

Hình 4.3. Đầu trang là thao tác, phía dưới là chi phí, hồ sơ, giấy phép

```map
Chi tiết đơn
  Đổi giai đoạn
  Chi phí
  Hồ sơ làm việc
  Giấy phép
  Thanh toán
  VAT
```

### 4.3.1 Đổi giai đoạn

Chọn giai đoạn mới. Hệ thống hỏi ==Chuyển sang…?== rồi mới lưu.

### 4.3.2 Chi phí, hồ sơ, giấy phép

1. **Chi phí:** thêm đề nghị chi của đơn này.
2. **Hồ sơ:** tải PDF, Word hoặc Excel.
3. **Giấy phép:** tải file kết quả và ==bắt buộc ngày hết hạn==.

:::note
Nút **Tạo VAT** mờ nếu đơn chưa có số hợp đồng.
:::
