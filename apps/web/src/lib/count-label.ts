/** English “1 file” versus “{count} files”. Other locales can pass the same string twice. */
export function countLabel(count: number, one: string, many: string): string {
  if (count === 1) return one;
  return many.replaceAll("{count}", String(count));
}
