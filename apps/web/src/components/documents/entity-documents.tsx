"use client";

import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { App, Button, Tag, Tooltip, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { DocumentFileActions, DocumentFileLink } from "@/components/documents/document-file-actions";
import { attachmentTypeIcon } from "@/components/orders/attachment-type-icon";
import { UploadJobsBar, type UploadJob } from "@/components/orders/upload-jobs-bar";
import { DataTable } from "@/components/shared/data-table";
import type { OrderAttachment } from "@/lib/types";
import { ACCEPT_FILE_TYPES, getAttachmentType } from "@/lib/order-workflow";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { documentsApi } from "@/modules/documents/api";
import { formatFileBytes, mapApiDocumentToAttachment } from "@/modules/documents/map-to-ui";
import { useDocumentViewer } from "@/modules/documents/use-document-viewer";
import { useT } from "@/lib/use-t";

export interface EntityDocumentsProps {
  attachments: OrderAttachment[];
  onChange: (next: OrderAttachment[]) => void;
  uploaderName?: string;
  orderId?: string;
  /** Nest `fileType` — e.g. `work`, `vat|{invoiceId}` */
  fileType?: string;
  intro?: ReactNode;
  emptyDescription?: string;
}

/** Drag-drop upload + list — cùng API documents của Quản lý đơn hàng. */
export function EntityDocuments({
  attachments,
  onChange,
  uploaderName = "Admin",
  orderId,
  fileType = "work",
  intro,
  emptyDescription,
}: EntityDocumentsProps) {
  const t = useT();
  const { message } = App.useApp();
  const { can } = useSession();
  const canUpload = can(PERMISSION.documentUpload);
  const visible = attachments.filter((a) => !a.deleted);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const docs = useDocumentViewer();
  const busy = jobs.length > 0;

  const patchJob = (id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  };

  const appendIfNew = (item: OrderAttachment) => {
    if (!item.id) return;
    const current = attachmentsRef.current;
    if (current.some((row) => row.id === item.id && !row.deleted)) return;
    onChange([...current, item]);
  };

  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    if (!canUpload) {
      message.error(t("docs.needUploadPerm"));
      return Upload.LIST_IGNORE;
    }
    const type = getAttachmentType(file.name);
    if (type === "other") {
      message.error(t("file.allowedTypes"));
      return Upload.LIST_IGNORE;
    }
    const jobId = `${file.uid}-${Date.now()}`;
    setJobs((prev) => [...prev, { id: jobId, name: file.name, percent: 0, phase: "upload" }]);
    void (async () => {
      try {
        if (orderId) {
          const doc = await documentsApi.upload(file, { orderId, fileType }, (percent) => {
            patchJob(jobId, { percent, phase: percent >= 100 ? "saving" : "upload" });
          });
          if (!doc?.id) throw new Error(t("docs.uploadFailed", { name: file.name }));
          patchJob(jobId, { percent: 100, phase: "saving" });
          try {
            appendIfNew(mapApiDocumentToAttachment(doc, uploaderName));
          } catch {
            appendIfNew({
              id: doc.id,
              name: doc.fileName || file.name,
              type,
              size: typeof doc.fileSize === "number" ? doc.fileSize : file.size,
              uploadedBy: uploaderName,
              uploadedAt: new Date().toISOString().slice(0, 10),
            });
          }
          message.success(
            t("docs.uploadedOk", {
              name: doc.fileName || file.name,
              size: formatFileBytes(doc.fileSize ?? file.size),
              id: doc.id,
            }),
          );
        } else {
          appendIfNew({
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            type,
            size: file.size,
            uploadedBy: uploaderName,
            uploadedAt: new Date().toISOString().slice(0, 10),
          });
          message.success(t("docs.added", { name: file.name }));
        }
      } catch (err) {
        message.error(apiErrorMessage(err, t("docs.uploadFailed", { name: file.name })));
      } finally {
        setJobs((prev) => prev.filter((job) => job.id !== jobId));
      }
    })();
    return Upload.LIST_IGNORE;
  };

  const softDelete = async (id: string) => {
    try {
      if (orderId) await documentsApi.remove(id);
      onChange(attachments.map((a) => (a.id === id ? { ...a, deleted: true } : a)));
    } catch (err) {
      message.error(apiErrorMessage(err, t("docs.empty")));
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t("common.file"),
        dataIndex: "name",
        render: (_name: string, r: OrderAttachment) => (
          <span>
            {attachmentTypeIcon(r.type)} <DocumentFileLink file={r} viewer={docs} />
          </span>
        ),
      },
      {
        title: t("common.type"),
        dataIndex: "type",
        width: 90,
        render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
      },
      {
        title: t("common.size"),
        dataIndex: "size",
        width: 100,
        render: (s: number) => formatFileBytes(s),
      },
      { title: t("common.uploader"), dataIndex: "uploadedBy", width: 140 },
      { title: t("common.date"), dataIndex: "uploadedAt", width: 110 },
      {
        title: "",
        key: "action",
        width: 128,
        render: (_: unknown, r: OrderAttachment) => (
          <DocumentFileActions
            file={r}
            viewer={docs}
            extra={
              <Tooltip title={t("common.delete")}>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => void softDelete(r.id)}
                />
              </Tooltip>
            }
          />
        ),
      },
    ],
    [docs.busyId, docs.download, docs.open, t],
  );

  return (
    <div>
      {intro ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {intro}
        </Typography.Paragraph>
      ) : null}
      <Upload.Dragger
        accept={ACCEPT_FILE_TYPES}
        beforeUpload={beforeUpload}
        fileList={[]}
        showUploadList={false}
        multiple
        disabled={!canUpload || busy}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{busy ? t("docs.waitUpload") : t("docs.drop")}</p>
        <p className="ant-upload-hint">{t("docs.uploadHint")}</p>
      </Upload.Dragger>
      <UploadJobsBar jobs={jobs} />

      <div style={{ marginTop: 16 }}>
        <DataTable<OrderAttachment>
          rowKey="id"
          size="small"
          pagination={false}
          padded={false}
          dataSource={visible}
          dateFilterField="uploadedAt"
          enableLocalSearch
          emptyDescription={emptyDescription ?? t("docs.empty")}
          columns={columns}
        />
      </div>
      {docs.modal}
    </div>
  );
}
