"use client";

import { Checkbox, Table } from "antd";
import { SYSTEM_PAGES, type PageAccess, type RolePagePermissions, type SystemPageKey } from "@/lib/types";
import { PAGE_NAV_KEY } from "@/lib/i18n";
import { useT } from "@/lib/use-t";

/** Editable View/Edit matrix for a role or per-user override. */
export function PermissionMatrix({
  value,
  onChange,
  size = "small",
}: {
  value: RolePagePermissions;
  onChange: (next: RolePagePermissions) => void;
  size?: "small" | "middle";
}) {
  const t = useT();
  const setAccess = (page: SystemPageKey, field: keyof PageAccess, checked: boolean) => {
    const current = { ...value[page] };
    if (field === "edit") {
      current.edit = checked;
      if (checked) current.view = true;
    } else {
      current.view = checked;
      if (!checked) current.edit = false;
    }
    onChange({ ...value, [page]: current });
  };

  return (
    <Table
      rowKey="key"
      size={size}
      pagination={false}
      columns={[
        { title: t("perm.page"), dataIndex: "label", key: "label" },
        {
          title: t("perm.view"),
          key: "view",
          width: 88,
          align: "center",
          render: (_: unknown, row: { key: SystemPageKey }) => (
            <Checkbox
              checked={value[row.key]?.view ?? false}
              onChange={(e) => setAccess(row.key, "view", e.target.checked)}
            />
          ),
        },
        {
          title: t("perm.edit"),
          key: "edit",
          width: 88,
          align: "center",
          render: (_: unknown, row: { key: SystemPageKey }) => (
            <Checkbox
              checked={value[row.key]?.edit ?? false}
              onChange={(e) => setAccess(row.key, "edit", e.target.checked)}
            />
          ),
        },
      ]}
      dataSource={SYSTEM_PAGES.map((p) => ({
        key: p.key,
        label: t(PAGE_NAV_KEY[p.key] ?? "nav.config"),
      }))}
    />
  );
}
