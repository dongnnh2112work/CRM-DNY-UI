import type { TableColumnsType } from "antd";

export const INDEX_COLUMN_KEY = "__stt";

export type TableColumn<T> = TableColumnsType<T>[number];

/** Cột số thứ tự — không đưa vào Quản lý cột. */
export function tableIndexColumn<T extends object>(offset = 0): TableColumn<T> {
  return {
    title: "STT",
    key: INDEX_COLUMN_KEY,
    width: 64,
    align: "center",
    render: (_value, _record, index) => offset + index + 1,
  };
}
