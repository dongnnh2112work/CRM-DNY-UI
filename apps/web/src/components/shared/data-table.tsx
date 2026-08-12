"use client";

import { Input, Table, type TableColumnsType, type TableProps } from "antd";
import type { Key, ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";

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
}

const DEFAULT_PAGINATION = { pageSize: 10, showSizeChanger: true } as const;

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
}: DataTableProps<T>) {
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
        };

  const table = (
    <Table<T>
      rowKey={rowKey}
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      size={size}
      pagination={resolvedPagination}
      scroll={scroll}
      onRow={onRow}
      onChange={onChange}
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
    </>
  );
}
