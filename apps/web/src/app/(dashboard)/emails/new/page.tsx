"use client";

import { Button, DatePicker, Form, Input, Select, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useCustomers } from "@/lib/customers-store";

export default function ComposeEmailPage() {
  const router = useRouter();
  const { customers } = useCustomers();
  const [saving, setSaving] = useState(false);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Email", href: "/emails" }, { title: "Soạn thư" }]} />
      <Form
        layout="vertical"
        style={{ maxWidth: 640, padding: 24 }}
        onFinish={() => {
          setSaving(true);
          try {
            router.push("/emails");
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form.Item name="recipients" label="Người nhận" rules={[{ required: true }]}>
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            placeholder="Chọn khách hàng hoặc nhập email"
            options={customers.map((c) => ({ value: c.email, label: `${c.name} (${c.email})` }))}
          />
        </Form.Item>
        <Form.Item name="subject" label="Tiêu đề" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="body" label="Nội dung">
          <Input.TextArea rows={10} placeholder="Soạn nội dung email…" />
        </Form.Item>
        <Form.Item name="scheduledAt" label="Lên lịch (tùy chọn)">
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          Trình soạn thảo đầy đủ sẽ có trong phiên bản hoàn chỉnh.
        </Typography.Text>
        <Space>
          <Button onClick={() => router.push("/emails")} disabled={saving}>
            Hủy
          </Button>
          <Button htmlType="submit" loading={saving} disabled={saving}>
            Lưu nháp
          </Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={saving}>
            Gửi ngay
          </Button>
        </Space>
      </Form>
    </>
  );
}
