"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Checkbox, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Select, Skeleton, Space, Tabs, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { OrderDocuments } from "@/components/orders/order-documents";
import { OrderExpensesPanel } from "@/components/orders/order-expenses-panel";
import { LicenseUpload } from "@/components/orders/license-upload";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusSelect } from "@/components/shared/status-select";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { useCustomers } from "@/lib/customers-store";
import { DISPLAY_DATE_FORMAT, formatDisplayDate, toStorageDate } from "@/lib/format-date";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { taskAssignedDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import {
  deadlineFromService,
  getOrderLicenseExpirySummary,
  isContractNumberTaken,
  licenseExpiryTagColor,
  licenseWarnMonthsForOrder,
  nextContractNumber,
} from "@/lib/order-helpers";
import { groupContractTotal, nextSiblingDossierNumber, pickPrimaryOrder, siblingOrders } from "@/lib/order-group";
import { useOrders } from "@/lib/orders-store";
import { apiErrorMessage } from "@/lib/http/message";
import { ApiError } from "@/lib/http/errors";
import { unwrapList } from "@/lib/http/paging";
import { reloadOrderFinance } from "@/lib/load-api-data";
import { useExpenses } from "@/lib/expenses-store";
import { ordersApi } from "@/modules/orders/api";
import { mapApiOrderToUi, mapUiOrderToCreateApi, mapUiOrderToUpdateApi } from "@/modules/orders/map-to-ui";
import { contractsApi } from "@/modules/contracts/api";
import { customersApi } from "@/modules/customers/api";
import { mapApiCustomerToUi } from "@/modules/customers/map-to-ui";
import { documentsApi, type ApiDocument } from "@/modules/documents/api";
import {
  isLicenseDocument,
  isVatDocument,
  mapApiDocumentToAttachment,
} from "@/modules/documents/map-to-ui";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { usePayments } from "@/lib/payments-store";
import { useServices } from "@/lib/services-store";
import type { Order, OrderStage } from "@/lib/types";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { orderHasContractNumber } from "@/lib/vat-helpers";
import { useT } from "@/lib/use-t";

type ScreenBoot =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "missing" }
  | { status: "error"; message: string };

/** Dedupe Strict Mode double-mount so order+docs hit the network once. */
const orderDetailBootInflight = new Map<
  string,
  Promise<[Awaited<ReturnType<typeof ordersApi.get>>, Awaited<ReturnType<typeof documentsApi.list>>]>
>();

function loadOrderDetailBoot(orderId: string) {
  const hit = orderDetailBootInflight.get(orderId);
  if (hit) return hit;
  const pending = Promise.all([
    ordersApi.get(orderId),
    documentsApi.list({ orderId, pageSize: 100 }),
  ]).finally(() => {
    orderDetailBootInflight.delete(orderId);
  });
  orderDetailBootInflight.set(orderId, pending);
  return pending;
}

function attachmentsFromDocs(docs: ApiDocument[], userName: Map<string, string>) {
  const mapDoc = (d: ApiDocument) => {
    try {
      return mapApiDocumentToAttachment(d, userName.get(d.uploadedByUserId));
    } catch {
      return null;
    }
  };
  return {
    work: docs
      .filter((d) => !isLicenseDocument(d) && !isVatDocument(d))
      .map(mapDoc)
      .filter((row) => row != null),
    licenses: docs.filter((d) => isLicenseDocument(d)).map(mapDoc).filter((row) => row != null),
  };
}

