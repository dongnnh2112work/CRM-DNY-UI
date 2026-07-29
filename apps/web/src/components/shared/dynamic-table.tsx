"use client";

import { SettingOutlined } from "@ant-design/icons";
import { Button, Checkbox, Drawer, Input, Select, Space, Table, Tag, type TableColumnsType } from "antd";
import { useMemo, useState } from "react";
import type { FieldDefinition, FieldType } from "@/lib/types";

interface DynamicTableProps<T extends object> {
  fieldDefs: FieldDefinition[];
  onFieldDefsChange?: (defs: FieldDefinition[]) => void;
  dataSource: T[];
  rowKey: string;
  onRow?: (record: T) => { onClick?: () => void };
  extra?: TableColumnsType<T>;
}

export function DynamicTable<T extends object>({
  fieldDefs,
  onFieldDefsChange,
  dataSource,
  rowKey,
  onRow,
  extra = [],
}: DynamicTableProps<T>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [defs, setDefs] = useState(fieldDefs);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");

  const visibleDefs = useMemo(
    () => [...defs].filter((d) => d.visible).sort((a, b) => a.order - b.order),
    [defs],
  );

  const columns: TableColumnsType<T> = useMemo(() => {
    const cols: TableColumnsType<T> = visibleDefs.map((def) => ({
      title: def.label,
      dataIndex: def.key,
      key: def.key,
      sorter: def.type === "number" ? (a: T, b: T) => Number((a as Record<string, unknown>)[def.key] ?? 0) - Number((b as Record<string, unknown>)[def.key] ?? 0) : undefined,
      render: (value: unknown) => {
        if (def.type === "checkbox") return value ? "Có" : "Không";
        if (def.key === "status" && typeof value === "string") {
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
        if (def.type === "number" && typeof value === "number") return value.toLocaleString();
        return value != null ? String(value) : "—";
      },
    }));
    return [...cols, ...extra];
  }, [visibleDefs, extra]);

  const toggleVisibility = (key: string) => {
    const updated = defs.map((d) => (d.key === key ? { ...d, visible: !d.visible } : d));
    setDefs(updated);
    onFieldDefsChange?.(updated);
  };

  const addField = () => {
    if (!newFieldLabel.trim()) return;
    const key = newFieldLabel.toLowerCase().replace(/\s+/g, "_");
    const newDef: FieldDefinition = {
      key,
      label: newFieldLabel,
      type: newFieldType,
      required: false,
      order: defs.length + 1,
      visible: true,
    };
    const updated = [...defs, newDef];
    setDefs(updated);
    onFieldDefsChange?.(updated);
    setNewFieldLabel("");
  };

  const removeField = (key: string) => {
    const builtIn = fieldDefs.find((d) => d.key === key);
    if (builtIn) return;
    const updated = defs.filter((d) => d.key !== key);
    setDefs(updated);
    onFieldDefsChange?.(updated);
  };

  // Resolve customFields into flat rows for table
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
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
        <Button icon={<SettingOutlined />} size="small" onClick={() => setDrawerOpen(true)}>
          Quản lý cột
        </Button>
      </div>
      <div style={{ padding: 16 }}>
        <Table
          rowKey={rowKey}
          columns={columns}
          dataSource={flatData as T[]}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          size="middle"
          onRow={onRow}
        />
      </div>
      <Drawer title="Quản lý cột" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={380}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {defs.map((def) => (
            <div key={def.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Checkbox checked={def.visible} onChange={() => toggleVisibility(def.key)} />
              <span style={{ flex: 1 }}>{def.label}</span>
              <Tag>{def.type}</Tag>
              {!fieldDefs.find((d) => d.key === def.key) && (
                <Button size="small" danger onClick={() => removeField(def.key)}>
                  Xóa
                </Button>
              )}
            </div>
          ))}
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
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
              <Button type="primary" onClick={addField}>
                Thêm
              </Button>
            </Space.Compact>
          </div>
        </Space>
      </Drawer>
    </>
  );
}
