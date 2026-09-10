"use client";

import { DatePicker, Input, Table, type TableColumnsType, type TableProps } from "antd";
import { useEffect, useMemo, useState, type Key, type ReactNode } from "react";
import {
  ColumnManagerButton,
  ColumnManagerDrawer,
  useManagedColumns,
  type ColumnManagerItem,
} from "@/components/shared/column-manager-drawer";
import { EmptyState } from "@/components/shared/empty-state";
import { RemoteListStatus } from "@/components/shared/remote-list-status";
import { enhanceColumnsWithFilters } from "@/components/shared/table-column-filters";
import { getRecordDate, isInDateRange, type DateRangeValue } from "@/lib/date-range";
import { matchesTableQuery } from "@/lib/table-search";
import { tableIndexColumn, tableColumnKey, type TableColumn } from "@/lib/table-index-column";
import { useT } from "@/lib/use-t";

export type DataTableEmptyAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type DataTableDateFilter<T extends object> = string | ((row: T) => string | undefined | null);

/**
 * Shared list-table chrome around Ant Design Table.
 *
 * - Search: prefer PageHeader; optional `search` renders Input.Search above the table.
 * - Sort / filter: auto column filters + optional date range; extra `filters` on columns are kept.
 * - Columns: fully custom per module via `columns` (render, align, width, fixed…).
 * - Bulk: `enableRowSelection` + `bulkToolbar` (BulkActionBar).
 */
export interface DataTableProps<T extends object> {
  rowKey: string | ((record: T) => Key);
  columns: TableColumnsType<T>;
  dataSource: T[];
  onRow?: TableProps<T>["onRow"];
  /** Ant Table loading spinner / skeleton overlay. */
  loading?: boolean;
  size?: TableProps<T>["size"];
  /** Merged with defaults: pageSize 10, showSizeChanger true. Pass `false` to disable. */
  pagination?: TableProps<T>["pagination"];
  scroll?: TableProps<T>["scroll"];
  emptyDescription?: string;
  emptyAction?: DataTableEmptyAction;
  enableRowSelection?: boolean;
  selectedRowKeys?: Key[];
  onSelectedRowKeysChange?: (keys: Key[]) => void;
  /** Escape hatch — overrides enableRowSelection helpers when set. */
  rowSelection?: TableProps<T>["rowSelection"];
  /** Forward Ant Table onChange (pagination / filters / sorter). */
  onChange?: TableProps<T>["onChange"];
  sortDirections?: TableProps<T>["sortDirections"];
  showSorterTooltip?: TableProps<T>["showSorterTooltip"];
  /**
   * Optional table-local search (when not using PageHeader search).
   * Filtering stays in the page — pass already-filtered `dataSource`.
   */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Date field used by the Từ–Đến RangePicker. Hidden when omitted. */
  dateFilterField?: DataTableDateFilter<T>;
  datePicker?: "date" | "month";
  /** Local search box when the page has no PageHeader search (nested tables). */
  enableLocalSearch?: boolean;
  /** Optional chrome above search/bulk (e.g. column manager). */
  toolbar?: ReactNode;
  /** Rendered between toolbar/search and table (typically BulkActionBar). */
  bulkToolbar?: ReactNode;
  /** Wrap table in padding: 16. Default true. */
  padded?: boolean;
  /**
   * Enable Quản lý cột (ẩn/hiện, Lưu mới áp dụng).
   * Persistence key: `dny-crm-columns:{id}`. Nested/detail tables should omit this.
   */
  columnManagerKey?: string;
  remote?: {
    loaded: number;
    total: number;
    onLoadMore: () => void;
    loading?: boolean;
  };
}

const DEFAULT_PAGINATION: { pageSize: number; showSizeChanger: boolean } = {
  pageSize: 10,
  showSizeChanger: true,
};

function getColumnLabel<T>(col: TableColumn<T>, actionsLabel: string, columnLabel: string): string {
  if (typeof col.title === "string" && col.title.trim()) return col.title;
  const key = tableColumnKey(col);
  if (key === "avatar") return "Avatar";
  if (key === "action" || key === "actions") return actionsLabel;
  return key || columnLabel;
}

