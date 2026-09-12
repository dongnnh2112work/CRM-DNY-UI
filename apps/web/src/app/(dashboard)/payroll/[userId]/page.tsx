"use client";

import { Button, Select, Typography, type TableColumnsType } from "antd";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { ds } from "@/lib/design-tokens";
import { useExpenses } from "@/lib/expenses-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import { currentYearMonth, formatYearMonth } from "@/lib/order-cashflow";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { buildPayroll, collectPayrollMonths, getPayrollScope, type PayrollLine } from "@/lib/payroll";
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

export default function PayrollStaffPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PayrollStaffPageContent />
    </Suspense>
  );
}

function PayrollStaffPageContent() {
  const t = useT();
  const router = useRouter();
  const { userId } = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const { currentUser, getEffectivePermissions, getById } = useUsers();
  const { user: apiUser } = useSession();
  const { orders } = useOrders();
  const { payments } = usePayments();
  const { expenses } = useExpenses();

  const perms = currentUser ? getEffectivePermissions(currentUser) : null;
  const scope = getPayrollScope(currentUser, perms, apiUser?.permissions);

  const month = isYearMonth(searchParams.get("month")) ? searchParams.get("month")! : currentYearMonth();

  const months = useMemo(
    () => collectPayrollMonths(orders, payments, expenses, [currentYearMonth(), month]),
    [orders, payments, expenses, month],
  );

  const payroll = useMemo(
    () => buildPayroll(orders, payments, expenses, month),
    [orders, payments, expenses, month],
  );

  const staffRow = payroll.find((s) => s.userId === userId);
  const user = getById(userId);
  const staffName = staffRow?.userName ?? user?.name;
  const lines = staffRow?.lines ?? [];
  const total = staffRow?.total ?? 0;
  const listHref = `/payroll?month=${month}`;

  const setMonth = (next: string) => {
    router.replace(`/payroll/${userId}?month=${next}`);
  };

  const columns: TableColumnsType<PayrollLine> = useMemo(
    () => [
      {
        title: t("common.dossier"),
        dataIndex: "orderNumber",
        sorter: (a, b) => a.orderNumber.localeCompare(b.orderNumber, "vi"),
        render: (v: string, r) => <Link href={`/orders/${r.orderId}`}>{v}</Link>,
      },
      {
        title: t("common.customer"),
        dataIndex: "customerName",
        sorter: (a, b) => a.customerName.localeCompare(b.customerName, "vi"),
      },
      {
        title: t("common.service"),
        dataIndex: "serviceName",
        ellipsis: true,
      },
      {
        title: t("payroll.thu"),
        dataIndex: "thu",
        align: "right",
        sorter: (a, b) => a.thu - b.thu,
        render: (v: number) => <MoneyCell value={v} />,
      },
      {
        title: t("payroll.chi"),
        dataIndex: "chi",
        align: "right",
        sorter: (a, b) => a.chi - b.chi,
        render: (v: number) => <MoneyCell value={v} />,
      },
      {
        title: t("payroll.net"),
        dataIndex: "net",
        align: "right",
        sorter: (a, b) => a.net - b.net,
        render: (v: number) => <MoneyCell value={v} />,
      },
      {
        title: t("order.commissionPercent"),
        dataIndex: "commissionPercent",
        align: "center",
        sorter: (a, b) => a.commissionPercent - b.commissionPercent,
        render: (v: number) => `${v}%`,
      },
      {
        title: t("payroll.salary"),
        dataIndex: "salary",
        align: "right",
        sorter: (a, b) => a.salary - b.salary,
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

  if (scope === "self" && currentUser.id !== userId) {
    return (
      <EmptyState
        description={t("payroll.forbiddenOther")}
        action={{ label: t("payroll.myPay"), href: `/payroll/${currentUser.id}?month=${month}` }}
      />
    );
  }

  const isOwn = Boolean(currentUser && currentUser.id === userId);
  const showCompanyList = scope === "all";

  if (!staffName) {
    return (
      <EmptyState
        description={t("payroll.notFoundStaff")}
        action={
          showCompanyList
            ? { label: t("common.back"), href: listHref }
            : { label: t("nav.dashboard"), href: "/dashboard" }
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          showCompanyList
            ? [
                { title: t("nav.payroll"), href: listHref },
                { title: t("payroll.detailTitle", { name: staffName }) },
              ]
            : [{ title: isOwn ? t("payroll.myPay") : t("payroll.detailTitle", { name: staffName }) }]
        }
      >
        <Select
          value={month}
          style={{ width: 160 }}
          onChange={setMonth}
          options={months.map((m) => ({ value: m, label: formatYearMonth(m) }))}
          aria-label={t("common.month")}
        />
        {showCompanyList ? (
          <Button onClick={() => router.push(listHref)}>{t("common.back")}</Button>
        ) : null}
      </PageHeader>
      <DataTable<PayrollLine>
        rowKey="orderId"
        columns={columns}
        dataSource={lines}
        columnManagerKey="payroll-detail"
        enableLocalSearch
        emptyDescription={t("payroll.emptyStaff")}
      />
      {lines.length > 0 ? (
        <div style={{ padding: "0 16px 16px", textAlign: "right", fontWeight: 600 }}>
          {t("payroll.total")}: <MoneyCell value={total} />
        </div>
      ) : (
        <div style={{ padding: "0 16px 16px" }}>
          <Typography.Text type="secondary">{t("payroll.formula")}</Typography.Text>
        </div>
      )}
    </>
  );
}
