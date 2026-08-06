"use client";

import { App, Button, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Tag, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useCustomers } from "@/lib/customers-store";
import type { CustomerStatus } from "@/lib/types";

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  active: "Hoạt động",
  lead: "Tiềm năng",
  archived: "Lưu trữ",
};

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

  if (!ready) return null;
  if (!customer) return <div style={{ padding: 24 }}>Không tìm thấy khách hàng.</div>;

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
            <Button danger onClick={archive}>
              Lưu trữ
            </Button>
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
            <Button danger type="primary">
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {customer.name}
          </Typography.Title>
          <Tag color={customer.status === "active" ? "success" : customer.status === "lead" ? "processing" : "default"}>
            {CUSTOMER_STATUS_LABELS[customer.status] ?? customer.status}
          </Tag>
        </Space>
        <Descriptions bordered column={1} size="small" style={{ maxWidth: 560 }}>
          <Descriptions.Item label="SĐT">{customer.phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email}</Descriptions.Item>
          <Descriptions.Item label="Công ty">{customer.company || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">{customer.taxCode || "—"}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ">{customer.address || "—"}</Descriptions.Item>
          <Descriptions.Item label="Phụ trách">{customer.owner}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{customer.createdAt}</Descriptions.Item>
        </Descriptions>
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
            <Select
              options={[
                { value: "active", label: "Hoạt động" },
                { value: "lead", label: "Tiềm năng" },
                { value: "archived", label: "Lưu trữ" },
              ]}
            />
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