export function DataTable<T extends object>({
  rowKey,
  columns,
  dataSource,
  onRow,
  loading = false,
  size = "middle",
  pagination,
  scroll = { x: true },
  emptyDescription,
  emptyAction,
  enableRowSelection = false,
  selectedRowKeys,
  onSelectedRowKeysChange,
  rowSelection: rowSelectionProp,
  onChange,
  sortDirections,
  showSorterTooltip,
  search,
  dateFilterField,
  datePicker = "date",
  enableLocalSearch = false,
  toolbar,
  bulkToolbar,
  padded = true,
  columnManagerKey,
  remote,
}: DataTableProps<T>) {
  const t = useT();
  const [managerOpen, setManagerOpen] = useState(false);
  const [pageState, setPageState] = useState({ current: 1, pageSize: DEFAULT_PAGINATION.pageSize });
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);
  const [localQuery, setLocalQuery] = useState("");

  const managerItems: ColumnManagerItem[] = useMemo(
    () =>
      (columns as TableColumn<T>[])
        .map((col) => ({ key: tableColumnKey(col), label: getColumnLabel(col, t("common.actions"), t("common.column")) }))
        .filter((item) => item.key),
    [columns, t],
  );

  const { committed, save, isVisible } = useManagedColumns(columnManagerKey, managerItems);

  const visibleColumns = columnManagerKey
    ? (columns as TableColumn<T>[]).filter((col) => {
        const key = tableColumnKey(col);
        return !key || isVisible(key);
      })
    : columns;

  const rangedData = useMemo(() => {
    let rows = dataSource;
    if (dateFilterField) {
      rows = rows.filter((row) =>
        isInDateRange(getRecordDate(row, dateFilterField), dateRange, datePicker),
      );
    }
    const q = search?.value ?? (enableLocalSearch ? localQuery : "");
    if (q.trim()) {
      rows = rows.filter((row) => matchesTableQuery(q, [row]));
    }
    return rows;
  }, [dataSource, dateFilterField, dateRange, datePicker, search?.value, enableLocalSearch, localQuery]);

  const filteredColumns = useMemo(
    () => enhanceColumnsWithFilters(visibleColumns as TableColumnsType<T>, rangedData, t),
    [visibleColumns, rangedData, t],
  );

  useEffect(() => {
    if (pagination === false) return;
    const maxPage = Math.max(1, Math.ceil(rangedData.length / pageState.pageSize) || 1);
    if (pageState.current > maxPage) {
      setPageState((prev) => ({ ...prev, current: maxPage }));
    }
  }, [rangedData.length, pageState.pageSize, pageState.current, pagination]);

  const indexOffset =
    pagination === false ? 0 : (pageState.current - 1) * pageState.pageSize;
  const columnsWithIndex = useMemo(
    () => [tableIndexColumn<T>(indexOffset), ...(filteredColumns as TableColumn<T>[])],
    [filteredColumns, indexOffset],
  );
  const rowSelection: TableProps<T>["rowSelection"] =
    rowSelectionProp ??
    (enableRowSelection
      ? {
          selectedRowKeys,
          onChange: (keys) => onSelectedRowKeysChange?.(keys),
          preserveSelectedRowKeys: false,
        }
      : undefined);

  const resolvedPagination =
    pagination === false
      ? false
      : {
          ...DEFAULT_PAGINATION,
          ...(typeof pagination === "object" && pagination ? pagination : {}),
          current: pageState.current,
          pageSize: pageState.pageSize,
        };

  const handleTableChange: TableProps<T>["onChange"] = (pag, filters, sorter, extra) => {
    if (pagination !== false && pag) {
      setPageState({
        current: pag.current ?? 1,
        pageSize: pag.pageSize ?? pageState.pageSize,
      });
    }
    onChange?.(pag, filters, sorter, extra);
  };

  const table = (
    <Table<T>
      rowKey={rowKey}
      columns={columnsWithIndex}
      dataSource={rangedData}
      loading={loading}
      size={size}
      pagination={resolvedPagination}
      scroll={scroll}
      onRow={onRow}
      onChange={handleTableChange}
      sortDirections={sortDirections}
      showSorterTooltip={showSorterTooltip}
      rowSelection={rowSelection}
      locale={{
        emptyText: (
          <EmptyState compact description={emptyDescription ?? t("common.noData")} action={emptyAction} />
        ),
      }}
    />
  );

  const showFilterBar =
    Boolean(search) || enableLocalSearch || Boolean(dateFilterField) || Boolean(columnManagerKey);

  return (
    <>
      {toolbar}
      {showFilterBar ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px 0",
          }}
        >
          {search || enableLocalSearch ? (
            <Input.Search
              allowClear
              placeholder={search?.placeholder ?? t("common.search")}
              value={search?.value ?? localQuery}
              onChange={(e) => {
                if (search) search.onChange(e.target.value);
                else setLocalQuery(e.target.value);
              }}
              style={{ maxWidth: 320 }}
            />
          ) : null}
          {dateFilterField ? (
            <DatePicker.RangePicker
              picker={datePicker}
              allowEmpty={[true, true]}
              value={dateRange}
              onChange={(next) => {
                setDateRange(next);
                setPageState((prev) => ({ ...prev, current: 1 }));
              }}
              placeholder={[t("common.dateFrom"), t("common.dateTo")]}
            />
          ) : null}
          <div style={{ flex: 1 }} />
          {columnManagerKey ? <ColumnManagerButton onClick={() => setManagerOpen(true)} /> : null}
        </div>
      ) : null}
      {bulkToolbar}
      {padded ? <div style={{ padding: 16 }}>{table}</div> : table}
      {remote ? (
        <RemoteListStatus
          loaded={remote.loaded}
          total={remote.total}
          onLoadMore={remote.onLoadMore}
          loading={remote.loading}
        />
      ) : null}
      {columnManagerKey ? (
        <ColumnManagerDrawer
          open={managerOpen}
          onClose={() => setManagerOpen(false)}
          items={managerItems}
          value={committed}
          onSave={save}
        />
      ) : null}
    </>
  );
}
