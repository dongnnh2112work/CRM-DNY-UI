"use client";

import { App, Button, Checkbox, DatePicker, Form, Input, InputNumber, Select, Space } from "antd";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import { useCustomers } from "@/lib/customers-store";
import { vndInputProps } from "@/lib/format-vnd";
import { apiErrorMessage } from "@/lib/http/message";
import { taskAssignedDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import { deadlineFromService, nextContractNumber, nextDossierNumber } from "@/lib/order-helpers";
import { useOrders } from "@/lib/orders-store";
import { useServices } from "@/lib/services-store";
import { useUsers } from "@/lib/users-store";
import { contractsApi } from "@/modules/contracts/api";
import { ordersApi } from "@/modules/orders/api";
import { mapApiOrderToUi, mapUiOrderToCreateApi } from "@/modules/orders/map-to-ui";
import { useT } from "@/lib/use-t";

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

  const suggestedHd = useMemo(() => nextContractNumber(orders), [orders]);

  const onServiceChange = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    form.setFieldValue("deadline", dayjs(deadlineFromService(svc.processingDays)));
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("common.order"), href: "/orders" }, { title: t("order.breadcrumbNew") }]} />
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: ds.formPageMaxWidth, padding: 24 }}
        initialValues={{ needsVat: false, customerId: prefillCustomerId }}
        onFinish={async (values) => {
          setSaving(true);
          try {
            const customer = customers.find((c) => c.id === values.customerId);
            const service = services.find((s) => s.id === values.serviceId);
            const assigned = activeUsers.find((u) => u.id === values.assignedUserId);
            const submitter = activeUsers.find((u) => u.id === values.submitterId);
            if (!customer || !service || !assigned || !submitter) {
              message.error(t("common.requiredMissing"));
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

            const value = Number(values.value);
            const vatRate = values.needsVat ? 10 : 0;
            const contract = await contractsApi.create({
              contractNumber: values.needsVat ? String(values.contractNumber) : `DH-${Date.now()}`,
              customerId: customer.id,
              title: `${customer.name} · ${service.name}`,
            });
            const apiOrder = await ordersApi.create(
              mapUiOrderToCreateApi({
                orderNumber: nextDossierNumber(orders, new Date()),
                contractId: contract.id,
                customerId: customer.id,
                serviceId: service.id,
                value,
                assignedUserId: assigned.id,
                submitterUserId: submitter.id,
                vatRate,
                stage: "new",
                notes: values.notes,
              }),
            );
            const created = {
              ...mapApiOrderToUi(apiOrder, {
                customerName: customer.name,
                serviceName: service.name,
                assignedUserName: assigned.name,
                submitterName: submitter.name,
                contractNumber: values.needsVat ? Number(values.contractNumber) : undefined,
              }),
              commissionPercent:
                values.commissionPercent != null && values.commissionPercent !== ""
                  ? Number(values.commissionPercent)
                  : undefined,
              zaloGroupUrl: values.zaloGroupUrl?.trim() || undefined,
              deadline: values.deadline ? values.deadline.format("YYYY-MM-DD") : undefined,
              needsVat: Boolean(values.needsVat),
            };
            replaceOrders([created, ...orders]);

            addNotifications(
              [assigned.id],
              taskAssignedDraft(created),
              currentUser?.id,
            );

            message.success(t("order.created"));
            router.push(`/orders/${created.id}`);
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
        <Form.Item name="serviceId" label={t("order.serviceOne")} rules={[{ required: true }]}>
          <Select
            onChange={onServiceChange}
            options={services
              .filter((s) => s.status === "active")
              .map((s) => ({
                value: s.id,
                label: s.name,
              }))}
          />
        </Form.Item>
        <Form.Item
          name="value"
          label={t("order.listPriceVnd")}
          rules={[{ required: true, message: t("order.enterListPrice") }]}
          extra={t("order.listPriceExtra")}
        >
          <InputNumber {...vndInputProps} />
        </Form.Item>
        <Form.Item
          name="commissionPercent"
          label={t("order.commissionPercent")}
          extra={t("order.commissionPercentExtra")}
        >
          <InputNumber min={0} max={100} precision={2} addonAfter="%" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="assignedUserId" label={t("common.owner")} rules={[{ required: true }]}>
          <Select
            options={activeUsers
              .filter((u) => u.role === "staff")
              .map((u) => ({ value: u.id, label: u.name }))}
          />
        </Form.Item>
        <Form.Item
          name="submitterId"
          label={t("order.submitterLabel")}
          rules={[{ required: true, message: t("order.selectSubmitter") }]}
        >
          <Select options={activeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} />
        </Form.Item>
        <Form.Item name="deadline" label={t("order.deadlineLabel")}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
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
