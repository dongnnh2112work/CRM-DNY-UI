"use client";

import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Form, List, Modal, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { attachmentTypeIcon } from "@/components/orders/attachment-type-icon";
import type { OrderAttachment } from "@/lib/types";
import { ds } from "@/lib/design-tokens";
import { ACCEPT_FILE_TYPES, getAttachmentType } from "@/lib/order-workflow";

interface LicenseUploadProps {
  files: OrderAttachment[];
  onChange: (next: OrderAttachment[]) => void;
  uploaderName?: string;
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dateForm] = Form.useForm();

  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    const type = getAttachmentType(file.name);
    if (type === "other") {
      message.error("Chỉ cho phép PDF, Word (.doc/.docx), Excel (.xls/.xlsx)");
      return Upload.LIST_IGNORE;
    }
    setPendingFile(file);
    dateForm.setFieldsValue({
      issuedAt: dayjs(),
      expiresAt: dayjs().add(1, "year"),
    });
    return false;
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;
    const values = await dateForm.validateFields();
    const type = getAttachmentType(pendingFile.name);
    const next: OrderAttachment = {
      id: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: pendingFile.name,
      type,
      size: pendingFile.size,
      uploadedBy: uploaderName,
      uploadedAt: new Date().toISOString().slice(0, 10),
      issuedAt: values.issuedAt ? values.issuedAt.format("YYYY-MM-DD") : undefined,
      expiresAt: values.expiresAt.format("YYYY-MM-DD"),
    };
    onChange([...(files ?? []), next]);
    message.success(`Đã lưu giấy phép: ${pendingFile.name}`);
    setPendingFile(null);
    dateForm.resetFields();
  };

  const remove = (id: string) => {
    onChange((files ?? []).map((a) => (a.id === id ? { ...a, deleted: true } : a)));
  };

  const updateDates = (id: string, issuedAt?: string, expiresAt?: string) => {
    onChange(
      (files ?? []).map((a) =>
        a.id === id ? { ...a, issuedAt, expiresAt: expiresAt ?? a.expiresAt } : a,
      ),
    );
  };

  return (
    <div>
      <Upload.Dragger
        accept={ACCEPT_FILE_TYPES}
        beforeUpload={beforeUpload}
        showUploadList={false}
        multiple={false}
        style={compact ? { padding: "12px 8px" } : undefined}
      >
        <p className="ant-upload-drag-icon" style={compact ? { marginBottom: 4 } : undefined}>
          <InboxOutlined />
        </p>
        <p className="ant-upload-text" style={{ fontSize: compact ? ds.fontSize.caption : undefined }}>
          Tải lên file giấy phép / văn bản được cấp phép
        </p>
        <p className="ant-upload-hint" style={{ fontSize: ds.fontSize.caption }}>
          Sau khi chọn file sẽ nhập ngày cấp / hết hạn. PDF / Word / Excel
        </p>
      </Upload.Dragger>

      <Modal
        title="Thời hạn giấy phép"
        open={Boolean(pendingFile)}
        onCancel={() => {
          setPendingFile(null);
          dateForm.resetFields();
        }}
        onOk={confirmUpload}
        okText="Lưu giấy phép"
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
          File: {pendingFile?.name}
        </Typography.Paragraph>
        <Form form={dateForm} layout="vertical">
          <Form.Item name="issuedAt" label="Ngày cấp">
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="expiresAt"
            label="Ngày hết hạn"
            rules={[{ required: true, message: "Chọn ngày hết hạn" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>

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
                avatar={attachmentTypeIcon(item.type)}
                title={
                  <Typography.Text style={{ fontSize: ds.fontSize.caption }}>{item.name}</Typography.Text>
                }
                description={
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                      {item.uploadedBy} · {item.uploadedAt}
                    </Typography.Text>
                    <Space wrap>
                      <DatePicker
                        size="small"
                        placeholder="Ngày cấp"
                        format="DD/MM/YYYY"
                        value={item.issuedAt ? dayjs(item.issuedAt) : null}
                        onChange={(d) =>
                          updateDates(
                            item.id,
                            d ? d.format("YYYY-MM-DD") : undefined,
                            item.expiresAt,
                          )
                        }
                      />
                      <DatePicker
                        size="small"
                        placeholder="Hết hạn"
                        format="DD/MM/YYYY"
                        value={item.expiresAt ? dayjs(item.expiresAt) : null}
                        onChange={(d) => {
                          if (!d) {
                            message.warning("Cần ngày hết hạn");
                            return;
                          }
                          updateDates(item.id, item.issuedAt, d.format("YYYY-MM-DD"));
                        }}
                      />
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
