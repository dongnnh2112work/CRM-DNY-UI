"use client";

import { Input, Table, type TableColumnsType, type TableProps } from "antd";
import { useEffect, useMemo, useState, type Key, type ReactNode } from "react";
import {
  ColumnManagerButton,
  ColumnManagerDrawer,
  useManagedColumns,
  type ColumnManagerItem,
} from "@/components/shared/column-manager-drawer";
import { EmptyState } from "@/components/shared/empty-state";
import { tableIndexColumn, tableColumnKey, type TableColumn } from "@/lib/table-index-column";

export type DataTableEmptyAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

/**
 * Shared list-table chrome around Ant Design Table.
 *
 * - Search: prefer PageHeader; optional `search` renders Input.Search above the table.
 * - Sort / filter: declare on each column (`sorter`, `filters`); `onChange` is forwarded.
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
}

const DEFAULT_PAGINATION: { pageSize: number; showSizeChanger: boolean } = {
  pageSize: 10,
  showSizeChanger: true,
};

function getColumnLabel<T>(col: TableColumn<T>): string {
  if (typeof col.title === "string" && col.title.trim()) return col.title;
  const key = tableColumnKey(col);
  if (key === "avatar") return "Avatar";
  if (key === "action" || key === "actions") return "Thao tác";
  return key || "Cột";
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
  emptyDescription = "Chưa có dữ liệu.",
  emptyAction,
  enableRowSelection = false,
  selectedRowKeys,
  onSelectedRowKeysChange,
  rowSelection: rowSelectionProp,
  onChange,
  sortDirections,
  showSorterTooltip,
  search,
  toolbar,
  bulkToolbar,
  padded = true,
  columnManagerKey,
}: DataTableProps<T>) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [pageState, setPageState] = useState({ current: 1, pageSize: DEFAULT_PAGINATION.pageSize });

  const managerItems: ColumnManagerItem[] = useMemo(
    () =>
      (columns as TableColumn<T>[])
        .map((col) => ({ key: tableColumnKey(col), label: getColumnLabel(col) }))
        .filter((item) => item.key),
    [columns],
  );

  const { committed, save, isVisible } = useManagedColumns(columnManagerKey, managerItems);

  const visibleColumns = columnManagerKey
    ? (columns as TableColumn<T>[]).filter((col) => {
        const key = tableColumnKey(col);
        return !key || isVisible(key);
      })
    : columns;

  useEffect(() => {
    if (pagination === false) return;
    const maxPage = Math.max(1, Math.ceil(dataSource.length / pageState.pageSize) || 1);
    if (pageState.current > maxPage) {
      setPageState((prev) => ({ ...prev, current: maxPage }));
    }
  }, [dataSource.length, pageState.pageSize, pageState.current, pagination]);

  const indexOffset =
    pagination === false ? 0 : (pageState.current - 1) * pageState.pageSize;
  const columnsWithIndex = useMemo(
    () => [tableIndexColumn<T>(indexOffset), ...(visibleColumns as TableColumn<T>[])],
    [visibleColumns, indexOffset],
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
      dataSource={dataSource}
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
          <EmptyState compact description={emptyDescription} action={emptyAction} />
        ),
      }}
    />
  );

  return (
    <>
      {toolbar}
      {columnManagerKey ? (
        <ColumnManagerButton onClick={() => setManagerOpen(true)} />
      ) : null}
      {search ? (
        <div style={{ padding: "8px 16px 0" }}>
          <Input.Search
            allowClear
            placeholder={search.placeholder ?? "Tìm kiếm…"}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>
      ) : null}
      {bulkToolbar}
      {padded ? <div style={{ padding: 16 }}>{table}</div> : table}
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
