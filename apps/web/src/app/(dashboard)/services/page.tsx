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
import { apiErrorMessage } from "@/lib/http/message";
import type { Service } from "@/lib/types";
import { servicesApi } from "@/modules/services/api";
import { mapApiServiceToUi, mapUiServiceToApi } from "@/modules/services/map-to-ui";
import { useRemoteList } from "@/components/api-hydrator";
import { useT } from "@/lib/use-t";

export default function ServicesPage() {
  const t = useT();
  const { message } = App.useApp();
  const { services, fieldDefs, saveFieldDefs, setServiceStatus, deleteService, updateService, replaceServices } =
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
  const servicesRemote = useRemoteList("services");

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

  const bulkSetStatus = async (status: "active" | "inactive") => {
    try {
      await Promise.all(
        selectedRowKeys.map(async (id) => {
          const sid = String(id);
          if (status === "inactive") await servicesApi.archive(sid);
          else await servicesApi.update(sid, { status: "ACTIVE" });
          setServiceStatus(sid, status);
        }),
      );
      message.success(
        status === "active"
          ? t("service.activatedN", { count: selectedCount })
          : t("service.deactivatedN", { count: selectedCount }),
      );
      clearSelection();
    } catch (err) {
      message.error(apiErrorMessage(err, t("service.empty")));
    }
  };

  const bulkDelete = async () => {
    try {
      await Promise.all(selectedRowKeys.map((id) => servicesApi.archive(String(id))));
      selectedRowKeys.forEach((id) => deleteService(String(id)));
      message.success(t("service.deletedN", { count: selectedCount }));
      clearSelection();
    } catch (err) {
      message.error(apiErrorMessage(err, t("service.empty")));
    }
  };

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: t("nav.services") }]}
        searchPlaceholder={t("common.searchTable")}
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: t("service.newCta"), onClick: openCreate }}
      />
      <DynamicTable<Service>
        fieldDefs={fieldDefs}
        onFieldDefsChange={saveFieldDefs}
        lockedFieldKeys={SERVICE_LOCKED_FIELD_KEYS}
        dataSource={filtered}
        rowKey="id"
        columnManagerKey="services"
        remote={servicesRemote}
        statusModule="service"
        linkField={{ key: "name", onClick: openEdit }}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Popconfirm
              title={t("service.activateN", { count: selectedCount })}
              okText={t("common.activate")}
              cancelText={t("common.cancel")}
              onConfirm={() => bulkSetStatus("active")}
            >
              <Button size="small">{t("service.setActive")}</Button>
            </Popconfirm>
            <Popconfirm
              title={t("service.deactivateN", { count: selectedCount })}
              okText={t("common.deactivate")}
              cancelText={t("common.cancel")}
              onConfirm={() => bulkSetStatus("inactive")}
            >
              <Button size="small">{t("common.deactivate")}</Button>
            </Popconfirm>
            <Popconfirm
              title={t("service.deleteN", { count: selectedCount })}
              description={t("service.deleteNBody")}
              okText={t("common.delete")}
              cancelText={t("common.cancel")}
              okButtonProps={{ danger: true }}
              onConfirm={bulkDelete}
            >
              <Button size="small" danger>
                {t("common.delete")}
              </Button>
            </Popconfirm>
          </BulkActionBar>
        }
        emptyDescription={
          query.trim() && services.length > 0 ? t("common.noResults") : t("service.empty")
        }
        emptyAction={
          query.trim() && services.length > 0
            ? undefined
            : { label: t("common.createService"), onClick: openCreate }
        }
      />

      <Modal
        title={editService ? editService.name : t("service.newTitle")}
        open={formOpen}
        onCancel={closeForm}
        footer={null}
        width={560}
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}>
          {editService ? t("service.editHint") : t("service.createHint")}
        </Typography.Paragraph>
        <ServiceForm
          key={`${editService?.id ?? "new"}-${fieldDefs.map((d) => `${d.key}:${d.visible}`).join("|")}`}
          service={editService}
          fieldDefs={fieldDefs}
          submitLabel={editService ? t("common.save") : t("common.createService")}
          loading={saving}
          onCancel={closeForm}
          onSubmit={async (payload) => {
            setSaving(true);
            try {
              if (editService) {
                const body = mapUiServiceToApi(payload);
                let updated = await servicesApi.update(editService.id, body);
                if (payload.status === "inactive" && updated.status?.toUpperCase() !== "ARCHIVED") {
                  updated = await servicesApi.archive(editService.id);
                }
                updateService(editService.id, mapApiServiceToUi(updated));
                message.success(t("service.updated"));
              } else {
                const created = await servicesApi.create(mapUiServiceToApi(payload));
                replaceServices([...services, mapApiServiceToUi(created)]);
                message.success(t("service.created"));
              }
              closeForm();
            } catch (err) {
              message.error(apiErrorMessage(err, t("service.empty")));
            } finally {
              setSaving(false);
            }
          }}
        />
      </Modal>
    </>
  );
}
