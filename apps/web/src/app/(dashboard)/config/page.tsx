"use client";

import { Card, Divider, InputNumber, Segmented, Switch, Typography } from "antd";
import { PageHeader } from "@/components/shared/page-header";
import { useAppConfig, type AppLocale } from "@/components/providers/antd-provider";
import { useAppReminderConfig } from "@/lib/app-config-store";

const APP_VERSION = "1.0.0";

export default function ConfigPage() {
  const { locale, setLocale, theme, setTheme } = useAppConfig();
  const { config, setLicenseExpiryWarnMonths, setVatIssueWarnDays } = useAppReminderConfig();

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Cấu hình" }]} />
      <div style={{ padding: 16, maxWidth: 600 }}>
        <Card title="Language / Ngôn ngữ" size="small" style={{ marginBottom: 16 }}>
          <Segmented
            value={locale}
            onChange={(v) => setLocale(v as AppLocale)}
            options={[
              { value: "vi", label: "Tiếng Việt" },
              { value: "en", label: "English" },
              { value: "zh", label: "中文" },
            ]}
          />
        </Card>

        <Card title="Giao diện" size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Typography.Text>Chế độ tối</Typography.Text>
            <Switch checked={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
          </div>
        </Card>

        <Card title="Nhắc hạn" size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <Typography.Text>Cảnh báo giấy phép trước (tháng)</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <InputNumber
                  min={1}
                  max={6}
                  value={config.licenseExpiryWarnMonths}
                  onChange={(v) => setLicenseExpiryWarnMonths(Number(v ?? 2))}
                />
              </div>
              <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
                Tag “Sắp hết hạn” và thông báo khi GP còn trong khoảng này.
              </Typography.Paragraph>
            </div>
            <div>
              <Typography.Text>Cảnh báo hạn xuất VAT (ngày)</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <InputNumber
                  min={7}
                  max={90}
                  value={config.vatIssueWarnDays}
                  onChange={(v) => setVatIssueWarnDays(Number(v ?? 30))}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Giới thiệu" size="small">
          <Typography.Text>DNY CRM</Typography.Text>
          <Divider type="vertical" />
          <Typography.Text type="secondary">Phiên bản {APP_VERSION}</Typography.Text>
        </Card>
      </div>
    </>
  );
}
