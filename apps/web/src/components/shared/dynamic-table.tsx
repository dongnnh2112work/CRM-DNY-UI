"use client";

import { DeleteOutlined, SettingOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Checkbox,
  Drawer,
  Input,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  theme,
  type TableColumnsType,
} from "antd";
import { useEffect, useMemo, useRef, useState, type Key, type ReactNode } from "react";
import { DataTable } from "@/components/shared/data-table";
import { useManagedColumns } from "@/components/shared/column-manager-drawer";
import { StatusBadge } from "@/components/shared/status-badge";
import { ds } from "@/lib/design-tokens";
import { translateSeedFieldLabel, translateStatusLabel } from "@/lib/i18n";
import { tableColumnKey } from "@/lib/table-index-column";
import { formatVndDisplay } from "@/lib/format-vnd";
import { useT } from "@/lib/use-t";
import type { StatusModule } from "@/lib/status-config";
import type { FieldDefinition, FieldType } from "@/lib/types";

const MONEY_FIELD_KEYS = new Set([
  "unitPrice",
  "value",
  "amount",
  "totalAmount",
  "paidAmount",
  "remaining",
  "taxAmount",
  "ctvPrice",
  "ratecard",
  "commission",
  "totalCommission",
]);

function isMoneyField(def: FieldDefinition) {
  return MONEY_FIELD_KEYS.has(def.key) || /vnd|đơn giá|tiền|hoa hồng/i.test(def.label);
}

interface DynamicTableProps<T extends object> {
  fieldDefs: FieldDefinition[];
  onFieldDefsChange?: (defs: FieldDefinition[]) => void;
  /** Keys không được xóa (cột hệ thống) */
  lockedFieldKeys?: string[];
  dataSource: T[];
  rowKey: string;
  onRow?: (record: T) => { onClick?: () => void };
  extra?: TableColumnsType<T>;
  /** When set, status column uses shared StatusBadge for this module */
  statusModule?: StatusModule;
  emptyDescription?: string;
  emptyAction?: { label: string; href?: string; onClick?: () => void };
  /** Enable checkbox selection (current page only via Ant Table default). */
  enableRowSelection?: boolean;
  selectedRowKeys?: Key[];
  onSelectedRowKeysChange?: (keys: Key[]) => void;
  /** Rendered between column manager and table when selection is active. */
  bulkToolbar?: ReactNode;
  /** Make a field value a clickable link (e.g. name → open edit). */
  linkField?: { key: string; onClick: (record: T) => void };
  /** Per-field render / sorter / width for system columns (e.g. used services). */
  columnOverrides?: Partial<
    Record<
      string,
      {
        render?: (value: unknown, record: T) => ReactNode;
        sorter?: (a: T, b: T) => number;
        width?: number;
      }
    >
  >;
  /** Persist ẩn/hiện cột extra (Thao tác…) — cùng rule Lưu mới áp dụng. */
  columnManagerKey?: string;
}

