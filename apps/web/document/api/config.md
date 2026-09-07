# App Config API — FE contract

> **Status: LIVE** · Module: `system` · Swagger tag: `config`  
> Base: `/api/v1/config`

## Permissions

| Method | Path | Permission |
|--------|------|------------|
| GET | `/config` | authenticated (any) |
| GET | `/config/:key` | authenticated (any) |
| PATCH | `/config/:key` | `config.manage` |

---

## Types

```ts
interface AppConfig {
  key: string;
  valueJson: unknown;
  createdAt: string;
  updatedAt: string;
}
```

## GET `/config`

**Query:** optional `key` — if set, returns single-item list or 404.

Response: `{ items: AppConfig[] }`

## PATCH `/config/:key`

Body: `{ valueJson: object | array }` — upserts the key.
