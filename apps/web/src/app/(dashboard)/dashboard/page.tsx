"use client";

import {
  DollarOutlined,
  ProjectOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Card, Col, Empty, Row, Skeleton, Space, Typography, theme } from "antd";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { useApiHydrate } from "@/components/api-hydrator";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useCustomers } from "@/lib/customers-store";
import { buildPaidRevenueByMonth } from "@/lib/dashboard-metrics";
import { ds } from "@/lib/design-tokens";
import { formatVndDisplay } from "@/lib/format-vnd";
import { currentYearMonth } from "@/lib/order-cashflow";
import { looksLikeUuid } from "@/lib/order-helpers";
import { useOrders } from "@/lib/orders-store";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { usePayments } from "@/lib/payments-store";
import { getPayrollScope } from "@/lib/payroll";
import { useSession } from "@/lib/session/session-provider";
import { ORDER_STAGE_CHART_COLORS, type Order } from "@/lib/types";
import { useT } from "@/lib/use-t";
import { useUsers } from "@/lib/users-store";

const DashboardCharts = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.DashboardCharts),
  {
    ssr: false,
    loading: () => (
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card size="small" className="crm-dash-card">
            <Skeleton active paragraph={{ rows: 8 }} title={false} style={{ padding: 16 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card size="small" className="crm-dash-card">
            <Skeleton active paragraph={{ rows: 8 }} title={false} style={{ padding: 16 }} />
          </Card>
        </Col>
      </Row>
    ),
  },
);

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

  const known = new Set(stageOptions.map((s) => s.value));
  const fromConfig = stageOptions
    .map((stage) => ({
      key: stage.value,
      name: stage.label,
      value: counts[stage.value] ?? 0,
      color: stage.color.startsWith("#")
        ? stage.color
        : (ORDER_STAGE_CHART_COLORS[stage.value] ?? ds.inkFaint),
    }))
    .filter((item) => item.value > 0);

  const orphans = Object.entries(counts)
    .filter(([key]) => !known.has(key))
    .map(([key, value]) => ({
      key,
      name: key,
      value,
      color: ORDER_STAGE_CHART_COLORS[key] ?? ds.inkFaint,
    }));

  return [...fromConfig, ...orphans];
}

