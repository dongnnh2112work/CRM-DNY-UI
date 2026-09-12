"use client";

import { Select, Typography, type TableColumnsType } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { ds } from "@/lib/design-tokens";
import { useExpenses } from "@/lib/expenses-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import { currentYearMonth, formatYearMonth } from "@/lib/order-cashflow";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { buildPayroll, collectPayrollMonths, getPayrollScope, type StaffPayroll } from "@/lib/payroll";
import { matchesTableQuery } from "@/lib/table-search";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { useT } from "@/lib/use-t";

function isYearMonth(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}$/.test(v);
}

function MoneyCell({ value }: { value: number }) {
  return (
    <span style={value < 0 ? { color: ds.danger, fontWeight: 600 } : undefined}>
      {formatVndDisplay(value)}
    </span>
  );
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PayrollPageContent />
    </Suspense>
  );
}

function PayrollPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, getEffectivePermissions } = useUsers();
  const { user: apiUser } = useSession();
  const { orders } = useOrders();
  const { payments } = usePayments();
  const { expenses } = useExpenses();
  const [query, setQuery] = useState("");
  const applyUrlQuery = useCallback((q: string) => setQuery(q), []);

  const perms = currentUser ? getEffectivePermissions(currentUser) : null;
  const scope = getPayrollScope(currentUser, perms, apiUser?.permissions);

  const month = isYearMonth(searchParams.get("month")) ? searchParams.get("month")! : currentYearMonth();

  useEffect(() => {
    if (scope === "self" && currentUser) {
      router.replace(`/payroll/${currentUser.id}?month=${month}`);
    }
  }, [scope, currentUser, month, router]);

  const months = useMemo(
    () => collectPayrollMonths(orders, payments, expenses, [currentYearMonth(), month]),
    [orders, payments, expenses, month],
  );

  const rows = useMemo(
    () => buildPayroll(orders, payments, expenses, month),
    [orders, payments, expenses, month],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    return rows.filter((r) =>
      matchesTableQuery(query, [r.userName, r.orderCount, r.total, ...r.lines.map((l) => l.orderNumber)]),
    );
  }, [rows, query]);

  const grandTotal = useMemo(() => filtered.reduce((sum, r) => sum + r.total, 0), [filtered]);

  const setMonth = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`/payroll?${params.toString()}`);
  };

  const columns: TableColumnsType<StaffPayroll> = useMemo(
    () => [
      {
        title: t("payroll.staff"),
        dataIndex: "userName",
        sorter: (a, b) => a.userName.localeCompare(b.userName, "vi"),
      },
      {
        title: t("payroll.orderCount"),
        dataIndex: "orderCount",
        align: "center",
        sorter: (a, b) => a.orderCount - b.orderCount,
      },
      {
        title: t("payroll.total"),
        dataIndex: "total",
        align: "right",
        sorter: (a, b) => a.total - b.total,
        render: (v: number) => <MoneyCell value={v} />,
      },
    ],
    [t],
  );

  if (scope === "none" || !currentUser) {
    return (
      <EmptyState
        description={t("payroll.forbidden")}
        action={{ label: t("nav.users"), href: "/users" }}
      />
    );
  }

  if (scope === "self") {
    return <PageLoading />;
  }

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: t("nav.payroll") }]}
        searchPlaceholder={t("shell.searchPayroll")}
        onSearch={setQuery}
        searchValue={query}
      >
        <Select
          value={month}
          style={{ width: 160 }}
          onChange={setMonth}
          options={months.map((m) => ({ value: m, label: formatYearMonth(m) }))}
          aria-label={t("common.month")}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t("payroll.formula")}
        </Typography.Text>
      </PageHeader>
      <DataTable<StaffPayroll>
        rowKey="userId"
        columns={columns}
        dataSource={filtered}
        columnManagerKey="payroll"
        onRow={(record) => ({
          onClick: () => router.push(`/payroll/${record.userId}?month=${month}`),
          style: { cursor: "pointer" },
        })}
        emptyDescription={
          query.trim() && rows.length > 0 ? t("common.noResults") : t("payroll.empty")
        }
      />
      {filtered.length > 0 ? (
        <div style={{ padding: "0 16px 16px", textAlign: "right", fontWeight: 600 }}>
          {t("payroll.total")}: <MoneyCell value={grandTotal} />
        </div>
      ) : null}
    </>
  );
}
