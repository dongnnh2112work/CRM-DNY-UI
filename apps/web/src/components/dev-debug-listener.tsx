"use client";

import { App } from "antd";
import { useEffect, useState } from "react";
import {
  API_ERROR_EVENT,
  DEV_DEBUG_CHANGE_EVENT,
  formatDebugError,
  isDevDebugEnabled,
  type ApiErrorEventDetail,
} from "@/lib/dev-debug";
import { useT } from "@/lib/use-t";

export function DevDebugListener() {
  const { notification } = App.useApp();
  const t = useT();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(isDevDebugEnabled());
    sync();
    window.addEventListener(DEV_DEBUG_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DEV_DEBUG_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorEventDetail>).detail;
      if (!detail) return;
      notification.warning({
        message: t("config.debugToastTitle"),
        description: formatDebugError(detail),
        placement: "bottomRight",
        duration: 8,
      });
    };
    window.addEventListener(API_ERROR_EVENT, onError);
    return () => window.removeEventListener(API_ERROR_EVENT, onError);
  }, [enabled, notification, t]);

  return null;
}
