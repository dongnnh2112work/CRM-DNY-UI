"use client";

import { Breadcrumb, Button, DatePicker, Input, theme } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";
import type { DateRangeValue } from "@/lib/date-range";
import { rangePickerFormat } from "@/lib/format-date";
import { useT } from "@/lib/use-t";

export function PageHeader({
  breadcrumbs,
  title,
  description,
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
  /**
   * Page title (H1). Omit it and list pages (a single breadcrumb) use that breadcrumb as the title;
   * detail pages (2+ breadcrumbs) keep the breadcrumb trail and render their own heading.
   * Pass `null` to opt out of the title row.
   */
  title?: string | null;
  /** One-line explanation under the title (≤ ~100 characters). */
  description?: string;
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
  const searchId = useId();
  const dateId = useId();
  const items = breadcrumbs.map((b) => ({
    title: b.href ? <Link href={b.href}>{b.title}</Link> : b.title,
  }));

  const crumbCount = breadcrumbs.length;
  const pageTitle = title === undefined ? breadcrumbs[crumbCount - 1]?.title : (title ?? undefined);
  const showTitleRow = title !== null && pageTitle !== undefined && (title !== undefined || crumbCount === 1);
  // List pages: the title replaces the breadcrumb. Detail pages keep the trail so users can go back.
  const showBreadcrumb = !showTitleRow || crumbCount > 1;

  const primaryButton = primaryAction ? (
    <Button
      type="primary"
      onClick={() => {
        if (primaryAction.onClick) primaryAction.onClick();
        else if (primaryAction.href) router.push(primaryAction.href);
      }}
    >
      {primaryAction.label}
    </Button>
  ) : null;

  const hasFilterRow =
    onSearch !== undefined || Boolean(onDateRangeChange) || Boolean(children) || (!showTitleRow && Boolean(primaryButton));

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      {showBreadcrumb && <Breadcrumb items={items} style={{ marginBottom: showTitleRow ? 4 : 8 }} />}
      {showTitleRow && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: hasFilterRow ? 12 : 0,
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 240px" }}>
            <h1 className="crm-page-title">{pageTitle}</h1>
            {description ? <p className="crm-page-desc">{description}</p> : null}
          </div>
          {primaryButton ? <div className="crm-page-head-action">{primaryButton}</div> : null}
        </div>
      )}
      {hasFilterRow && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {onSearch !== undefined && (
            <Input.Search
              id={searchId}
              autoComplete="off"
              placeholder={searchPlaceholder ?? t("common.search")}
              allowClear
              style={{ width: "100%", maxWidth: 280, minWidth: 0, flex: "1 1 160px" }}
              value={searchValue}
              onChange={(e) => onSearch(e.target.value)}
            />
          )}
          {onDateRangeChange ? (
            <DatePicker.RangePicker
              id={{ start: `${dateId}-start`, end: `${dateId}-end` }}
              picker={datePicker}
              format={rangePickerFormat(datePicker)}
              allowEmpty={[true, true]}
              value={dateRange}
              onChange={(next) => onDateRangeChange(next)}
              placeholder={[t("common.dateFrom"), t("common.dateTo")]}
              style={{ maxWidth: "100%" }}
            />
          ) : null}
          {children}
          <div style={{ flex: 1 }} />
          {!showTitleRow ? primaryButton : null}
        </div>
      )}
    </div>
  );
}
