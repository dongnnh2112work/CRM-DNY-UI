import type { Buffer as ExcelBuffer } from "exceljs";

export type SheetRow = Record<string, string | number | boolean | null | undefined>;

async function createWorkbook() {
  const excel = await import("exceljs");
  return new excel.Workbook();
}

function cellText(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") {
    const record = value as { text?: unknown; result?: unknown; richText?: { text?: string }[] };
    if (typeof record.text === "string") return record.text;
    if (record.result != null && (typeof record.result === "string" || typeof record.result === "number")) return record.result;
    if (Array.isArray(record.richText)) return record.richText.map((part) => part.text ?? "").join("");
  }
  return String(value);
}

export function isLegacyXls(name: string, bytes?: Uint8Array): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xls") && !lower.endsWith(".xlsx")) return true;
  if (bytes && bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return true;
  }
  return false;
}

export function parseCsv(text: string): Record<string, string>[] {
  const source = text.replace(/^\uFEFF/, "");
  const lines = source.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

export async function rowsToXlsxBuffer(rows: SheetRow[]): Promise<ExcelBuffer> {
  const book = await createWorkbook();
  const sheet = book.addWorksheet("Data");
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    sheet.addRow(keys);
    for (const row of rows) sheet.addRow(keys.map((key) => row[key] ?? ""));
  }
  return book.xlsx.writeBuffer();
}

export async function rowsFromXlsx(data: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const book = await createWorkbook();
  await book.xlsx.load(data as unknown as ExcelBuffer);
  const sheet = book.worksheets[0];
  if (!sheet) return [];
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cellText(cell.value)).trim();
  });
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    let any = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = cellText(row.getCell(index + 1).value);
      if (value !== "") any = true;
      record[header] = value;
    });
    if (any) rows.push(record);
  });
  return rows;
}

/** Export rows to an .xlsx file and trigger download. */
export async function exportRowsToXlsx(filename: string, rows: SheetRow[]) {
  if (rows.length === 0) return;
  const buffer = await rowsToXlsxBuffer(rows);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
