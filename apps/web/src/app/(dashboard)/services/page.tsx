"use client";

import { App, Button, Modal, Popconfirm, Typography } from "antd";
import { useCallback, useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DynamicTable } from "@/components/shared/dynamic-table";
import { PageHeader } from "@/components/shared/page-header";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { ServiceForm } from "@/components/services/service-form";
import { ds } from "@/lib/design-tokens";
import { SERVICE_LOCKED_FIELD_KEYS, serviceMatchesQuery } from "@/lib/service-fields";
import { useServices } from "@/lib/services-store";
import type { Service } from "@/lib/types";

export default function ServicesPage() {
  const { message } = App.useApp();
  const { services, fieldDefs, saveFieldDefs, setServiceStatus, deleteService, addService, updateService } =
    useServices();
  const [query, setQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedRowKeys([]);
  }, []);
  const [formOpen, setFormOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = services.filter((s) => serviceMatchesQuery(s, query));

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);

  const openCreate = () => {
    setEditService(null);
    setFormOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditService(service);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditService(null);
  };

  const bulkSetStatus = (status: "active" | "inactive") => {
    selectedRowKeys.forEach((id) => setServiceStatus(String(id), status));
    message.success(
      status === "active"
        ? `Đã kích hoạt ${selectedCount} dịch vụ`
        : `Đã ngừng ${selectedCount} dịch vụ`,
    );
    clearSelection();
  };

  const bulkDelete = () => {
    selectedRowKeys.forEach((id) => deleteService(String(id)));
    message.success(`Đã xóa ${selectedCount} dịch vụ`);
    clearSelection();
  };

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: "Quản lý dịch vụ" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: "+ Dịch vụ mới", onClick: openCreate }}
      />
      <DynamicTable<Service>
        fieldDefs={fieldDefs}
        onFieldDefsChange={saveFieldDefs}
        lockedFieldKeys={SERVICE_LOCKED_FIELD_KEYS}
        dataSource={filtered}
        rowKey="id"
        columnManagerKey="services"
        statusModule="service"
        linkField={{ key: "name", onClick: openEdit }}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Popconfirm
              title={`Kích hoạt ${selectedCount} dịch vụ đã chọn?`}
              okText="Kích hoạt"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("active")}
            >
              <Button size="small">Đặt hoạt động</Button>
            </Popconfirm>
            <Popconfirm
              title={`Ngừng hoạt động ${selectedCount} dịch vụ đã chọn?`}
              okText="Ngừng"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("inactive")}
            >
              <Button size="small">Ngừng hoạt động</Button>
            </Popconfirm>
            <Popconfirm
              title={`Xóa ${selectedCount} dịch vụ đã chọn?`}
              description="Thao tác không hoàn tác trong phiên demo. Chỉ áp dụng các dòng đang chọn trên trang hiện tại."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={bulkDelete}
            >
              <Button size="small" danger>
                Xóa
              </Button>
            </Popconfirm>
          </BulkActionBar>
        }
        emptyDescription={
          query.trim() && services.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có dịch vụ nào."
        }
        emptyAction={
          query.trim() && services.length > 0
            ? undefined
            : { label: "Tạo dịch vụ", onClick: openCreate }
        }
      />

      <Modal
        title={editService ? editService.name : "Dịch vụ mới"}
        open={formOpen}
        onCancel={closeForm}
        footer={null}
        width={560}
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}>
          {editService
            ? "Xem và chỉnh sửa thông tin dịch vụ. Bấm lưu để cập nhật."
            : "Điền thông tin để tạo dịch vụ mới."}
        </Typography.Paragraph>
        <ServiceForm
          key={`${editService?.id ?? "new"}-${fieldDefs.map((d) => `${d.key}:${d.visible}`).join("|")}`}
          service={editService}
          fieldDefs={fieldDefs}
          submitLabel={editService ? "Lưu" : "Tạo dịch vụ"}
          loading={saving}
          onCancel={closeForm}
          onSubmit={async (payload) => {
            setSaving(true);
            try {
              if (editService) {
                updateService(editService.id, payload);
                message.success("Đã cập nhật dịch vụ");
              } else {
                addService(payload);
                message.success("Đã tạo dịch vụ");
              }
              closeForm();
            } finally {
              setSaving(false);
            }
          }}
        />
      </Modal>
    </>
  );
}
