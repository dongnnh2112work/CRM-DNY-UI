"use client";

import { Card, Col, Row, Skeleton, theme } from "antd";
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
import { ds } from "@/lib/design-tokens";
import { formatVndDisplay } from "@/lib/format-vnd";
import { useT } from "@/lib/use-t";

export type RevenueChartPoint = { month: string; value: number; label: string };
export type StatusChartPoint = { key: string; name: string; value: number; color: string };

function formatVndAxisTick(value: number) {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function DashboardCharts({
  ready,
  revenueData,
  orderStatusData,
}: {
  ready: boolean;
  revenueData: RevenueChartPoint[];
  orderStatusData: StatusChartPoint[];
}) {
  const t = useT();
  const { token } = theme.useToken();

  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={14}>
        <Card title={t("dash.revenueByMonth")} size="small">
          <div
            style={{ width: "100%", height: 280, position: "relative" }}
            role="img"
            aria-label={t("dash.revenueByMonth")}
          >
            {ready ? (
              <>
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
                <ul className="crm-sr-only">
                  {revenueData.map((item) => (
                    <li key={item.month}>
                      {item.label}: {formatVndDisplay(item.value)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Skeleton active paragraph={{ rows: 8 }} title={false} style={{ padding: 16 }} />
            )}
          </div>
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Card title={t("dash.ordersByStatus")} size="small">
          <div
            style={{ width: "100%", height: 280, position: "relative" }}
            role="img"
            aria-label={t("dash.ordersByStatus")}
          >
            {ready ? (
              <>
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
                <ul className="crm-sr-only">
                  {orderStatusData.map((item) => (
                    <li key={item.key}>
                      {t("dash.orderCount", { status: item.name, count: String(item.value) })}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Skeleton active paragraph={{ rows: 8 }} title={false} style={{ padding: 16 }} />
            )}
          </div>
        </Card>
      </Col>
    </Row>
  );
}
