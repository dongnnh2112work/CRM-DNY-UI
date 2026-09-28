# Mail / email templates — FE contract

> **Status: LIVE** · Module: `communication` + `common/mail` (Resend MailPort)  
> Bases: `/api/v1/email-templates`, `/api/v1/mail`, `/api/v1/notification-preferences`

## Env (Resend)

```bash
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM="DYN CRM <noreply@your-verified-domain.com>"
```

- Domain phải verify trên [Resend](https://resend.com/domains).
- Dev có thể dùng `onboarding@resend.dev` làm `MAIL_FROM` (giới hạn Resend).
- Secret **không** lưu DB — chỉ env (local / Railway).

## Permissions

| Method | Path | Permission |
|--------|------|------------|
| * | `/email-templates` | `email.template.manage` |
| GET | `/mail/status` | `email.template.manage` |
| GET | `/mail/outbound` | `email.template.manage` |
| POST | `/mail/test` | `email.template.manage` |
| POST | `/mail/send` | `email.template.manage` |
| GET/PUT | `/notification-preferences` | `notification.view_own` |

Role seed: SUPER_ADMIN / ADMIN (group `system.config`) có `email.template.manage`.

## Tables

| Table | Purpose |
|-------|---------|
| `email_templates` | Subject/HTML/text + `key` (`{{var}}` placeholders) |
| `user_notification_preferences` | Per-user channel EMAIL / IN_APP / TELEGRAM |
| `outbound_email_logs` | SENT / FAILED / SKIPPED + provider id |
| `app_config` key `mail.flags` | Feature toggles (optional) |

## Setup checklist

1. Tạo API key Resend → set `RESEND_API_KEY` + `MAIL_FROM` trên Railway / `.env`.
2. Apply migration: `cd apps/backend && pnpm exec prisma migrate deploy`
3. Seed (hoặc tạo template `mail.test` qua API).
4. `GET /mail/status` → `{ configured: true, from: "..." }`
5. `POST /mail/test` `{ "to": "you@example.com" }`

## Template variables

Body/subject dùng `{{name}}`. Unknown keys giữ nguyên.

Seed keys: `mail.test`, `expense.submitted`, `expense.approved`, `expense.rejected`.

## Preferences

`PUT /notification-preferences`

```json
{ "channel": "EMAIL", "eventType": "expense.approved", "enabled": false }
```

- `eventType: "*"` = cả channel.
- Không có row → **enabled** (default).
- `POST /mail/send` với `recipientUserId` sẽ SKIPPED nếu user tắt EMAIL.

## Programmatic send (other modules)

Inject `MailApplicationService` (exported từ `CommunicationModule`) → `sendTemplated({ templateKey, to, variables, recipientUserId?, eventType? })`.

## FE (`/emails`)

Trang quản trị không còn hộp thư local. Mỗi capability map đúng endpoint:

| Tab | API |
|-----|-----|
| Banner | `GET /mail/status` |
| Nhật ký gửi | `GET /mail/outbound?page&pageSize&templateKey` |
| Mẫu | `GET/POST /email-templates`, `PATCH/DELETE /email-templates/:id` |
| Gửi thử | Tạo/bật mẫu `mail.test` nếu chưa có, rồi `POST /mail/test` `{ to }` |
| Gửi theo mẫu | `POST /mail/send` `{ templateKey, to, variables?, recipientUserId?, eventType?, relatedNotificationId? }` |
| Kênh thông báo | `GET/PUT /notification-preferences` (quyền `notification.view_own`, của chính user) |

Menu **Quản lý email** ẩn khi user không có `email.template.manage`. Không có API nháp / lên lịch / gửi HTML tùy ý.
