"use client";

import {
  DeleteOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  InboxOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import { App, Button, Table, Tag, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import type { OrderAttachment } from "@/lib/types";
import { ACCEPT_FILE_TYPES, getAttachmentType } from "@/lib/order-workflow";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeIcon(type: OrderAttachment["type"]) {
  if (type === "pdf") return <FilePdfOutlined style={{ color: "#ff4d4f" }} />;
  if (type === "word") return <FileWordOutlined style={{ color: "#1677ff" }} />;
  if (type === "excel") return <FileExcelOutlined style={{ color: "#52c41a" }} />;
  return <PaperClipOutlined />;
}

interface OrderDocumentsProps {
  attachments: OrderAttachment[];
  onChange: (next: OrderAttachment[]) => void;
  uploaderName?: string;
}

/** Hồ sơ làm việc trong quá trình xử lý (không gồm giấy phép final) */
export function OrderDocuments({ attachments, onChange, uploaderName = "Admin" }: OrderDocumentsProps) {
  const { message } = App.useApp();
  const visible = attachments.filter((a) => !a.deleted);

  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    const type = getAttachmentType(file.name);
    if (type === "other") {
      message.error("Chỉ cho phép PDF, Word (.doc/.docx), Excel (.xls/.xlsx)");
      return Upload.LIST_IGNORE;
    }
    const next: OrderAttachment = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      type,
      size: file.size,
      uploadedBy: uploaderName,
      uploadedAt: new Date().toISOString().slice(0, 10),
    };
    onChange([...attachments, next]);
    message.success(`Đã thêm ${file.name}`);
    return false;
  };

  const softDelete = (id: string) => {
    onChange(attachments.map((a) => (a.id === id ? { ...a, deleted: true } : a)));
  };

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Hồ sơ làm việc trong quá trình xử lý. File giấy phép final tải riêng khi chuyển sang Hoàn thành.
      </Typography.Paragraph>
      <Upload.Dragger accept={ACCEPT_FILE_TYPES} beforeUpload={beforeUpload} showUploadList={false} multiple>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Nhấn hoặc kéo thả file PDF / Word / Excel vào đây</p>
        <p className="ant-upload-hint">Tải lên mô phỏng — chỉ lưu metadata</p>
      </Upload.Dragger>

      <Table
        style={{ marginTop: 16 }}
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={visible}
        locale={{ emptyText: "Chưa có hồ sơ làm việc" }}
        columns={[
          {
            title: "Tệp",
            dataIndex: "name",
            render: (name: string, r: OrderAttachment) => (
              <span>
                {typeIcon(r.type)} <Typography.Text>{name}</Typography.Text>
              </span>
            ),
          },
          {
            title: "Loại",
            dataIndex: "type",
            width: 90,
            render: (t: string) => <Tag>{t.toUpperCase()}</Tag>,
          },
          {
            title: "Kích thước",
            dataIndex: "size",
            width: 100,
            render: (s: number) => formatSize(s),
          },
          { title: "Người tải", dataIndex: "uploadedBy", width: 140 },
          { title: "Ngày", dataIndex: "uploadedAt", width: 110 },
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
        ]}
      />
    </div>
  );
}
