"use client";

import { App, Alert, Button, Checkbox, DatePicker, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import { useCustomers } from "@/lib/customers-store";
import { useCtvs } from "@/lib/ctvs-store";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { MOCK_USERS } from "@/lib/mock-users";
import { taskAssignedDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import { deadlineFromService, nextContractNumber } from "@/lib/order-helpers";
import { useOrders } from "@/lib/orders-store";
import { useServices } from "@/lib/services-store";
import { useUsers } from "@/lib/users-store";
import { useT } from "@/lib/use-t";

const activeUsers = MOCK_USERS.filter((u) => u.status === "active");

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
  const { ctvs, addJob } = useCtvs();
  const { orders, addOrder, isContractTaken } = useOrders();
  const { addNotifications } = useNotifications();
  const { currentUser } = useUsers();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const channel = Form.useWatch("channel", form);
  const value = Form.useWatch("value", form) as number | undefined;
  const ctvPrice = Form.useWatch("ctvPrice", form) as number | undefined;
  const serviceId = Form.useWatch("serviceId", form) as string | undefined;
  const needsVat = Form.useWatch("needsVat", form) as boolean | undefined;

  const suggestedHd = useMemo(() => nextContractNumber(orders), [orders]);

  const selectedService = services.find((s) => s.id === serviceId);
  const ctvCommission =
    channel === "ctv" && typeof value === "number" && typeof ctvPrice === "number"
      ? ctvPrice - value
      : null;

  const onServiceChange = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    form.setFieldValue("value", svc.unitPrice);
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
        onFinish={(values) => {
          setSaving(true);
          try {
            const customer = customers.find((c) => c.id === values.customerId);
            const service = services.find((s) => s.id === values.serviceId);
            const assigned = activeUsers.find((u) => u.id === values.assignedUserId);
            const submitter = activeUsers.find((u) => u.id === values.submitterId);
            const reviewer = values.reviewerId
              ? activeUsers.find((u) => u.id === values.reviewerId)
              : undefined;
            const ctv = values.ctvId ? ctvs.find((c) => c.id === values.ctvId) : undefined;
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

            const created = addOrder({
              customerId: customer.id,
              customerName: customer.name,
              serviceId: service.id,
              serviceName: service.name,
              channel: values.channel,
              ctvId: ctv?.id,
              ctvName: ctv?.name,
              value: Number(values.value),
              commission:
                values.commission != null && values.commission !== ""
                  ? Number(values.commission)
                  : undefined,
              zaloGroupUrl: values.zaloGroupUrl?.trim() || undefined,
              ctvPrice: values.channel === "ctv" ? Number(values.ctvPrice) : undefined,
              assignedUserId: assigned.id,
              assignedUserName: assigned.name,
              submitterId: submitter.id,
              submitterName: submitter.name,
              reviewerId: reviewer?.id,
              reviewerName: reviewer?.name,
              notes: values.notes,
              needsVat: Boolean(values.needsVat),
              contractNumber: values.needsVat ? Number(values.contractNumber) : undefined,
              deadline: values.deadline ? values.deadline.format("YYYY-MM-DD") : undefined,
            });

            addNotifications(
              [assigned.id],
              taskAssignedDraft(created),
              currentUser?.id,
            );

            if (ctv && values.channel === "ctv") {
              const ratecard = Number(values.value);
              const price = Number(values.ctvPrice);
              addJob(ctv.id, {
                orderId: created.id,
                orderNumber: created.orderNumber,
                customerName: customer.name,
                serviceName: service.name,
                ratecard,
                ctvPrice: price,
                commission: price - ratecard,
              });
            }

            message.success(t("order.created"));
            router.push(`/orders/${created.id}`);
          } catch (err) {
            message.error(err instanceof Error ? err.message : t("order.createFailed"));
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
                label: `${s.name} — ${formatVndDisplay(s.unitPrice)}`,
              }))}
          />
        </Form.Item>
        <Form.Item name="channel" label={t("common.channel")} rules={[{ required: true }]}>
          <Select
            options={[
              { value: "direct", label: t("channel.direct") },
              { value: "website", label: t("channel.website") },
              { value: "referral", label: t("channel.referral") },
              { value: "ctv", label: t("channel.ctv") },
            ]}
          />
        </Form.Item>
        {channel === "ctv" && (
          <Form.Item name="ctvId" label={t("order.selectCtv")} rules={[{ required: true, message: t("order.selectCtv") }]}>
            <Select
              options={ctvs
                .filter((c) => c.status === "active")
                .map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        )}
        <Form.Item
          name="value"
          label={t("order.listPriceVnd")}
          rules={[{ required: true, message: t("order.enterListPrice") }]}
          extra={
            selectedService
              ? t("order.listPriceHint", { amount: formatVndDisplay(selectedService.unitPrice) })
              : t("order.listPriceExtra")
          }
        >
          <InputNumber {...vndInputProps} />
        </Form.Item>
        <Form.Item
          name="commission"
          label={t("order.commissionVnd")}
          extra={t("order.commissionExtra")}
        >
          <InputNumber {...vndInputProps} />
        </Form.Item>
        {channel === "ctv" && (
          <>
            <Form.Item
              name="ctvPrice"
              label={t("order.ctvPriceVnd")}
              rules={[
                { required: true, message: t("order.enterCtvPrice") },
                {
                  validator: async (_, ctvVal) => {
                    if (ctvVal == null || value == null) return;
                    if (Number(ctvVal) < Number(value)) {
                      throw new Error(t("order.ctvPriceHint"));
                    }
                  },
                },
              ]}
              extra={t("order.ctvCommissionExtra")}
              dependencies={["value"]}
            >
              <InputNumber {...vndInputProps} />
            </Form.Item>
            {ctvCommission != null && (
              <Alert
                type={ctvCommission >= 0 ? "success" : "error"}
                showIcon
                style={{ marginBottom: 16 }}
                message={
                  <Typography.Text>
                    {t("order.commissionExpected")}{" "}
                    <Typography.Text strong>{formatVndDisplay(ctvCommission)}</Typography.Text>
                    <Typography.Text type="secondary"> ({t("order.ctvCommissionExtra")})</Typography.Text>
                    {ctvCommission < 0 && t("order.checkPrice")}
                  </Typography.Text>
                }
              />
            )}
          </>
        )}
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
        <Form.Item
          name="reviewerId"
          label={t("order.reviewerOptional")}
          extra={t("order.reviewerExtra")}
        >
          <Select
            allowClear
            options={activeUsers
              .filter((u) => u.role === "admin" || u.role === "super_admin" || u.role === "accountant")
              .map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
          />
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
