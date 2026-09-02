"use client";

import { EyeOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Form, Input, Select, Space, Upload } from "antd";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EmailPreviewModal } from "@/components/emails/email-preview-modal";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import { useCustomers } from "@/lib/customers-store";
import { isHtmlFile } from "@/lib/email-preview";
import { useEmails } from "@/lib/emails-store";
import type { EmailStatus } from "@/lib/types";
import { useT } from "@/lib/use-t";

type EmailFormValues = {
  recipients: string[];
  subject: string;
  body?: string;
  scheduledAt?: string;
};

export default function ComposeEmailPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ComposeEmailPageContent />
    </Suspense>
  );
}

function ComposeEmailPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message, modal } = App.useApp();
  const { customers } = useCustomers();
  const { emails, addEmail, updateEmail } = useEmails();
  const [form] = Form.useForm<EmailFormValues>();
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const bodyWatch = Form.useWatch("body", form);
  const subjectWatch = Form.useWatch("subject", form);
  const editId = searchParams.get("id") ?? undefined;
  const existing = editId ? emails.find((e) => e.id === editId) : undefined;

  useEffect(() => {
    if (!existing) return;
    form.setFieldsValue({
      recipients: existing.recipients,
      subject: existing.subject,
      body: existing.body,
      scheduledAt: existing.scheduledAt,
    });
  }, [existing, form]);

  const persist = async (status: EmailStatus) => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const recipients = values.recipients ?? [];
      const scheduledAt = values.scheduledAt;
      const nextStatus = status === "draft" && scheduledAt ? "scheduled" : status;
      const payload = {
        subject: values.subject,
        recipients,
        recipientCount: recipients.length,
        body: values.body ?? "",
        status: nextStatus,
        scheduledAt,
        sentAt: nextStatus === "sent" ? new Date().toISOString().slice(0, 10) : existing?.sentAt,
      };
      if (existing) {
        updateEmail(existing.id, payload);
      } else {
        addEmail(payload);
      }
      message.success(
        nextStatus === "sent"
          ? t("email.sent")
          : nextStatus === "scheduled"
            ? t("email.scheduled")
            : t("email.draftSaved"),
      );
      router.push("/emails");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: t("email.breadcrumb"), href: "/emails" },
          { title: existing ? existing.subject : t("email.compose") },
        ]}
      />
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: ds.formPageMaxWidth, padding: 24 }}
      >
        <Form.Item label={t("email.recipients")} required>
          <Space orientation="vertical" style={{ width: "100%" }} size={8}>
            <Form.Item
              name="recipients"
              noStyle
              rules={[{ required: true, message: t("email.selectRecipients") }]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder={t("email.selectCustomers")}
                options={customers.map((c) => ({ value: c.email, label: `${c.name} (${c.email})` }))}
              />
            </Form.Item>
            <Button
              onClick={() => {
                const emails = [
                  ...new Set(
                    customers
                      .map((c) => c.email?.trim())
                      .filter((e): e is string => Boolean(e)),
                  ),
                ];
                if (emails.length === 0) {
                  message.warning(t("email.noCustomerEmail"));
                  return;
                }
                form.setFieldValue("recipients", emails);
                message.success(t("email.selectedN", { count: emails.length }));
              }}
            >
              {t("email.sendAll")}
            </Button>
          </Space>
        </Form.Item>
        <Form.Item
          name="subject"
          label={t("email.subject")}
          rules={[{ required: true, message: t("email.enterSubject") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t("email.body")} extra={t("email.bodyExtra")}>
          <Space wrap style={{ marginBottom: 8 }}>
            <Upload
              accept=".html,.htm,text/html"
              showUploadList={false}
              beforeUpload={(file) => {
                if (!isHtmlFile(file)) {
                  message.error(t("email.htmlOnly"));
                  return Upload.LIST_IGNORE;
                }
                if (file.size > 1024 * 1024) {
                  message.error(t("email.htmlTooBig"));
                  return Upload.LIST_IGNORE;
                }
                void file.text().then((text) => {
                  form.setFieldValue("body", text);
                  message.success(t("email.loadedFile", { name: file.name }));
                });
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>{t("email.uploadHtml")}</Button>
            </Upload>
            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                if (!String(bodyWatch ?? "").trim()) {
                  message.warning(t("email.noPreview"));
                  return;
                }
                setPreviewOpen(true);
              }}
            >
              {t("email.preview")}
            </Button>
          </Space>
          <Form.Item name="body" noStyle>
            <Input.TextArea
              rows={12}
              placeholder={t("email.bodyPlaceholder")}
              style={{ fontFamily: "monospace" }}
            />
          </Form.Item>
        </Form.Item>
        <Form.Item
          name="scheduledAt"
          label={t("email.scheduleOptional")}
          getValueFromEvent={(d: dayjs.Dayjs | null) => (d ? d.format("YYYY-MM-DD HH:mm") : undefined)}
          getValueProps={(value: string | undefined) => ({
            value: value ? dayjs(value) : undefined,
          })}
        >
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>
        <Space>
          <Button
            onClick={() => confirmDiscardIfDirty(modal, form, () => router.push("/emails"))}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={() => persist("draft")} loading={saving} disabled={saving}>
            {t("email.saveDraft")}
          </Button>
          <Button type="primary" onClick={() => persist("sent")} loading={saving} disabled={saving}>
            {t("email.sendNow")}
          </Button>
        </Space>
      </Form>
      <EmailPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        subject={subjectWatch}
        body={bodyWatch}
      />
    </>
  );
}
