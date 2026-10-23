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
import { ds, fontStack, palette } from "@/lib/design-tokens";
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
  const c = isDark ? palette.dark : palette.light;
  const cardShadow = isDark ? "none" : ds.shadow;

  return {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: c.primary,
      colorPrimaryHover: c.primaryHover,
      colorPrimaryActive: c.primaryHover,
      colorInfo: c.info,
      colorSuccess: c.success,
      colorWarning: c.warning,
      colorError: c.danger,
      colorSuccessBg: c.successBg,
      colorSuccessBorder: c.successBg,
      colorWarningBg: c.warningBg,
      colorWarningBorder: c.warningBg,
      colorErrorBg: c.dangerBg,
      colorErrorBorder: c.dangerBg,
      colorInfoBg: c.infoBg,
      colorInfoBorder: c.infoBg,
      colorLink: c.link,
      colorLinkHover: c.primaryHover,
      colorTextBase: c.text,
      colorTextSecondary: c.textSecondary,
      colorTextTertiary: c.textTertiary,
      colorTextQuaternary: c.textTertiary,
      colorBgBase: c.appBg,
      colorBgContainer: c.surface,
      colorBgElevated: c.surfaceElevated,
      colorBgLayout: c.appBg,
      colorBorder: c.border,
      colorBorderSecondary: c.border,
      colorSplit: c.border,
      borderRadius: ds.radius.sm,
      borderRadiusLG: ds.radius.md,
      borderRadiusSM: ds.radius.xs,
      fontFamily: fontStack,
      fontSize: ds.fontSize.bodySm,
      controlHeight: 36,
      controlHeightLG: 40,
      boxShadow: ds.shadowElevated,
      boxShadowSecondary: isDark ? "0 0 0 1px " + c.border + ", 0 8px 24px rgba(0,0,0,0.5)" : ds.shadowElevated,
      wireframe: false,
    },
    components: {
      Button: {
        primaryColor: ds.onPrimary,
        dangerColor: c.onDanger,
        primaryShadow: "none",
        defaultShadow: "none",
        dangerShadow: "none",
        fontWeight: 500,
        borderRadius: ds.radius.sm,
        controlHeight: 36,
        controlHeightLG: 40,
        paddingContentHorizontal: 16,
        defaultBorderColor: c.borderStrong,
      },
      Card: {
        paddingLG: 24,
        borderRadiusLG: ds.radius.md,
        boxShadowTertiary: cardShadow,
        colorBorderSecondary: c.border,
      },
      Layout: {
        siderBg: c.sidebarBg,
        headerBg: c.surface,
        bodyBg: c.appBg,
        triggerBg: c.surfaceElevated,
        triggerColor: c.text,
      },
      Menu: {
        itemBg: "transparent",
        subMenuItemBg: "transparent",
        itemSelectedBg: c.primaryBg,
        itemSelectedColor: c.link,
        itemHoverBg: c.hover,
        itemColor: c.textSecondary,
        itemActiveBg: c.primaryBg,
        groupTitleColor: c.textTertiary,
        groupTitleFontSize: 11,
        activeBarBorderWidth: 0,
        iconSize: 18,
        itemHeight: 40,
        itemMarginInline: 0,
        borderRadius: ds.radius.sm,
      },
      // Form controls use the stronger border (≥3:1 non-text contrast); cards/dividers stay hairline.
      InputNumber: { colorBorder: c.borderStrong },
      DatePicker: { colorBorder: c.borderStrong },
      Checkbox: { colorBorder: c.borderStrong },
      Radio: { colorBorder: c.borderStrong },
      Input: {
        colorBorder: c.borderStrong,
        activeBorderColor: c.primary,
        hoverBorderColor: c.link,
        activeShadow: `0 0 0 2px ${c.focusRing}`,
        borderRadius: ds.radius.sm,
        paddingBlock: 6,
        paddingInline: 10,
        colorBgContainer: c.surface,
      },
      Select: {
        colorBorder: c.borderStrong,
        optionSelectedBg: c.primaryBg,
        borderRadius: ds.radius.sm,
      },
      Table: {
        headerBg: c.appBg,
        headerColor: c.textSecondary,
        headerSplitColor: "transparent",
        borderColor: c.border,
        rowHoverBg: c.hover,
        rowSelectedBg: c.primaryBg,
        rowSelectedHoverBg: c.primaryBg,
      },
      Tag: {
        borderRadiusSM: ds.radius.sm,
        defaultBg: c.neutralBg,
        defaultColor: c.textSecondary,
      },
      Tabs: {
        itemSelectedColor: c.link,
        itemHoverColor: c.link,
        inkBarColor: c.primary,
      },
      Breadcrumb: {
        linkColor: c.link,
        itemColor: c.textSecondary,
        lastItemColor: c.text,
        separatorColor: c.textTertiary,
      },
      Typography: {
        colorTextHeading: c.text,
        titleMarginBottom: "0.5em",
      },
      Modal: {
        borderRadiusLG: ds.radius.lg,
        boxShadow: isDark ? `0 0 0 1px ${c.border}, 0 16px 40px rgba(0,0,0,0.65)` : ds.shadowElevated,
      },
      Drawer: {
        colorBgElevated: c.surface,
      },
      Descriptions: {
        labelBg: c.appBg,
      },
      Segmented: {
        itemSelectedBg: c.surface,
        itemSelectedColor: c.text,
        itemColor: c.textSecondary,
        trackBg: c.appBg,
        borderRadius: ds.radius.sm,
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
