# Frontend handoff — xem / tải file (document viewer)

> Module dùng chung cho **mọi trang** có file Nest (`order`, `contract`, VAT, …).  
> Không gọi Supabase trực tiếp. Chỉ `GET /documents/:id/download-url` rồi preview / download.

Contract HTTP: [`documents.md`](./documents.md)  
Code: `apps/web/src/modules/documents/` + `apps/web/src/components/documents/`

---

## Khi nào dùng

Bất kỳ list/detail nào đã có `document.id` (UUID từ Nest). Ví dụ:

- Hồ sơ làm việc / giấy phép trên đơn (đã gắn)
- File đính kèm hợp đồng, hóa đơn VAT, đề nghị chi — **cùng API**, không viết viewer mới

**Cấm:** `fetch` URL Storage; tự ký URL; preview bằng path local (`a-123`, `lic-…`). File chưa `201` thì viewer báo chưa lưu server.

---

## API surface

| Export | File | Việc |
|--------|------|------|
| `useDocumentViewer()` | `modules/documents/use-document-viewer.tsx` | Mở modal, tải về, toast lỗi |
| `DocumentFileLink` | `components/documents/document-file-actions.tsx` | Tên file bấm để xem |
| `DocumentFileActions` | cùng file | Icon mắt + tải (+ `extra` xóa) |
| `DocumentReviewModal` | `components/documents/document-review-modal.tsx` | Modal preview (PDF / ảnh / Office) |
| `documentsApi.downloadUrl(id)` | `modules/documents/api.ts` | `GET /documents/:id/download-url` |
| `downloadDocument(id, name)` | `modules/documents/open-file.ts` | Tải file (blob hoặc tab mới) |
| `canPreviewDocument(id)` | `use-document-viewer.tsx` | `true` khi `id` là UUID |

Barrel: `import { useDocumentViewer, downloadDocument } from "@/modules/documents"`.

---

## Copy vào trang mới

Phải nằm trong `App` (Ant Design) vì hook dùng `message`.

```tsx
"use client";

import { DocumentFileActions, DocumentFileLink } from "@/components/documents/document-file-actions";
import { useDocumentViewer } from "@/modules/documents/use-document-viewer";

export function SomeFilesTable({ files }: { files: { id: string; name: string }[] }) {
  const docs = useDocumentViewer();

  return (
    <>
      {/* bảng / list */}
      {files.map((file) => (
        <div key={file.id}>
          <DocumentFileLink file={file} viewer={docs} />
          <DocumentFileActions file={file} viewer={docs} />
        </div>
      ))}
      {docs.modal}
    </>
  );
}
```

Chỉ tải, không modal:

```tsx
await docs.download({ id, name });
// hoặc
import { downloadDocument } from "@/modules/documents";
await downloadDocument(id, name);
```

Nút xóa riêng — truyền `extra`:

```tsx
<DocumentFileActions
  file={row}
  viewer={docs}
  extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(row.id)} />}
/>
```

Gọi modal thủ công (không dùng `DocumentFileLink`):

```tsx
docs.open({ id: row.id, name: row.name });
```

---

## Hành vi preview (tối ưu bandwidth)

FE **không** `fetch().blob()` file Storage. Chỉ `GET /documents/:id/download-url` (JSON), rồi browser mở `downloadUrl`.

| Loại | UI |
|------|----|
| PDF | iframe `src=signedUrl` — Chrome có thể Range, không nhét cả file vào RAM JS |
| Ảnh | `Image src=signedUrl` |
| Word / Excel | Office Online embed (họ tải full; file **> 8MB** thì không embed sẵn) |
| Khác | gợi ý tải về |
| `fileSize` > 8MB | Cảnh báo + **Tải về** / **Vẫn xem** |

Luồng:

1. `GET /documents/:id/download-url` → `{ downloadUrl, fileName, mimeType, expiresIn }` — **cache tới gần hết TTL**
2. Preview: gán URL vào iframe/img (không blob JS)
3. Tải về: `<a href=downloadUrl>` **tái dùng URL đã cache**, không fetch blob lần 2

TTL signed URL ~ 1h. Truyền `size` trên `{ id, name, size }` để chặn preview file lớn.

---

## Permission

BE: mọi endpoint documents hiện cần `document.upload` (xem [`documents.md`](./documents.md)).  
403 → toast qua `apiErrorMessage`. Đừng giả lập Storage.

---

## Đã dùng module này

- `components/orders/order-documents.tsx` — hồ sơ làm việc
- `components/orders/license-upload.tsx` — giấy phép

Trang mới **import hook + actions**, không copy modal từ folder `orders/`.