export default function OrderDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { status: sessionStatus, can } = useSession();
  const { upsertOrder, deleteOrder, orders, isContractTaken } = useOrders();
  const { addNotifications } = useNotifications();
  const { currentUser, users } = useUsers();
  const activeUsers = users.filter((u) => u.status === "active");
  const { stageOptions } = useOrderStatusConfig();
  const { getByOrderId, upsertPayment } = usePayments();
  const { mergeExpensesForOrder } = useExpenses();
  const { customers } = useCustomers();
  const { services } = useServices();
  const [order, setOrder] = useState<Order | null>(null);
  const [boot, setBoot] = useState<ScreenBoot>({ status: "loading" });
  const [financeReady, setFinanceReady] = useState(false);
  const payment = order ? getByOrderId(order.id) : undefined;
  const [editOpen, setEditOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [form] = Form.useForm();
  const [addServiceForm] = Form.useForm();
  const needsVatEdit = Form.useWatch("needsVat", form) as boolean | undefined;

  const suggestedHd = useMemo(
    () => nextContractNumber(orders.filter((o) => o.id !== id)),
    [orders, id],
  );

  const catalogsRef = useRef({ users, customers, services });
  catalogsRef.current = { users, customers, services };
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useEffect(() => {
    if (!order || !editOpen) return;
    form.setFieldsValue({
      customerId: order.customerId,
      serviceId: order.serviceId,
      value: order.value,
      commissionPercent: order.commissionPercent,
      assignedUserId: order.assignedUserId,
      submitterId: order.submitterId,
      deadline: order.deadline ? dayjs(order.deadline) : null,
      zaloGroupUrl: order.zaloGroupUrl,
      needsVat: order.needsVat,
      contractNumber: order.contractNumber,
      notes: order.notes,
    });
  }, [order, editOpen, form]);

  useEffect(() => {
    if (!id || sessionStatus !== "authenticated") return;
    let cancelled = false;
    setFinanceReady(false);

    const cached = ordersRef.current.find((o) => o.id === id);
    if (cached) {
      setOrder(cached);
      setBoot({ status: "ready" });
    } else {
      setBoot({ status: "loading" });
      setOrder(null);
    }

    const load = async () => {
      try {
        const [apiOrder, docsResult] = await loadOrderDetailBoot(id);
        if (cancelled) return;
        if (!apiOrder?.id) {
          setBoot({ status: "missing" });
          return;
        }

        const { users: catalogUsers, customers: catalogCustomers, services: catalogServices } =
          catalogsRef.current;
        const userName = new Map(catalogUsers.map((u) => [u.id, u.name]));
        const customerName = new Map(catalogCustomers.map((c) => [c.id, c.name]));
        const serviceName = new Map(catalogServices.map((s) => [s.id, s.name]));

        let mapped = mapApiOrderToUi(apiOrder, {
          customerName: customerName.get(apiOrder.customerId),
          serviceName: serviceName.get(apiOrder.serviceId),
          assignedUserName: userName.get(apiOrder.assignedUserId),
          submitterName: userName.get(apiOrder.submitterUserId),
          reviewerName: apiOrder.reviewerUserId ? userName.get(apiOrder.reviewerUserId) : undefined,
        });

        if (mapped.customerName === mapped.customerId) {
          try {
            const customer = mapApiCustomerToUi(await customersApi.get(mapped.customerId));
            mapped = { ...mapped, customerName: customer.name };
          } catch {
            /* keep id until catalog arrives */
          }
        }

        const docs = unwrapList(docsResult).filter((d) => d?.id);
        const { work, licenses } = attachmentsFromDocs(docs, userName);
        mapped = {
          ...mapped,
          attachments: work,
          licenseAttachments: licenses,
        };

        if (cancelled) return;
        setOrder(mapped);
        upsertOrder(mapped);
        setBoot({ status: "ready" });

        try {
          await reloadOrderFinance({
            order: mapped,
            groupOrders: ordersRef.current,
            users: catalogUsers,
            upsertPayment,
            mergeExpensesForOrder,
          });
        } finally {
          if (!cancelled) setFinanceReady(true);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 403)) {
          setBoot({ status: "missing" });
          return;
        }
        setBoot({ status: "error", message: apiErrorMessage(err, t("common.notFoundOrder")) });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, sessionStatus, upsertOrder, upsertPayment, mergeExpensesForOrder, t]);

  if (sessionStatus === "loading" || boot.status === "loading" || (boot.status === "ready" && !order)) {
    return <PageLoading />;
  }
  if (boot.status === "missing" || boot.status === "error" || !order) {
    return (
      <EmptyState
        description={boot.status === "error" ? boot.message : t("common.notFoundOrder")}
        action={{ label: t("common.back"), href: "/orders" }}
      />
    );
  }

  const workFileCount = order.attachments.filter((a) => !a.deleted).length;
  const licenseFileCount = (order.licenseAttachments ?? []).filter((a) => !a.deleted).length;
  const licenseSummary = getOrderLicenseExpirySummary(
    order,
    licenseWarnMonthsForOrder(order, services),
  );
  const siblings = siblingOrders(orders, order);
  const primary = pickPrimaryOrder(siblings);
  const groupTotal = groupContractTotal(siblings);
  const activeServices = services.filter((s) => s.status === "active");
  const canAddService = can(PERMISSION.orderCreate) && order.stage !== "cancelled";

  const persist = (next: Order) => {
    setOrder(next);
    upsertOrder(next);
  };

  const openAddService = () => {
    addServiceForm.resetFields();
    addServiceForm.setFieldsValue({
      assignedUserId: order.assignedUserId,
      submitterId: order.submitterId,
      commissionPercent: order.commissionPercent,
    });
    setAddServiceOpen(true);
  };

  const addServiceToContract = async (values: {
    serviceId?: string;
    value?: number;
    deadline?: unknown;
    assignedUserId?: string;
    submitterId?: string;
    commissionPercent?: number | string;
  }) => {
    const service = services.find((s) => s.id === values.serviceId);
    const assigned = activeUsers.find((u) => u.id === values.assignedUserId);
    const submitter = activeUsers.find((u) => u.id === values.submitterId);
    const value = Number(values.value);
    if (!service || !assigned || !submitter || !Number.isFinite(value)) {
      message.error(t("common.requiredMissing"));
      return;
    }

    setAddingService(true);
    try {
      let contractId = order.contractId;
      if (!contractId) {
        const contract = await contractsApi.create({
          contractNumber:
            order.contractNumber != null ? String(order.contractNumber) : `DH-${Date.now()}`,
          customerId: order.customerId,
          title: `${order.customerName} · ${[...siblings.map((s) => s.serviceName), service.name].join(", ")}`,
        });
        contractId = contract.id;
        persist({ ...order, contractId });
      }

      const orderNumber = nextSiblingDossierNumber(siblings);
      const vatRate = order.needsVat ? 10 : 0;
      const apiOrder = await ordersApi.create(
        mapUiOrderToCreateApi({
          orderNumber,
          contractId,
          customerId: order.customerId,
          serviceId: service.id,
          value,
          assignedUserId: assigned.id,
          submitterUserId: submitter.id,
          vatRate,
          stage: "new",
        }),
      );
      const created = {
        ...mapApiOrderToUi(apiOrder, {
          customerName: order.customerName,
          serviceName: service.name,
          assignedUserName: assigned.name,
          submitterName: submitter.name,
          contractNumber: order.contractNumber,
        }),
        contractId,
        commissionPercent:
          values.commissionPercent != null && values.commissionPercent !== ""
            ? Number(values.commissionPercent)
            : order.commissionPercent,
        zaloGroupUrl: order.zaloGroupUrl,
        deadline: toStorageDate(values.deadline),
        needsVat: order.needsVat,
      };
      upsertOrder(created);
      addNotifications([assigned.id], taskAssignedDraft(created), currentUser?.id);
      message.success(t("order.addedService", { number: created.orderNumber, service: service.name }));
      setAddServiceOpen(false);
    } catch (err) {
      message.error(apiErrorMessage(err, t("order.createFailed")));
    } finally {
      setAddingService(false);
    }
  };

  const applyStage = async (newStage: OrderStage) => {
    if (newStage === order.stage) return;
    try {
      await ordersApi.changeStage(order.id, newStage);
      persist({
        ...order,
        stage: newStage,
        approvalStatus: "none",
        pendingTransition: undefined,
      });
      message.success(t("order.stageUpdated"));
    } catch (err) {
      message.error(apiErrorMessage(err, t("order.stageUpdated")));
    }
  };

  const requestStageChange = (newStage: OrderStage) => {
    if (newStage === order.stage) return;
    const nextLabel = stageOptions.find((s) => s.value === newStage)?.label ?? newStage;
    modal.confirm({
      title: t("order.changeStage", { label: nextLabel }),
      okText: t("common.confirm"),
      cancelText: t("common.cancel"),
      onOk: () => applyStage(newStage),
    });
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("common.order"), href: "/orders" }, { title: order.orderNumber }]}>
        <Space wrap>
          {can(PERMISSION.orderUpdate) ? (
            <Button onClick={() => setEditOpen(true)}>{t("common.edit")}</Button>
          ) : null}
          {canAddService ? (
            <Button icon={<PlusOutlined />} onClick={openAddService}>
              {t("order.addServiceToContract")}
            </Button>
          ) : null}
          <Button
            type="primary"
            onClick={() => {
              if (payment) router.push(`/payments/${payment.id}`);
              else router.push("/payments");
            }}
          >
            {t("order.payment")}
            {financeReady && payment
              ? t("order.remainingAmount", { amount: formatVndDisplay(payment.remaining) })
              : financeReady
                ? ""
                : " …"}
          </Button>
          <Tooltip title={!orderHasContractNumber(order) ? t("order.vatNeedsContract") : undefined}>
            <span>
              <Button
                disabled={!orderHasContractNumber(order)}
                onClick={() => router.push(`/vat/new?orderId=${order.id}`)}
              >
                {t("common.createVat")}
              </Button>
            </span>
          </Tooltip>
          <Popconfirm
            title={t("order.cancelTitle")}
            description={t("order.cancelBody")}
            okText={t("order.cancelOk")}
            cancelText={t("common.close")}
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              applyStage("cancelled");
            }}
          >
            <Button danger>{t("order.cancelOk")}</Button>
          </Popconfirm>
          <Popconfirm
            title={t("order.deleteTitle")}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              deleteOrder(order.id);
              message.success(t("order.deleted"));
              router.push("/orders");
            }}
          >
            <Button danger>{t("common.delete")}</Button>
          </Popconfirm>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {order.orderNumber}
          </Typography.Title>
          <StatusSelect
            module="orderStage"
            value={order.stage}
            options={stageOptions.map((s) => ({ value: s.value, label: s.label }))}
            onChange={(v) => requestStageChange(v as OrderStage)}
          />
          <Tag color={order.needsVat ? "blue" : "default"}>
            {order.needsVat ? t("common.withVat") : t("common.withoutVat")}
          </Tag>
          {order.contractNumber != null ? (
            <Tag>{t("order.contractTag", { n: order.contractNumber })}</Tag>
          ) : null}
          <Tag color={licenseExpiryTagColor(licenseSummary.tone)}>
            {licenseSummary.label}
            {licenseSummary.earliestExpiresAt ? ` · ${licenseSummary.earliestExpiresAt}` : ""}
          </Tag>
          <Tag>{t("order.workFilesTag", { count: workFileCount })}</Tag>
          {licenseFileCount > 0 && (
            <Tag color="green">{t("order.licenseCountTag", { count: licenseFileCount })}</Tag>
          )}
        </Space>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("order.contractServices")}
          description={
            <Space orientation="vertical" size={4}>
              {siblings.length > 1 ? (
                <span>
                  {financeReady ? (
                    t("order.sharedPaymentHint", {
                      amount: formatVndDisplay(payment?.totalAmount ?? groupTotal),
                      count: siblings.length,
                      number: primary.orderNumber,
                    })
                  ) : (
                    <Skeleton.Input active size="small" style={{ width: 280, verticalAlign: "middle" }} />
                  )}
                </span>
              ) : (
                <Typography.Text type="secondary">{t("order.addServiceToContractHint")}</Typography.Text>
              )}
              <Space wrap size={4}>
                <Typography.Text type="secondary">{t("order.sameContract")}:</Typography.Text>
                {siblings.map((s) =>
                  s.id === order.id ? (
                    <Tag key={s.id}>
                      {s.orderNumber} · {s.serviceName}
                    </Tag>
                  ) : (
                    <Link key={s.id} href={`/orders/${s.id}`}>
                      {s.orderNumber} · {s.serviceName}
                    </Link>
                  ),
                )}
                {canAddService ? (
                  <Button type="link" size="small" icon={<PlusOutlined />} onClick={openAddService}>
                    {t("order.addServiceLine")}
                  </Button>
                ) : null}
              </Space>
              {siblings.length > 1 && payment ? (
                <Link href={`/payments/${payment.id}`}>{t("order.payment")}</Link>
              ) : null}
            </Space>
          }
        />

        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label={t("common.customer")}>
            <Link href={`/customers/${order.customerId}`}>{order.customerName}</Link>
          </Descriptions.Item>
          <Descriptions.Item label={t("common.service")}>{order.serviceName}</Descriptions.Item>
          <Descriptions.Item label={t("order.listPriceVnd")}>{formatVndDisplay(order.value)}</Descriptions.Item>
          <Descriptions.Item label={t("order.commissionPercent")}>
            {order.commissionPercent != null ? `${order.commissionPercent}%` : "—"}
          </Descriptions.Item>
          <Descriptions.Item label={t("common.zaloGroup")}>
            {order.zaloGroupUrl ? (
              <Typography.Link href={order.zaloGroupUrl} target="_blank" rel="noopener noreferrer">
                {order.zaloGroupUrl}
              </Typography.Link>
            ) : (
              "—"
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.issueVat")}>{order.needsVat ? t("common.yes") : t("common.no")}</Descriptions.Item>
          <Descriptions.Item label={t("common.contractNo")}>
            {order.contractNumber != null ? order.contractNumber : "—"}
          </Descriptions.Item>
          <Descriptions.Item label={t("common.deadline")}>
            {formatDisplayDate(order.deadline)}
          </Descriptions.Item>
          <Descriptions.Item label={t("common.owner")}>{order.assignedUserName}</Descriptions.Item>
          <Descriptions.Item label={t("common.submitter")}>{order.submitterName}</Descriptions.Item>
          <Descriptions.Item label={t("common.createdAt")}>
            {formatDisplayDate(order.createdAt)}
          </Descriptions.Item>
          {order.notes && (
            <Descriptions.Item label={t("common.note")} span={2}>
              {order.notes}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Tabs
          items={[
            {
              key: "expenses",
              label: t("order.expensesTab"),
              children: <OrderExpensesPanel order={order} financeReady={financeReady} />,
            },
            {
              key: "documents",
              label: t("order.workFiles", { count: workFileCount }),
              children: (
                <OrderDocuments
                  orderId={order.id}
                  attachments={order.attachments}
                  onChange={(attachments) => persist({ ...order, attachments })}
                  uploaderName={order.submitterName}
                />
              ),
            },
            {
              key: "license",
              label: t("order.licenseFiles", { count: licenseFileCount }),
              children: (
                <div>
                  <Typography.Paragraph type="secondary">{t("license.tabHint")}</Typography.Paragraph>
                  <LicenseUpload
                    orderId={order.id}
                    files={order.licenseAttachments ?? []}
                    onChange={(licenseAttachments) => persist({ ...order, licenseAttachments })}
                    uploaderName={order.submitterName}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={t("order.editTitle", { number: order.orderNumber })}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={560}
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Form
          form={form}
          layout="vertical"
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
                if (isContractTaken(hd, order.id) || isContractNumberTaken(orders, hd, order.id)) {
                  message.error(t("order.contractTaken"));
                  return;
                }
              }

              const value = Number(values.value);
              const vatRate = values.needsVat ? 10 : 0;
              await ordersApi.update(
                order.id,
                mapUiOrderToUpdateApi({
                  value,
                  vatRate,
                  notes: values.notes,
                }),
              );
              if (assigned.id !== order.assignedUserId) {
                await ordersApi.assign(order.id, assigned.id);
              }
              if (order.contractId && values.needsVat && values.contractNumber) {
                await contractsApi.update(order.contractId, {
                  contractNumber: String(values.contractNumber),
                  customerId: customer.id,
                });
              }

              persist({
                ...order,
                customerId: customer.id,
                customerName: customer.name,
                serviceId: service.id,
                serviceName: service.name,
                value,
                commissionPercent:
                  values.commissionPercent != null && values.commissionPercent !== ""
                    ? Number(values.commissionPercent)
                    : undefined,
                assignedUserId: assigned.id,
                assignedUserName: assigned.name,
                submitterId: submitter.id,
                submitterName: submitter.name,
                notes: values.notes,
                needsVat: Boolean(values.needsVat),
                contractNumber: values.needsVat ? Number(values.contractNumber) : undefined,
                deadline: toStorageDate(values.deadline),
                zaloGroupUrl: values.zaloGroupUrl?.trim() || undefined,
                vatIssueDeadline: undefined,
              });
              if (assigned.id !== order.assignedUserId) {
                addNotifications(
                  [assigned.id],
                  taskAssignedDraft({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    customerName: customer.name,
                    serviceName: service.name,
                  }),
                  currentUser?.id,
                );
              }
              message.success(t("order.updated"));
              setEditOpen(false);
            } catch (err) {
              message.error(apiErrorMessage(err, t("order.updated")));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="customerId" label={t("common.customer")} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="serviceId" label={t("common.service")} rules={[{ required: true }]}>
            <Select
              onChange={(id) => {
                const svc = services.find((s) => s.id === id);
                if (!svc) return;
                const from = order.createdAt ? new Date(order.createdAt) : new Date();
                form.setFieldValue("deadline", dayjs(deadlineFromService(svc.processingDays, from)));
              }}
              options={services.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="value" label={t("common.listPrice")} rules={[{ required: true }]}>
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
            <Select options={activeUsers.map((u) => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="submitterId" label={t("common.submitter")} rules={[{ required: true }]}>
            <Select options={activeUsers.map((u) => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="deadline" label={t("order.deadlineLabel")}>
            <DatePicker style={{ width: "100%" }} format={DISPLAY_DATE_FORMAT} />
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
                if (e.target.checked && !form.getFieldValue("contractNumber")) {
                  form.setFieldValue("contractNumber", suggestedHd);
                }
              }}
            >
              {t("order.needsVat")}
            </Checkbox>
          </Form.Item>
          {needsVatEdit ? (
            <Form.Item
              name="contractNumber"
              label={t("common.contractNo")}
              rules={[{ required: true, message: t("order.enterContract") }]}
            >
              <InputNumber min={1} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}
          <Form.Item name="notes" label={t("common.note")}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space>
            <Button
              onClick={() => confirmDiscardIfDirty(modal, form, () => setEditOpen(false))}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="primary" htmlType="submit" loading={saving} disabled={saving}>
              {t("common.save")}
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={t("order.addServiceTitle", { number: order.orderNumber })}
        open={addServiceOpen}
        onCancel={() => setAddServiceOpen(false)}
        footer={null}
        width={480}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">{t("order.addServiceToContractHint")}</Typography.Paragraph>
        <Form form={addServiceForm} layout="vertical" onFinish={(values) => void addServiceToContract(values)}>
          <Form.Item
            name="serviceId"
            label={t("common.service")}
            rules={[{ required: true, message: t("order.selectService") }]}
          >
            <Select
              options={activeServices.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(id) => {
                const svc = services.find((s) => s.id === id);
                if (!svc) return;
                addServiceForm.setFieldValue("deadline", dayjs(deadlineFromService(svc.processingDays)));
              }}
            />
          </Form.Item>
          <Form.Item
            name="value"
            label={t("order.listPriceVnd")}
            rules={[{ required: true, message: t("order.enterListPrice") }]}
          >
            <InputNumber {...vndInputProps} />
          </Form.Item>
          <Form.Item name="deadline" label={t("order.deadlineLabel")}>
            <DatePicker style={{ width: "100%" }} format={DISPLAY_DATE_FORMAT} />
          </Form.Item>
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
          <Form.Item name="submitterId" label={t("common.submitter")} rules={[{ required: true }]}>
            <Select options={activeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} />
          </Form.Item>
          <Space>
            <Button onClick={() => setAddServiceOpen(false)} disabled={addingService}>
              {t("common.cancel")}
            </Button>
            <Button type="primary" htmlType="submit" loading={addingService} disabled={addingService}>
              {t("order.addServiceLine")}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
