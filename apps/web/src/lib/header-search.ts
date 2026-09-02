export type HeaderSearchTarget = {
  placeholder: string;
  /** List path to apply `?q=`. Null when the current page has no searchable list. */
  listPath: string | null;
};

const MODULES: { prefix: string; listPath: string; placeholder: string }[] = [
  { prefix: "/orders", listPath: "/orders", placeholder: "Tìm đơn hàng…" },
  { prefix: "/customers", listPath: "/customers", placeholder: "Tìm khách hàng…" },
  { prefix: "/payments", listPath: "/payments", placeholder: "Tìm thanh toán…" },
  { prefix: "/expense-approvals", listPath: "/expense-approvals", placeholder: "Tìm đề nghị thanh toán…" },
  { prefix: "/vat", listPath: "/vat", placeholder: "Tìm hóa đơn VAT…" },
  { prefix: "/services", listPath: "/services", placeholder: "Tìm dịch vụ…" },
  { prefix: "/emails", listPath: "/emails", placeholder: "Tìm email…" },
  { prefix: "/users", listPath: "/users", placeholder: "Tìm người dùng…" },
];

export function getHeaderSearchTarget(pathname: string): HeaderSearchTarget {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return { placeholder: "Tìm khách hàng…", listPath: "/customers" };
  }
  const hit = MODULES.filter(
    (m) => pathname === m.prefix || pathname.startsWith(`${m.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (hit) return { placeholder: hit.placeholder, listPath: hit.listPath };
  return { placeholder: "Tìm kiếm…", listPath: null };
}

export function listSearchHref(listPath: string, query: string) {
  const q = query.trim();
  if (!q) return listPath;
  return `${listPath}?q=${encodeURIComponent(q)}`;
}
