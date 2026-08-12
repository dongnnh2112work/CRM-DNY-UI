"use client";

import { App, Button, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Tabs, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusBadge } from "@/components/shared/status-badge";
import { useCustomers } from "@/lib/customers-store";
import { getStatusOptions } from "@/lib/status-config";
import type { CustomerStatus } from "@/lib/types";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { getById, ready, updateCustomer, deleteCustomer } = useCustomers();
  const customer = getById(id);
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (customer && editOpen) {
      form.setFieldsValue(customer);
    }
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

  const archive = () => {
    updateCustomer(customer.id, { status: "archived" });
    message.success("Đã lưu trữ khách hàng");
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Khách hàng", href: "/customers" }, { title: customer.name }]}>
        <Space wrap>
          <Button type="primary" onClick={() => router.push("/orders/new")}>
            + Tạo đơn
          </Button>
          <Button onClick={() => setEditOpen(true)}>Sửa</Button>
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
        <Space align="center" size="middle" style={{ marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {customer.name}
          </Typography.Title>
          <StatusBadge module="customer" status={customer.status} />
        </Space>
        <Tabs
          items={[
            {
              key: "info",
              label: "Thông tin",
              children: (
                <Descriptions bordered column={1} size="small" style={{ maxWidth: 560 }}>
                  <Descriptions.Item label="SĐT">{customer.phone}</Descriptions.Item>
                  <Descriptions.Item label="Email">{customer.email}</Descriptions.Item>
                  <Descriptions.Item label="Công ty">{customer.company || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Mã số thuế">{customer.taxCode || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ">{customer.address || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Phụ trách">{customer.owner}</Descriptions.Item>
                  <Descriptions.Item label="Ngày tạo">{customer.createdAt}</Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: "notes",
              label: "Ghi chú / Liên quan",
              children: (
                <Typography.Paragraph type="secondary">
                  Ghi chú nội bộ và đơn hàng liên quan sẽ hiển thị tại đây.{" "}
                  <Link href="/orders/new">Tạo đơn mới</Link> cho khách hàng này.
                </Typography.Paragraph>
              ),
            },
          ]}
        />
      </div>

      <Drawer title="Sửa khách hàng" open={editOpen} onClose={() => setEditOpen(false)} width={420} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            updateCustomer(customer.id, {
              name: values.name,
              phone: values.phone,
              email: values.email,
              company: values.company,
              taxCode: values.taxCode,
              address: values.address,
              owner: values.owner,
              status: values.status as CustomerStatus,
            });
            message.success("Đã cập nhật khách hàng");
            setEditOpen(false);
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
            <Select options={[{ value: "Le Staff A" }, { value: "Vo Staff B" }, { value: "Tran Admin" }]} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select options={getStatusOptions("customer")} />
          </Form.Item>
          <Space>
            <Button onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit">
              Lưu
            </Button>
          </Space>
        </Form>
      </Drawer>
    </>
  );
}
