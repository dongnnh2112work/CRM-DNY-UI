"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Drawer, Input, Modal, Popconfirm, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { ColorSwatchPicker } from "@/components/shared/color-swatch-picker";
import {
  getDefaultOrderStages,
  nextFreeStageColor,
  useOrderStatusConfig,
  type OrderStageDefinition,
} from "@/lib/order-status-store";
import { ds } from "@/lib/design-tokens";
import { useOrders } from "@/lib/orders-store";
import type { OrderStage } from "@/lib/types";

function cloneStages(list: OrderStageDefinition[]): OrderStageDefinition[] {
  return list.map((s) => ({ ...s }));
}

export function OrderStageSettingsDrawer({
  open,
  onClose,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const { message } = App.useApp();
  const { orders } = useOrders();
  const { stages, replaceStages } = useOrderStatusConfig();
  const [draft, setDraft] = useState<OrderStageDefinition[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(cloneStages(stages));
    setDirty(false);
  }, [open, stages]);

  const countInStage = (key: OrderStage) => orders.filter((o) => o.stage === key).length;

  const markDraft = (next: OrderStageDefinition[]) => {
    setDraft(next);
    setDirty(true);
  };

  const handleColorChange = (key: OrderStage, hex: string) => {
    const conflict = draft.some(
      (s) => s.key !== key && s.color.toLowerCase() === hex.toLowerCase(),
    );
    if (conflict) {
      message.warning("Màu này đã được dùng cho giai đoạn khác");
      return;
    }
    markDraft(draft.map((s) => (s.key === key ? { ...s, color: hex } : s)));
  };

  const handleAdd = () => {
    const free = nextFreeStageColor(draft.map((s) => s.color));
    if (!free) {
      message.warning("Đã hết màu trong palette — xóa hoặc đổi màu giai đoạn khác trước");
      return;
    }
    const existing = new Set(draft.map((s) => s.key));
    let n = draft.length + 1;
    let key = `giai_doan_${n}`;
    while (existing.has(key)) {
      n += 1;
      key = `giai_doan_${n}`;
    }
    markDraft([...draft, { key, label: `Giai đoạn ${n}`, color: free }]);
  };

  const handleRemove = (key: OrderStage) => {
    const inUse = countInStage(key);
    if (inUse > 0) {
      message.warning(`Không thể xóa — còn ${inUse} đơn ở giai đoạn này`);
      return;
    }
    if (draft.length <= 1) {
      message.warning("Cần giữ ít nhất một giai đoạn");
      return;
    }
    markDraft(draft.filter((s) => s.key !== key));
  };

  const handleResetDraft = () => {
    markDraft(cloneStages(getDefaultOrderStages()));
  };

  const handleSave = () => {
    if (!dirty) {
      message.info("Không có thay đổi");
      onClose();
      return;
    }
    if (draft.some((s) => !s.label.trim())) {
      message.warning("Tên giai đoạn không được trống");
      return;
    }
    const colors = draft.map((s) => s.color.toLowerCase());
    if (new Set(colors).size !== colors.length) {
      message.warning("Mỗi giai đoạn phải có màu khác nhau");
      return;
    }
    replaceStages(draft);
    setDirty(false);
    message.success("Đã lưu giai đoạn");
    onClose();
  };

  const tryClose = () => {
    if (!canEdit || !dirty) {
      onClose();
      return;
    }
    Modal.confirm({
      title: "Hủy?",
      content: "Thay đổi sẽ không được lưu.",
      okText: "Hủy",
      cancelText: "Tiếp tục",
      onOk: () => {
        setDirty(false);
        onClose();
      },
    });
  };

  return (
    <Drawer
      title="Giai đoạn"
      open={open}
      onClose={tryClose}
      width={420}
      destroyOnClose
      footer={
        canEdit ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Popconfirm
              title="Đặt lại danh sách mặc định?"
              description="Chỉ áp dụng sau khi bấm Lưu."
              okText="Đặt lại"
              cancelText="Hủy"
              onConfirm={handleResetDraft}
            >
              <Button type="text">Đặt lại mặc định</Button>
            </Popconfirm>
            <Space size={8}>
              <Button onClick={tryClose}>Hủy</Button>
              <Button type="primary" onClick={handleSave}>
                Lưu
              </Button>
            </Space>
          </div>
        ) : null
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm, marginTop: 0 }}>
        Đổi tên, màu; thêm hoặc xóa — bấm Lưu để xác nhận. Mỗi giai đoạn một màu.
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        {draft.map((stage) => {
          const inUse = countInStage(stage.key);
          const takenColors = draft.filter((s) => s.key !== stage.key).map((s) => s.color);
          return (
            <div
              key={stage.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <ColorSwatchPicker
                value={stage.color}
                takenColors={takenColors}
                disabled={!canEdit}
                onChange={(hex) => handleColorChange(stage.key, hex)}
              />
              <Input
                value={stage.label}
                disabled={!canEdit}
                placeholder="Tên giai đoạn"
                onChange={(e) =>
                  markDraft(
                    draft.map((s) => (s.key === stage.key ? { ...s, label: e.target.value } : s)),
                  )
                }
                style={{ flex: 1 }}
              />
              {canEdit ? (
                <Popconfirm
                  title="Xóa giai đoạn này?"
                  description={inUse > 0 ? `Còn ${inUse} đơn đang dùng.` : undefined}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, disabled: inUse > 0 || draft.length <= 1 }}
                  onConfirm={() => handleRemove(stage.key)}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={draft.length <= 1}
                    aria-label="Xóa giai đoạn"
                  />
                </Popconfirm>
              ) : null}
            </div>
          );
        })}
        {canEdit ? (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm giai đoạn
          </Button>
        ) : null}
      </Space>
    </Drawer>
  );
}
