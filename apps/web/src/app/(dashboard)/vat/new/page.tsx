"use client";

import { Alert, App, Button, Col, Form, Input, InputNumber, Row, Select, Space, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import { useCustomers } from "@/lib/customers-store";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import type { Order } from "@/lib/types";
import { VAT_TAX_RATES, orderHasContractNumber, vatAmountsFromLines } from "@/lib/vat-helpers";
import { useVat } from "@/lib/vat-store";

type VatFormValues = {
  orderId: string;
  customerName: string;
  taxCode?: string;
  taxRate: number;
  lines: { description: string; amount: number }[];
};

export default function NewVatPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewVatPageContent />
    </Suspense>
  );
}

function NewVatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<VatFormValues>();
  const { orders } = useOrders();
  const { getById: getCustomer } = useCustomers();
  const { addInvoice } = useVat();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);

  const lines = Form.useWatch("lines", form);
  const taxRate = Form.useWatch("taxRate", form);
  const totals = useMemo(() => vatAmountsFromLines(lines, taxRate ?? 0), [lines, taxRate]);

  const eligibleOrders = useMemo(
    () => orders.filter(orderHasContractNumber),
    [orders],
  );

  const applyOrder = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      if (!orderHasContractNumber(order)) {
        message.warning("Chỉ xuất VAT cho đơn đã có số HĐ.");
        setSelectedOrder(null);
        form.setFieldValue("orderId", undefined);
        return;
      }
      setSelectedOrder(order);
      const customer = getCustomer(order.customerId);
      form.setFieldsValue({
        customerName: order.customerName,
        taxCode: customer?.taxCode ?? "",
        taxRate: form.getFieldValue("taxRate") ?? 10,
        lines: [
          { description: order.serviceName, amount: order.value },
          { description: "", amount: 0 },
        ],
      });
    },
    [form, getCustomer, message, orders],
  );

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId || orders.length === 0) return;
    if (form.getFieldValue("orderId")) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order || !orderHasContractNumber(order)) {
      if (order) message.warning("Đơn này chưa có số HĐ nên không xuất VAT được.");
      return;
    }
    form.setFieldValue("orderId", orderId);
    applyOrder(orderId);
  }, [applyOrder, form, message, orders, searchParams]);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "VAT", href: "/vat" }, { title: "Hóa đơn mới" }]} />
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: ds.formPageMaxWidth, padding: 24 }}
        initialValues={{
          taxRate: 10,
          lines: [
            { description: "", amount: 0 },
            { description: "", amount: 0 },
          ],
        }}
        onFinish={(values) => {
          setSaving(true);
          try {
            const order = orders.find((o) => o.id === values.orderId);
            if (!order) {
              message.error("Không tìm thấy đơn hàng");
              return;
            }
            if (!orderHasContractNumber(order)) {
              message.error("Chỉ xuất VAT cho đơn đã có số HĐ.");
              return;
            }
            const computed = vatAmountsFromLines(values.lines, values.taxRate);
            addInvoice({
              orderId: order.id,
              orderNumber: order.orderNumber,
              contractNumber: order.contractNumber,
              customerName: values.customerName || order.customerName,
              taxCode: values.taxCode,
              taxRate: values.taxRate,
              amount: computed.amount,
              taxAmount: computed.taxAmount,
              totalAmount: computed.totalAmount,
              lines: [
                {
                  description: values.lines?.[0]?.description?.trim() ?? "",
                  amount: Number(values.lines?.[0]?.amount) || 0,
                },
                {
                  description: values.lines?.[1]?.description?.trim() ?? "",
                  amount: Number(values.lines?.[1]?.amount) || 0,
                },
              ],
            });
            message.success("Đã tạo hóa đơn VAT (nháp)");
            router.push("/vat");
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form.Item name="orderId" label="Chọn đơn hàng" rules={[{ required: true, message: "Chọn đơn hàng" }]} extra="Chỉ hiện đơn đã có số HĐ.">
          <Select
            showSearch
            optionFilterProp="label"
            onChange={applyOrder}
            notFoundContent={eligibleOrders.length === 0 ? "Không có đơn nào có số HĐ." : undefined}
            options={eligibleOrders.map((o) => ({
              value: o.id,
              label: `${o.orderNumber} · HĐ ${o.contractNumber} — ${o.customerName}`,
            }))}
          />
        </Form.Item>
        {selectedOrder && (
          <Alert
            message={`Tự điền từ ${selectedOrder.orderNumber}${
              selectedOrder.contractNumber != null ? ` · Số HĐ ${selectedOrder.contractNumber}` : ""
            }`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item name="customerName" label="Tên khách hàng">
          <Input disabled />
        </Form.Item>
        <Form.Item label="Số HĐ">
          <Input disabled value={selectedOrder?.contractNumber != null ? String(selectedOrder.contractNumber) : "—"} />
        </Form.Item>
        <Form.Item name="taxCode" label="Mã số thuế">
          <Input />
        </Form.Item>

        <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
          Nội dung hóa đơn
        </Typography.Text>
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item name={["lines", 0, "description"]} label="Dòng 1" rules={[{ required: true, message: "Nhập nội dung dòng 1" }]}>
              <Input placeholder="Mô tả hàng hóa / dịch vụ" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={["lines", 0, "amount"]} label="Thành tiền">
              <InputNumber {...vndInputProps} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item name={["lines", 1, "description"]} label="Dòng 2">
              <Input placeholder="Nội dung bổ sung (không bắt buộc)" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={["lines", 1, "amount"]} label="Thành tiền">
              <InputNumber {...vndInputProps} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="taxRate" label="Thuế suất (%)" rules={[{ required: true, message: "Chọn thuế suất" }]}>
          <Select
            options={VAT_TAX_RATES.map((rate) => ({
              value: rate,
              label: `${rate}%`,
            }))}
          />
        </Form.Item>
        <Form.Item label="Tiền hàng (trước thuế)">
          <Input disabled value={formatVndDisplay(totals.amount)} />
        </Form.Item>
        <Form.Item label="Tiền thuế">
          <Input disabled value={formatVndDisplay(totals.taxAmount)} />
        </Form.Item>
        <Form.Item label="Tổng cộng">
          <Input disabled value={formatVndDisplay(totals.totalAmount)} />
        </Form.Item>
        <Space>
          <Button
            onClick={() => confirmDiscardIfDirty(modal, form, () => router.push("/vat"))}
            disabled={saving}
          >
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
