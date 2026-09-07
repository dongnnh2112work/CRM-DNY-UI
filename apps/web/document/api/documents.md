# Documents API — FE contract

> **Status: LIVE** · Module: `legal` · Swagger tag: `documents`  
> Base: `/api/v1/documents`  
> Binary: **Supabase Storage** via Nest `StoragePort` · metadata: `document_metadata`

## Permissions

All endpoints: `document.upload`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/documents/upload` | **Multipart** upload file → Storage + metadata |
| POST | `/documents` | Metadata-only (file đã có trên Storage) |
| GET | `/documents` | List |
| GET | `/documents/:id` | Detail |
| GET | `/documents/:id/download-url` | Signed download URL |
| DELETE | `/documents/:id` | Soft-delete + remove object |

---

## FE note (quan trọng)

FE **không** gọi Supabase Storage trực tiếp và **không** cần biết tên bucket.  
Chỉ gọi Nest: upload multipart → nhận metadata; download qua `download-url` (signed URL).

Permission: `document.upload` (Admin seed có sẵn).

---

## Setup Supabase (BE — một lần; không phải việc FE)

1. Dashboard → **Storage** → tạo bucket **Private** (tên thật trên project hiện tại: `DNY_BUCKET`).  
2. Đặt đúng tên vào backend `.env` (`STORAGE_BUCKET` phải khớp 100%):

```env
SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # bắt buộc — Nest upload vào bucket private
STORAGE_BUCKET="DNY_BUCKET"          # đổi nếu bucket trên Dashboard tên khác
STORAGE_MAX_BYTES="20971520"         # 20MB optional
STORAGE_SIGNED_URL_TTL="3600"        # seconds
# STORAGE_ALLOWED_MIME="application/pdf,image/png,image/jpeg"
```

Restart Nest sau khi sửa `.env`. Không commit `service_role` lên git.

---

## POST `/documents/upload` (khuyến nghị cho FE)

`Content-Type: multipart/form-data` — **không** set header `Content-Type` thủ công (browser/FormData tự gắn boundary).

| Field | Type | Required |
|-------|------|----------|
| file | binary | yes |
| contractId | uuid | one of contractId / orderId |
| orderId | uuid | one of … |
| fileType | string | no (e.g. `contract`) |

**Response `201`**

```ts
{
  id: string;
  contractId: string | null;
  orderId: string | null;
  storageKey: string;
  fileName: string;
  fileType: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedByUserId: string;
  bucket: string; // informational only (e.g. DNY_BUCKET)
  createdAt: string;
  updatedAt: string;
}
```

### Next.js sketch

```ts
const form = new FormData();
form.append('file', file); // File from <input type="file">
form.append('contractId', contractId);
form.append('fileType', 'contract'); // optional

const res = await fetch(`${API}/documents/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  // do NOT set Content-Type — browser sets multipart boundary
  body: form,
});
const doc = await res.json(); // 201
```

Seed contract id (QA): `44444444-4444-4444-8444-444444444401`

---

## GET `/documents/:id/download-url`

```ts
{ id, fileName, mimeType, expiresIn: number, downloadUrl: string }
```

FE mở `downloadUrl` (tab mới / `<a download>`). TTL mặc định 1h (backend `STORAGE_SIGNED_URL_TTL`).

---

## MIME mặc định cho phép

`application/pdf`, `image/jpeg|png|webp`, Word/Excel (legacy + OOXML).

---

## POST `/documents` (metadata only)

Dùng khi FE đã upload bằng signed URL riêng. Cần `storageKey` + `fileName` + `contractId`|`orderId`.
