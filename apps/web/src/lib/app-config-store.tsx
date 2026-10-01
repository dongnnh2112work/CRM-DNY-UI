"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { configApi, REMINDER_CONFIG_KEY } from "@/modules/config/api";

export type ReminderConfig = {
  vatIssueWarnDays: number;
};

const DEFAULTS: ReminderConfig = {
  vatIssueWarnDays: 30,
};

type Ctx = {
  config: ReminderConfig;
  ready: boolean;
  setVatIssueWarnDays: (n: number) => void;
  hydrateConfig: (next: ReminderConfig) => void;
  resetServerData: () => void;
};

const AppConfigContext = createContext<Ctx | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ReminderConfig>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const setVatIssueWarnDays = useCallback((n: number) => {
    const vatIssueWarnDays = Math.min(90, Math.max(7, Math.round(n)));
    setConfig((c) => ({ ...c, vatIssueWarnDays }));
    void configApi.patch(REMINDER_CONFIG_KEY, { vatIssueWarnDays }).catch(() => undefined);
  }, []);

  const hydrateConfig = useCallback((next: ReminderConfig) => {
    setConfig({
      vatIssueWarnDays: Math.min(90, Math.max(7, Math.round(next.vatIssueWarnDays))),
    });
  }, []);

  const resetServerData = useCallback(() => {
    setConfig(DEFAULTS);
  }, []);

  const value = useMemo(
    () => ({ config, ready, setVatIssueWarnDays, hydrateConfig, resetServerData }),
    [config, ready, setVatIssueWarnDays, hydrateConfig, resetServerData],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppReminderConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppReminderConfig must be used within AppConfigProvider");
  return ctx;
}
