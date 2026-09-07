# Reminders API — FE contract

> **Status: LIVE** · Module: `communication` · Swagger tag: `reminders`  
> Base: `/api/v1/reminders`

## Permissions

Uses `notification.view_own` (personal inbox capability). All list/detail scoped to `recipientUserId = current`.

| Method | Path | Permission |
|--------|------|------------|
| POST | `/reminders` | `notification.view_own` |
| GET | `/reminders` | `notification.view_own` |
| GET | `/reminders/:id` | `notification.view_own` |
| PATCH | `/reminders/:id` | `notification.view_own` |
| DELETE | `/reminders/:id` | `notification.view_own` |
| POST | `/reminders/:id/complete` | `notification.view_own` |

---

## Types

```ts
interface Reminder {
  id: string;
  recipientUserId: string;
  title: string;
  description: string | null;
  sourceType: string | null;
  sourceId: string | null;
  remindAt: string;
  status: string; // PENDING | COMPLETED
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## POST `/reminders`

Required: `title`, `remindAt`. Optional: `recipientUserId` (default current), `description`, `sourceType`, `sourceId`.

## POST `/:id/complete`

Sets `status: COMPLETED`, `completedAt` now.
