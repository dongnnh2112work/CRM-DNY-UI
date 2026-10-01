"use client";

import { Card, Col, Row, Skeleton, theme } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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

function formatBarLabel(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function DashboardCharts({
  ready,
  revenueData,
  orderStatusData,
  highlightMonth,
  totalOrders,
}: {
  ready: boolean;
  revenueData: RevenueChartPoint[];
  orderStatusData: StatusChartPoint[];
  /** YYYY-MM — current month bar uses full accent */
  highlightMonth?: string;
  /** BE list total — same source as StatCard “Tổng đơn hàng” */
  totalOrders?: number;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const segmentSum = orderStatusData.reduce((sum, s) => sum + s.value, 0);
  /** Prefer BE total so center matches StatCard; fall back to segment sum */
  const centerTotal = totalOrders ?? segmentSum;
  const mutedBar = "rgba(0, 117, 222, 0.28)";

  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={14}>
        <Card title={t("dash.revenueByMonth")} size="small" className="crm-dash-card">
          <div
            style={{ width: "100%", height: 280, position: "relative" }}
            role="img"
            aria-label={t("dash.revenueByMonth")}
          >
            {ready ? (
              <>
                <ResponsiveContainer>
                  <BarChart data={revenueData} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={token.colorBorderSecondary}
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: token.colorTextSecondary }}
                    />
                    <YAxis
                      tickFormatter={formatVndAxisTick}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tick={{ fontSize: 12, fill: token.colorTextSecondary }}
                    />
                    <Tooltip
                      cursor={{ fill: token.colorFillSecondary, radius: 8 }}
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
                    <Bar dataKey="value" radius={[8, 8, 4, 4]} maxBarSize={44}>
                      {revenueData.map((entry) => {
                        const active = highlightMonth != null && entry.month === highlightMonth;
                        return (
                          <Cell
                            key={entry.month}
                            fill={active ? ds.primary : mutedBar}
                            stroke={active ? ds.primaryActive : "transparent"}
                            strokeWidth={active ? 1 : 0}
                          />
                        );
                      })}
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={formatBarLabel}
                        style={{
                          fill: token.colorTextSecondary,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      />
                    </Bar>
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
        <Card title={t("dash.ordersByStatus")} size="small" className="crm-dash-card">
          <div
            style={{ width: "100%", height: 280, position: "relative" }}
            role="img"
            aria-label={t("dash.ordersByStatus")}
          >
            {ready ? (
              <>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                      >
                        {orderStatusData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={entry.color}
                            stroke={token.colorBgContainer}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0];
                          const status = String(item.name ?? "");
                          const count = Number(item.value ?? 0);
                          const pct =
                            segmentSum > 0 ? Math.round((count / segmentSum) * 100) : 0;
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
                                {t("dash.orderCount", { status, count: String(count) })} ({pct}%)
                              </span>
                            </div>
                          );
                        }}
                      />
                      <text
                        x="50%"
                        y="48%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{
                          fill: token.colorText,
                          fontSize: 22,
                          fontWeight: 700,
                          letterSpacing: "-0.3px",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {centerTotal}
                      </text>
                      <text
                        x="50%"
                        y="58%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{
                          fill: token.colorTextSecondary,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {t("dash.totalOrders")}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="crm-pie-legend" role="list">
                  {orderStatusData.map((item) => (
                    <span key={item.key} className="crm-pie-legend-item" role="listitem">
                      <span
                        className="crm-pie-legend-swatch"
                        aria-hidden
                        style={{ background: item.color }}
                      />
                      <span>{item.name}</span>
                    </span>
                  ))}
                </div>
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
