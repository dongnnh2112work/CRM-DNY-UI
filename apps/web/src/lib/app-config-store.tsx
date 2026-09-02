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
import { loadJson, saveJson } from "@/lib/demo-storage";

const KEY = "dny-crm-app-reminders";

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
};

const AppConfigContext = createContext<Ctx | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ReminderConfig>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadJson<ReminderConfig & { licenseExpiryWarnMonths?: number }>(KEY);
    if (stored) {
      setConfig({
        vatIssueWarnDays: stored.vatIssueWarnDays ?? DEFAULTS.vatIssueWarnDays,
      });
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(KEY, config);
  }, [config, ready]);

  const setVatIssueWarnDays = useCallback((n: number) => {
    setConfig((c) => ({ ...c, vatIssueWarnDays: Math.min(90, Math.max(7, Math.round(n))) }));
  }, []);

  const value = useMemo(
    () => ({ config, ready, setVatIssueWarnDays }),
    [config, ready, setVatIssueWarnDays],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppReminderConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppReminderConfig must be used within AppConfigProvider");
  return ctx;
}
