"use client";

import {
  App,
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UsedServiceTags } from "@/components/customers/used-service-tags";
import { DataTable } from "@/components/shared/data-table";
import { ExtraFormFields } from "@/components/shared/extra-form-fields";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusSelect } from "@/components/shared/status-select";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import {
  collectCustomFields,
  getCustomerFormExtraFields,
  getCustomerOrders,
  getCustomerUsedServices,
  type CustomerUsedService,
} from "@/lib/customer-helpers";
import { useCustomerStatusConfig } from "@/lib/customer-status-store";
import { useCustomers } from "@/lib/customers-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import { apiErrorMessage } from "@/lib/http/message";
import { useOrders } from "@/lib/orders-store";
import { useServices } from "@/lib/services-store";
import type { Customer, CustomerStatus, Order } from "@/lib/types";
import { useUsers } from "@/lib/users-store";
import { customersApi } from "@/modules/customers/api";
import { mapApiCustomerToUi, mapUiCustomerPatchToApi } from "@/modules/customers/map-to-ui";
import { useT } from "@/lib/use-t";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function CustomerDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { statusOptions, addStatus, updateStatus, removeStatus } = useCustomerStatusConfig();
  const { customers, getById, ready, updateCustomer, deleteCustomer, fieldDefs } = useCustomers();
  const { users } = useUsers();
  const { orders } = useOrders();
  const { services } = useServices();
  const mockCustomer = getById(id);
  const [liveCustomer, setLiveCustomer] = useState<Customer | null>(null);
  const [liveChecked, setLiveChecked] = useState(false);
  const customer = mockCustomer ?? liveCustomer;
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const relatedOrders = useMemo(
    () => (customer ? getCustomerOrders(customer.id, orders) : []),
    [customer, orders],
  );
  const usedServices = useMemo(
    () =>
      customer
        ? getCustomerUsedServices(customer.id, customer.usedServiceIds, orders, services)
        : [],
    [customer, orders, services],
  );
  const extraFields = getCustomerFormExtraFields(fieldDefs);

  const orderColumns = useMemo(
    () => [
      {
        title: t("common.dossier"),
        dataIndex: "orderNumber",
        sorter: (a: Order, b: Order) => compareText(a.orderNumber, b.orderNumber),
        render: (v: string, r: Order) => <Link href={`/orders/${r.id}`}>{v}</Link>,
      },
      {
        title: t("common.service"),
        dataIndex: "serviceName",
        sorter: (a: Order, b: Order) => compareText(a.serviceName, b.serviceName),
      },
      {
        title: t("common.stage"),
        dataIndex: "stage",
        render: (s: string) => <StatusBadge module="orderStage" status={s} />,
      },
      {
        title: t("common.value"),
        dataIndex: "value",
        align: "center" as const,
        sorter: (a: Order, b: Order) => a.value - b.value,
        render: (v: number) => formatVndDisplay(v),
      },
      {
        title: t("common.owner"),
        dataIndex: "assignedUserName",
      },
      {
        title: t("common.createdAt"),
        dataIndex: "createdAt",
      },
    ],
    [t],
  );

  const usedServiceColumns = useMemo(
    () => [
      {
        title: t("common.service"),
        dataIndex: "serviceName",
        render: (name: string, r: CustomerUsedService) => (
          <Link href={`/services/${r.serviceId}`}>{name}</Link>
        ),
      },
      {
        title: t("field.category"),
        dataIndex: "category",
        render: (v?: string) => v || "—",
      },
      {
        title: t("customer.orderCount"),
        dataIndex: "orderCount",
        align: "center" as const,
        render: (n: number) => n || "—",
      },
      {
        title: t("customer.latestOrder"),
        dataIndex: "lastOrderAt",
        render: (v?: string) => v || "—",
      },
      {
        title: t("customer.source"),
        key: "source",
        render: (_: unknown, r: CustomerUsedService) => (
          <Space size={4} wrap>
            {r.fromOrders ? <Tag color="blue">{t("common.order")}</Tag> : null}
            {r.fromRecord && !r.fromOrders ? <Tag>{t("customer.manualRecord")}</Tag> : null}
          </Space>
        ),
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!ready || !id) return;
    if (getById(id)) {
      setLiveChecked(true);
      return;
    }
    let cancelled = false;
    customersApi
      .get(id)
      .then((c) => {
        if (!cancelled) setLiveCustomer(mapApiCustomerToUi(c));
      })
      .catch(() => {
        if (!cancelled) setLiveCustomer(null);
      })
      .finally(() => {
        if (!cancelled) setLiveChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, id, getById]);

  useEffect(() => {
    if (!customer || !editOpen) return;
    form.setFieldsValue({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      company: customer.company,
      taxCode: customer.taxCode,
      address: customer.address,
      owner: customer.owner,
      status: customer.status,
      channel: customer.channel,
      usedServiceIds: customer.usedServiceIds ?? [],
      ...customer.customFields,
    });
  }, [customer, editOpen, form]);

  if (!ready || (!mockCustomer && !liveChecked)) return <PageLoading />;
  if (!customer) {
    return (
      <EmptyState
        description={t("common.notFoundCustomer")}
        action={{ label: t("common.back"), href: "/customers" }}
      />
    );
  }

  const changeStatus = async (status: CustomerStatus) => {
    if (status === customer.status) return;
    try {
      const updated = await customersApi.update(customer.id, mapUiCustomerPatchToApi({ status }));
      updateCustomer(customer.id, { ...mapApiCustomerToUi(updated), status });
      message.success(t("customer.statusUpdated"));
    } catch (err) {
      message.error(apiErrorMessage(err, t("customer.loadFailed")));
    }
  };

  const archive = async () => {
    try {
      const updated = await customersApi.update(
        customer.id,
        mapUiCustomerPatchToApi({ status: "archived" }),
      );
      updateCustomer(customer.id, { ...mapApiCustomerToUi(updated), status: "archived" });
      message.success(t("customer.archived"));
    } catch (err) {
      message.error(apiErrorMessage(err, t("customer.loadFailed")));
    }
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("common.customer"), href: "/customers" }, { title: customer.name }]}>
        <Space wrap>
          <Button onClick={() => setEditOpen(true)}>{t("common.edit")}</Button>
          <Button type="primary" onClick={() => router.push(`/orders/new?customerId=${customer.id}`)}>
            {t("order.newCta")}
          </Button>
          {customer.status !== "archived" && (
            <Popconfirm
              title={t("customer.archiveTitle")}
              description={t("customer.archiveBody")}
              okText={t("customer.archiveOk")}
              cancelText={t("common.cancel")}
              okButtonProps={{ danger: true }}
              onConfirm={archive}
            >
              <Button danger>{t("customer.archiveOk")}</Button>
            </Popconfirm>
          )}
          <Popconfirm
            title={t("customer.deleteTitle")}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await customersApi.remove(customer.id);
                deleteCustomer(customer.id);
                message.success(t("customer.deleted"));
                router.push("/customers");
              } catch (err) {
                message.error(apiErrorMessage(err, t("customer.loadFailed")));
              }
            }}
          >
            <Button danger>{t("common.delete")}</Button>
          </Popconfirm>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {customer.name}
          </Typography.Title>
          <StatusSelect
            module="customer"
            value={customer.status}
            options={statusOptions}
            onChange={(v) => changeStatus(v)}
            manage={{
              takenColors: statusOptions.map((s) => s.color),
              onColorChange: (key, hex) => updateStatus(key, { color: hex }),
              onAdd: (label) => addStatus(label),
              onRemove: (key) => {
                const inUse = customers.filter((c) => c.status === key).length;
                if (inUse > 0) {
                  return {
                    ok: false,
                    reason: t("common.cannotDeleteInUse", { count: inUse }),
                  };
                }
                return removeStatus(key);
              },
            }}
          />
          <Tag>{t("customer.ordersBadge", { count: relatedOrders.length })}</Tag>
          <Tag color={usedServices.length > 0 ? "blue" : "default"}>
            {t("customer.servicesUsedBadge", { count: usedServices.length })}
          </Tag>
        </Space>

        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label={t("field.phone")}>{customer.phone}</Descriptions.Item>
          <Descriptions.Item label={t("field.email")}>{customer.email || "—"}</Descriptions.Item>
          <Descriptions.Item label={t("field.company")}>{customer.company || "—"}</Descriptions.Item>
          <Descriptions.Item label={t("field.taxCode")}>{customer.taxCode || "—"}</Descriptions.Item>
          <Descriptions.Item label={t("field.address")}>{customer.address || "—"}</Descriptions.Item>
          <Descriptions.Item label={t("field.owner")}>{customer.owner}</Descriptions.Item>
          <Descriptions.Item label={t("common.channel")}>
            {customer.channel === "direct"
              ? t("channel.direct")
              : customer.channel === "website"
                ? t("channel.website")
                : customer.channel === "referral"
                  ? t("channel.referral")
                  : customer.channel === "ctv"
                    ? t("channel.ctv")
                    : "—"}
          </Descriptions.Item>
          <Descriptions.Item label={t("field.createdAt")} span={2}>
            {customer.createdAt}
          </Descriptions.Item>
          <Descriptions.Item label={t("customer.usedServices")} span={2}>
            <UsedServiceTags services={usedServices} max={8} />
          </Descriptions.Item>
        </Descriptions>

        <Tabs
          items={[
            {
              key: "orders",
              label: t("customer.ordersN", { count: relatedOrders.length }),
              children: (
                <DataTable<Order>
                  rowKey="id"
                  columns={orderColumns}
                  dataSource={relatedOrders}
                  padded={false}
                  dateFilterField="createdAt"
                  enableLocalSearch
                  emptyDescription={t("customer.noOrders")}
                  emptyAction={{ label: t("common.createOrder"), href: `/orders/new?customerId=${customer.id}` }}
                />
              ),
            },
            {
              key: "services",
              label: t("customer.usedServicesN", { count: usedServices.length }),
              children: (
                <DataTable<CustomerUsedService>
                  rowKey="serviceId"
                  padded={false}
                  dataSource={usedServices}
                  dateFilterField="lastOrderAt"
                  enableLocalSearch
                  emptyDescription={t("customer.noUsedServices")}
                  emptyAction={{ label: t("customer.editTitle"), onClick: () => setEditOpen(true) }}
                  columns={usedServiceColumns}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={`${t("common.edit")} ${customer.name}`}
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
              const updated = await customersApi.update(
                customer.id,
                mapUiCustomerPatchToApi({
                  name: values.name,
                  phone: values.phone,
                  email: values.email,
                  company: values.company,
                  taxCode: values.taxCode,
                  owner: values.owner,
                  status: values.status,
                  channel: values.channel,
                  customFields: collectCustomFields(values, extraFields, customer.customFields),
                }),
              );
              updateCustomer(customer.id, {
                ...mapApiCustomerToUi(updated),
                address: values.address,
                status: (values.status as CustomerStatus) ?? mapApiCustomerToUi(updated).status,
                usedServiceIds: values.usedServiceIds ?? [],
                channel: values.channel,
                customFields: collectCustomFields(values, extraFields, customer.customFields),
              });
              setLiveCustomer(mapApiCustomerToUi(updated));
              message.success(t("customer.updated"));
              setEditOpen(false);
            } catch (err) {
              message.error(apiErrorMessage(err, t("customer.loadFailed")));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="name" label={t("field.name")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t("field.phone")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("field.email")} rules={[{ type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="company" label={t("field.company")}>
            <Input />
          </Form.Item>
          <Form.Item name="taxCode" label={t("field.taxCode")}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t("field.address")}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="owner" label={t("field.owner")} rules={[{ required: true }]}>
            <Select options={users.filter((u) => u.status === "active").map((u) => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="channel" label={t("common.channel")}>
            <Select
              allowClear
              options={[
                { value: "direct", label: t("channel.direct") },
                { value: "website", label: t("channel.website") },
                { value: "referral", label: t("channel.referral") },
                { value: "ctv", label: t("channel.ctv") },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label={t("field.status")} rules={[{ required: true }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item
            name="usedServiceIds"
            label={t("customer.usedServices")}
            extra={t("customer.usedServicesExtra")}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t("customer.selectService")}
              options={services.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
          </Form.Item>
          <ExtraFormFields fields={extraFields} />
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
    </>
  );
}
