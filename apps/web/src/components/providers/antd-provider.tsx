"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme as antTheme } from "antd";
import enUS from "antd/locale/en_US";
import viVN from "antd/locale/vi_VN";
import zhCN from "antd/locale/zh_CN";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ds, fontStack } from "@/lib/design-tokens";

export type AppLocale = "vi" | "en" | "zh";
export type AppTheme = "light" | "dark";

interface AppConfig {
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}

const AppConfigContext = createContext<AppConfig>({
  locale: "vi",
  setLocale: () => {},
  theme: "light",
  setTheme: () => {},
});

export const useAppConfig = () => useContext(AppConfigContext);

const LOCALE_MAP = { vi: viVN, en: enUS, zh: zhCN };

function buildTheme(mode: AppTheme) {
  const isDark = mode === "dark";

  return {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: ds.primary,
      colorInfo: ds.primary,
      colorSuccess: ds.accentGreen,
      colorWarning: ds.accentOrange,
      colorError: "#e03e3e",
      colorLink: ds.primary,
      colorTextBase: isDark ? "#ffffff" : ds.ink,
      colorTextSecondary: isDark ? "#a39e98" : ds.inkMuted,
      colorBgBase: isDark ? "#191919" : ds.canvasSoft,
      colorBgContainer: isDark ? "#202020" : ds.surface,
      colorBgElevated: isDark ? "#252525" : ds.surface,
      colorBgLayout: isDark ? "#191919" : ds.canvasSoft,
      colorBorder: isDark ? "#333333" : ds.hairline,
      colorBorderSecondary: isDark ? "#2a2a2a" : ds.hairline,
      borderRadius: ds.radius.md,
      borderRadiusLG: ds.radius.lg,
      borderRadiusSM: ds.radius.xs,
      fontFamily: fontStack,
      fontSize: 15,
      controlHeight: 36,
      controlHeightLG: 40,
      boxShadow: ds.shadow,
      boxShadowSecondary: ds.shadow,
      wireframe: false,
    },
    components: {
      Button: {
        primaryColor: ds.onPrimary,
        primaryShadow: "none",
        defaultShadow: "none",
        dangerShadow: "none",
        fontWeight: 500,
        borderRadius: ds.radius.full,
        controlHeight: 36,
        controlHeightLG: 40,
        paddingContentHorizontal: 16,
      },
      Card: {
        paddingLG: 24,
        borderRadiusLG: ds.radius.lg,
        boxShadowTertiary: ds.shadow,
        colorBorderSecondary: isDark ? "#333333" : ds.hairline,
      },
      Layout: {
        siderBg: isDark ? "#202020" : ds.canvas,
        headerBg: isDark ? "#202020" : ds.canvas,
        bodyBg: isDark ? "#191919" : ds.canvasSoft,
        triggerBg: isDark ? "#252525" : ds.canvasSoft,
        triggerColor: isDark ? "#ffffff" : ds.ink,
      },
      Menu: {
        itemBg: "transparent",
        subMenuItemBg: "transparent",
        itemSelectedBg: isDark ? "rgba(0,117,222,0.2)" : ds.selected,
        itemSelectedColor: isDark ? "#ffffff" : ds.ink,
        itemHoverBg: isDark ? "rgba(255,255,255,0.06)" : ds.hover,
        itemColor: isDark ? "#a39e98" : ds.inkSecondary,
        itemActiveBg: isDark ? "rgba(0,117,222,0.2)" : ds.selected,
        activeBarBorderWidth: 0,
        iconSize: 16,
        borderRadius: ds.radius.sm,
      },
      Input: {
        activeBorderColor: ds.primary,
        hoverBorderColor: ds.hairline,
        activeShadow: `0 0 0 2px ${ds.focusRing}`,
        borderRadius: ds.radius.xs,
        paddingBlock: 6,
        paddingInline: 10,
      },
      Select: {
        optionSelectedBg: isDark ? "rgba(0,117,222,0.2)" : ds.selected,
        borderRadius: ds.radius.xs,
      },
      Table: {
        headerBg: isDark ? "#252525" : ds.canvasSoft,
        headerColor: isDark ? "#ffffff" : ds.inkMuted,
        borderColor: isDark ? "#333333" : ds.hairline,
        rowHoverBg: isDark ? "rgba(255,255,255,0.04)" : ds.hover,
      },
      Tag: {
        borderRadiusSM: ds.radius.full,
        defaultBg: isDark ? "#333333" : ds.canvasSoft,
        defaultColor: isDark ? "#ffffff" : ds.inkSecondary,
      },
      Tabs: {
        itemSelectedColor: ds.primary,
        itemHoverColor: ds.inkSecondary,
        inkBarColor: ds.primary,
      },
      Breadcrumb: {
        linkColor: ds.primary,
        itemColor: ds.inkMuted,
        lastItemColor: ds.ink,
      },
      Typography: {
        colorTextHeading: isDark ? "#ffffff" : ds.ink,
        titleMarginBottom: "0.5em",
      },
      Modal: {
        borderRadiusLG: ds.radius.xl,
        boxShadow: ds.shadow,
      },
      Drawer: {
        colorBgElevated: isDark ? "#202020" : ds.surface,
      },
      Segmented: {
        itemSelectedBg: isDark ? "#333333" : ds.surface,
        itemSelectedColor: isDark ? "#ffffff" : ds.ink,
        trackBg: isDark ? "#252525" : ds.canvasSoft,
        borderRadius: ds.radius.md,
      },
    },
  };
}

export function AntdProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>("vi");
  const [theme, setTheme] = useState<AppTheme>("light");

  useEffect(() => {
    const savedLocale = localStorage.getItem("app_locale") as AppLocale | null;
    const savedTheme = localStorage.getItem("app_theme") as AppTheme | null;
    if (savedLocale) setLocale(savedLocale);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  const handleSetLocale = (l: AppLocale) => {
    setLocale(l);
    localStorage.setItem("app_locale", l);
  };

  const handleSetTheme = (t: AppTheme) => {
    setTheme(t);
    localStorage.setItem("app_theme", t);
    document.documentElement.style.colorScheme = t;
  };

  return (
    <AppConfigContext.Provider value={{ locale, setLocale: handleSetLocale, theme, setTheme: handleSetTheme }}>
      <AntdRegistry>
        <ConfigProvider locale={LOCALE_MAP[locale]} theme={buildTheme(theme)}>
          <App>{children}</App>
        </ConfigProvider>
      </AntdRegistry>
    </AppConfigContext.Provider>
  );
}
