"use client";

import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Checkbox, DatePicker, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useApiHydrate } from "@/components/api-hydrator";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { contractNumberLabel, numericContractNumber } from "@/lib/contract-number";
import { ds } from "@/lib/design-tokens";
import { useCustomers } from "@/lib/customers-store";
import { rememberContractNumber } from "@/lib/entity-lookups";
import { DISPLAY_DATE_FORMAT, toStorageDate } from "@/lib/format-date";
import { commissionIssue, moneyAmountIssue, signedVndInputProps } from "@/lib/input-validators";
import { apiErrorMessage } from "@/lib/http/message";
import { deadlineFromService, nextContractNumber } from "@/lib/order-helpers";
import { useOrders } from "@/lib/orders-store";
import { canLoadScope, isListSliceSettled } from "@/lib/route-data-scopes";
import { useNotifications } from "@/lib/notifications-store";
import {
  resolveCatalogEntity,
  useOrderFormCatalogs,
  usePrefillCustomerOption,
  withCurrentSelectOption,
} from "@/lib/order-form-catalogs";
import { useServices } from "@/lib/services-store";
import { useUsers } from "@/lib/users-store";
import { useSession } from "@/lib/session/session-provider";
import { contractsApi } from "@/modules/contracts/api";
import { ordersApi } from "@/modules/orders/api";
import {
  collectOrderNumbers,
  placeholderContractNumber,
  proposeDossierNumbers,
  shouldDeleteOrphanContract,
} from "@/modules/orders/dossier-catalog";
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
  const { listMeta } = useApiHydrate();
  const { users } = useUsers();
  const { user: sessionUser } = useSession();
  const ordersCatalogReady =
    canLoadScope("orders", sessionUser?.permissions) && isListSliceSettled(listMeta.orders, true);
  const { refreshInbox } = useNotifications();
  const activeUsers = users.filter((u) => u.status === "active");
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const catalogs = useOrderFormCatalogs(true);
  const knownPrefill = customers.find((customer) => customer.id === prefillCustomerId);
  const prefillCustomer = usePrefillCustomerOption(prefillCustomerId, knownPrefill?.name);
  const needsVat = Form.useWatch("needsVat", form) as boolean | undefined;
  const activeServices = useMemo(
    () => services.filter((s) => s.status === "active"),
    [services],
  );

  const suggestedHd = useMemo(
    () => (ordersCatalogReady ? nextContractNumber(orders) : undefined),
    [orders, ordersCatalogReady],
  );

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
          let createdContractId: string | undefined;
          let createdOrderCount = 0;
          try {
            const customer = resolveCatalogEntity(customers, values.customerId, prefillCustomer
              ? { id: prefillCustomer.value, name: prefillCustomer.label }
              : undefined);
            const assigned = resolveCatalogEntity(activeUsers, values.assignedUserId);
            const submitter = resolveCatalogEntity(activeUsers, values.submitterId);
            const lines = ((values.lines ?? []) as ServiceLine[]).filter((line) => line.serviceId);
            if (!customer || !assigned || !submitter || lines.length === 0) {
              message.error(t("common.requiredMissing"));
              return;
            }

            const resolved = lines.map((line) => {
              const service = services.find((s) => s.id === line.serviceId);
              return { line, service, value: Number(line.value) };
            });
            if (resolved.some((r) => !r.service || moneyAmountIssue(r.line.value))) {
              const negative = resolved.some((r) => moneyAmountIssue(r.line.value) === "negative");
              message.error(negative ? t("order.valueNegative") : t("order.valuePositive"));
              return;
            }
            const commissionProblem = commissionIssue(values.commissionPercent, Boolean(values.confirmZeroCommission));
            if (commissionProblem) {
              message.error(
                commissionProblem === "zero_unconfirmed"
                  ? t("order.commissionZeroConfirm")
                  : commissionProblem === "range"
                    ? t("order.commissionRange")
                    : t("order.commissionRequired"),
              );
              return;
            }

            if (values.needsVat) {
              const hd = numericContractNumber(values.contractNumber);
              if (hd == null) {
                message.error(t("order.enterContractValid"));
                return;
              }
              if (isContractTaken(hd)) {
                message.error(t("order.contractTaken"));
                return;
              }
            }

            const catalog = await collectOrderNumbers((page, pageSize) =>
              ordersApi.list({ page, pageSize }),
            );
            const proposed = proposeDossierNumbers(
              catalog.orderNumbers,
              resolved.length,
              new Date(),
              catalog.complete,
            );
            if (!proposed.ok) {
              message.error(t("order.dossierCatalogIncomplete"));
              return;
            }

            const vatRate = values.needsVat ? 10 : 0;
            const serviceNames = resolved.map((r) => r.service!.name);
            const submittedContractNumber = values.needsVat
              ? contractNumberLabel(values.contractNumber) ?? String(values.contractNumber)
              : placeholderContractNumber();
            const contract = await contractsApi.create({
              contractNumber: submittedContractNumber,
              customerId: customer.id,
              title: `${customer.name} · ${serviceNames.join(", ")}`,
            });
            createdContractId = contract.id;
            const savedContractNumber = contract.contractNumber || submittedContractNumber;
            if (contract.id) rememberContractNumber(contract.id, savedContractNumber);
            const numbers = proposed.numbers;
            const created: Order[] = [];

            try {
              for (let i = 0; i < resolved.length; i++) {
                const { service, value, line } = resolved[i];
                const formCommission =
                  values.commissionPercent != null && values.commissionPercent !== ""
                    ? Number(values.commissionPercent)
                    : undefined;
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
                    commissionPercent: formCommission,
                  }),
                );
                const mapped = mapApiOrderToUi(apiOrder, {
                  customerName: customer.name,
                  serviceName: service!.name,
                  assignedUserName: assigned.name,
                  submitterName: submitter.name,
                  contractNumber: savedContractNumber,
                });
                created.push({
                  ...mapped,
                  commissionPercent: mapped.commissionPercent ?? formCommission,
                  zaloGroupUrl: values.zaloGroupUrl?.trim() || undefined,
                  deadline: toStorageDate(line.deadline),
                  needsVat: Boolean(values.needsVat),
                });
              }
            } catch (err) {
              createdOrderCount = created.length;
              if (created.length) replaceOrders([...created, ...orders]);
              throw err;
            }
            createdOrderCount = created.length;

            replaceOrders([...created, ...orders]);
            if (assigned.id !== sessionUser?.id) refreshInbox();

            if (created.length === 1) {
              message.success(t("order.created"));
            } else {
              message.success(
                t("order.createdGroup", { count: created.length, numbers: numbers.join(", ") }),
              );
            }
            router.push(`/orders/${created[0].id}`);
          } catch (err) {
            let suffix = "";
            if (createdContractId && shouldDeleteOrphanContract(createdOrderCount)) {
              try {
                await contractsApi.remove(createdContractId);
                suffix = t("order.orphanContractRemoved");
              } catch {
                suffix = t("order.orphanContract", { id: createdContractId });
              }
            } else if (createdContractId) {
              suffix = t("order.orphanContractPartial", { id: createdContractId, count: createdOrderCount });
            }
            const base = apiErrorMessage(err, t("order.createFailed"));
            message.error(suffix ? `${base} ${suffix}` : base);
          } finally {
            setSaving(false);
          }
        }}
      >
        {ordersCatalogReady ? null : (
          <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t("order.dossierCatalogLoading")} />
        )}
        <Form.Item name="customerId" label={t("common.customer")} rules={[{ required: true, message: t("order.selectCustomer") }]}>
          <Select
            showSearch
            optionFilterProp="label"
            loading={catalogs.customersLoading}
            options={withCurrentSelectOption(
              customers.map((c) => ({ value: c.id, label: c.name })),
              prefillCustomer ?? undefined,
            )}
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
                      showSearch
                      optionFilterProp="label"
                      loading={catalogs.servicesLoading}
                      options={activeServices.map((s) => ({ value: s.id, label: s.name }))}
                      onChange={(id) => setLineDeadline(field.name, id)}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, "value"]}
                    label={t("order.listPriceVnd")}
                    rules={[
                      {
                        validator: async (_, value) => {
                          const issue = moneyAmountIssue(value);
                          if (!issue) return;
                          throw new Error(issue === "negative" ? t("order.valueNegative") : t("order.valuePositive"));
                        },
                      },
                    ]}
                    extra={t("order.listPriceExtra")}
                  >
                    <InputNumber {...signedVndInputProps} />
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
          rules={[
            {
              validator: async (_, value) => {
                const issue = commissionIssue(value, Boolean(form.getFieldValue("confirmZeroCommission")));
                if (!issue) return;
                if (issue === "range") throw new Error(t("order.commissionRange"));
                if (issue === "zero_unconfirmed") throw new Error(t("order.commissionZeroConfirm"));
                throw new Error(t("order.commissionRequired"));
              },
            },
          ]}
        >
          <InputNumber precision={2} addonAfter="%" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="confirmZeroCommission" valuePropName="checked">
          <Checkbox>{t("order.commissionZeroConfirm")}</Checkbox>
        </Form.Item>
        <Form.Item name="assignedUserId" label={t("common.owner")} rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            loading={catalogs.usersLoading}
            options={activeUsers.map((u) => ({ value: u.id, label: u.name }))}
          />
        </Form.Item>
        <Form.Item
          name="submitterId"
          label={t("order.submitterLabel")}
          rules={[{ required: true, message: t("order.selectSubmitter") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={catalogs.usersLoading}
            options={activeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
          />
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
              if (e.target.checked && suggestedHd != null) {
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
            extra={suggestedHd != null ? t("order.contractHint", { n: suggestedHd }) : t("order.dossierCatalogLoading")}
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
