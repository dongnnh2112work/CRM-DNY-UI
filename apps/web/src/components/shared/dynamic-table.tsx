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
import { tableColumnKey } from "@/lib/table-index-column";
import { formatVndDisplay } from "@/lib/format-vnd";
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

export function DynamicTable<T extends object>({
  fieldDefs,
  onFieldDefsChange,
  lockedFieldKeys,
  dataSource,
  rowKey,
  onRow,
  extra = [],
  statusModule,
  emptyDescription = "Chưa có dữ liệu.",
  emptyAction,
  enableRowSelection = false,
  selectedRowKeys,
  onSelectedRowKeysChange,
  bulkToolbar,
  linkField,
  columnOverrides,
  columnManagerKey,
}: DynamicTableProps<T>) {
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
                ? "Thao tác"
                : key;
          return { key, label };
        })
        .filter((i) => i.key),
    [extra],
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
        title: def.label,
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
          if (def.type === "checkbox") return value ? "Có" : "Không";
          if (def.key === "status" && typeof value === "string") {
            if (statusModule) {
              return <StatusBadge module={statusModule} status={value} />;
            }
            const color = value === "active" ? "success" : value === "lead" ? "processing" : "default";
            const statusLabels: Record<string, string> = {
              active: "Hoạt động",
              lead: "Tiềm năng",
              archived: "Lưu trữ",
              inactive: "Ngừng",
            };
            const label = statusLabels[value] ?? String(value).toUpperCase();
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
  }, [committedVisibleDefs, visibleExtra, statusModule, linkField, columnOverrides]);

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
      message.warning("Tên cột không hợp lệ hoặc đã tồn tại");
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
    message.success("Đã lưu cấu hình cột");
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
      title: "Hủy?",
      content: "Thay đổi sẽ không được lưu.",
      okText: "Hủy",
      cancelText: "Tiếp tục",
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
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
        enableRowSelection={enableRowSelection}
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={onSelectedRowKeysChange}
        bulkToolbar={bulkToolbar}
        toolbar={
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
            <Button icon={<SettingOutlined />} size="small" onClick={() => setDrawerOpen(true)}>
              Quản lý cột
            </Button>
          </div>
        }
      />
      <Drawer
        title="Quản lý cột"
        open={drawerOpen}
        onClose={requestClose}
        width={400}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={requestClose}>Đóng</Button>
            <Button type="primary" disabled={!dirty} onClick={handleSave}>
              Lưu
            </Button>
          </div>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <span style={{ color: token.colorTextSecondary, fontSize: ds.fontSize.bodySm }}>
            Ẩn/hiện, thêm hoặc xóa cột chỉ áp dụng sau khi bấm Lưu.
          </span>
          {[...defs]
            .sort((a, b) => a.order - b.order)
            .map((def) => {
            const isLocked = locked.has(def.key);
            return (
              <div key={def.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Checkbox checked={def.visible} onChange={() => toggleVisibility(def.key)} />
                <span style={{ flex: 1 }}>{def.label}</span>
                <Tag>{def.type}</Tag>
                {isLocked ? (
                  <Tooltip title="Cột hệ thống — không xóa được">
                    <Button size="small" type="text" disabled icon={<DeleteOutlined />} />
                  </Tooltip>
                ) : (
                  <Popconfirm
                    title={`Xóa cột “${def.label}”?`}
                    description="Cột sẽ bị xóa sau khi bấm Lưu."
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => removeField(def.key)}
                  >
                    <Tooltip title="Xóa cột">
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
              <Tag>cột bảng</Tag>
              <Tooltip title="Cột hệ thống — không xóa được">
                <Button size="small" type="text" disabled icon={<DeleteOutlined />} />
              </Tooltip>
            </div>
              ))
            : null}
          <div style={{ borderTop: `1px solid ${token.colorBorder}`, paddingTop: 12 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Tên cột mới"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                onPressEnter={addField}
              />
              <Select value={newFieldType} onChange={setNewFieldType} style={{ width: 100 }}>
                <Select.Option value="text">Chữ</Select.Option>
                <Select.Option value="number">Số</Select.Option>
                <Select.Option value="date">Ngày</Select.Option>
                <Select.Option value="select">Chọn</Select.Option>
                <Select.Option value="checkbox">Checkbox</Select.Option>
              </Select>
              <Button onClick={addField}>
                Thêm
              </Button>
            </Space.Compact>
          </div>
        </Space>
      </Drawer>
    </>
  );
}
