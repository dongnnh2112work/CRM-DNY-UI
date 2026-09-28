"use client";

import { EyeOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableColumnsType,
} from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { EmailPreviewModal } from "@/components/emails/email-preview-modal";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDisplayDateTime } from "@/lib/format-date";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { useT } from "@/lib/use-t";
import {
  mailApi,
  type EmailTemplate,
  type MailStatus,
  type NotificationChannel,
  type NotificationPreference,
  type OutboundEmailLog,
} from "@/modules/mail/api";

const TABS = ["logs", "templates", "send", "prefs"] as const;
type MailTab = (typeof TABS)[number];

const CHANNELS: NotificationChannel[] = ["EMAIL", "IN_APP", "TELEGRAM"];
const SEED_EVENTS = ["*", "mail.test", "expense.submitted", "expense.approved", "expense.rejected"];

function placeholdersOf(template?: Pick<EmailTemplate, "subject" | "htmlBody" | "textBody"> | null) {
  if (!template) return [];
  const found = new Set<string>();
  const re = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
  for (const text of [template.subject, template.htmlBody, template.textBody ?? ""]) {
    for (const match of text.matchAll(re)) found.add(match[1]);
  }
  return [...found];
}

function logStatus(status?: string | null) {
  const value = (status ?? "").toLowerCase();
  if (value === "sent" || value === "failed" || value === "skipped") return value;
  return value || "sent";
}

function logReason(row: OutboundEmailLog) {
  return row.errorMessage || row.skipReason || "—";
}

export default function EmailsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <EmailsPageContent />
    </Suspense>
  );
}

function EmailsPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const { can } = useSession();
  const { users } = useUsers();
  const canManage = can(PERMISSION.emailTemplateManage);
  const canPrefs = can(PERMISSION.notificationViewOwn);
  const requested = searchParams.get("tab");
  const tab: MailTab = TABS.includes(requested as MailTab) ? (requested as MailTab) : "logs";

  const [status, setStatus] = useState<MailStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/emails?${params.toString()}`);
  };

  const reloadStatus = useCallback(async () => {
    if (!canManage) return;
    try {
      setStatus(await mailApi.status());
      setStatusError(null);
    } catch (err) {
      setStatus(null);
      setStatusError(apiErrorMessage(err, t("email.statusMissing")));
    }
  }, [canManage, t]);

  useEffect(() => {
    void reloadStatus();
  }, [reloadStatus]);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("nav.emails") }]} />
      <div style={{ padding: 16 }}>
        {canManage ? (
          status?.configured ? (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              title={t("email.statusReady", { from: status.from || "—" })}
            />
          ) : (
            <Alert
              type={statusError ? "error" : "warning"}
              showIcon
              style={{ marginBottom: 16 }}
              title={statusError || t("email.statusMissing")}
            />
          )
        ) : (
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t("email.noManage")} />
        )}
        <Tabs
          activeKey={canManage ? tab : "prefs"}
          onChange={setTab}
          items={[
            {
              key: "logs",
              label: t("email.tabLogs"),
              disabled: !canManage,
              children: canManage ? <OutboundPanel /> : null,
            },
            {
              key: "templates",
              label: t("email.tabTemplates"),
              disabled: !canManage,
              children: canManage ? <TemplatesPanel /> : null,
            },
            {
              key: "send",
              label: t("email.tabSend"),
              disabled: !canManage,
              children: canManage ? (
                <SendPanel
                  users={users}
                  onSent={() => {
                    void reloadStatus();
                    setTab("logs");
                  }}
                />
              ) : null,
            },
            {
              key: "prefs",
              label: t("email.tabPrefs"),
              disabled: !canPrefs,
              children: canPrefs ? <PreferencesPanel /> : <Alert type="warning" showIcon title={t("email.noPrefs")} />,
            },
          ]}
        />
      </div>
    </>
  );
}

function OutboundPanel() {
  const t = useT();
  const { message } = App.useApp();
  const [rows, setRows] = useState<OutboundEmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [templateKey, setTemplateKey] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await mailApi.listOutbound({ page, pageSize, templateKey });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      message.error(apiErrorMessage(err, t("email.emptyLogs")));
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, t, templateKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumnsType<OutboundEmailLog> = [
    {
      title: t("email.sendAt"),
      dataIndex: "createdAt",
      render: (value?: string) => (value ? formatDisplayDateTime(value) : "—"),
    },
    { title: t("email.recipients"), dataIndex: "to", render: (value?: string) => value || "—" },
    { title: t("email.templateKey"), dataIndex: "templateKey", render: (value?: string) => value || "—" },
    { title: t("email.subject"), dataIndex: "subject", ellipsis: true, render: (value?: string) => value || "—" },
    {
      title: t("common.status"),
      dataIndex: "status",
      render: (value?: string) => <StatusBadge module="email" status={logStatus(value)} />,
    },
    { title: t("email.providerId"), dataIndex: "providerMessageId", render: (value?: string) => value || "—" },
    { title: t("email.errorCol"), key: "reason", ellipsis: true, render: (_, row) => logReason(row) },
  ];

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={12}>
      <Input.Search
        allowClear
        placeholder={t("email.filterTemplate")}
        style={{ maxWidth: 320 }}
        onSearch={(value) => {
          setPage(1);
          setTemplateKey(value);
        }}
      />
      <Table
        rowKey={(row) => row.id}
        loading={loading}
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: t("email.emptyLogs") }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (next, size) => {
            setPage(next);
            setPageSize(size);
          },
        }}
      />
    </Space>
  );
}

function TemplatesPanel() {
  const t = useT();
  const { message } = App.useApp();
  const [rows, setRows] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null | "new">(null);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await mailApi.listTemplates({ pageSize: 50 });
      setRows(result.items);
    } catch (err) {
      message.error(apiErrorMessage(err, t("email.emptyTemplates")));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumnsType<EmailTemplate> = [
    { title: t("email.templateKey"), dataIndex: "key" },
    { title: t("email.templateName"), dataIndex: "name" },
    { title: t("email.subject"), dataIndex: "subject", ellipsis: true },
    {
      title: t("common.status"),
      dataIndex: "isActive",
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>{active ? t("email.active") : t("email.inactive")}</Tag>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 220,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setPreview(row)}>
            {t("email.preview")}
          </Button>
          <Button size="small" onClick={() => setEditing(row)}>
            {t("common.edit")}
          </Button>
          <Popconfirm
            title={t("email.deleteTemplate", { key: row.key })}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await mailApi.deleteTemplate(row.id);
                message.success(t("email.templateDeleted"));
                await load();
              } catch (err) {
                message.error(apiErrorMessage(err, t("email.deleteTemplate", { key: row.key })));
              }
            }}
          >
            <Button size="small" danger>
              {t("common.delete")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space orientation="vertical" style={{ width: "100%" }} size={12}>
        <Button type="primary" onClick={() => setEditing("new")}>
          {t("email.newTemplate")}
        </Button>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: t("email.emptyTemplates") }}
        />
      </Space>
      <TemplateDrawer
        open={editing != null}
        template={editing && editing !== "new" ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
      <EmailPreviewModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        subject={preview?.subject}
        body={preview?.htmlBody}
      />
    </>
  );
}

function TemplateDrawer({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useT();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const subject = Form.useWatch("subject", form) as string | undefined;
  const htmlBody = Form.useWatch("htmlBody", form) as string | undefined;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      template
        ? {
            key: template.key,
            name: template.name,
            subject: template.subject,
            htmlBody: template.htmlBody,
            textBody: template.textBody ?? "",
            description: template.description ?? "",
            isActive: template.isActive,
          }
        : { isActive: true, htmlBody: "", textBody: "", description: "" },
    );
  }, [form, open, template]);

  return (
    <>
      <Drawer
        title={template ? t("email.editTemplate") : t("email.newTemplate")}
        open={open}
        onClose={onClose}
        size={640}
        extra={
          <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
            {t("email.preview")}
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            setSaving(true);
            try {
              if (template) {
                await mailApi.updateTemplate(template.id, {
                  name: values.name,
                  subject: values.subject,
                  htmlBody: values.htmlBody,
                  textBody: values.textBody || null,
                  description: values.description || null,
                  isActive: Boolean(values.isActive),
                });
                message.success(t("email.templateSaved"));
              } else {
                await mailApi.createTemplate({
                  key: values.key.trim(),
                  name: values.name,
                  subject: values.subject,
                  htmlBody: values.htmlBody,
                  textBody: values.textBody || undefined,
                  description: values.description || undefined,
                  isActive: Boolean(values.isActive),
                });
                message.success(t("email.templateCreated"));
              }
              await onSaved();
            } catch (err) {
              message.error(apiErrorMessage(err, t("email.templateSaved")));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item
            name="key"
            label={t("email.templateKey")}
            extra={template ? t("email.keyLocked") : t("email.placeholderVars")}
            rules={template ? [] : [{ required: true, message: t("email.keyRequired") }]}
          >
            <Input disabled={Boolean(template)} placeholder="expense.approved" />
          </Form.Item>
          <Form.Item name="name" label={t("email.templateName")} rules={[{ required: true, message: t("email.nameRequired") }]}>
            <Input />
          </Form.Item>
          <Form.Item name="subject" label={t("email.subject")} rules={[{ required: true, message: t("email.enterSubject") }]}>
            <Input />
          </Form.Item>
          <Form.Item name="htmlBody" label={t("email.htmlBody")} rules={[{ required: true, message: t("email.htmlRequired") }]}>
            <Input.TextArea rows={10} style={{ fontFamily: "monospace" }} />
          </Form.Item>
          <Form.Item name="textBody" label={t("email.textBody")}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="description" label={t("email.description")}>
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label={t("email.active")} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t("common.save")}
            </Button>
          </Space>
        </Form>
      </Drawer>
      <EmailPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} subject={subject} body={htmlBody} />
    </>
  );
}

function SendPanel({
  users,
  onSent,
}: {
  users: { id: string; name: string; email: string }[];
  onSent: () => void;
}) {
  const t = useT();
  const { message } = App.useApp();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const templateKey = Form.useWatch("templateKey", form) as string | undefined;
  const template = templates.find((item) => item.key === templateKey);
  const vars = useMemo(() => placeholdersOf(template), [template]);

  useEffect(() => {
    void mailApi.listTemplates({ pageSize: 50, activeOnly: true }).then((result) => setTemplates(result.items)).catch(() => undefined);
  }, []);

  return (
    <Space orientation="vertical" size={24} style={{ width: "100%", maxWidth: 720 }}>
      <div>
        <Typography.Title level={5}>{t("email.testTo")}</Typography.Title>
        <Form
          form={testForm}
          layout="inline"
          onFinish={async (values) => {
            setTesting(true);
            try {
              await mailApi.ensureTestTemplate();
              await mailApi.sendTest(values.to.trim());
              message.success(t("email.testSent"));
              onSent();
            } catch (err) {
              message.error(apiErrorMessage(err, t("email.testSent")));
            } finally {
              setTesting(false);
            }
          }}
        >
          <Form.Item name="to" rules={[{ required: true, type: "email", message: t("email.toRequired") }]}>
            <Input placeholder="you@example.com" style={{ width: 280 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={testing}>
            {t("email.sendTest")}
          </Button>
        </Form>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          setSending(true);
          try {
            const variables: Record<string, string> = {};
            for (const row of (values.variables ?? []) as { name?: string; value?: string }[]) {
              if (row?.name?.trim()) variables[row.name.trim()] = row.value ?? "";
            }
            await mailApi.send({
              templateKey: values.templateKey,
              to: values.to.trim(),
              variables: Object.keys(variables).length ? variables : undefined,
              recipientUserId: values.recipientUserId || undefined,
              eventType: values.eventType?.trim() || undefined,
              relatedNotificationId: values.relatedNotificationId?.trim() || undefined,
            });
            message.success(t("email.sendOk"));
            onSent();
          } catch (err) {
            message.error(apiErrorMessage(err, t("email.sendOk")));
          } finally {
            setSending(false);
          }
        }}
      >
        <Typography.Title level={5}>{t("email.tabSend")}</Typography.Title>
        <Form.Item name="templateKey" label={t("email.templateKey")} rules={[{ required: true, message: t("email.keyRequired") }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={templates.map((item) => ({ value: item.key, label: `${item.key} — ${item.name}` }))}
            onChange={(key) => {
              const next = templates.find((item) => item.key === key);
              form.setFieldValue(
                "variables",
                placeholdersOf(next).map((name) => ({ name, value: "" })),
              );
            }}
          />
        </Form.Item>
        <Form.Item name="to" label={t("email.recipients")} rules={[{ required: true, type: "email", message: t("email.toRequired") }]}>
          <Input />
        </Form.Item>
        <Form.Item label={t("email.variables")} extra={t("email.placeholderVars")}>
          <Form.List name="variables">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" style={{ width: "100%" }}>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline">
                    <Form.Item name={[field.name, "name"]} noStyle>
                      <Input placeholder={t("email.varName")} style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, "value"]} noStyle>
                      <Input placeholder={t("email.varValue")} style={{ width: 280 }} />
                    </Form.Item>
                    <Button type="link" onClick={() => remove(field.name)}>
                      {t("common.delete")}
                    </Button>
                  </Space>
                ))}
                <Button
                  onClick={() => add(vars.length ? { name: "", value: "" } : { name: "", value: "" })}
                >
                  {t("email.addVar")}
                </Button>
              </Space>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item name="recipientUserId" label={t("email.recipientUser")}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={users
              .filter((user) => user.email)
              .map((user) => ({ value: user.id, label: `${user.name} (${user.email})` }))}
          />
        </Form.Item>
        <Form.Item name="eventType" label={t("email.eventType")} extra={t("email.eventTypeHint")}>
          <Input placeholder={templateKey} />
        </Form.Item>
        <Form.Item name="relatedNotificationId" label={t("email.relatedNotif")}>
          <Input />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={sending}>
          {t("email.sendNow")}
        </Button>
      </Form>
    </Space>
  );
}

function PreferencesPanel() {
  const t = useT();
  const { message } = App.useApp();
  const [rows, setRows] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const channel = Form.useWatch("channel", form) as NotificationChannel | undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await mailApi.listPreferences());
    } catch (err) {
      message.error(apiErrorMessage(err, t("email.noPrefs")));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumnsType<NotificationPreference> = [
    { title: t("email.channel"), dataIndex: "channel" },
    { title: t("email.event"), dataIndex: "eventType" },
    {
      title: t("email.enabled"),
      dataIndex: "enabled",
      render: (enabled: boolean, row) => (
        <Switch
          checked={enabled}
          onChange={async (next) => {
            try {
              await mailApi.upsertPreference({
                channel: row.channel,
                eventType: row.eventType,
                enabled: next,
                channelAddress: row.channelAddress,
              });
              message.success(t("email.prefSaved"));
              await load();
            } catch (err) {
              message.error(apiErrorMessage(err, t("email.prefSaved")));
            }
          }}
        />
      ),
    },
    { title: t("email.address"), dataIndex: "channelAddress", render: (value?: string) => value || "—" },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%", maxWidth: 720 }}>
      <Typography.Paragraph type="secondary">{t("email.prefsHint")}</Typography.Paragraph>
      <Table
        rowKey={(row) => `${row.channel}:${row.eventType}`}
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{ channel: "EMAIL", eventType: "expense.approved", enabled: false }}
        onFinish={async (values) => {
          try {
            await mailApi.upsertPreference({
              channel: values.channel,
              eventType: values.eventType.trim(),
              enabled: Boolean(values.enabled),
              channelAddress: values.channelAddress?.trim() || undefined,
            });
            message.success(t("email.prefSaved"));
            await load();
          } catch (err) {
            message.error(apiErrorMessage(err, t("email.prefSaved")));
          }
        }}
      >
        <Form.Item name="channel" label={t("email.channel")} rules={[{ required: true }]}>
          <Select options={CHANNELS.map((item) => ({ value: item, label: item }))} />
        </Form.Item>
        <Form.Item name="eventType" label={t("email.event")} rules={[{ required: true }]}>
          <AutoComplete options={SEED_EVENTS.map((item) => ({ value: item }))} />
        </Form.Item>
        {channel === "TELEGRAM" ? (
          <Form.Item name="channelAddress" label={t("email.address")} extra={t("email.addressHint")}>
            <Input />
          </Form.Item>
        ) : null}
        <Form.Item name="enabled" label={t("email.enabled")} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          {t("common.save")}
        </Button>
      </Form>
    </Space>
  );
}
