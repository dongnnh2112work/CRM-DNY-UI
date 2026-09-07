# Contract Requests API — FE contract

> **Status: LIVE** · Module: `collaboration` · Swagger tag: `contract-requests`  
> Base: `/api/v1/contract-requests`

## Permissions

| Method | Path | Permission |
|--------|------|------------|
| POST | `/contract-requests` | `contract_request.create` |
| GET | `/contract-requests` | `contract_request.view` |
| GET | `/contract-requests/:id` | `contract_request.view` |
| PATCH | `/contract-requests/:id` | `contract_request.create` |
| POST | `/contract-requests/:id/review` | `contract_request.review` |
| POST | `/contract-requests/:id/approve` | `contract_request.approve` |
| POST | `/contract-requests/:id/reject` | `contract_request.reject` |

**Business rule:** collaborator cannot review/approve/reject own request  
(`collaborator.userId === currentUser.id` → **403**).

---

## Types

```ts
type ContractRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'NEEDS_INFO'
  | 'APPROVED'
  | 'REJECTED';

interface ContractRequest {
  id: string;
  collaboratorId: string;
  customerId: string | null;
  leadId: string | null;
  title: string;
  description: string | null;
  status: ContractRequestStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  approvedContractId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## POST `/contract-requests`

Required: `collaboratorId`, `title`. Optional: `description`, `customerId`, `leadId`.  
Creates as **SUBMITTED**.

## Commands

- **review** `{ note? }` → IN_REVIEW  
- **approve** `{ note?, approvedContractId? }` → APPROVED  
- **reject** `{ note? }` → REJECTED
