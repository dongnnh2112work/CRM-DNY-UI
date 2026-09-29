# 8. VAT

## 8.1 Danh sách

![Danh sách VAT](/huong-dan/17-vat.png)

Hình 8.1. Nháp, đã xuất, đã hủy và hạn xuất

Cột trạng thái: ==Nháp==, ==Đã xuất==, ==Đã hủy==. Hạn gần tới được tô cảnh báo. Số ngày cảnh báo chỉnh ở Cài đặt.

## 8.2 Lập hóa đơn

![Form tạo VAT](/huong-dan/18-vat-new.png)

Hình 8.2. Gắn hóa đơn vào một đơn đã có số hợp đồng

```flow
Đơn có số hợp đồng → Tạo VAT → Nháp → Xuất
```

### 8.2.1 Từ danh sách

Bấm ==+ Tạo mới==, chọn đơn.

### 8.2.2 Từ đơn hàng

Trên chi tiết đơn, bấm **Tạo VAT**. Đơn chưa có số hợp đồng thì nút mờ.

:::warn
Không chọn đơn không hợp đồng. Hệ thống chặn và báo lỗi.
:::

## 8.3 Xuất hoặc hủy

Mở hóa đơn nháp. **Xuất** khi được phép xuất. **Hủy** khi được phép hủy. Không có ô tự sửa trạng thái.
