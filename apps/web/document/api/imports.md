# Lead Imports API — FE contract

> **Status: LIVE** · Module: `crm` · Swagger tag: `imports`  
> Base: `/api/v1/imports/batches`

MVP import pipeline: create batch → add rows → commit valid rows as leads.

## Permissions

| Method | Path | Permission |
|--------|------|------------|
| POST | `/imports/batches` | `lead.import` |
| POST | `/imports/batches/:id/rows` | `lead.import` |
| POST | `/imports/batches/:id/commit` | `lead.import` |

---

## Flow

1. **POST `/imports/batches`** `{ fileRef? }` → status `OPEN`
2. **POST `/:id/rows`** `{ rows: [{ rowNumber, rawJson }] }`  
   - Validates each row: needs at least one of `name` / `phone` / `email` → `VALID` else `INVALID`
3. **POST `/:id/commit`** — creates leads from VALID rows (`source` default `import`, `status` default `NEW`, owner = current user), sets batch `COMMITTED`

```ts
interface ImportBatch {
  id: string;
  fileRef: string | null;
  status: string; // OPEN | COMMITTED
  createdByUserId: string;
  committedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rows?: ImportRow[];
}

interface ImportRow {
  id: string;
  batchId: string;
  rowNumber: number;
  rawJson: Record<string, unknown>;
  validationStatus: string; // VALID | INVALID
  resultingLeadId: string | null;
}
```
