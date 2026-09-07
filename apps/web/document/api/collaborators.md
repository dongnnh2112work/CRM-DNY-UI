# Collaborators API — FE contract

> **Status: LIVE** · Module: `collaboration` · Swagger tag: `collaborators`  
> Base: `/api/v1/collaborators`

## Permissions

| Method | Path | Permission |
|--------|------|------------|
| POST | `/collaborators` | `collaborator.create` |
| GET | `/collaborators` | `collaborator.view` |
| GET | `/collaborators/:id` | `collaborator.view` |
| PATCH | `/collaborators/:id` | `collaborator.update` |
| POST | `/collaborators/:id/deactivate` | `collaborator.deactivate` |
| POST | `/collaborators/:id/customers` | `collaborator_customer.assign` |
| DELETE | `/collaborators/:id/customers/:customerId` | `collaborator_customer.assign` |
| GET | `/collaborators/:id/customers` | `collaborator.view` |

---

## Types

```ts
type CollaboratorStatus = 'ACTIVE' | 'INACTIVE';

interface Collaborator {
  id: string;
  userId: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  status: CollaboratorStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## POST `/collaborators`

Required: `userId`, `displayName`. Optional: `phone`, `email`, `notes`.

## POST `/:id/deactivate`

Sets `status: INACTIVE`.

## Customers

- **POST** `{ customerId }` — assign  
- **DELETE** `/:customerId` — unassign (**204**)  
- **GET** — `{ items: [{ collaboratorId, customerId, assignedAt }] }`
