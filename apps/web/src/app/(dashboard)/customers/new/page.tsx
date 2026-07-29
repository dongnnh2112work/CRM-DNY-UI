"use client";

import { Button, Form, Input, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";

export default function NewCustomerPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Khách hàng", href: "/customers" }, { title: "Tạo mới" }]} />
      <Form
        layout="vertical"
        style={{ maxWidth: 560, padding: 24 }}
        onFinish={() => router.push("/customers")}
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
        <Form.Item name="owner" label="Phụ trách" initialValue="Le Staff A">
          <Select options={[{ value: "Le Staff A" }, { value: "Vo Staff B" }, { value: "Tran Admin" }]} />
        </Form.Item>
        <Space>
          <Button onClick={() => router.push("/customers")}>Hủy</Button>
          <Button type="primary" htmlType="submit">Lưu khách hàng</Button>
        </Space>
      </Form>
    </>
  );
}
