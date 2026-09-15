"use client";

import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Form, List, Modal, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { DocumentFileActions, DocumentFileLink } from "@/components/documents/document-file-actions";
import { attachmentTypeIcon } from "@/components/orders/attachment-type-icon";
import { UploadJobsBar, type UploadJob } from "@/components/orders/upload-jobs-bar";
import type { OrderAttachment } from "@/lib/types";
import { ds } from "@/lib/design-tokens";
import { ACCEPT_FILE_TYPES, getAttachmentType } from "@/lib/order-workflow";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { documentsApi } from "@/modules/documents/api";
import { encodeLicenseFileType, formatFileBytes, mapApiDocumentToAttachment } from "@/modules/documents/map-to-ui";
import { useDocumentViewer } from "@/modules/documents/use-document-viewer";
import { useT } from "@/lib/use-t";

interface LicenseUploadProps {
  files: OrderAttachment[];
  onChange: (next: OrderAttachment[]) => void;
  uploaderName?: string;
  compact?: boolean;
  orderId?: string;
}

export function LicenseUpload({
  files,
  onChange,
  uploaderName = "Admin",
  compact = false,
  orderId,
}: LicenseUploadProps) {
  const t = useT();
  const { message } = App.useApp();
  const { can } = useSession();
  const canUpload = can(PERMISSION.documentUpload);
  const visible = (files ?? []).filter((a) => !a.deleted);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dateForm] = Form.useForm();
  const [job, setJob] = useState<UploadJob | null>(null);
  const docs = useDocumentViewer();
  const saving = Boolean(job);

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
    setPendingFile(file);
    dateForm.setFieldsValue({
      issuedAt: dayjs(),
      expiresAt: dayjs().add(1, "year"),
    });
    return Upload.LIST_IGNORE;
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;
    const values = await dateForm.validateFields();
    const issuedAt = values.issuedAt ? values.issuedAt.format("YYYY-MM-DD") : undefined;
    const expiresAt = values.expiresAt.format("YYYY-MM-DD");
    const jobId = `lic-${Date.now()}`;
    setJob({ id: jobId, name: pendingFile.name, percent: 0, phase: "upload" });
    try {
      if (orderId) {
        const doc = await documentsApi.upload(
          pendingFile,
          { orderId, fileType: encodeLicenseFileType(issuedAt, expiresAt) },
          (percent) => {
            setJob({
              id: jobId,
              name: pendingFile.name,
              percent,
              phase: percent >= 100 ? "saving" : "upload",
            });
          },
        );
        if (!doc?.id) throw new Error(t("docs.uploadFailed", { name: pendingFile.name }));
        let mapped: OrderAttachment;
        try {
          mapped = {
            ...mapApiDocumentToAttachment(doc, uploaderName),
            issuedAt,
            expiresAt,
          };
        } catch {
          mapped = {
            id: doc.id,
            name: doc.fileName || pendingFile.name,
            type: getAttachmentType(pendingFile.name),
            size: typeof doc.fileSize === "number" ? doc.fileSize : pendingFile.size,
            uploadedBy: uploaderName,
            uploadedAt: new Date().toISOString().slice(0, 10),
            issuedAt,
            expiresAt,
          };
        }
        const current = files ?? [];
        if (!current.some((row) => row.id === mapped.id && !row.deleted)) {
          onChange([...current, mapped]);
        }
        message.success(
          t("docs.uploadedOk", {
            name: doc.fileName || pendingFile.name,
            size: formatFileBytes(doc.fileSize ?? pendingFile.size),
            id: doc.id,
          }),
        );
      } else {
        const type = getAttachmentType(pendingFile.name);
        const next: OrderAttachment = {
          id: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: pendingFile.name,
          type,
          size: pendingFile.size,
          uploadedBy: uploaderName,
          uploadedAt: new Date().toISOString().slice(0, 10),
          issuedAt,
          expiresAt,
        };
        onChange([...(files ?? []), next]);
        message.success(t("license.saved", { name: pendingFile.name }));
      }
      setPendingFile(null);
      dateForm.resetFields();
    } catch (err) {
      message.error(apiErrorMessage(err, t("docs.uploadFailed", { name: pendingFile.name })));
    } finally {
      setJob(null);
    }
  };

  const remove = async (id: string) => {
    try {
      if (orderId) await documentsApi.remove(id);
      onChange((files ?? []).map((a) => (a.id === id ? { ...a, deleted: true } : a)));
    } catch (err) {
      message.error(apiErrorMessage(err, t("docs.empty")));
    }
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
        fileList={[]}
        showUploadList={false}
        multiple={false}
        disabled={!canUpload || saving}
        style={compact ? { padding: "12px 8px" } : undefined}
      >
        <p className="ant-upload-drag-icon" style={compact ? { marginBottom: 4 } : undefined}>
          <InboxOutlined />
        </p>
        <p className="ant-upload-text" style={{ fontSize: compact ? ds.fontSize.caption : undefined }}>
          {t("license.uploadHint")}
        </p>
        <p className="ant-upload-hint" style={{ fontSize: ds.fontSize.caption }}>
          {t("license.afterPickHint")}
        </p>
      </Upload.Dragger>

      <Modal
        title={t("license.datesTitle")}
        open={Boolean(pendingFile)}
        onCancel={() => {
          if (saving) return;
          setPendingFile(null);
          dateForm.resetFields();
        }}
        onOk={confirmUpload}
        okText={t("license.save")}
        confirmLoading={saving}
        okButtonProps={{ disabled: saving }}
        cancelButtonProps={{ disabled: saving }}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
          {t("license.fileLabel", { name: pendingFile?.name ?? "" })}
        </Typography.Paragraph>
        <Form form={dateForm} layout="vertical" disabled={saving}>
          <Form.Item name="issuedAt" label={t("license.issuedAt")}>
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="expiresAt"
            label={t("license.expiresAt")}
            rules={[{ required: true, message: t("license.selectExpiry") }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
        {job ? <UploadJobsBar jobs={[job]} /> : null}
      </Modal>

      {visible.length > 0 && (
        <List
          size="small"
          style={{ marginTop: 8 }}
          dataSource={visible}
          renderItem={(item) => (
            <List.Item
              actions={[
                <DocumentFileActions
                  key="file"
                  file={item}
                  viewer={docs}
                  extra={
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => void remove(item.id)}
                    />
                  }
                />,
              ]}
            >
              <List.Item.Meta
                avatar={attachmentTypeIcon(item.type)}
                title={
                  <DocumentFileLink file={item} viewer={docs} style={{ fontSize: ds.fontSize.caption }} />
                }
                description={
                  <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                    <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                      {item.uploadedBy} · {item.uploadedAt}
                    </Typography.Text>
                    <Space wrap>
                      <DatePicker
                        size="small"
                        placeholder={t("license.issuedAt")}
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
                        placeholder={t("license.expiresShort")}
                        format="DD/MM/YYYY"
                        value={item.expiresAt ? dayjs(item.expiresAt) : null}
                        onChange={(d) => {
                          if (!d) {
                            message.warning(t("license.needExpiry"));
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
      {docs.modal}
    </div>
  );
}
