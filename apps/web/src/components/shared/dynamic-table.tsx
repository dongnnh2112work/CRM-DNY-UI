"use client";

import { DeleteOutlined, SettingOutlined } from "@ant-design/icons";
import { App, Button, Checkbox, Drawer, Input, Popconfirm, Select, Space, Table, Tag, Tooltip, type TableColumnsType } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldDefinition, FieldType } from "@/lib/types";

interface DynamicTableProps<T extends object> {
  fieldDefs: FieldDefinition[];
  onFieldDefsChange?: (defs: FieldDefinition[]) => void;
  /** Keys không được xóa (cột hệ thống) */
  lockedFieldKeys?: string[];
  dataSource: T[];
  rowKey: string;
  onRow?: (record: T) => { onClick?: () => void };
  extra?: TableColumnsType<T>;
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
}: DynamicTableProps<T>) {
  const { message } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [defs, setDefs] = useState(fieldDefs);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const seedKeysRef = useRef(new Set(fieldDefs.map((d) => d.key)));

  const locked = useMemo(
    () => new Set(lockedFieldKeys ?? [...seedKeysRef.current]),
    [lockedFieldKeys],
  );

  useEffect(() => {
    if (!drawerOpen) setDefs(fieldDefs);
  }, [fieldDefs, drawerOpen]);

  const dirty = !defsEqual(defs, fieldDefs);

  const visibleDefs = useMemo(
    () => [...defs].filter((d) => d.visible).sort((a, b) => a.order - b.order),
    [defs],
  );

  const columns: TableColumnsType<T> = useMemo(() => {
    const cols: TableColumnsType<T> = visibleDefs.map((def) => ({
      title: def.label,
      dataIndex: def.key,
      key: def.key,
      sorter:
        def.type === "number"
          ? (a: T, b: T) =>
              Number((a as Record<string, unknown>)[def.key] ?? 0) -
              Number((b as Record<string, unknown>)[def.key] ?? 0)
          : undefined,
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
        if (def.type === "number" && typeof value === "number") return value.toLocaleString("vi-VN");
        return value != null && value !== "" ? String(value) : "—";
      },
    }));
    return [...cols, ...extra];
  }, [visibleDefs, extra]);

  const toggleVisibility = (key: string) => {
    setDefs((prev) => prev.map((d) => (d.key === key ? { ...d, visible: !d.visible } : d)));
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
    setDefs((prev) => [
      ...prev,
      {
        key,
        label: newFieldLabel.trim(),
        type: newFieldType,
        required: false,
        order: prev.length + 1,
        visible: true,
      },
    ]);
    setNewFieldLabel("");
  };

  const removeField = (key: string) => {
    if (locked.has(key)) return;
    setDefs((prev) => prev.filter((d) => d.key !== key));
  };

  const handleSave = () => {
    onFieldDefsChange?.(defs);
    message.success("Đã lưu cấu hình cột");
  };

  const handleClose = () => {
    setDefs(fieldDefs);
    setDrawerOpen(false);
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
      <Drawer
        title="Quản lý cột"
        open={drawerOpen}
        onClose={handleClose}
        width={400}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={handleClose}>Đóng</Button>
            <Button type="primary" disabled={!dirty} onClick={handleSave}>
              Lưu
            </Button>
          </div>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {dirty && (
            <Tag color="warning">Có thay đổi chưa lưu — bấm Lưu để giữ lại</Tag>
          )}
          {defs.map((def) => {
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
                    description="Cột sẽ biến mất khỏi bảng và form tạo/sửa sau khi Lưu."
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
