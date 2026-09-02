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
import { useT } from "@/lib/use-t";

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
  const t = useT();
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
      message.warning(t("stage.colorTaken"));
      return;
    }
    markDraft(draft.map((s) => (s.key === key ? { ...s, color: hex } : s)));
  };

  const handleAdd = () => {
    const free = nextFreeStageColor(draft.map((s) => s.color));
    if (!free) {
      message.warning(t("stage.noColors"));
      return;
    }
    const existing = new Set(draft.map((s) => s.key));
    let n = draft.length + 1;
    let key = `giai_doan_${n}`;
    while (existing.has(key)) {
      n += 1;
      key = `giai_doan_${n}`;
    }
    markDraft([...draft, { key, label: t("stage.defaultName", { n }), color: free }]);
  };

  const handleRemove = (key: OrderStage) => {
    const inUse = countInStage(key);
    if (inUse > 0) {
      message.warning(t("stage.inUse", { count: inUse }));
      return;
    }
    if (draft.length <= 1) {
      message.warning(t("stage.needOne"));
      return;
    }
    markDraft(draft.filter((s) => s.key !== key));
  };

  const handleResetDraft = () => {
    markDraft(cloneStages(getDefaultOrderStages()));
  };

  const handleSave = () => {
    if (!dirty) {
      message.info(t("common.noChange"));
      onClose();
      return;
    }
    if (draft.some((s) => !s.label.trim())) {
      message.warning(t("stage.emptyName"));
      return;
    }
    const colors = draft.map((s) => s.color.toLowerCase());
    if (new Set(colors).size !== colors.length) {
      message.warning(t("stage.uniqueColors"));
      return;
    }
    replaceStages(draft);
    setDirty(false);
    message.success(t("stage.saved"));
    onClose();
  };

  const tryClose = () => {
    if (!canEdit || !dirty) {
      onClose();
      return;
    }
    Modal.confirm({
      title: t("common.discardTitle"),
      content: t("common.discardBody"),
      okText: t("common.cancel"),
      cancelText: t("common.continue"),
      onOk: () => {
        setDirty(false);
        onClose();
      },
    });
  };

  return (
    <Drawer
      title={t("nav.orderStatuses")}
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
              title={t("stage.resetTitle")}
              description={t("stage.resetBody")}
              okText={t("common.reset")}
              cancelText={t("common.cancel")}
              onConfirm={handleResetDraft}
            >
              <Button type="text">{t("stage.resetDefault")}</Button>
            </Popconfirm>
            <Space size={8}>
              <Button onClick={tryClose}>{t("common.cancel")}</Button>
              <Button type="primary" onClick={handleSave}>
                {t("common.save")}
              </Button>
            </Space>
          </div>
        ) : null
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm, marginTop: 0 }}>
        {t("stage.drawerHint")}
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
                placeholder={t("stage.namePh")}
                onChange={(e) =>
                  markDraft(
                    draft.map((s) => (s.key === stage.key ? { ...s, label: e.target.value } : s)),
                  )
                }
                style={{ flex: 1 }}
              />
              {canEdit ? (
                <Popconfirm
                  title={t("stage.deleteTitle")}
                  description={inUse > 0 ? t("stage.deleteInUse", { count: inUse }) : undefined}
                  okText={t("common.delete")}
                  cancelText={t("common.cancel")}
                  okButtonProps={{ danger: true, disabled: inUse > 0 || draft.length <= 1 }}
                  onConfirm={() => handleRemove(stage.key)}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={draft.length <= 1}
                    aria-label={t("stage.deleteAria")}
                  />
                </Popconfirm>
              ) : null}
            </div>
          );
        })}
        {canEdit ? (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={handleAdd}>
            {t("stage.add")}
          </Button>
        ) : null}
      </Space>
    </Drawer>
  );
}
