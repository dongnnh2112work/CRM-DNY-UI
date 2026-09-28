import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateEmailTemplateBody = {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  description?: string;
  isActive?: boolean;
};

export type UpdateEmailTemplateBody = {
  name?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export type OutboundEmailLog = {
  id: string;
  to?: string | null;
  templateKey?: string | null;
  status?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  skipReason?: string | null;
  recipientUserId?: string | null;
  eventType?: string | null;
  subject?: string | null;
  createdAt?: string | null;
};

export type MailStatus = {
  configured: boolean;
  from?: string | null;
};

export type NotificationChannel = "EMAIL" | "IN_APP" | "TELEGRAM";

export type NotificationPreference = {
  id?: string;
  channel: NotificationChannel;
  eventType: string;
  enabled: boolean;
  channelAddress?: string | null;
};

export type SendTemplatedBody = {
  templateKey: string;
  to: string;
  variables?: Record<string, string>;
  recipientUserId?: string;
  eventType?: string;
  relatedNotificationId?: string;
};

function unwrapData(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "data" in raw) {
    const data = (raw as { data: unknown }).data;
    if (data && typeof data === "object") return data;
  }
  return raw;
}

function asPage<T>(raw: unknown): PageResult<T> {
  const body = unwrapData(raw);
  if (Array.isArray(body)) {
    return { items: body as T[], total: body.length, page: 1, pageSize: body.length || 20 };
  }
  if (body && typeof body === "object" && "items" in body) {
    const page = body as Partial<PageResult<T>>;
    const items = page.items ?? [];
    return {
      items,
      total: page.total ?? items.length,
      page: page.page ?? 1,
      pageSize: page.pageSize ?? (items.length || 20),
    };
  }
  return { items: [], total: 0, page: 1, pageSize: 20 };
}

function asRecord<T>(raw: unknown): T {
  return unwrapData(raw) as T;
}

function asList<T>(raw: unknown): T[] {
  const body = unwrapData(raw);
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && "items" in body) {
    return ((body as { items?: T[] }).items ?? []) as T[];
  }
  return [];
}

export const mailApi = {
  status() {
    return apiRequest<unknown>("/mail/status").then((raw) => asRecord<MailStatus>(raw));
  },

  listOutbound(query: { page?: number; pageSize?: number; templateKey?: string } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    if (query.templateKey?.trim()) params.set("templateKey", query.templateKey.trim());
    return apiRequest<unknown>(`/mail/outbound?${params.toString()}`).then((raw) => asPage<OutboundEmailLog>(raw));
  },

  sendTest(to: string) {
    return apiRequest<unknown>("/mail/test", { method: "POST", body: JSON.stringify({ to }) });
  },

  send(body: SendTemplatedBody) {
    return apiRequest<unknown>("/mail/send", { method: "POST", body: JSON.stringify(body) });
  },

  listTemplates(query: { page?: number; pageSize?: number; activeOnly?: boolean } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 50));
    if (query.activeOnly) params.set("activeOnly", "true");
    return apiRequest<unknown>(`/email-templates?${params.toString()}`).then((raw) => asPage<EmailTemplate>(raw));
  },

  getTemplate(id: string) {
    return apiRequest<unknown>(`/email-templates/${id}`).then((raw) => asRecord<EmailTemplate>(raw));
  },

  createTemplate(body: CreateEmailTemplateBody) {
    return apiRequest<unknown>("/email-templates", { method: "POST", body: JSON.stringify(body) }).then((raw) =>
      asRecord<EmailTemplate>(raw),
    );
  },

  updateTemplate(id: string, body: UpdateEmailTemplateBody) {
    return apiRequest<unknown>(`/email-templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then((raw) =>
      asRecord<EmailTemplate>(raw),
    );
  },

  deleteTemplate(id: string) {
    return apiRequest<unknown>(`/email-templates/${id}`, { method: "DELETE" });
  },

  /** POST /mail/test always uses key `mail.test`. Local DB often has no seed. */
  async ensureTestTemplate() {
    const listed = await mailApi.listTemplates({ page: 1, pageSize: 100 });
    const existing = listed.items.find((item) => item.key === "mail.test");
    if (!existing) {
      return mailApi.createTemplate({
        key: "mail.test",
        name: "Mail test",
        subject: "Email thử CRM",
        htmlBody: "<p>Xin chào {{name}}, đây là email thử từ CRM.</p>",
        textBody: "Xin chào {{name}}, đây là email thử từ CRM.",
        description: "Mẫu dùng cho POST /mail/test",
        isActive: true,
      });
    }
    if (!existing.isActive) {
      return mailApi.updateTemplate(existing.id, { isActive: true });
    }
    return existing;
  },

  listPreferences() {
    return apiRequest<unknown>("/notification-preferences").then((raw) => asList<NotificationPreference>(raw));
  },

  upsertPreference(body: {
    channel: NotificationChannel;
    eventType: string;
    enabled: boolean;
    channelAddress?: string | null;
  }) {
    const payload: Record<string, unknown> = {
      channel: body.channel,
      eventType: body.eventType,
      enabled: body.enabled,
    };
    if (body.channelAddress) payload.channelAddress = body.channelAddress;
    return apiRequest<unknown>("/notification-preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    }).then((raw) => asRecord<NotificationPreference>(raw));
  },
};
