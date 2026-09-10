"use client";

import { SearchOutlined } from "@ant-design/icons";
import { Button, Input, Space, type TableColumnsType } from "antd";
import { INDEX_COLUMN_KEY, tableColumnKey, type TableColumn } from "@/lib/table-index-column";
import { hasMessageKey, type MessageKey, type MessageVars } from "@/lib/i18n";
import { matchesTableQuery } from "@/lib/table-search";

const SKIP_KEYS = new Set([INDEX_COLUMN_KEY, "action", "actions", "avatar"]);
const ENUM_KEYS = new Set(["status", "stage", "channel", "role", "category", "type", "method"]);

type TFn = (key: MessageKey, vars?: MessageVars) => string;

function dataIndexPath<T>(col: TableColumn<T>): string | undefined {
  if (!("dataIndex" in col) || col.dataIndex == null) return undefined;
  return Array.isArray(col.dataIndex) ? col.dataIndex.join(".") : String(col.dataIndex);
}

function readPath(record: object, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, record);
}

function enumLabel(dataIndex: string, value: string, t: TFn): string {
  if (dataIndex === "channel") {
    const key = `channel.${value}`;
    if (hasMessageKey(key)) return t(key);
  }
  if (dataIndex === "role") {
    const key = `role.${value}`;
    if (hasMessageKey(key)) return t(key);
  }
  const modules = [
    "customer",
    "payment",
    "paymentInstallment",
    "service",
    "user",
    "email",
    "vat",
    "orderStage",
    "approvalRequest",
    "approval",
  ];
  for (const mod of modules) {
    const key = `status.${mod}.${value}`;
    if (hasMessageKey(key)) return t(key);
  }
  return value;
}

export function enhanceColumnsWithFilters<T extends object>(
  columns: TableColumnsType<T>,
  dataSource: T[],
  t: TFn,
): TableColumnsType<T> {
  return columns.map((col) => {
    const key = tableColumnKey(col as TableColumn<T>);
    const path = dataIndexPath(col as TableColumn<T>);
    if (!path || SKIP_KEYS.has(key) || col.filters || col.filterDropdown || col.onFilter) {
      return col;
    }

    if (ENUM_KEYS.has(path)) {
      const uniq = new Set<string>();
      for (const row of dataSource) {
        const raw = readPath(row, path);
        if (raw != null && raw !== "") uniq.add(String(raw));
      }
      if (uniq.size === 0) return col;
      return {
        ...col,
        filters: [...uniq]
          .sort((a, b) => a.localeCompare(b, "vi"))
          .map((value) => ({ text: enumLabel(path, value, t), value })),
        onFilter: (value, record) => String(readPath(record as object, path) ?? "") === String(value),
        filterSearch: uniq.size > 8,
      };
    }

    return {
      ...col,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
          <Input
            placeholder={t("common.filterSearch")}
            value={selectedKeys[0] != null ? String(selectedKeys[0]) : ""}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ marginBottom: 8, display: "block", width: 188 }}
            allowClear
          />
          <Space>
            <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => confirm()}>
              {t("common.filterOk")}
            </Button>
            <Button
              size="small"
              onClick={() => {
                clearFilters?.();
                confirm();
              }}
            >
              {t("common.filterReset")}
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <SearchOutlined style={{ color: filtered ? "var(--ant-color-primary)" : undefined }} />
      ),
      onFilter: (value, record) => matchesTableQuery(String(value), [readPath(record as object, path)]),
    };
  });
}
