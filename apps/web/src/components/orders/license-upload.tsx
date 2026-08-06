"use client";

import {
  DeleteOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  InboxOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import { App, Button, List, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import type { OrderAttachment } from "@/lib/types";
import { ACCEPT_FILE_TYPES, getAttachmentType } from "@/lib/order-workflow";

function typeIcon(type: OrderAttachment["type"]) {
  if (type === "pdf") return <FilePdfOutlined style={{ color: "#ff4d4f" }} />;
  if (type === "word") return <FileWordOutlined style={{ color: "#1677ff" }} />;
  if (type === "excel") return <FileExcelOutlined style={{ color: "#52c41a" }} />;
  return <PaperClipOutlined />;
}

interface LicenseUploadProps {
  files: OrderAttachment[];
  onChange: (next: OrderAttachment[]) => void;
  uploaderName?: string;
  /** Compact mode for form inside approval panel */
  compact?: boolean;
}

export function LicenseUpload({
  files,
  onChange,
  uploaderName = "Admin",
  compact = false,
}: LicenseUploadProps) {
  const { message } = App.useApp();
  const visible = (files ?? []).filter((a) => !a.deleted);

  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    const type = getAttachmentType(file.name);
    if (type === "other") {
      message.error("Chỉ cho phép PDF, Word (.doc/.docx), Excel (.xls/.xlsx)");
      return Upload.LIST_IGNORE;
    }
    const next: OrderAttachment = {
      id: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      type,
      size: file.size,
      uploadedBy: uploaderName,
      uploadedAt: new Date().toISOString().slice(0, 10),
    };
    onChange([...(files ?? []), next]);
    message.success(`Đã lưu giấy phép: ${file.name}`);
    return false;
  };

  const remove = (id: string) => {
    onChange((files ?? []).map((a) => (a.id === id ? { ...a, deleted: true } : a)));
  };

  return (
    <div>
      <Upload.Dragger
        accept={ACCEPT_FILE_TYPES}
        beforeUpload={beforeUpload}
        showUploadList={false}
        multiple
        style={compact ? { padding: "12px 8px" } : undefined}
      >
        <p className="ant-upload-drag-icon" style={compact ? { marginBottom: 4 } : undefined}>
          <InboxOutlined />
        </p>
        <p className="ant-upload-text" style={{ fontSize: compact ? 13 : undefined }}>
          Tải lên file giấy phép / văn bản được cấp phép
        </p>
        <p className="ant-upload-hint" style={{ fontSize: 12 }}>
          Lưu final — tách riêng hồ sơ làm việc. PDF / Word / Excel
        </p>
      </Upload.Dragger>

      {visible.length > 0 && (
        <List
          size="small"
          style={{ marginTop: 8 }}
          dataSource={visible}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="del"
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(item.id)}
                />,
              ]}
            >
              <List.Item.Meta
                avatar={typeIcon(item.type)}
                title={<Typography.Text style={{ fontSize: 13 }}>{item.name}</Typography.Text>}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {item.uploadedBy} · {item.uploadedAt}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
