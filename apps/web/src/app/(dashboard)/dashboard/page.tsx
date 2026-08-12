"use client";

import {
  DollarOutlined,
  ProjectOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Space, Typography, theme } from "antd";
import Link from "next/link";
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
import { MOCK_DASHBOARD } from "@/lib/mock-dashboard";
import { ds } from "@/lib/design-tokens";
import { formatVndDisplay } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { usePayments } from "@/lib/payments-store";
import { ORDER_STAGE_CHART_COLORS, type Order } from "@/lib/types";

const d = MOCK_DASHBOARD;

const CTV_COLORS = ["#0075de", "#62aef0", "#2a9d99", "#d6b6f6", "#dd5b00"];

/** Compact tick labels for chart axes only (not list/table display). */
function formatVndAxisTick(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function formatMonth(month: string) {
  const [, m] = month.split("-");
  const n = Number(m);
  return Number.isFinite(n) ? `Thg ${n}` : month;
}

const revenueData = d.revenue.byMonth.map((item) => ({
  ...item,
  label: formatMonth(item.month),
}));

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
  const { token } = theme.useToken();
  const { orders } = useOrders();
  const { payments } = usePayments();
  const { stageOptions } = useOrderStatusConfig();
  const recentOrders = orders.slice(0, 5);
  const upcomingPayments = payments.filter((p) => p.status !== "paid").slice(0, 5);
  const orderStatusData = buildOrderStatusChart(orders, stageOptions);
  const totalOrders = orders.length;

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Tổng quan" }]} />
      <div style={{ padding: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Doanh thu (tháng này)"
              value={d.revenue.thisMonth}
              prefix={<DollarOutlined />}
              suffix="₫"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="Tổng đơn hàng" value={totalOrders} prefix={<ProjectOutlined />} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="Tổng khách hàng" value={d.customers.total} prefix={<TeamOutlined />} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Hoa hồng đã trả"
              value={d.commission.totalPaid}
              prefix={<TrophyOutlined />}
              suffix="₫"
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="Doanh thu theo tháng" size="small">
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} />
                    <YAxis tickFormatter={formatVndAxisTick} tickLine={false} width={48} />
                    <Tooltip
                      cursor={false}
                      formatter={(value) => [formatVndDisplay(Number(value)), "Doanh thu"]}
                      labelFormatter={(label) => `Tháng: ${label}`}
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
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Đơn hàng theo trạng thái" size="small">
              <div style={{ width: "100%", height: 280 }}>
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
                              {status}: {count} đơn
                            </span>
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="Top CTV theo hoa hồng" size="small">
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={d.commission.topCtv}
                    margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={formatVndAxisTick} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tickLine={false} />
                    <Tooltip
                      cursor={false}
                      formatter={(value) => [formatVndDisplay(Number(value)), "Hoa hồng"]}
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
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {d.commission.topCtv.map((entry, index) => (
                        <Cell key={entry.name} fill={CTV_COLORS[index % CTV_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="Đơn hàng gần đây" size="small" extra={<Link href="/orders">Xem tất cả</Link>}>
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
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
                </Card>
              </Col>
              <Col span={24}>
                <Card title="Thanh toán sắp tới" size="small" extra={<Link href="/payments">Xem tất cả</Link>}>
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
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
                            {p.customerName} · Còn lại: {formatVndDisplay(p.remaining)}
                          </div>
                        </div>
                        <StatusBadge module="payment" status={p.status} />
                      </div>
                    ))}
                  </Space>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </div>
    </>
  );
}
