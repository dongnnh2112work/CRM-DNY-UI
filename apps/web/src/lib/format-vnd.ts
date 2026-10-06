/** Format số tiền VND khi nhập: 20000000 → 20.000.000 */

export function formatVndGrouped(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseVndGrouped(display: string | undefined): string {
  return (display ?? "").replace(/\./g, "");
}

/** Props dùng chung cho Ant Design InputNumber tiền VND */
export const vndInputProps = {
  min: 0 as const,
  style: { width: "100%" as const },
  formatter: (value: string | number | undefined) => formatVndGrouped(value),
  parser: (value: string | undefined) => parseVndGrouped(value) as unknown as number,
};

/** Hiển thị tiền trong bảng / mô tả — VND luôn làm tròn số nguyên. */
export function formatVndDisplay(value: number): string {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 0 })} ₫`;
}
