"use client";

import { Card, Statistic, theme } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { ds } from "@/lib/design-tokens";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function tint(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function StatCard({
  title,
  value,
  prefix,
  suffix,
  accent = ds.primary,
  description,
  valueColor,
}: {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  suffix?: string;
  /** Metric accent — icon chip + value tint */
  accent?: string;
  /** Optional hint under the value (kept inside the card so it is not clipped). */
  description?: ReactNode;
  /** Overrides the value color (negative payroll, for example). */
  valueColor?: string;
}) {
  const { token } = theme.useToken();

  const iconWrap: CSSProperties | undefined = prefix
    ? {
        background: tint(accent, 0.12),
        color: accent,
      }
    : undefined;

  return (
    <Card
      size="small"
      className="crm-dash-card"
      styles={{ body: { padding: 16 } }}
      style={{
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {prefix ? (
          <span className="crm-dash-stat-icon" style={iconWrap} aria-hidden>
            {prefix}
          </span>
        ) : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          {typeof value === "string" ? (
            <div>
              <div
                style={{
                  color: token.colorTextSecondary,
                  fontWeight: 500,
                  fontSize: ds.fontSize.caption,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  color: valueColor ?? token.colorText,
                  fontWeight: 700,
                  fontSize: ds.fontSize.h3,
                  letterSpacing: "-0.3px",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.4,
                }}
              >
                {value}
                {suffix ? ` ${suffix}` : ""}
              </div>
            </div>
          ) : (
          <Statistic
            title={
              <span
                style={{
                  color: token.colorTextSecondary,
                  fontWeight: 500,
                  fontSize: ds.fontSize.caption,
                }}
              >
                {title}
              </span>
            }
            value={value}
            suffix={suffix}
            styles={{
              content: {
                color: valueColor ?? token.colorText,
                fontWeight: 700,
                fontSize: ds.fontSize.h3,
                letterSpacing: "-0.3px",
                fontVariantNumeric: "tabular-nums",
              },
            }}
          />
          )}
          {description ? (
            <div
              style={{
                marginTop: 6,
                color: token.colorTextSecondary,
                fontSize: ds.fontSize.caption,
                lineHeight: 1.4,
              }}
            >
              {description}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
