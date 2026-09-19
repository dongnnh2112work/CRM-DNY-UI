"use client";

import {
  DollarOutlined,
  ProjectOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Skeleton, Space, Typography, theme } from "antd";
import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useCustomers } from "@/lib/customers-store";
import { buildPaidRevenueByMonth } from "@/lib/dashboard-metrics";
import { ds } from "@/lib/design-tokens";
import { useExpenses } from "@/lib/expenses-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import { currentYearMonth } from "@/lib/order-cashflow";
import { useOrders } from "@/lib/orders-store";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { usePayments } from "@/lib/payments-store";
import { buildPayroll, getPayrollScope } from "@/lib/payroll";
import { useT } from "@/lib/use-t";
import { ORDER_STAGE_CHART_COLORS, type Order } from "@/lib/types";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { useApiHydrate } from "@/components/api-hydrator";

/** Compact tick labels for chart axes only (not list/table display). */
function formatVndAxisTick(value: number) {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

/** Đồng bộ với cấu hình giai đoạn trên Quản lý đơn hàng */
function buildOrderStatusChart(
  orders: Order[],
  stageOptions: { value: string; label: string; color: string }[],
) {
  const counts = orders.reduce(
    (acc, order) => {
      acc[order.stage] = (acc[order.stage] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return stageOptions
    .map((stage) => ({
      key: stage.value,
      name: stage.label,
      value: counts[stage.value] ?? 0,
      color: stage.color.startsWith("#")
        ? stage.color
        : (ORDER_STAGE_CHART_COLORS[stage.value] ?? ds.inkFaint),
    }))
    .filter((item) => item.value > 0);
}

export default function DashboardPage() {
  const t = useT();
  const { token } = theme.useToken();
  const { currentUser, getEffectivePermissions } = useUsers();
  const { user: apiUser } = useSession();
  const { orders } = useOrders();
  const { payments } = usePayments();
  const { expenses } = useExpenses();
  const { customers } = useCustomers();
  const { listMeta } = useApiHydrate();
  const { stageOptions } = useOrderStatusConfig();
  const statsReady = Boolean(listMeta.orders && listMeta.customers && listMeta.payments);
  const recentOrders = orders.slice(0, 5);
  const upcomingPayments = payments.filter((p) => p.status !== "paid").slice(0, 5);
  const orderStatusData = buildOrderStatusChart(orders, stageOptions);
  const totalOrders = listMeta.orders?.total ?? orders.length;
  const totalCustomers = listMeta.customers?.total ?? customers.length;
  const revenueByMonth = useMemo(() => buildPaidRevenueByMonth(payments), [payments]);
  const thisMonthKey = currentYearMonth();
  const revenueThisMonth = revenueByMonth.find((item) => item.month === thisMonthKey)?.value ?? 0;
  const payrollScope = getPayrollScope(
    currentUser,
    currentUser ? getEffectivePermissions(currentUser) : null,
    apiUser?.permissions,
  );
  const payrollThisMonth = useMemo(() => {
    if (payrollScope === "none") return 0;
    const rows = buildPayroll(orders, payments, expenses, currentYearMonth());
    const visible =
      payrollScope === "self" && currentUser
        ? rows.filter((s) => s.userId === currentUser.id)
        : rows;
    return visible.reduce((sum, s) => sum + s.total, 0);
  }, [orders, payments, expenses, payrollScope, currentUser]);

  const revenueData = useMemo(
    () =>
      revenueByMonth.map((item) => {
        const [, m] = item.month.split("-");
        const n = Number(m);
        return {
          ...item,
          label: Number.isFinite(n) ? t("common.monthShort", { n }) : item.month,
        };
      }),
    [t, revenueByMonth],
  );

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("nav.dashboard") }]} />
      <div style={{ padding: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            {statsReady ? (
              <StatCard
                title={t("dash.revenueMonth")}
                value={revenueThisMonth}
                prefix={<DollarOutlined />}
                suffix="₫"
              />
            ) : (
              <Card size="small" styles={{ body: { padding: 16 } }}>
                <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1 }} />
              </Card>
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {statsReady ? (
              <StatCard title={t("dash.totalOrders")} value={totalOrders} prefix={<ProjectOutlined />} />
            ) : (
              <Card size="small" styles={{ body: { padding: 16 } }}>
                <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1 }} />
              </Card>
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {statsReady ? (
              <StatCard title={t("dash.totalCustomers")} value={totalCustomers} prefix={<TeamOutlined />} />
            ) : (
              <Card size="small" styles={{ body: { padding: 16 } }}>
                <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1 }} />
              </Card>
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {statsReady ? (
              payrollScope === "none" ? (
                <StatCard
                  title={t("dash.commissionPaid")}
                  value={payrollThisMonth}
                  prefix={<TrophyOutlined />}
                  suffix="₫"
                />
              ) : (
                <Link href="/payroll" style={{ color: "inherit", display: "block" }}>
                  <StatCard
                    title={payrollScope === "self" ? t("dash.myPayroll") : t("dash.commissionPaid")}
                    value={payrollThisMonth}
                    prefix={<TrophyOutlined />}
                    suffix="₫"
                  />
                </Link>
              )
            ) : (
              <Card size="small" styles={{ body: { padding: 16 } }}>
                <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1 }} />
              </Card>
            )}
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title={t("dash.revenueByMonth")} size="small">
              <div style={{ width: "100%", height: 280 }}>
                {statsReady ? (
                  <ResponsiveContainer>
                    <BarChart data={revenueData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} />
                      <YAxis
                        tickFormatter={formatVndAxisTick}
                        tickLine={false}
                        width={56}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={false}
                        formatter={(value) => [formatVndDisplay(Number(value)), t("dash.revenue")]}
                        labelFormatter={(label) => t("common.monthLabel", { label: String(label) })}
                        contentStyle={{
                          background: token.colorBgElevated,
                          border: `1px solid ${token.colorBorder}`,
                          borderRadius: 8,
                          color: token.colorText,
                          boxShadow: token.boxShadowSecondary,
                        }}
                        labelStyle={{ color: token.colorTextSecondary }}
                        itemStyle={{ color: token.colorText }}
                      />
                      <Bar dataKey="value" fill="#0075de" radius={[8, 8, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton active paragraph={{ rows: 8 }} title={false} style={{ padding: 16 }} />
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title={t("dash.ordersByStatus")} size="small">
              <div style={{ width: "100%", height: 280 }}>
                {statsReady ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="46%"
                        innerRadius={58}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {orderStatusData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0];
                          const status = String(item.name ?? "");
                          const count = item.value;
                          return (
                            <div
                              style={{
                                background: token.colorBgElevated,
                                border: `1px solid ${token.colorBorder}`,
                                borderRadius: 8,
                                padding: "8px 12px",
                                fontSize: ds.fontSize.caption,
                                color: token.colorText,
                                boxShadow: token.boxShadowSecondary,
                              }}
                            >
                              <span style={{ color: item.payload?.fill ?? item.color }}>
                                {t("dash.orderCount", { status, count: String(count) })}
                              </span>
                            </div>
                          );
                        }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton active paragraph={{ rows: 8 }} title={false} style={{ padding: 16 }} />
                )}
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title={t("dash.recentOrders")}
              size="small"
              extra={<Link href="/orders">{t("common.viewAll")}</Link>}
            >
              {statsReady ? (
                <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                  {recentOrders.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div>
                        <Link href={`/orders/${o.id}`}>{o.orderNumber}</Link>
                        <div style={{ fontSize: ds.fontSize.caption, color: token.colorTextSecondary }}>
                          {o.customerName} · {o.serviceName}
                        </div>
                      </div>
                      <Typography.Text>{formatVndDisplay(o.value)}</Typography.Text>
                    </div>
                  ))}
                </Space>
              ) : (
                <Skeleton active paragraph={{ rows: 4 }} title={false} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={t("dash.upcomingPayments")}
              size="small"
              extra={<Link href="/payments">{t("common.viewAll")}</Link>}
            >
              {statsReady ? (
                <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                  {upcomingPayments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div>
                        <Link href={`/payments/${p.id}`}>{p.orderNumber}</Link>
                        <div style={{ fontSize: ds.fontSize.caption, color: token.colorTextSecondary }}>
                          {p.customerName} · {t("dash.remaining", { amount: formatVndDisplay(p.remaining) })}
                        </div>
                      </div>
                      <StatusBadge module="payment" status={p.status} />
                    </div>
                  ))}
                </Space>
              ) : (
                <Skeleton active paragraph={{ rows: 4 }} title={false} />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
}
