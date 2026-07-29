"use client";

import { Card, Divider, Segmented, Switch, Typography } from "antd";
import { PageHeader } from "@/components/shared/page-header";
import { useAppConfig, type AppLocale } from "@/components/providers/antd-provider";

const APP_VERSION = "1.0.0";

export default function ConfigPage() {
  const { locale, setLocale, theme, setTheme } = useAppConfig();

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

        <Card title="Giới thiệu" size="small">
          <Typography.Text>DNY CRM</Typography.Text>
          <Divider type="vertical" />
          <Typography.Text type="secondary">Phiên bản {APP_VERSION}</Typography.Text>
        </Card>
      </div>
    </>
  );
}
