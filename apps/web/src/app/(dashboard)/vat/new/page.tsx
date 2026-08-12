"use client";

import { Alert, Button, Form, Input, InputNumber, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useCustomers } from "@/lib/customers-store";
import { vndInputProps } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import type { Order } from "@/lib/types";

export default function NewVatPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { orders } = useOrders();
  const { getById: getCustomer } = useCustomers();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);

  const handleOrderChange = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      setSelectedOrder(order);
      const customer = getCustomer(order.customerId);
      const amount = Math.round(order.value / 1.1);
      const tax = order.value - amount;
      form.setFieldsValue({
        customerName: order.customerName,
        taxCode: customer?.taxCode ?? "",
        amount,
        taxRate: 10,
        taxAmount: tax,
        totalAmount: order.value,
      });
    }
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "VAT", href: "/vat" }, { title: "Hóa đơn mới" }]} />
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 560, padding: 24 }}
        onFinish={() => {
          setSaving(true);
          try {
            router.push("/vat");
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form.Item name="orderId" label="Chọn đơn hàng" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            onChange={handleOrderChange}
            options={orders.map((o) => ({ value: o.id, label: `${o.orderNumber} — ${o.customerName}` }))}
          />
        </Form.Item>
        {selectedOrder && (
          <Alert message={`Tự điền từ ${selectedOrder.orderNumber}`} type="info" showIcon style={{ marginBottom: 16 }} />
        )}
        <Form.Item name="customerName" label="Tên khách hàng">
          <Input disabled />
        </Form.Item>
        <Form.Item name="taxCode" label="Mã số thuế">
          <Input />
        </Form.Item>
        <Form.Item name="amount" label="Tiền hàng (trước thuế)">
          <InputNumber {...vndInputProps} disabled />
        </Form.Item>
        <Form.Item name="taxRate" label="Thuế suất (%)">
          <InputNumber style={{ width: "100%" }} disabled />
        </Form.Item>
        <Form.Item name="taxAmount" label="Tiền thuế">
          <InputNumber {...vndInputProps} disabled />
        </Form.Item>
        <Form.Item name="totalAmount" label="Tổng cộng">
          <InputNumber {...vndInputProps} disabled />
        </Form.Item>
        <Space>
          <Button onClick={() => router.push("/vat")} disabled={saving}>
            Hủy
          </Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={saving}>
            Tạo hóa đơn VAT
          </Button>
        </Space>
      </Form>
    </>
  );
}
