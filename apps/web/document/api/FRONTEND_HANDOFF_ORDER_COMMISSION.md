# Frontend handoff — % hoa hồng nhân viên trên đơn

> Dành cho **backend**. Không cần API lương mới. FE đã tính lương từ dữ liệu đơn.  
> Thiếu field này thì reload mất `%` và lương tháng = 0.

## Việc cần làm

Thêm `commissionPercent` trên **Order**, persist qua GET / POST / PATCH hiện có.

| | |
|--|--|
| Tên field | `commissionPercent` |
| Ý nghĩa | % hoa hồng **nhân viên phụ trách đơn** (`assignedUserId`) |
| Kiểu | number, nullable. GET có thể trả decimal string như `value` |
| Khoảng | `0`–`100`, tối đa 2 chữ số thập phân. `null` = chưa nhập |
| Bắt buộc | không. Không gửi = giữ nguyên trên PATCH, `null` khi tạo |
| Quyền | cùng `order.create` / `order.update` / `order.view` |

**Không** dùng `collaboratorPrice`, module `commissions`, hay `%` CTV. Đó là hoa hồng cộng tác viên, khác field này.

## Contract

`GET /orders`, `GET /orders/:id`, và sau này `GET /orders/:id/detail` phải trả `commissionPercent`.

`POST /orders` và `PATCH /orders/:id` nhận cùng field (whitelist, không strip).

```json
{ "commissionPercent": 12.5 }
```

Xóa giá trị: `PATCH` `{ "commissionPercent": null }`.

## FE dùng thế nào

Lương tháng của nhân viên (tính trên FE, không gọi API lương):

`lương đơn = commissionPercent / 100 × (thu đã trả trong tháng − chi đã duyệt trong tháng)`

`null` → FE tính 0. Nhiều dịch vụ cùng HĐ: `%` nằm trên **từng order**, thu chia theo giá trị dịch vụ, chi theo đúng `orderId`.

## Xong khi

1. Tạo đơn `{ commissionPercent: 10 }` → GET lại vẫn `10`.
2. PATCH `{ commissionPercent: 8.5 }` → GET lại `8.5`.
3. PATCH `{ commissionPercent: null }` → GET `null`.
4. Đơn cũ chưa có cột → GET `null`, không 500.
