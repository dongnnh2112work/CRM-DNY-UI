# Remotion — Hướng dẫn CRM DNY (preview 1 phút)

Clip Remotion giúp clip hướng dẫn CRM dễ hiểu hơn: caption tiếng Việt, spotlight vùng bấm, step rail.

## Nội dung bản preview

| Thời lượng | Nội dung |
|---|---|
| 0–4s | Intro DNY CRM |
| 4–28s | Đăng nhập (Google + email) |
| 28–36s | Chờ duyệt (Google lần đầu) |
| 36–58s | Tổng quan (thẻ số + danh sách) |
| 58–60s | Outro |

> **Lưu ý:** File `Screen Recording 2026-10-15 at 11.30.33 PM` trong Downloads máy local **không có** trong môi trường Cloud Agent. Bản này dùng ảnh `public/huong-dan` sẵn có. Khi bạn đính kèm / upload clip gốc, sẽ sync đúng luồng ghi hình và làm full.

## Chạy Studio

```bash
cd apps/remotion-huong-dan
npm install
npm run dev
```

## Render MP4

```bash
cd apps/remotion-huong-dan
npx remotion render CrmHuongDan1Min out/crm-huong-dan-1min.mp4
```

## Assets

Ảnh nằm trong `public/`:

- `dang-nhap.png`
- `cho-duyet.png`
- `05-dashboard.png`