export default function DashboardPage() {
  const t = useT();
  const { token } = theme.useToken();
  const { currentUser, getEffectivePermissions } = useUsers();
  const { user: apiUser } = useSession();
  const { orders } = useOrders();
  const { payments } = usePayments();
  const { customers } = useCustomers();
  const { listMeta, refreshing, dataFresh } = useApiHydrate();
  const { stageOptions } = useOrderStatusConfig();

  const countsReady = Boolean(listMeta.orders && listMeta.customers && listMeta.payments);
  const sliceComplete = (meta?: { total: number; loaded: number; page: number; pageSize: number }) => {
    if (!meta) return false;
    if (meta.total === 0) return true;
    return meta.loaded >= meta.total || meta.page * meta.pageSize >= meta.total;
  };
  /** Only compute revenue/charts when the in-memory slice covers every row (or total is 0). */
  const aggregatesReady = sliceComplete(listMeta.orders) && sliceComplete(listMeta.payments);
  const previewReady =
    (listMeta.orders != null || listMeta.payments != null) && !refreshing;
  const recentOrders = orders.slice(0, 5);
  const upcomingPayments = payments.filter((p) => p.status !== "paid").slice(0, 5);
  const orderStatusData = aggregatesReady ? buildOrderStatusChart(orders, stageOptions) : [];
  const totalOrders = listMeta.orders?.total ?? 0;
  const totalCustomers = listMeta.customers?.total ?? 0;
  const revenueByMonth = useMemo(
    () => (aggregatesReady ? buildPaidRevenueByMonth(payments) : []),
    [payments, aggregatesReady],
  );
  const thisMonthKey = currentYearMonth();
  const revenueThisMonth = revenueByMonth.find((item) => item.month === thisMonthKey)?.value ?? 0;
  const payrollScope = getPayrollScope(
    currentUser,
    currentUser ? getEffectivePermissions(currentUser) : null,
    apiUser?.permissions,
  );

  const displayName = (value?: string) => {
    const text = value?.trim();
    if (!text || looksLikeUuid(text)) return "—";
    return text;
  };

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

  const showStaleLoading = !dataFresh && refreshing;

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("nav.dashboard") }]} />
      <div style={{ padding: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            {aggregatesReady ? (
              <StatCard
                title={t("dash.revenueMonth")}
                value={revenueThisMonth}
                prefix={<DollarOutlined />}
                suffix="₫"
                accent={ds.primary}
              />
            ) : showStaleLoading || !countsReady ? (
              <Card size="small" className="crm-dash-card" styles={{ body: { padding: 16 } }}>
                <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1 }} />
              </Card>
            ) : (
              <Card size="small" className="crm-dash-card" styles={{ body: { padding: 16 } }}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {t("dash.summaryNeeded")}
                </Typography.Text>
              </Card>
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {countsReady ? (
              <StatCard
                title={t("dash.totalOrders")}
                value={totalOrders}
                prefix={<ProjectOutlined />}
                accent={ds.accentTeal}
              />
            ) : (
              <Card size="small" className="crm-dash-card" styles={{ body: { padding: 16 } }}>
                <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1 }} />
              </Card>
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {countsReady ? (
              <StatCard
                title={t("dash.totalCustomers")}
                value={totalCustomers}
                prefix={<TeamOutlined />}
                accent={ds.secondary}
              />
            ) : (
              <Card size="small" className="crm-dash-card" styles={{ body: { padding: 16 } }}>
                <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1 }} />
              </Card>
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {payrollScope === "none" ? (
              <Card size="small" className="crm-dash-card" styles={{ body: { padding: 16 } }}>
                <Typography.Text type="secondary">{t("dash.payrollNoAccess")}</Typography.Text>
              </Card>
            ) : (
              <Link href="/payroll" style={{ color: "inherit", display: "block", height: "100%" }}>
                <StatCard
                  title={payrollScope === "self" ? t("dash.myPayroll") : t("dash.commissionPaid")}
                  value={0}
                  prefix={<TrophyOutlined />}
                  suffix=""
                  accent={ds.accentOrange}
                  description={t("dash.openPayroll")}
                />
              </Link>
            )}
          </Col>
        </Row>

        <DashboardCharts
          ready={aggregatesReady}
          incomplete={!aggregatesReady && countsReady}
          incompleteHint={t("dash.summaryNeeded")}
          revenueData={revenueData}
          orderStatusData={orderStatusData}
          highlightMonth={thisMonthKey}
          totalOrders={totalOrders}
        />

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title={t("dash.recentOrders")}
              size="small"
              className="crm-dash-card"
              extra={<Link href="/orders">{t("common.viewAll")}</Link>}
            >
              {previewReady ? (
                recentOrders.length ? (
                  <Space orientation="vertical" style={{ width: "100%" }} size={0}>
                    {recentOrders.map((o) => (
                      <div key={o.id} className="crm-dash-list-row">
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/orders/${o.id}`}>{o.orderNumber}</Link>
                          <div
                            style={{
                              fontSize: ds.fontSize.caption,
                              color: token.colorTextSecondary,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {displayName(o.customerName)} · {displayName(o.serviceName)}
                          </div>
                        </div>
                        <Typography.Text
                          style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
                        >
                          {formatVndDisplay(o.value)}
                        </Typography.Text>
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("dash.noRecentOrders")} />
                )
              ) : (
                <Skeleton active paragraph={{ rows: 4 }} title={false} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={t("dash.upcomingPayments")}
              size="small"
              className="crm-dash-card"
              extra={<Link href="/payments">{t("common.viewAll")}</Link>}
            >
              {previewReady ? (
                upcomingPayments.length ? (
                  <Space orientation="vertical" style={{ width: "100%" }} size={0}>
                    {upcomingPayments.map((p) => (
                      <div key={p.id} className="crm-dash-list-row">
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/payments/${p.id}`}>{p.orderNumber}</Link>
                          <div
                            style={{
                              fontSize: ds.fontSize.caption,
                              color: token.colorTextSecondary,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {displayName(p.customerName)} ·{" "}
                            {t("dash.remaining", { amount: formatVndDisplay(p.remaining) })}
                          </div>
                        </div>
                        <StatusBadge module="payment" status={p.status} />
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t("dash.noUpcomingPayments")}
                  />
                )
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
