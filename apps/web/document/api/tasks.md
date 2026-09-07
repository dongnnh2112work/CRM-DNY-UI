# Tasks API — FE contract

> **Status: LIVE** · Module: `legal` · Swagger tag: `tasks`  
> Base: `/api/v1/tasks`

## Permissions

| Method | Path | Permission | Scope |
|--------|------|------------|-------|
| POST | `/tasks` | `task.create` | — |
| GET | `/tasks` | `task.view` | ALL if `task.create`+`task.update`; else OWN by assignee or creator |
| GET | `/tasks/:id` | `task.view` | Must be in scope |
| PATCH | `/tasks/:id` | `task.update` | Must be in scope |
| DELETE | `/tasks/:id` | `task.update` | Hard delete; must be in scope |

---

## Types

```ts
interface Task {
  id: string;
  instanceId: string | null;
  contractId: string;
  title: string;
  description: string | null;
  assigneeUserId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  status: string; // OPEN | DONE | …
  createdAt: string;
  updatedAt: string;
}
```

---

## POST `/tasks`

| Field | Type | Required |
|-------|------|----------|
| contractId | uuid | yes |
| title | string | yes |
| instanceId | uuid | no |
| description | string | no |
| assigneeUserId | uuid | no |
| dueAt | ISO datetime | no |
| status | string | no (default `OPEN`) |

---

## GET `/tasks`

**Query:** `page`, `pageSize`, `contractId`, `status`, `assigneeUserId`

---

## PATCH `/tasks/:id`

Partial update. Optional `completed: true` sets `completedAt` now and status `DONE` (unless `status` provided).  
`completed: false` clears `completedAt`.
