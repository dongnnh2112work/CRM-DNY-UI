"use client";

import { SettingOutlined } from "@ant-design/icons";
import { App, Button, Checkbox, Drawer, Space, theme } from "antd";
import { useEffect, useMemo, useState } from "react";
import { ds } from "@/lib/design-tokens";
import {
  loadColumnVisibility,
  saveColumnVisibility,
  type ColumnVisibility,
} from "@/lib/column-visibility";
import { useT } from "@/lib/use-t";

export type ColumnManagerItem = {
  key: string;
  label: string;
};

function visEqual(a: ColumnVisibility, b: ColumnVisibility) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useManagedColumns(managerId: string | undefined, items: ColumnManagerItem[]) {
  const keysSig = items.map((i) => i.key).join("|");
  const keys = useMemo(() => (keysSig ? keysSig.split("|") : []), [keysSig]);
  const [committed, setCommitted] = useState<ColumnVisibility>(() =>
    Object.fromEntries(keys.map((k) => [k, true])),
  );

  useEffect(() => {
    if (!managerId) {
      setCommitted(Object.fromEntries(keys.map((k) => [k, true])));
      return;
    }
    setCommitted(loadColumnVisibility(managerId, keys));
  }, [managerId, keys, keysSig]);

  const save = (next: ColumnVisibility) => {
    if (managerId) saveColumnVisibility(managerId, next);
    setCommitted(next);
  };

  const isVisible = (key: string) => committed[key] !== false;

  return { committed, save, isVisible };
}

export function ColumnManagerButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
      <Button icon={<SettingOutlined />} size="small" onClick={onClick}>
        {t("common.manageColumns")}
      </Button>
    </div>
  );
}

export function ColumnManagerDrawer({
  open,
  onClose,
  items,
  value,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  items: ColumnManagerItem[];
  value: ColumnVisibility;
  onSave: (next: ColumnVisibility) => void;
}) {
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const t = useT();
  const [draft, setDraft] = useState<ColumnVisibility>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const dirty = !visEqual(draft, value);

  const handleSave = () => {
    onSave(draft);
    message.success(t("common.savedColumns"));
    onClose();
  };

  const discard = () => {
    setDraft(value);
    onClose();
  };

  const requestClose = () => {
    if (!dirty) {
      discard();
      return;
    }
    modal.confirm({
      title: t("common.discardTitle"),
      content: t("common.discardBody"),
      okText: t("common.cancel"),
      cancelText: t("common.continue"),
      onOk: discard,
    });
  };

  return (
    <Drawer
      title={t("common.manageColumns")}
      open={open}
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
          {t("col.saveHint")}
        </span>
        {items.map((item) => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Checkbox
              checked={draft[item.key] !== false}
              onChange={() =>
                setDraft((prev) => ({ ...prev, [item.key]: prev[item.key] === false }))
              }
            />
            <span style={{ flex: 1 }}>{item.label}</span>
          </div>
        ))}
      </Space>
    </Drawer>
  );
}
