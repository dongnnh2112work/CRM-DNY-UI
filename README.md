# CRM DNY - UI

Next.js UI mockup cho hệ thống CRM DNY.

## Cấu trúc

```
apps/web/   ← ứng dụng Next.js (đặt Root Directory = apps/web khi deploy)
```

## Dev

```bash
cd apps/web
pnpm install
pnpm dev
```

Hoặc từ thư mục gốc: `npm run dev`

## Deploy Vercel

1. Import repo `CRM-DNY-UI`
2. **Root Directory:** `apps/web` ← bắt buộc
3. Framework: Next.js (tự nhận)
4. Install: `pnpm install`
5. Build: `pnpm build`

Nếu thấy lỗi *No Next.js version detected* → Root Directory đang để trống / `.` thay vì `apps/web`.
