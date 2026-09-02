import type { TableColumnsType } from "antd";
import { tt } from "@/lib/i18n";

export const INDEX_COLUMN_KEY = "__stt";

export type TableColumn<T> = TableColumnsType<T>[number];

export function tableColumnKey<T>(col: TableColumn<T>): string {
  if (col.key != null && col.key !== "") return String(col.key);
  if ("dataIndex" in col && col.dataIndex != null) {
    return Array.isArray(col.dataIndex) ? col.dataIndex.join(".") : String(col.dataIndex);
  }
  return "";
}

/** Cột số thứ tự — không đưa vào Quản lý cột. */
export function tableIndexColumn<T extends object>(offset = 0): TableColumn<T> {
  return {
    title: tt("common.stt"),
    key: INDEX_COLUMN_KEY,
    width: 64,
    align: "center",
    render: (_value, _record, index) => offset + index + 1,
  };
}
