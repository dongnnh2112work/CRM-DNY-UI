"use client";

import { Alert, Button, Form, Input, InputNumber, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_ORDERS } from "@/lib/mock-orders";
import { MOCK_CUSTOMERS } from "@/lib/mock-customers";

export default function NewVatPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [selectedOrder, setSelectedOrder] = useState<(typeof MOCK_ORDERS)[number] | null>(null);

  const handleOrderChange = (orderId: string) => {
    const order = MOCK_ORDERS.find((o) => o.id === orderId);
    if (order) {
      setSelectedOrder(order);
      const customer = MOCK_CUSTOMERS.find((c) => c.id === order.customerId);
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
      <Form form={form} layout="vertical" style={{ maxWidth: 560, padding: 24 }} onFinish={() => router.push("/vat")}>
        <Form.Item name="orderId" label="Chọn đơn hàng" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            onChange={handleOrderChange}
            options={MOCK_ORDERS.map((o) => ({ value: o.id, label: `${o.orderNumber} — ${o.customerName}` }))}
          />
        </Form.Item>
        {selectedOrder && (
          <Alert message={`Tự điền từ ${selectedOrder.orderNumber}`} type="info" showIcon style={{ marginBottom: 16 }} />
        )}
        <Form.Item name="customerName" label="Tên khách hàng"><Input disabled /></Form.Item>
        <Form.Item name="taxCode" label="Mã số thuế"><Input /></Form.Item>
        <Form.Item name="amount" label="Tiền hàng (trước thuế)"><InputNumber style={{ width: "100%" }} disabled /></Form.Item>
        <Form.Item name="taxRate" label="Thuế suất (%)"><InputNumber style={{ width: "100%" }} disabled /></Form.Item>
        <Form.Item name="taxAmount" label="Tiền thuế"><InputNumber style={{ width: "100%" }} disabled /></Form.Item>
        <Form.Item name="totalAmount" label="Tổng cộng"><InputNumber style={{ width: "100%" }} disabled /></Form.Item>
        <Space>
          <Button onClick={() => router.push("/vat")}>Hủy</Button>
          <Button type="primary" htmlType="submit">Tạo hóa đơn VAT</Button>
        </Space>
      </Form>
    </>
  );
}
