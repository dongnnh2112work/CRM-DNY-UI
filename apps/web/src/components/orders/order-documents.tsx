"use client";

import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { App, Button, Tag, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useMemo } from "react";
import { attachmentTypeIcon } from "@/components/orders/attachment-type-icon";
import { DataTable } from "@/components/shared/data-table";
import type { OrderAttachment } from "@/lib/types";
import { ACCEPT_FILE_TYPES, getAttachmentType } from "@/lib/order-workflow";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { documentsApi } from "@/modules/documents/api";
import { mapApiDocumentToAttachment } from "@/modules/documents/map-to-ui";
import { useT } from "@/lib/use-t";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface OrderDocumentsProps {
  attachments: OrderAttachment[];
  onChange: (next: OrderAttachment[]) => void;
  uploaderName?: string;
  orderId?: string;
}

/** Hồ sơ làm việc trong quá trình xử lý (không gồm giấy phép final) */
export function OrderDocuments({ attachments, onChange, uploaderName = "Admin", orderId }: OrderDocumentsProps) {
  const t = useT();
  const { message } = App.useApp();
  const { can } = useSession();
  const canUpload = can(PERMISSION.documentUpload);
  const visible = attachments.filter((a) => !a.deleted);

  const beforeUpload: UploadProps["beforeUpload"] = async (file) => {
    if (!canUpload) {
      message.error(t("docs.needUploadPerm"));
      return Upload.LIST_IGNORE;
    }
    const type = getAttachmentType(file.name);
    if (type === "other") {
      message.error(t("file.allowedTypes"));
      return Upload.LIST_IGNORE;
    }
    try {
      if (orderId) {
        const doc = await documentsApi.upload(file, { orderId, fileType: "work" });
        onChange([...attachments, mapApiDocumentToAttachment(doc, uploaderName)]);
      } else {
        const next: OrderAttachment = {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type,
          size: file.size,
          uploadedBy: uploaderName,
          uploadedAt: new Date().toISOString().slice(0, 10),
        };
        onChange([...attachments, next]);
      }
      message.success(t("docs.added", { name: file.name }));
    } catch (err) {
      message.error(apiErrorMessage(err, t("docs.added", { name: file.name })));
    }
    return false;
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
        render: (name: string, r: OrderAttachment) => (
          <span>
            {attachmentTypeIcon(r.type)} <Typography.Text>{name}</Typography.Text>
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
        render: (s: number) => formatSize(s),
      },
      { title: t("common.uploader"), dataIndex: "uploadedBy", width: 140 },
      { title: t("common.date"), dataIndex: "uploadedAt", width: 110 },
      {
        title: "",
        key: "action",
        width: 64,
        render: (_: unknown, r: OrderAttachment) => (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => softDelete(r.id)}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {t("docs.intro")}
      </Typography.Paragraph>
      <Upload.Dragger
        accept={ACCEPT_FILE_TYPES}
        beforeUpload={beforeUpload}
        showUploadList={false}
        multiple
        disabled={!canUpload}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t("docs.drop")}</p>
        <p className="ant-upload-hint">{t("docs.uploadHint")}</p>
      </Upload.Dragger>

      <div style={{ marginTop: 16 }}>
        <DataTable<OrderAttachment>
          rowKey="id"
          size="small"
          pagination={false}
          padded={false}
          dataSource={visible}
          dateFilterField="uploadedAt"
          enableLocalSearch
          emptyDescription={t("docs.empty")}
          columns={columns}
        />
      </div>
    </div>
  );
}
