"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme as antTheme } from "antd";
import enUS from "antd/locale/en_US";
import viVN from "antd/locale/vi_VN";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/vi";
import "dayjs/locale/zh-cn";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DevDebugListener } from "@/components/dev-debug-listener";
import { ds, fontStack } from "@/lib/design-tokens";
import { DISPLAY_DATE_FORMAT, DISPLAY_MONTH_FORMAT } from "@/lib/format-date";
import { setI18nLocale, type AppLocale } from "@/lib/i18n";

export type { AppLocale };
export type AppTheme = "light" | "dark";

function resolveAppTheme(v: string | null): AppTheme {
  if (v === "dark") return "dark";
  /* Legacy "binance" preference maps to dark */
  if (v === "binance") return "dark";
  return "light";
}

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

const LOCALE_MAP = {
  vi: withSystemDateFormat(viVN),
  en: withSystemDateFormat(enUS),
  zh: withSystemDateFormat(zhCN),
};
const DAYJS_LOCALE = { vi: "vi", en: "en", zh: "zh-cn" } as const;

function withSystemDateFormat<T extends typeof viVN>(locale: T): T {
  const picker = locale.DatePicker;
  const calendar = locale.Calendar;
  return {
    ...locale,
    DatePicker: picker
      ? {
          ...picker,
          lang: {
            ...picker.lang,
            dateFormat: DISPLAY_DATE_FORMAT,
            dateTimeFormat: `${DISPLAY_DATE_FORMAT} HH:mm:ss`,
            monthFormat: DISPLAY_MONTH_FORMAT,
          },
        }
      : picker,
    Calendar: calendar
      ? {
          ...calendar,
          lang: {
            ...calendar.lang,
            dateFormat: DISPLAY_DATE_FORMAT,
            dateTimeFormat: `${DISPLAY_DATE_FORMAT} HH:mm:ss`,
            monthFormat: DISPLAY_MONTH_FORMAT,
          },
        }
      : calendar,
  };
}

function applyDocumentLocale(locale: AppLocale) {
  setI18nLocale(locale);
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  dayjs.locale(DAYJS_LOCALE[locale]);
}

