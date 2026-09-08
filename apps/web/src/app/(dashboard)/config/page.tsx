"use client";

import { Card, Divider, InputNumber, Segmented, Switch, Typography } from "antd";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAppConfig, type AppLocale } from "@/components/providers/antd-provider";
import { isDevDebugEnabled, setDevDebugEnabled } from "@/lib/dev-debug";
import { useAppReminderConfig } from "@/lib/app-config-store";
import { useT } from "@/lib/use-t";

const APP_VERSION = "1.0.0";

export default function ConfigPage() {
  const { locale, setLocale, theme, setTheme } = useAppConfig();
  const { config, setVatIssueWarnDays } = useAppReminderConfig();
  const t = useT();
  const [devDebug, setDevDebug] = useState(false);

  useEffect(() => {
    setDevDebug(isDevDebugEnabled());
  }, []);

  const onDevDebug = (v: boolean) => {
    setDevDebug(v);
    setDevDebugEnabled(v);
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("config.title") }]} />
      <div style={{ padding: 16, maxWidth: 600 }}>
        <Card title={t("config.language")} size="small" style={{ marginBottom: 16 }}>
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

        <Card title={t("config.appearance")} size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Typography.Text>{t("config.darkMode")}</Typography.Text>
            <Switch checked={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
          </div>
        </Card>

        <Card title={t("config.reminders")} size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <Typography.Text>{t("config.vatWarnDays")}</Typography.Text>
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

        <Card title={t("config.developer")} size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <Typography.Text>{t("config.developerDebug")}</Typography.Text>
              <div>
                <Typography.Text type="secondary">{t("config.developerDebugHint")}</Typography.Text>
              </div>
            </div>
            <Switch checked={devDebug} onChange={onDevDebug} />
          </div>
        </Card>

        <Card title={t("config.about")} size="small">
          <Typography.Text>DNY CRM</Typography.Text>
          <Divider orientation="vertical" />
          <Typography.Text type="secondary">
            {t("config.version")} {APP_VERSION}
          </Typography.Text>
        </Card>
      </div>
    </>
  );
}
