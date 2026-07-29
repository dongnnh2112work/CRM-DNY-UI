# Service Catalog

## Purpose

Manage all legal services.

## Business Rules

- Service Code must be unique.
- One Service has one Workflow Template.
- One Workflow Template contains many Workflow Steps.
- Service cannot be deleted if existing Cases are using it (use archive; permanent delete via API only when no cases).

## Fields

| Field | Notes |
|--------|--------|
| Service Name | Required |
| Service Code | Required, unique |
| Description | Optional |
| Estimated SLA | e.g. days |
| Default Fee | Currency |
| VAT | Rate % |
| Required Documents | List |
| Workflow Template | Required, single select |

## Acceptance Criteria

- Create Service
- Edit Service
- Duplicate Service
- Archive Service
- Restore Service
- Search
- Filter
- Pagination
- RBAC

## APIs

| Method | Path |
|--------|------|
| GET | `/services` |
| POST | `/services` |
| PATCH | `/services/:id` |
| DELETE | `/services/:id` |
| GET | `/services/:id` |
