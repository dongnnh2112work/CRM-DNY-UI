"use client";

import { App, Button, Descriptions, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Tag, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ServiceExtraFormFields } from "@/components/services/service-extra-form-fields";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { getServiceFormExtraFields, splitServiceFormValues } from "@/lib/service-fields";
import { useServices } from "@/lib/services-store";

const CATEGORIES = ["Work Permit", "Visa", "License", "Legal", "Other"];

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { getById, ready, updateService, setServiceStatus, deleteService, fieldDefs } = useServices();
  const service = getById(id);
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();
  const extraFields = getServiceFormExtraFields(fieldDefs);

  useEffect(() => {
    if (service && editOpen) {
      form.setFieldsValue({
        name: service.name,
        code: service.code,
        category: service.category,
        unitPrice: service.unitPrice,
        processingDays: service.processingDays,
        ...service.customFields,
      });
    }
  }, [service, editOpen, form]);

  if (!ready) return null;
  if (!service) return <div style={{ padding: 24 }}>Không tìm thấy dịch vụ.</div>;

  const toggleStatus = () => {
    const next = service.status === "active" ? "inactive" : "active";
    setServiceStatus(service.id, next);
    message.success(next === "active" ? "Đã kích hoạt dịch vụ" : "Đã ngừng hoạt động");
  };

  const onDelete = () => {
    deleteService(service.id);
    message.success("Đã xóa dịch vụ");
    router.push("/services");
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Dịch vụ", href: "/services" }, { title: service.name }]}>
        <Space wrap>
          <Button onClick={() => setEditOpen(true)}>Sửa</Button>
          <Button danger={service.status === "active"} onClick={toggleStatus}>
            {service.status === "active" ? "Ngừng hoạt động" : "Kích hoạt"}
          </Button>
          <Popconfirm
            title="Xóa dịch vụ này?"
            description="Thao tác không hoàn tác trong phiên demo."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={onDelete}
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
            {service.name}
          </Typography.Title>
          <Tag color={service.status === "active" ? "success" : "default"}>
            {service.status === "active" ? "Hoạt động" : "Ngừng"}
          </Tag>
        </Space>
        <Descriptions bordered column={1} size="small" style={{ maxWidth: 560 }}>
          <Descriptions.Item label="Mã">{service.code}</Descriptions.Item>
          <Descriptions.Item label="Danh mục">{service.category}</Descriptions.Item>
          <Descriptions.Item label="Đơn giá">{formatVndDisplay(service.unitPrice)}</Descriptions.Item>
          <Descriptions.Item label="Thời gian xử lý">{service.processingDays} ngày</Descriptions.Item>
          {extraFields.map((def) => {
            const raw = service.customFields?.[def.key];
            const display =
              raw == null || raw === ""
                ? "—"
                : def.type === "number" && typeof raw === "number"
                  ? Number(raw).toLocaleString("vi-VN")
                  : String(raw);
            return (
              <Descriptions.Item key={def.key} label={def.label}>
                {display}
              </Descriptions.Item>
            );
          })}
        </Descriptions>
      </div>

      <Drawer
        title="Sửa dịch vụ"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        width={420}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const { core, customFields } = splitServiceFormValues(values, extraFields);
            updateService(service.id, { ...core, customFields });
            message.success("Đã cập nhật dịch vụ");
            setEditOpen(false);
          }}
        >
          <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Mã" rules={[{ required: true }]}>
            <Input style={{ fontFamily: "monospace" }} />
          </Form.Item>
          <Form.Item name="category" label="Danh mục" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="unitPrice" label="Đơn giá (VND)" rules={[{ required: true }]}>
            <InputNumber {...vndInputProps} />
          </Form.Item>
          <Form.Item name="processingDays" label="Thời gian xử lý (ngày)" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={1} />
          </Form.Item>
          <ServiceExtraFormFields fields={extraFields} />
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
