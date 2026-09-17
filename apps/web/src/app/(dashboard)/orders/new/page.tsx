"use client";

import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Checkbox, DatePicker, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import { useCustomers } from "@/lib/customers-store";
import { DISPLAY_DATE_FORMAT, toStorageDate } from "@/lib/format-date";
import { vndInputProps } from "@/lib/format-vnd";
import { apiErrorMessage } from "@/lib/http/message";
import { taskAssignedDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import { deadlineFromService, nextContractNumber, nextDossierNumber } from "@/lib/order-helpers";
import { splitDossierNumbers } from "@/lib/order-group";
import { useOrders } from "@/lib/orders-store";
import { useServices } from "@/lib/services-store";
import { useUsers } from "@/lib/users-store";
import { contractsApi } from "@/modules/contracts/api";
import { ordersApi } from "@/modules/orders/api";
import { mapApiOrderToUi, mapUiOrderToCreateApi } from "@/modules/orders/map-to-ui";
import { useT } from "@/lib/use-t";
import type { Order } from "@/lib/types";

type ServiceLine = {
  serviceId?: string;
  value?: number;
  deadline?: dayjs.Dayjs | string;
};

export default function NewOrderPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewOrderPageContent />
    </Suspense>
  );
}

function NewOrderPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCustomerId = searchParams.get("customerId") ?? undefined;
  const { message, modal } = App.useApp();
  const { services } = useServices();
  const { customers } = useCustomers();
  const { orders, replaceOrders, isContractTaken } = useOrders();
  const { addNotifications } = useNotifications();
  const { currentUser, users } = useUsers();
  const activeUsers = users.filter((u) => u.status === "active");
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const needsVat = Form.useWatch("needsVat", form) as boolean | undefined;
  const activeServices = useMemo(
    () => services.filter((s) => s.status === "active"),
    [services],
  );

  const suggestedHd = useMemo(() => nextContractNumber(orders), [orders]);

  const setLineDeadline = (lineIndex: number, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    form.setFieldValue(["lines", lineIndex, "deadline"], dayjs(deadlineFromService(svc.processingDays)));
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("common.order"), href: "/orders" }, { title: t("order.breadcrumbNew") }]} />
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: ds.formPageMaxWidth, padding: 24 }}
        initialValues={{
          needsVat: false,
          customerId: prefillCustomerId,
          lines: [{}],
        }}
        onFinish={async (values) => {
          setSaving(true);
          try {
            const customer = customers.find((c) => c.id === values.customerId);
            const assigned = activeUsers.find((u) => u.id === values.assignedUserId);
            const submitter = activeUsers.find((u) => u.id === values.submitterId);
            const lines = ((values.lines ?? []) as ServiceLine[]).filter((line) => line.serviceId);
            if (!customer || !assigned || !submitter || lines.length === 0) {
              message.error(t("common.requiredMissing"));
              return;
            }

            const resolved = lines.map((line) => {
              const service = services.find((s) => s.id === line.serviceId);
              return { line, service, value: Number(line.value) };
            });
            if (resolved.some((r) => !r.service || !Number.isFinite(r.value))) {
              message.error(t("order.enterListPrice"));
              return;
            }

            if (values.needsVat) {
              const hd = Number(values.contractNumber);
              if (!hd || hd < 1) {
                message.error(t("order.enterContractValid"));
                return;
              }
              if (isContractTaken(hd)) {
                message.error(t("order.contractTaken"));
                return;
              }
            }

            const vatRate = values.needsVat ? 10 : 0;
            const serviceNames = resolved.map((r) => r.service!.name);
            const contract = await contractsApi.create({
              contractNumber: values.needsVat ? String(values.contractNumber) : `DH-${Date.now()}`,
              customerId: customer.id,
              title: `${customer.name} · ${serviceNames.join(", ")}`,
            });
            const numbers = splitDossierNumbers(nextDossierNumber(orders, new Date()), resolved.length);
            const created: Order[] = [];

            try {
              for (let i = 0; i < resolved.length; i++) {
                const { service, value, line } = resolved[i];
                const apiOrder = await ordersApi.create(
                  mapUiOrderToCreateApi({
                    orderNumber: numbers[i],
                    contractId: contract.id,
                    customerId: customer.id,
                    serviceId: service!.id,
                    value,
                    assignedUserId: assigned.id,
                    submitterUserId: submitter.id,
                    vatRate,
                    stage: "new",
                    notes: values.notes,
                  }),
                );
                created.push({
                  ...mapApiOrderToUi(apiOrder, {
                    customerName: customer.name,
                    serviceName: service!.name,
                    assignedUserName: assigned.name,
                    submitterName: submitter.name,
                    contractNumber: values.needsVat ? Number(values.contractNumber) : undefined,
                  }),
                  commissionPercent:
                    values.commissionPercent != null && values.commissionPercent !== ""
                      ? Number(values.commissionPercent)
                      : undefined,
                  zaloGroupUrl: values.zaloGroupUrl?.trim() || undefined,
                  deadline: toStorageDate(line.deadline),
                  needsVat: Boolean(values.needsVat),
                });
              }
            } catch (err) {
              if (created.length) replaceOrders([...created, ...orders]);
              throw err;
            }

            replaceOrders([...created, ...orders]);
            addNotifications(
              [assigned.id],
              taskAssignedDraft(created[0]),
              currentUser?.id,
            );

            if (created.length === 1) {
              message.success(t("order.created"));
            } else {
              message.success(
                t("order.createdGroup", { count: created.length, numbers: numbers.join(", ") }),
              );
            }
            router.push(`/orders/${created[0].id}`);
          } catch (err) {
            message.error(apiErrorMessage(err, t("order.createFailed")));
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form.Item name="customerId" label={t("common.customer")} rules={[{ required: true, message: t("order.selectCustomer") }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
        <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
          {t("order.servicesLabel")}
        </Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {t("order.servicesHint")}
        </Typography.Paragraph>
        <Form.List
          name="lines"
          rules={[
            {
              validator: async (_, lines) => {
                if (!lines?.length) throw new Error(t("order.needOneService"));
              },
            },
          ]}
        >
          {(fields, { add, remove }) => (
            <Space orientation="vertical" size={12} style={{ width: "100%", marginBottom: 16 }}>
              {fields.map((field, index) => (
                <div
                  key={field.key}
                  style={{
                    border: `1px solid ${ds.hairline}`,
                    borderRadius: ds.radius.md,
                    padding: 12,
                  }}
                >
                  <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
                    <Typography.Text type="secondary">
                      {t("order.serviceLine", { n: index + 1 })}
                    </Typography.Text>
                    {fields.length > 1 ? (
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(field.name)}
                      >
                        {t("order.removeServiceLine")}
                      </Button>
                    ) : null}
                  </Space>
                  <Form.Item
                    name={[field.name, "serviceId"]}
                    label={t("common.service")}
                    rules={[{ required: true, message: t("order.selectService") }]}
                  >
                    <Select
                      options={activeServices.map((s) => ({ value: s.id, label: s.name }))}
                      onChange={(id) => setLineDeadline(field.name, id)}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, "value"]}
                    label={t("order.listPriceVnd")}
                    rules={[{ required: true, message: t("order.enterListPrice") }]}
                    extra={t("order.listPriceExtra")}
                  >
                    <InputNumber {...vndInputProps} />
                  </Form.Item>
                  <Form.Item name={[field.name, "deadline"]} label={t("order.deadlineLabel")}>
                    <DatePicker style={{ width: "100%" }} format={DISPLAY_DATE_FORMAT} />
                  </Form.Item>
                </div>
              ))}
              <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                {t("order.addServiceLine")}
              </Button>
            </Space>
          )}
        </Form.List>
        <Form.Item
          name="commissionPercent"
          label={t("order.commissionPercent")}
          extra={t("order.commissionPercentExtra")}
        >
          <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="assignedUserId" label={t("common.owner")} rules={[{ required: true }]}>
          <Select options={activeUsers.map((u) => ({ value: u.id, label: u.name }))} />
        </Form.Item>
        <Form.Item
          name="submitterId"
          label={t("order.submitterLabel")}
          rules={[{ required: true, message: t("order.selectSubmitter") }]}
        >
          <Select options={activeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} />
        </Form.Item>
        <Form.Item
          name="zaloGroupUrl"
          label={t("common.zaloGroup")}
          rules={[
            {
              validator: async (_, v) => {
                const s = String(v ?? "").trim();
                if (!s) return;
                try {
                  new URL(s);
                } catch {
                  throw new Error(t("order.invalidUrl"));
                }
              },
            },
          ]}
        >
          <Input placeholder="https://zalo.me/g/…" />
        </Form.Item>
        <Form.Item name="needsVat" valuePropName="checked">
          <Checkbox
            onChange={(e) => {
              if (e.target.checked) {
                form.setFieldValue("contractNumber", suggestedHd);
              }
            }}
          >
            {t("order.needsVat")}
          </Checkbox>
        </Form.Item>
        {needsVat ? (
          <Form.Item
            name="contractNumber"
            label={t("order.contractLabel")}
            rules={[{ required: true, message: t("order.enterContract") }]}
            extra={t("order.contractHint", { n: suggestedHd })}
          >
            <InputNumber min={1} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        ) : null}
        <Form.Item name="notes" label={t("common.note")}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Space>
          <Button
            onClick={() => confirmDiscardIfDirty(modal, form, () => router.push("/orders"))}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={saving}>
            {t("common.createOrder")}
          </Button>
        </Space>
      </Form>
    </>
  );
}