function defsEqual(a: FieldDefinition[], b: FieldDefinition[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function statusFallbackLabel(value: string) {
  const customer = translateStatusLabel("customer", value);
  if (customer !== value) return customer;
  return translateStatusLabel("user", value);
}

export function DynamicTable<T extends object>({
  fieldDefs,
  onFieldDefsChange,
  lockedFieldKeys,
  dataSource,
  rowKey,
  onRow,
  extra = [],
  statusModule,
  emptyDescription,
  emptyAction,
  enableRowSelection = false,
  selectedRowKeys,
  onSelectedRowKeysChange,
  bulkToolbar,
  linkField,
  columnOverrides,
  columnManagerKey,
}: DynamicTableProps<T>) {
  const t = useT();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [defs, setDefs] = useState(fieldDefs);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const seedKeysRef = useRef(new Set(fieldDefs.map((d) => d.key)));

  const locked = useMemo(
    () => new Set(lockedFieldKeys ?? [...seedKeysRef.current]),
    [lockedFieldKeys],
  );

  const extraItems = useMemo(
    () =>
      extra
        .map((col) => {
          const key = tableColumnKey(col);
          const label =
            typeof col.title === "string" && col.title.trim()
              ? col.title
              : key === "action" || key === "actions"
                ? t("common.actions")
                : key;
          return { key, label };
        })
        .filter((i) => i.key),
    [extra, t],
  );
  const extraManagerId =
    columnManagerKey && extraItems.length > 0 ? `${columnManagerKey}-extra` : undefined;
  const extraManaged = useManagedColumns(extraManagerId, extraItems);
  const [extraDraft, setExtraDraft] = useState(extraManaged.committed);

  useEffect(() => {
    if (!drawerOpen) setDefs(fieldDefs);
  }, [fieldDefs, drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) setExtraDraft(extraManaged.committed);
  }, [drawerOpen, extraManaged.committed]);

  const extraDirty =
    extraManagerId && JSON.stringify(extraDraft) !== JSON.stringify(extraManaged.committed);
  const dirty = !defsEqual(defs, fieldDefs) || Boolean(extraDirty);

  const committedVisibleDefs = useMemo(
    () => [...fieldDefs].filter((d) => d.visible).sort((a, b) => a.order - b.order),
    [fieldDefs],
  );

  const visibleExtra = extraManagerId
    ? extra.filter((col) => extraManaged.isVisible(tableColumnKey(col)))
    : extra;

  const columns: TableColumnsType<T> = useMemo(() => {
    const cols: TableColumnsType<T> = committedVisibleDefs.map((def) => {
      const override = columnOverrides?.[def.key];
      return {
        title: translateSeedFieldLabel(def.label),
        dataIndex: def.key,
        key: def.key,
        width: override?.width,
        align: def.type === "number" ? ("center" as const) : undefined,
        sorter:
          override?.sorter ??
          (def.type === "number"
            ? (a: T, b: T) =>
                Number((a as Record<string, unknown>)[def.key] ?? 0) -
                Number((b as Record<string, unknown>)[def.key] ?? 0)
            : def.type === "date"
              ? (a: T, b: T) =>
                  String((a as Record<string, unknown>)[def.key] ?? "").localeCompare(
                    String((b as Record<string, unknown>)[def.key] ?? ""),
                  )
              : undefined),
        render: (value: unknown, record: T) => {
          if (override?.render) return override.render(value, record);
          if (linkField && def.key === linkField.key) {
            const label =
              value != null && value !== "" ? String(value) : "—";
            return (
              <Button
                type="link"
                style={{ padding: 0, height: "auto", fontWeight: 500 }}
                onClick={(e) => {
                  e.stopPropagation();
                  linkField.onClick(record);
                }}
              >
                {label}
              </Button>
            );
          }
          if (def.type === "checkbox") return value ? t("common.yes") : t("common.no");
          if (def.key === "status" && typeof value === "string") {
            if (statusModule) {
              return <StatusBadge module={statusModule} status={value} />;
            }
            const color = value === "active" ? "success" : value === "lead" ? "processing" : "default";
            const label = statusFallbackLabel(value);
            return <Tag color={color}>{label}</Tag>;
          }
          if (def.type === "number" && typeof value === "number") {
            return isMoneyField(def) ? formatVndDisplay(value) : value.toLocaleString("vi-VN");
          }
          if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
          return value != null && value !== "" ? String(value) : "—";
        },
      };
    });
    return [...cols, ...visibleExtra];
  }, [committedVisibleDefs, visibleExtra, statusModule, linkField, columnOverrides, t]);

  const resolvedEmptyDescription = emptyDescription ?? t("common.noData");

  const toggleVisibility = (key: string) => {
    setDefs(defs.map((d) => (d.key === key ? { ...d, visible: !d.visible } : d)));
  };

  const addField = () => {
    if (!newFieldLabel.trim()) return;
    const key = newFieldLabel
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!key || defs.some((d) => d.key === key)) {
      message.warning(t("col.invalidName"));
      return;
    }
    setDefs([
      ...defs,
      {
        key,
        label: newFieldLabel.trim(),
        type: newFieldType,
        required: false,
        order: defs.length + 1,
        visible: true,
      },
    ]);
    setNewFieldLabel("");
  };

  const removeField = (key: string) => {
    if (locked.has(key)) return;
    setDefs(defs.filter((d) => d.key !== key));
  };

  const handleSave = () => {
    onFieldDefsChange?.(defs);
    extraManaged.save(extraDraft);
    message.success(t("common.savedColumns"));
    setDrawerOpen(false);
  };

  const handleClose = () => {
    setDefs(fieldDefs);
    setExtraDraft(extraManaged.committed);
    setNewFieldLabel("");
    setDrawerOpen(false);
  };

  const requestClose = () => {
    if (!dirty) {
      handleClose();
      return;
    }
    modal.confirm({
      title: t("common.discardTitle"),
      content: t("common.discardBody"),
      okText: t("common.cancel"),
      cancelText: t("common.continue"),
      onOk: handleClose,
    });
  };

  const flatData = useMemo(
    () =>
      dataSource.map((row) => {
        const cf = (row as Record<string, unknown>).customFields as Record<string, unknown> | undefined;
        return cf ? { ...row, ...cf } : row;
      }),
    [dataSource],
  );

  return (
    <>
      <DataTable<T>
        rowKey={rowKey}
        columns={columns}
        dataSource={flatData as T[]}
        onRow={onRow}
        emptyDescription={resolvedEmptyDescription}
        emptyAction={emptyAction}
        enableRowSelection={enableRowSelection}
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={onSelectedRowKeysChange}
        bulkToolbar={bulkToolbar}
        toolbar={
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
            <Button icon={<SettingOutlined />} size="small" onClick={() => setDrawerOpen(true)}>
              {t("common.manageColumns")}
            </Button>
          </div>
        }
      />
      <Drawer
        title={t("common.manageColumns")}
        open={drawerOpen}
        onClose={requestClose}
        width={400}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={requestClose}>{t("common.close")}</Button>
            <Button type="primary" disabled={!dirty} onClick={handleSave}>
              {t("common.save")}
            </Button>
          </div>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <span style={{ color: token.colorTextSecondary, fontSize: ds.fontSize.bodySm }}>
            {t("col.saveHintEdit")}
          </span>
          {[...defs]
            .sort((a, b) => a.order - b.order)
            .map((def) => {
            const isLocked = locked.has(def.key);
            return (
              <div key={def.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Checkbox checked={def.visible} onChange={() => toggleVisibility(def.key)} />
                <span style={{ flex: 1 }}>{translateSeedFieldLabel(def.label)}</span>
                <Tag>{def.type}</Tag>
                {isLocked ? (
                  <Tooltip title={t("col.systemLocked")}>
                    <Button size="small" type="text" disabled icon={<DeleteOutlined />} />
                  </Tooltip>
                ) : (
                  <Popconfirm
                    title={t("col.deleteTitle", { label: def.label })}
                    description={t("col.deleteBody")}
                    okText={t("common.delete")}
                    cancelText={t("common.cancel")}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => removeField(def.key)}
                  >
                    <Tooltip title={t("col.deleteCol")}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                )}
              </div>
            );
          })}
          {extraManagerId
            ? extraItems.map((item) => (
            <div key={`extra-${item.key}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Checkbox
                checked={extraDraft[item.key] !== false}
                onChange={() =>
                  setExtraDraft((prev) => ({
                    ...prev,
                    [item.key]: prev[item.key] === false,
                  }))
                }
              />
              <span style={{ flex: 1 }}>{item.label}</span>
              <Tag>{t("col.tableCol")}</Tag>
              <Tooltip title={t("col.systemLocked")}>
                <Button size="small" type="text" disabled icon={<DeleteOutlined />} />
              </Tooltip>
            </div>
              ))
            : null}
          <div style={{ borderTop: `1px solid ${token.colorBorder}`, paddingTop: 12 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder={t("col.newName")}
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                onPressEnter={addField}
              />
              <Select value={newFieldType} onChange={setNewFieldType} style={{ width: 100 }}>
                <Select.Option value="text">{t("col.typeText")}</Select.Option>
                <Select.Option value="number">{t("col.typeNumber")}</Select.Option>
                <Select.Option value="date">{t("col.typeDate")}</Select.Option>
                <Select.Option value="select">{t("col.typeSelect")}</Select.Option>
                <Select.Option value="checkbox">{t("col.typeCheckbox")}</Select.Option>
              </Select>
              <Button onClick={addField}>{t("common.add")}</Button>
            </Space.Compact>
          </div>
        </Space>
      </Drawer>
    </>
  );
}
