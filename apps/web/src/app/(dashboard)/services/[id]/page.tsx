"use client";

import { App, Button, Descriptions, Modal, Popconfirm, Space, Tabs, Tag, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { ReadMoreText } from "@/components/shared/read-more-text";
import { ServiceForm } from "@/components/services/service-form";
import { ds } from "@/lib/design-tokens";
import { getServiceFormExtraFields } from "@/lib/service-fields";
import { useServices } from "@/lib/services-store";
import { useT } from "@/lib/use-t";

export default function ServiceDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { getById, ready, updateService, setServiceStatus, deleteService, fieldDefs } = useServices();
  const service = getById(id);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const extraFields = getServiceFormExtraFields(fieldDefs);

  if (!ready) return <PageLoading />;
  if (!service) {
    return (
      <EmptyState
        description={t("common.notFoundService")}
        action={{ label: t("common.back"), href: "/services" }}
      />
    );
  }

  const toggleStatus = () => {
    const next = service.status === "active" ? "inactive" : "active";
    setServiceStatus(service.id, next);
    message.success(next === "active" ? t("service.activated") : t("service.deactivated"));
  };

  const onDelete = () => {
    deleteService(service.id);
    message.success(t("service.deleted"));
    router.push("/services");
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("service.breadcrumb"), href: "/services" }, { title: service.name }]}>
        <Space wrap>
          <Button onClick={() => setEditOpen(true)}>{t("common.edit")}</Button>
          <Button danger={service.status === "active"} onClick={toggleStatus}>
            {service.status === "active" ? t("common.deactivate") : t("common.activate")}
          </Button>
          <Popconfirm
            title={t("service.deleteTitle")}
            description={t("common.demoIrreversible")}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
            onConfirm={onDelete}
          >
            <Button danger>{t("common.delete")}</Button>
          </Popconfirm>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {service.name}
          </Typography.Title>
          <Tag color={service.status === "active" ? "success" : "default"}>
            {service.status === "active" ? t("status.service.active") : t("status.service.inactive")}
          </Tag>
        </Space>
        <Tabs
          items={[
            {
              key: "info",
              label: t("service.info"),
              children: (
                <Descriptions bordered column={1} size="small" style={{ maxWidth: 560 }}>
                  <Descriptions.Item label={t("common.category")}>{service.category}</Descriptions.Item>
                  <Descriptions.Item label={t("common.processingTime")}>
                    {t("common.days", { n: service.processingDays })}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("service.licenseWarn")}>
                    {t("common.months", { n: service.licenseExpiryWarnMonths ?? 2 })}
                  </Descriptions.Item>
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
                        {typeof display === "string" && display.length > 80 ? (
                          <ReadMoreText text={display} />
                        ) : (
                          display
                        )}
                      </Descriptions.Item>
                    );
                  })}
                </Descriptions>
              ),
            },
            {
              key: "notes",
              label: t("service.notes"),
              children: (
                <Typography.Paragraph type="secondary">
                  {t("service.notesPlaceholder")}{" "}
                  <Link href="/orders/new">{t("order.breadcrumbNew")}</Link>.
                </Typography.Paragraph>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={t("service.editTitle")}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={560}
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}>
          {t("service.editHint")}
        </Typography.Paragraph>
        <ServiceForm
          key={service.id}
          service={service}
          fieldDefs={fieldDefs}
          submitLabel={t("common.save")}
          loading={saving}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (payload) => {
            setSaving(true);
            try {
              updateService(service.id, payload);
              message.success(t("service.updated"));
              setEditOpen(false);
            } finally {
              setSaving(false);
            }
          }}
        />
      </Modal>
    </>
  );
}
