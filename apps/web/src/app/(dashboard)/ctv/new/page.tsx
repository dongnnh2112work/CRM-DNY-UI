"use client";

import { App, Button, Form, Input, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useCtvs } from "@/lib/ctvs-store";

export default function NewCtvPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { addCtv } = useCtvs();
  const [saving, setSaving] = useState(false);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "CTV", href: "/ctv" }, { title: "Tạo mới" }]} />
      <Form
        layout="vertical"
        style={{ maxWidth: 560, padding: 24 }}
        onFinish={(values) => {
          setSaving(true);
          try {
            const created = addCtv({
              name: values.name,
              phone: values.phone,
              email: values.email,
              status: values.status,
            });
            message.success("Đã tạo CTV");
            router.push(`/ctv/${created.id}`);
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
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
          <Input />
        </Form.Item>
        <Form.Item name="status" label="Trạng thái" initialValue="active" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "active", label: "Hoạt động" },
              { value: "inactive", label: "Ngừng" },
            ]}
          />
        </Form.Item>
        <Space>
          <Button onClick={() => router.push("/ctv")} disabled={saving}>
            Hủy
          </Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={saving}>
            Tạo CTV
          </Button>
        </Space>
      </Form>
    </>
  );
}
