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
  CUSTOMER_OWNER_OPTIONS,
  collectCustomFields,
  getCustomerFormExtraFields,
  getCustomerOrders,
  getCustomerUsedServices,
  type CustomerUsedService,
} from "@/lib/customer-helpers";
import { useCustomerStatusConfig } from "@/lib/customer-status-store";
import { useCustomers } from "@/lib/customers-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import { useServices } from "@/lib/services-store";
import type { CustomerStatus, Order } from "@/lib/types";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { statusOptions, addStatus, updateStatus, removeStatus } = useCustomerStatusConfig();
  const { customers, getById, ready, updateCustomer, deleteCustomer, fieldDefs } = useCustomers();
  const { orders } = useOrders();
  const { services } = useServices();
  const customer = getById(id);
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
      usedServiceIds: customer.usedServiceIds ?? [],
      ...customer.customFields,
    });
  }, [customer, editOpen, form]);

  if (!ready) return <PageLoading />;
  if (!customer) {
    return (
      <EmptyState
        description="Không tìm thấy khách hàng."
        action={{ label: "Quay lại danh sách", href: "/customers" }}
      />
    );
  }

  const changeStatus = (status: CustomerStatus) => {
    if (status === customer.status) return;
    updateCustomer(customer.id, { status });
    message.success("Đã cập nhật trạng thái");
  };

  const archive = () => {
    updateCustomer(customer.id, { status: "archived" });
    message.success("Đã lưu trữ khách hàng");
  };

  const orderColumns = [
    {
      title: "Mã hồ sơ",
      dataIndex: "orderNumber",
      sorter: (a: Order, b: Order) => compareText(a.orderNumber, b.orderNumber),
      render: (v: string, r: Order) => <Link href={`/orders/${r.id}`}>{v}</Link>,
    },
    {
      title: "Dịch vụ",
      dataIndex: "serviceName",
      sorter: (a: Order, b: Order) => compareText(a.serviceName, b.serviceName),
    },
    {
      title: "Giai đoạn",
      dataIndex: "stage",
      render: (s: string) => <StatusBadge module="orderStage" status={s} />,
    },
    {
      title: "Giá trị",
      dataIndex: "value",
      align: "center" as const,
      sorter: (a: Order, b: Order) => a.value - b.value,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Phụ trách",
      dataIndex: "assignedUserName",
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
    },
  ];

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Khách hàng", href: "/customers" }, { title: customer.name }]}>
        <Space wrap>
          <Button onClick={() => setEditOpen(true)}>Sửa</Button>
          <Button type="primary" onClick={() => router.push(`/orders/new?customerId=${customer.id}`)}>
            + Đơn hàng mới
          </Button>
          {customer.status !== "archived" && (
            <Popconfirm
              title="Lưu trữ khách hàng này?"
              description="Khách hàng sẽ chuyển sang trạng thái Lưu trữ."
              okText="Lưu trữ"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={archive}
            >
              <Button danger>Lưu trữ</Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="Xóa khách hàng này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              deleteCustomer(customer.id);
              message.success("Đã xóa khách hàng");
              router.push("/customers");
            }}
          >
            <Button danger>Xóa</Button>
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
                    reason: `Không thể xóa — còn ${inUse} khách hàng dùng trạng thái này`,
                  };
                }
                return removeStatus(key);
              },
            }}
          />
          <Tag>{relatedOrders.length} đơn hàng</Tag>
          <Tag color={usedServices.length > 0 ? "blue" : "default"}>
            {usedServices.length} dịch vụ đã dùng
          </Tag>
        </Space>

        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="SĐT">{customer.phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email || "—"}</Descriptions.Item>
          <Descriptions.Item label="Công ty">{customer.company || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">{customer.taxCode || "—"}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ">{customer.address || "—"}</Descriptions.Item>
          <Descriptions.Item label="Phụ trách">{customer.owner}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo" span={2}>
            {customer.createdAt}
          </Descriptions.Item>
          <Descriptions.Item label="Dịch vụ đã dùng" span={2}>
            <UsedServiceTags services={usedServices} max={8} />
          </Descriptions.Item>
        </Descriptions>

        <Tabs
          items={[
            {
              key: "orders",
              label: `Đơn hàng (${relatedOrders.length})`,
              children: (
                <DataTable<Order>
                  rowKey="id"
                  columns={orderColumns}
                  dataSource={relatedOrders}
                  padded={false}
                  emptyDescription="Khách hàng chưa có đơn hàng."
                  emptyAction={{ label: "Tạo đơn hàng", href: `/orders/new?customerId=${customer.id}` }}
                />
              ),
            },
            {
              key: "services",
              label: `Dịch vụ đã dùng (${usedServices.length})`,
              children: (
                <DataTable<CustomerUsedService>
                  rowKey="serviceId"
                  padded={false}
                  dataSource={usedServices}
                  emptyDescription="Chưa ghi nhận dịch vụ nào."
                  emptyAction={{ label: "Sửa khách hàng", onClick: () => setEditOpen(true) }}
                  columns={[
                    {
                      title: "Dịch vụ",
                      dataIndex: "serviceName",
                      render: (name: string, r) => (
                        <Link href={`/services/${r.serviceId}`}>{name}</Link>
                      ),
                    },
                    {
                      title: "Danh mục",
                      dataIndex: "category",
                      render: (v?: string) => v || "—",
                    },
                    {
                      title: "Số đơn",
                      dataIndex: "orderCount",
                      align: "center",
                      render: (n: number) => n || "—",
                    },
                    {
                      title: "Đơn gần nhất",
                      dataIndex: "lastOrderAt",
                      render: (v?: string) => v || "—",
                    },
                    {
                      title: "Nguồn",
                      key: "source",
                      render: (_, r) => (
                        <Space size={4} wrap>
                          {r.fromOrders ? <Tag color="blue">Đơn hàng</Tag> : null}
                          {r.fromRecord && !r.fromOrders ? <Tag>Ghi nhận thủ công</Tag> : null}
                        </Space>
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={`Sửa ${customer.name}`}
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
          onFinish={(values) => {
            setSaving(true);
            try {
              updateCustomer(customer.id, {
                name: values.name,
                phone: values.phone,
                email: values.email,
                company: values.company,
                taxCode: values.taxCode,
                address: values.address,
                owner: values.owner,
                status: values.status as CustomerStatus,
                usedServiceIds: values.usedServiceIds ?? [],
                customFields: collectCustomFields(values, extraFields, customer.customFields),
              });
              message.success("Đã cập nhật khách hàng");
              setEditOpen(false);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="SĐT" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="company" label="Công ty">
            <Input />
          </Form.Item>
          <Form.Item name="taxCode" label="Mã số thuế">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="owner" label="Phụ trách" rules={[{ required: true }]}>
            <Select options={CUSTOMER_OWNER_OPTIONS} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item
            name="usedServiceIds"
            label="Dịch vụ đã sử dụng"
            extra="Dịch vụ gắn từ đơn hàng luôn hiển thị. Có thể ghi nhận thêm dịch vụ ngoài hệ thống đơn."
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn dịch vụ"
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
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={saving} disabled={saving}>
              Lưu
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
