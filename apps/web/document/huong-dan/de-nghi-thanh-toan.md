# 6. Đề nghị thanh toán

Đây là chỗ duyệt chi, tách khỏi tab chi phí trên đơn nhưng cùng một dữ liệu.

![Duyệt đề nghị](/huong-dan/14-expense-approvals.png)

Hình 6.1. Lọc theo trạng thái, duyệt hoặc từ chối

## 6.1 Xem danh sách

Mặc định lọc ==Chờ duyệt==. Đổi lọc sang Đã duyệt, Từ chối hoặc Tất cả.

## 6.2 Duyệt hoặc từ chối

Chỉ người có quyền duyệt thấy nút. Cả hai đều hỏi lại trước khi gửi.

```flow
Người đề nghị gửi → Chờ → Duyệt hoặc Từ chối
```

:::note
Không có quyền duyệt thì chỉ xem, không có nút.
:::

## 6.3 Tạo đề nghị

Bấm tạo, chọn đơn, số tiền, nội dung và file nếu có.
