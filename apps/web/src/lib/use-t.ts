"use client";

import { useCallback } from "react";
import { useAppConfig } from "@/components/providers/antd-provider";
import { t, type MessageKey, type MessageVars } from "@/lib/i18n";

export function useT() {
  const { locale } = useAppConfig();
  return useCallback((key: MessageKey, vars?: MessageVars) => t(locale, key, vars), [locale]);
}
