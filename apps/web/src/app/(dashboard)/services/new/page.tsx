"use client";

import { Button, Form, Input, InputNumber, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";

export default function NewServicePage() {
  const router = useRouter();
  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Dịch vụ", href: "/services" }, { title: "Tạo mới" }]} />
      <Form layout="vertical" style={{ maxWidth: 560, padding: 24 }} onFinish={() => router.push("/services")}>
        <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="Mã" rules={[{ required: true }]}><Input style={{ fontFamily: "monospace" }} /></Form.Item>
        <Form.Item name="category" label="Danh mục" rules={[{ required: true }]}>
          <Select options={["Work Permit", "Visa", "License", "Legal", "Other"].map((c) => ({ value: c, label: c }))} />
        </Form.Item>
        <Form.Item name="unitPrice" label="Đơn giá (VND)" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} min={0} /></Form.Item>
        <Form.Item name="processingDays" label="Thời gian xử lý (ngày)" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} min={1} /></Form.Item>
        <Space>
          <Button onClick={() => router.push("/services")}>Hủy</Button>
          <Button type="primary" htmlType="submit">Tạo dịch vụ</Button>
        </Space>
      </Form>
    </>
  );
}
