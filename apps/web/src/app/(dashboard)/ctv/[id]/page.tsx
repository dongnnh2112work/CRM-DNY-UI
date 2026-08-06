"use client";

import { App, Button, Descriptions, Drawer, Form, Input, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useCtvs } from "@/lib/ctvs-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import type { CtvJob, CtvStatus } from "@/lib/types";

const CTV_STATUS_LABELS: Record<CtvStatus, string> = {
  active: "Hoạt động",
  inactive: "Ngừng",
};

export default function CtvDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { getById, ready, updateCtv, deleteCtv } = useCtvs();
  const ctv = getById(id);
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (ctv && editOpen) {
      form.setFieldsValue({
        name: ctv.name,
        phone: ctv.phone,
        email: ctv.email,
        status: ctv.status,
      });
    }
  }, [ctv, editOpen, form]);

  if (!ready) return null;
  if (!ctv) return <div style={{ padding: 24 }}>Không tìm thấy CTV.</div>;

  const jobColumns = [
    {
      title: "Đơn hàng",
      dataIndex: "orderNumber",
      render: (v: string, r: CtvJob) => <Link href={`/orders/${r.orderId}`}>{v}</Link>,
    },
    { title: "Khách hàng", dataIndex: "customerName" },
    { title: "Dịch vụ", dataIndex: "serviceName" },
    { title: "Bảng giá", dataIndex: "ratecard", render: (v: number) => formatVndDisplay(v) },
    { title: "Giá CTV", dataIndex: "ctvPrice", render: (v: number) => formatVndDisplay(v) },
    {
      title: "Hoa hồng",
      dataIndex: "commission",
      render: (v: number) => <Tag color="green">{formatVndDisplay(v)}</Tag>,
    },
  ];

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "CTV", href: "/ctv" }, { title: ctv.name }]}>
        <Space wrap>
          <Button onClick={() => setEditOpen(true)}>Sửa</Button>
          <Button
            danger={ctv.status === "active"}
            onClick={() => {
              const next = ctv.status === "active" ? "inactive" : "active";
              updateCtv(ctv.id, { status: next });
              message.success(next === "active" ? "Đã kích hoạt CTV" : "Đã ngừng CTV");
            }}
          >
            {ctv.status === "active" ? "Ngừng hoạt động" : "Kích hoạt"}
          </Button>
          <Popconfirm
            title="Xóa CTV này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              deleteCtv(ctv.id);
              message.success("Đã xóa CTV");
              router.push("/ctv");
            }}
          >
            <Button danger type="primary">
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Tên">{ctv.name}</Descriptions.Item>
          <Descriptions.Item label="SĐT">{ctv.phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{ctv.email}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={ctv.status === "active" ? "success" : "default"}>
              {CTV_STATUS_LABELS[ctv.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Tổng đơn">{ctv.totalJobs}</Descriptions.Item>
          <Descriptions.Item label="Tổng hoa hồng">{formatVndDisplay(ctv.totalCommission)}</Descriptions.Item>
        </Descriptions>
        <Typography.Title level={5}>Đơn giới thiệu & hoa hồng</Typography.Title>
        <Table rowKey="orderId" columns={jobColumns} dataSource={ctv.jobs} pagination={false} />
      </div>

      <Drawer title="Sửa CTV" open={editOpen} onClose={() => setEditOpen(false)} width={420} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            updateCtv(ctv.id, {
              name: values.name,
              phone: values.phone,
              email: values.email,
              status: values.status,
            });
            message.success("Đã cập nhật CTV");
            setEditOpen(false);
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
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "active", label: "Hoạt động" },
                { value: "inactive", label: "Ngừng" },
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
