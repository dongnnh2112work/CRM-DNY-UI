# Workflows API — FE contract

> **Status: LIVE** · Module: `legal` · Swagger tags: `workflow-templates`, `workflow-instances`  
> Permission for all routes: `workflow_template.manage`

## Templates

| Method | Path | Notes |
|--------|------|--------|
| POST | `/workflow-templates` | Optional nested `stages` |
| GET | `/workflow-templates` | List with stages |
| GET | `/workflow-templates/:id` | Detail + stages |
| PATCH | `/workflow-templates/:id` | `name`, `description`, `isActive` |
| GET | `/workflow-templates/:id/stages` | Stages only |

### POST body

```ts
{
  name: string;
  description?: string;
  isActive?: boolean; // default true
  stages?: Array<{
    name: string;
    sortOrder: number;
    responsibleRoleCode?: string;
  }>;
}
```

---

## Instances

| Method | Path | Notes |
|--------|------|--------|
| POST | `/workflow-instances` | Start at first stage (`sortOrder` asc) |
| POST | `/workflow-instances/:id/advance` | Move to `stageId` |

### Start

```ts
{ contractId: string; templateId: string }
```

Rules: contract exists; template active; template has ≥1 stage.  
Sets `startedAt`, `currentStageId` = first stage.

### Advance

```ts
{ stageId: string }
```

`stageId` must belong to the instance’s template.  
If advancing to the last stage, sets `completedAt`.
