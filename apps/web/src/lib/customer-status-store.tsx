"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppConfig } from "@/components/providers/antd-provider";
import { loadJson, saveJson } from "@/lib/demo-storage";
import { tt, translateStatusLabel } from "@/lib/i18n";
import { STATUS_CONFIG, type DisplayStatusMeta, type StatusTone } from "@/lib/status-config";
import {
  STAGE_COLOR_PALETTE,
  TONE_TO_HEX,
  nextFreeStageColor,
  normalizeStoredColor,
  slugifyKey,
  uniqueKey,
} from "@/lib/status-palette";
import { CUSTOMER_STATUS_CATALOG_KEY, patchConfigDebounced } from "@/modules/config/api";

const KEY = "dny-crm-customer-status-meta";

export type CustomerStatusDefinition = {
  key: string;
  label: string;
  color: string;
};

const DEFAULT_COLORS: Record<string, string> = {
  active: "#448361",
  lead: "#337ea9",
  archived: "#787774",
};

function defaultStatuses(): CustomerStatusDefinition[] {
  return Object.entries(STATUS_CONFIG.customer).map(([key, meta]) => ({
    key,
    label: meta.label,
    color: DEFAULT_COLORS[key] ?? TONE_TO_HEX[(meta.color ?? "default") as StatusTone],
  }));
}

function ensureUniqueColors(list: CustomerStatusDefinition[]): CustomerStatusDefinition[] {
  const used = new Set<string>();
  return list.map((s) => {
    const lower = s.color.toLowerCase();
    if (!used.has(lower)) {
      used.add(lower);
      return s;
    }
    const free = nextFreeStageColor([...used]);
    if (!free) return s;
    used.add(free.toLowerCase());
    return { ...s, color: free };
  });
}

function parseStored(raw: unknown): CustomerStatusDefinition[] | null {
  if (!raw || typeof raw !== "object") return null;
  const stages = (raw as { statuses?: CustomerStatusDefinition[] }).statuses;
  if (!Array.isArray(stages)) return null;
  const list = stages
    .filter((s) => s && typeof s.key === "string")
    .map((s) => ({
      key: s.key,
      label: s.label?.trim() || s.key,
      color: normalizeStoredColor(s.color, STAGE_COLOR_PALETTE[0]),
    }));
  return list.length > 0 ? ensureUniqueColors(list) : null;
}

type Ctx = {
  statuses: CustomerStatusDefinition[];
  ready: boolean;
  getMeta: (status: string) => DisplayStatusMeta;
  updateStatus: (key: string, patch: Partial<Pick<CustomerStatusDefinition, "label" | "color">>) => void;
  addStatus: (label: string) => CustomerStatusDefinition | null;
  removeStatus: (key: string) => { ok: true } | { ok: false; reason: string };
  hydrateFromRemote: (raw: unknown | null) => void;
  statusOptions: { value: string; label: string; color: string }[];
};

export const CustomerStatusContext = createContext<Ctx | null>(null);

export function CustomerStatusProvider({ children }: { children: ReactNode }) {
  const { locale } = useAppConfig();
  const [statuses, setStatuses] = useState<CustomerStatusDefinition[]>(defaultStatuses);
  const [ready, setReady] = useState(false);
  const persistEnabled = useRef(false);

  useEffect(() => {
    const stored = loadJson<unknown>(KEY);
    const parsed = parseStored(stored);
    if (parsed) setStatuses(parsed);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !persistEnabled.current) return;
    saveJson(KEY, { statuses });
    patchConfigDebounced(CUSTOMER_STATUS_CATALOG_KEY, { statuses });
  }, [statuses, ready]);

  const hydrateFromRemote = useCallback((raw: unknown | null) => {
    persistEnabled.current = false;
    const parsed = parseStored(raw);
    if (parsed) setStatuses(parsed);
    window.setTimeout(() => {
      persistEnabled.current = true;
    }, 0);
  }, []);

  const getMeta = useCallback((status: string): DisplayStatusMeta => {
    const found = statuses.find((s) => s.key === status);
    if (found) {
      return {
        label: translateStatusLabel("customer", found.key, found.label),
        color: found.color,
      };
    }
    return { label: status, color: STAGE_COLOR_PALETTE[0] };
  }, [statuses, locale]);

  const updateStatus = useCallback(
    (key: string, patch: Partial<Pick<CustomerStatusDefinition, "label" | "color">>) => {
      setStatuses((prev) => {
        if (patch.color) {
          const taken = prev.some(
            (s) => s.key !== key && s.color.toLowerCase() === patch.color!.toLowerCase(),
          );
          if (taken) return prev;
        }
        return prev.map((s) =>
          s.key === key
            ? {
                ...s,
                ...(patch.label !== undefined ? { label: patch.label } : null),
                ...(patch.color !== undefined ? { color: patch.color } : null),
              }
            : s,
        );
      });
    },
    [],
  );

  const addStatus = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    let created: CustomerStatusDefinition | null = null;
    setStatuses((prev) => {
      const free = nextFreeStageColor(prev.map((s) => s.color));
      if (!free) return prev;
      const existing = new Set(prev.map((s) => s.key));
      const key = uniqueKey(slugifyKey(trimmed), existing);
      created = { key, label: trimmed, color: free };
      return [...prev, created];
    });
    return created;
  }, []);

  const removeStatus = useCallback((key: string) => {
    let result: { ok: true } | { ok: false; reason: string } = {
      ok: false,
      reason: tt("status.notFound"),
    };
    setStatuses((prev) => {
      if (prev.length <= 1) {
        result = { ok: false, reason: tt("status.needOne") };
        return prev;
      }
      if (!prev.some((s) => s.key === key)) return prev;
      result = { ok: true };
      return prev.filter((s) => s.key !== key);
    });
    return result;
  }, []);

  const statusOptions = useMemo(
    () =>
      statuses.map((s) => ({
        value: s.key,
        label: translateStatusLabel("customer", s.key, s.label),
        color: s.color,
      })),
    [statuses, locale],
  );

  const value = useMemo(
    () => ({
      statuses,
      ready,
      getMeta,
      updateStatus,
      addStatus,
      removeStatus,
      hydrateFromRemote,
      statusOptions,
    }),
    [statuses, ready, getMeta, updateStatus, addStatus, removeStatus, hydrateFromRemote, statusOptions],
  );

  return <CustomerStatusContext.Provider value={value}>{children}</CustomerStatusContext.Provider>;
}

export function useCustomerStatusConfig() {
  const ctx = useContext(CustomerStatusContext);
  if (!ctx) throw new Error("useCustomerStatusConfig must be used within CustomerStatusProvider");
  return ctx;
}
