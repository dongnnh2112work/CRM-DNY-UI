"use client";

import { Breadcrumb, Button, DatePicker, Input, theme } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { DateRangeValue } from "@/lib/date-range";
import { useT } from "@/lib/use-t";

export function PageHeader({
  breadcrumbs,
  searchPlaceholder,
  onSearch,
  searchValue,
  dateRange,
  onDateRangeChange,
  datePicker = "date",
  primaryAction,
  children,
}: {
  breadcrumbs: { title: string; href?: string }[];
  searchPlaceholder?: string;
  onSearch?: (v: string) => void;
  searchValue?: string;
  dateRange?: DateRangeValue;
  onDateRangeChange?: (value: DateRangeValue) => void;
  datePicker?: "date" | "month";
  /** Right-aligned primary CTA — use href (navigate) or onClick (e.g. open modal). */
  primaryAction?: { label: string; href?: string; onClick?: () => void };
  children?: ReactNode;
}) {
  const router = useRouter();
  const { token } = theme.useToken();
  const t = useT();
  const items = breadcrumbs.map((b) => ({
    title: b.href ? <Link href={b.href}>{b.title}</Link> : b.title,
  }));

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${token.colorBorder}`,
        background: token.colorBgContainer,
      }}
    >
      <Breadcrumb items={items} style={{ marginBottom: 8 }} />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {onSearch !== undefined && (
          <Input.Search
            placeholder={searchPlaceholder ?? t("common.search")}
            allowClear
            style={{ width: 280 }}
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
          />
        )}
        {onDateRangeChange ? (
          <DatePicker.RangePicker
            picker={datePicker}
            allowEmpty={[true, true]}
            value={dateRange}
            onChange={(next) => onDateRangeChange(next)}
            placeholder={[t("common.dateFrom"), t("common.dateTo")]}
          />
        ) : null}
        {children}
        <div style={{ flex: 1 }} />
        {primaryAction && (
          <Button
            type="primary"
            onClick={() => {
              if (primaryAction.onClick) primaryAction.onClick();
              else if (primaryAction.href) router.push(primaryAction.href);
            }}
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
