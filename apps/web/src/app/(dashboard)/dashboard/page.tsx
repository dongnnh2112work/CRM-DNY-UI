"use client";

import {
  DollarOutlined,
  ProjectOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Space, Tag, Typography } from "antd";
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
import { MOCK_DASHBOARD } from "@/lib/mock-dashboard";
import { MOCK_ORDERS } from "@/lib/mock-orders";
import { MOCK_PAYMENTS } from "@/lib/mock-payments";
import { PAYMENT_STATUS_LABELS } from "@/lib/types";

const d = MOCK_DASHBOARD;

const STATUS_COLORS: Record<string, string> = {
  Mới: "#0075de",
  "Đang xử lý": "#dd5b00",
  Chờ: "#2a9d99",
  "Hoàn thành": "#1aae39",
  "Đã hủy": "#a39e98",
};

const CTV_COLORS = ["#0075de", "#62aef0", "#2a9d99", "#d6b6f6", "#dd5b00"];

function formatVnd(value: number) {
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

const orderStatusData = d.orders.byStatus.map((item) => ({
  name: item.status,
  value: item.count,
}));

export default function DashboardPage() {
  const recentOrders = MOCK_ORDERS.slice(0, 5);
  const upcomingPayments = MOCK_PAYMENTS.filter((p) => p.status !== "paid").slice(0, 5);

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
            <StatCard title="Tổng đơn hàng" value={d.orders.total} prefix={<ProjectOutlined />} />
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
                    <YAxis tickFormatter={formatVnd} tickLine={false} width={48} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString()} ₫`, "Doanh thu"]}
                      labelFormatter={(label) => `Tháng: ${label}`}
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
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#1677ff"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} đơn`, "Số lượng"]} />
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
                    <XAxis type="number" tickFormatter={formatVnd} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tickLine={false} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString()} ₫`, "Hoa hồng"]}
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
                          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
                            {o.customerName} · {o.serviceName}
                          </div>
                        </div>
                        <Typography.Text>{o.value.toLocaleString()} ₫</Typography.Text>
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
                          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
                            {p.customerName} · Còn lại: {p.remaining.toLocaleString()} ₫
                          </div>
                        </div>
                        <Tag color={p.status === "overdue" ? "error" : "warning"}>
                          {PAYMENT_STATUS_LABELS[p.status]}
                        </Tag>
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
