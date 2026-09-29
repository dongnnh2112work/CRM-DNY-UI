# 12. Phân quyền

Quyền không gắn trực tiếp từng ô trên user. Đi theo chuỗi dưới.

```map
Người dùng
  Vai trò
    Nhóm quyền
      Quyền lẻ
        Xem khách
        Tạo đơn
        Duyệt chi
```

## 12.1 Chuỗi gán quyền

```flow
Tạo nhóm quyền → Gán nhóm vào vai trò → Gán vai trò cho user
```

### 12.1.1 Nhóm quyền

Một nhóm là một túi quyền, ví dụ xem khách, sửa đơn, duyệt chi. Lưu nhóm là thay cả túi.

### 12.1.2 Vai trò

Mở ==Phân quyền==. Chọn vai trò, tick các nhóm, lưu. Lưu là thay cả danh sách nhóm của vai trò đó.

### 12.1.3 User

Gán vai trò ở mục **11. Người dùng**. User nhận quyền mới phải tải lại trang.

## 12.2 Xóa nhóm đang dùng

Nếu nhóm còn gắn vai trò, hệ thống bắt xử lý người bị ảnh hưởng rồi mới xóa.

:::warn
Chưa có ảnh màn Phân quyền hiện tại. Ảnh mục 11 chỉ là danh sách user. Cần chụp `/users/permissions`.
:::

:::note
Không đủ quyền thì menu Phân quyền không hiện. Nút trên từng màn ẩn theo quyền, không theo tên vai trò.
:::
