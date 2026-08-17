const HTML_TAG = /<[a-z][\s\S]*>/i;

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Wrap plain text; pass through HTML so iframe srcDoc can render it. */
export function toEmailPreviewHtml(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (HTML_TAG.test(trimmed)) return trimmed;
  return `<pre style="margin:0;font-family:inherit;font-size:14px;white-space:pre-wrap;word-break:break-word">${escapeHtml(trimmed)}</pre>`;
}

export function isHtmlFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".html") || name.endsWith(".htm") || file.type === "text/html";
}
