"use client";

import { Alert, Select, Typography, type TableColumnsType } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useApiHydrate } from "@/components/api-hydrator";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { ds } from "@/lib/design-tokens";
import { lookupUserName, rememberUserName, resolveEntityLookups } from "@/lib/entity-lookups";
import { useExpenses } from "@/lib/expenses-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import { currentYearMonth, formatYearMonth } from "@/lib/order-cashflow";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { buildPayroll, collectPayrollMonths, getPayrollScope, type StaffPayroll } from "@/lib/payroll";
import { canLoadScope, isListSliceComplete, isListSliceSettled } from "@/lib/route-data-scopes";
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
  const { currentUser, getEffectivePermissions, users } = useUsers();
  const { user: apiUser } = useSession();
  const { orders } = useOrders();
  const { payments } = usePayments();
  const { expenses } = useExpenses();
  const { listMeta } = useApiHydrate();
  const [query, setQuery] = useState("");
  const [nameTick, setNameTick] = useState(0);
  const applyUrlQuery = useCallback((q: string) => setQuery(q), []);

  const perms = currentUser ? getEffectivePermissions(currentUser) : null;
  const scope = getPayrollScope(currentUser, perms, apiUser?.permissions);
  const lookupPerms = apiUser?.permissions;

  const month = isYearMonth(searchParams.get("month")) ? searchParams.get("month")! : currentYearMonth();

  useEffect(() => {
    if (scope === "self" && currentUser) {
      router.replace(`/payroll/${currentUser.id}?month=${month}`);
    }
  }, [scope, currentUser, month, router]);

  useEffect(() => {
    for (const u of users) {
      if (u.id && u.name) rememberUserName(u.id, u.name);
    }
    const ids = [...new Set(orders.map((o) => o.assignedUserId).filter(Boolean))];
    if (!ids.length) return;
    let cancelled = false;
    void resolveEntityLookups({ userIds: ids }, lookupPerms).then(() => {
      if (!cancelled) setNameTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [orders, users, lookupPerms]);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      if (u.id && u.name && u.name !== u.id) map.set(u.id, u.name);
    }
    for (const o of orders) {
      const looked = lookupUserName(o.assignedUserId);
      if (looked && looked !== o.assignedUserId) map.set(o.assignedUserId, looked);
      else if (o.assignedUserName && o.assignedUserName !== o.assignedUserId) {
        map.set(o.assignedUserId, o.assignedUserName);
      }
    }
    return map;
    // nameTick re-reads lookup cache after resolveEntityLookups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, orders, nameTick]);

  const months = useMemo(
    () => collectPayrollMonths(orders, payments, expenses, [currentYearMonth(), month]),
    [orders, payments, expenses, month],
  );

  const rows = useMemo(
    () => buildPayroll(orders, payments, expenses, month, staffNameById),
    [orders, payments, expenses, month, staffNameById],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    return rows.filter((r) =>
      matchesTableQuery(query, [r.userName, r.orderCount, r.total, ...r.lines.map((l) => l.orderNumber)]),
    );
  }, [rows, query]);

  const grandTotal = useMemo(() => filtered.reduce((sum, r) => sum + r.total, 0), [filtered]);

  const apiPerms = apiUser?.permissions;
  const scopeDone = (scope: "orders" | "payments" | "expenses") =>
    !canLoadScope(scope, apiPerms) || isListSliceComplete(listMeta[scope]);
  const figuresReady =
    isListSliceSettled(listMeta.orders, canLoadScope("orders", apiPerms)) &&
    isListSliceSettled(listMeta.payments, canLoadScope("payments", apiPerms)) &&
    isListSliceSettled(listMeta.expenses, canLoadScope("expenses", apiPerms));
  const hitCap = figuresReady && !(scopeDone("orders") && scopeDone("payments") && scopeDone("expenses"));

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
        render: (name: string, row) => (name && name !== row.userId ? name : "—"),
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
      {!figuresReady ? (
        <PageLoading />
      ) : (
        <>
          {hitCap ? (
            <div style={{ padding: "0 16px 12px" }}>
              <Alert type="warning" showIcon message={t("payroll.capReached")} />
            </div>
          ) : null}
          <DataTable<StaffPayroll>
            rowKey="userId"
            columns={columns}
            dataSource={filtered}
            columnManagerKey="payroll"
            onRow={(record) => ({
              onClick: () => router.push(`/payroll/${record.userId}?month=${month}`),
              style: { cursor: "pointer" },
            })}
            emptyDescription={query.trim() && rows.length > 0 ? t("common.noResults") : t("payroll.empty")}
          />
          {filtered.length > 0 ? (
            <div style={{ padding: "0 16px 16px", textAlign: "right", fontWeight: 600 }}>
              {t("payroll.total")}: <MoneyCell value={grandTotal} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
