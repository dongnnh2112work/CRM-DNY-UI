# Notifications API — FE contract

> **Status: LIVE** · Module: `communication` · Swagger tag: `notifications`  
> Base: `/api/v1/notifications`  
> **BE emit 6 loại thông báo:** [`FRONTEND_HANDOFF_NOTIFICATIONS.md`](./FRONTEND_HANDOFF_NOTIFICATIONS.md)

## Permissions

| Method | Path | Permission | Scope |
|--------|------|------------|-------|
| GET | `/notifications` | `notification.view_own` | `recipientUserId = current` |
| POST | `/notifications/:id/read` | `notification.view_own` | Must be recipient |

---

## Types

```ts
interface Notification {
  id: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## GET `/notifications`

**Query:** `page`, `pageSize`  
Always filtered to current user.

## POST `/:id/read`

Sets `readAt` to now.