function buildTheme(mode: AppTheme) {
  const isDark = mode === "dark";

  return {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: ds.primary,
      colorInfo: ds.primary,
      colorSuccess: ds.accentGreen,
      colorWarning: ds.accentOrange,
      colorError: ds.danger,
      colorLink: ds.primary,
      colorTextBase: isDark ? "#ffffff" : ds.ink,
      colorTextSecondary: isDark ? "#a39e98" : ds.inkMuted,
      colorTextTertiary: isDark ? "#8a8680" : ds.inkFaint,
      colorTextQuaternary: isDark ? "#6f6b66" : ds.inkFaint,
      /* True black layout; cards lift via #0A0A0A + hairline, not gray wash */
      colorBgBase: isDark ? "#000000" : ds.canvasSoft,
      colorBgContainer: isDark ? "#0A0A0A" : ds.surface,
      colorBgElevated: isDark ? "#141414" : ds.surface,
      colorBgLayout: isDark ? "#000000" : ds.canvasSoft,
      colorBorder: isDark ? "#222222" : ds.hairline,
      colorBorderSecondary: isDark ? "#1A1A1A" : ds.hairline,
      borderRadius: ds.radius.md,
      borderRadiusLG: ds.radius.lg,
      borderRadiusSM: ds.radius.xs,
      fontFamily: fontStack,
      fontSize: ds.fontSize.bodySm,
      controlHeight: 36,
      controlHeightLG: 40,
      boxShadow: isDark ? "none" : ds.shadow,
      boxShadowSecondary: isDark ? "none" : ds.shadow,
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
        boxShadowTertiary: isDark ? "none" : ds.shadow,
        colorBorderSecondary: isDark ? "#222222" : ds.hairline,
      },
      Layout: {
        siderBg: isDark ? "#000000" : ds.canvas,
        headerBg: isDark ? "#000000" : ds.canvas,
        bodyBg: isDark ? "#000000" : ds.canvasSoft,
        triggerBg: isDark ? "#141414" : ds.canvasSoft,
        triggerColor: isDark ? "#ffffff" : ds.ink,
      },
      Menu: {
        itemBg: "transparent",
        subMenuItemBg: "transparent",
        itemSelectedBg: isDark ? "rgba(0,117,222,0.22)" : ds.selected,
        itemSelectedColor: isDark ? "#ffffff" : ds.ink,
        itemHoverBg: isDark ? "rgba(255,255,255,0.06)" : ds.hover,
        itemColor: isDark ? "#a39e98" : ds.inkSecondary,
        itemActiveBg: isDark ? "rgba(0,117,222,0.22)" : ds.selected,
        activeBarBorderWidth: 0,
        iconSize: 16,
        borderRadius: ds.radius.sm,
      },
      Input: {
        activeBorderColor: ds.primary,
        hoverBorderColor: isDark ? "#333333" : ds.hairline,
        activeShadow: `0 0 0 2px ${ds.focusRing}`,
        borderRadius: ds.radius.xs,
        paddingBlock: 6,
        paddingInline: 10,
        colorBgContainer: isDark ? "#0A0A0A" : undefined,
      },
      Select: {
        optionSelectedBg: isDark ? "rgba(0,117,222,0.22)" : ds.selected,
        borderRadius: ds.radius.xs,
      },
      Table: {
        headerBg: isDark ? "#141414" : ds.canvasSoft,
        headerColor: isDark ? "#ffffff" : ds.inkMuted,
        borderColor: isDark ? "#222222" : ds.hairline,
        rowHoverBg: isDark ? "rgba(255,255,255,0.04)" : ds.hover,
      },
      Tag: {
        borderRadiusSM: ds.radius.full,
        defaultBg: isDark ? "#141414" : ds.canvasSoft,
        defaultColor: isDark ? "#ffffff" : ds.inkSecondary,
      },
      Tabs: {
        itemSelectedColor: ds.primary,
        itemHoverColor: isDark ? "#e8e6e3" : ds.inkSecondary,
        inkBarColor: ds.primary,
      },
      Breadcrumb: {
        linkColor: ds.primary,
        itemColor: isDark ? "#a39e98" : ds.inkMuted,
        lastItemColor: isDark ? "#ffffff" : ds.ink,
        separatorColor: isDark ? "#8a8680" : ds.inkFaint,
      },
      Typography: {
        colorTextHeading: isDark ? "#ffffff" : ds.ink,
        titleMarginBottom: "0.5em",
      },
      Modal: {
        borderRadiusLG: ds.radius.xl,
        boxShadow: isDark ? "0 0 0 1px #222222, 0 16px 40px rgba(0,0,0,0.65)" : ds.shadow,
      },
      Drawer: {
        colorBgElevated: isDark ? "#0A0A0A" : ds.surface,
      },
      Descriptions: {
        labelBg: isDark ? "#141414" : ds.canvasSoft,
      },
      Segmented: {
        itemSelectedBg: isDark ? "#141414" : ds.surface,
        itemSelectedColor: isDark ? "#ffffff" : ds.ink,
        itemColor: isDark ? "#a39e98" : ds.inkSecondary,
        trackBg: isDark ? "#000000" : ds.canvasSoft,
        borderRadius: ds.radius.md,
      },
    },
  };
}

function applyDocumentTheme(mode: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode === "light" ? "light" : "dark";
}

export function AntdProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>("vi");
  const [theme, setTheme] = useState<AppTheme>("light");

  useEffect(() => {
    const savedLocale = localStorage.getItem("app_locale") as AppLocale | null;
    const savedTheme = localStorage.getItem("app_theme");
    if (savedLocale === "vi" || savedLocale === "en" || savedLocale === "zh") {
      setLocale(savedLocale);
      applyDocumentLocale(savedLocale);
    }
    const nextTheme = resolveAppTheme(savedTheme);
    setTheme(nextTheme);
    applyDocumentTheme(nextTheme);
    if (savedTheme === "binance") localStorage.setItem("app_theme", "dark");
  }, []);

  const handleSetLocale = (l: AppLocale) => {
    setLocale(l);
    localStorage.setItem("app_locale", l);
    applyDocumentLocale(l);
  };

  const handleSetTheme = (t: AppTheme) => {
    // better-ui: suppress color/border/shadow transitions during theme flip
    const style = document.createElement("style");
    style.append(document.createTextNode("*,*::before,*::after{transition:none !important}"));
    document.head.append(style);
    setTheme(t);
    localStorage.setItem("app_theme", t);
    applyDocumentTheme(t);
    void document.body.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => style.remove());
    });
  };

  return (
    <AppConfigContext.Provider value={{ locale, setLocale: handleSetLocale, theme, setTheme: handleSetTheme }}>
      <AntdRegistry>
        <ConfigProvider locale={LOCALE_MAP[locale]} theme={buildTheme(theme)}>
          <App>
            <DevDebugListener />
            {children}
          </App>
        </ConfigProvider>
      </AntdRegistry>
    </AppConfigContext.Provider>
  );
}
