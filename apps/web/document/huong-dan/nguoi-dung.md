# 11. Người dùng

Chỉ tài khoản có quyền quản lý user mới thấy menu.

## 11.1 Danh sách

![Danh sách người dùng](/huong-dan/24-users.png)

Hình 11.1. Tên, liên hệ, vai trò và trạng thái

Bấm tên để mở hồ sơ. Bấm ==+ Người dùng mới== để thêm. Vai trò hiện bằng nhãn màu, ví dụ Kinh doanh, Quản trị.

## 11.2 Thêm hoặc sửa

Điền tên, email, điện thoại, ngày sinh, địa chỉ, **một bộ vai trò**, trạng thái.

:::note
Đổi vai trò là **thay cả bộ**, không cộng thêm vào vai trò cũ.
:::

## 11.3 Duyệt Gmail mới

Vào ==Tài khoản chờ duyệt==.

```flow
User Google mới → Chờ duyệt → Chọn vai trò → Kích hoạt
```

1. Bấm **Duyệt**, chọn một vai trò. Mặc định gợi ý Kinh doanh.
2. **Từ chối** thì khóa tài khoản, có hỏi lại.

:::warn
Chưa có ảnh màn chờ duyệt của quản trị. Cần chụp `/users/pending` để gắn vào mục này.
:::

Người vừa được duyệt phải mở lại app hoặc tải lại phiên mới vào được CRM.
