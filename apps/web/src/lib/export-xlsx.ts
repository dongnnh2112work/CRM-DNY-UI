/** Export rows to an .xlsx file and trigger download. */
export async function exportRowsToXlsx(
  filename: string,
  rows: Record<string, string | number | boolean | null | undefined>[],
) {
  if (rows.length === 0) return;
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Data");
  XLSX.writeFile(book, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
