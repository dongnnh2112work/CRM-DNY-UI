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
import { ds } from "@/lib/design-tokens";
import {
  STATUS_CONFIG,
  type StatusMeta,
  type StatusModule,
  type StatusTone,
} from "@/lib/status-config";
import type { OrderStage } from "@/lib/types";
import { ORDER_STAGES } from "@/lib/types";

const KEY = "dny-crm-order-stage-meta";

/** Soft Notion-like palette — swatches only */
export const STAGE_COLOR_PALETTE = [
  "#787774",
  "#9b6b43",
  "#d9730d",
  "#cb912f",
  "#448361",
  "#337ea9",
  "#9065b0",
  "#c14c8a",
  "#d44c47",
  "#5d6b7a",
  "#2a9d99",
  "#5b67a5",
  "#a8557a",
  "#6b7280",
  "#b45309",
  "#15803d",
] as const;

const TONE_TO_HEX: Record<StatusTone, string> = {
  processing: "#337ea9",
  success: "#448361",
  warning: "#d9730d",
  error: "#d44c47",
  default: "#787774",
};

export type OrderStageDefinition = {
  key: OrderStage;
  label: string;
  /** Hex color for Tag / dots */
  color: string;
};

export type OrderStageDisplayMeta = {
  label: string;
  color: string;
};

function defaultStages(): OrderStageDefinition[] {
  const base = STATUS_CONFIG.orderStage;
  /** Unique hex per default stage (not shared Ant tones) */
  const defaultColors: Record<string, string> = {
    new: "#337ea9",
    processing: "#d9730d",
    waiting_customer: "#9065b0",
    waiting_gov: "#cb912f",
    completed: "#448361",
    cancelled: "#787774",
  };
  return ORDER_STAGES.map((s) => {
    const meta = base[s.key];
    return {
      key: s.key,
      label: meta?.label ?? s.label,
      color: defaultColors[s.key] ?? TONE_TO_HEX[(meta?.color ?? "default") as StatusTone],
    };
  });
}

export function getDefaultOrderStages(): OrderStageDefinition[] {
  return defaultStages();
}

export function nextFreeStageColor(usedColors: string[]): string | null {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  return STAGE_COLOR_PALETTE.find((c) => !used.has(c.toLowerCase())) ?? null;
}

function normalizeStoredColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (raw.startsWith("#")) return raw;
  if (raw in TONE_TO_HEX) return TONE_TO_HEX[raw as StatusTone];
  return fallback;
}

function slugifyKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return base || `stage_${Date.now()}`;
}

function uniqueKey(desired: string, existing: Set<string>): string {
  let key = desired;
  let n = 2;
  while (existing.has(key)) {
    key = `${desired}_${n}`;
    n += 1;
  }
  return key;
}

type PersistedV1 = Record<string, { label?: string; color?: string }>;
type PersistedV2 = { stages: OrderStageDefinition[] };

function ensureUniqueColors(list: OrderStageDefinition[]): OrderStageDefinition[] {
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

function parseStored(raw: unknown): OrderStageDefinition[] | null {
  if (!raw || typeof raw !== "object") return null;

  if (Array.isArray((raw as PersistedV2).stages)) {
    const list = (raw as PersistedV2).stages
      .filter((s) => s && typeof s.key === "string")
      .map((s) => ({
        key: s.key,
        label: s.label?.trim() || s.key,
        color: normalizeStoredColor(s.color, STAGE_COLOR_PALETTE[0]),
      }));
    return list.length > 0 ? ensureUniqueColors(list) : null;
  }

  // Legacy map keyed by stage
  const map = raw as PersistedV1;
  const defaults = defaultStages();
  return ensureUniqueColors(
    defaults.map((d) => {
      const row = map[d.key];
      return {
        key: d.key,
        label: row?.label?.trim() || d.label,
        color: normalizeStoredColor(row?.color, d.color),
      };
    }),
  );
}

/** Unified meta for badges: label + color string (tone name or hex) */
export type DisplayStatusMeta = { label: string; color: string };

type Ctx = {
  stages: OrderStageDefinition[];
  ready: boolean;
  getMeta: (module: StatusModule, status: string) => DisplayStatusMeta;
  updateStage: (key: OrderStage, patch: Partial<OrderStageDisplayMeta>) => void;
  addStage: (input?: { label?: string; color?: string }) => OrderStageDefinition | null;
  removeStage: (key: OrderStage) => { ok: true } | { ok: false; reason: string };
  replaceStages: (next: OrderStageDefinition[]) => void;
  resetDefaults: () => void;
  stageOptions: { value: OrderStage; label: string; color: string }[];
};

const OrderStatusContext = createContext<Ctx | null>(null);

export function OrderStatusProvider({ children }: { children: ReactNode }) {
  const [stages, setStages] = useState<OrderStageDefinition[]>(defaultStages);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadJson<unknown>(KEY);
    const parsed = parseStored(stored);
    if (parsed) setStages(parsed);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(KEY, { stages } satisfies PersistedV2);
  }, [stages, ready]);

  const getMeta = useCallback(
    (module: StatusModule, status: string): DisplayStatusMeta => {
      if (module === "orderStage") {
        const found = stages.find((s) => s.key === status);
        if (found) return { label: found.label, color: found.color };
        return { label: status, color: STAGE_COLOR_PALETTE[0] };
      }
      const meta: StatusMeta = STATUS_CONFIG[module][status] ?? {
        label: status,
        color: "default",
      };
      return { label: meta.label, color: meta.color };
    },
    [stages],
  );

  const updateStage = useCallback((key: OrderStage, patch: Partial<OrderStageDisplayMeta>) => {
    setStages((prev) => {
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
  }, []);

  const addStage = useCallback((input?: { label?: string; color?: string }) => {
    let created: OrderStageDefinition | null = null;
    setStages((prev) => {
      const free =
        (input?.color &&
        !prev.some((s) => s.color.toLowerCase() === input.color!.toLowerCase())
          ? input.color
          : null) ?? nextFreeStageColor(prev.map((s) => s.color));
      if (!free) return prev;
      const existing = new Set(prev.map((s) => s.key));
      const label = input?.label?.trim() || `Giai đoạn ${prev.length + 1}`;
      const key = uniqueKey(slugifyKey(label), existing);
      created = { key, label, color: free };
      return [...prev, created];
    });
    return created;
  }, []);

  const removeStage = useCallback((key: OrderStage) => {
    let result: { ok: true } | { ok: false; reason: string } = {
      ok: false,
      reason: "Không tìm thấy giai đoạn",
    };
    setStages((prev) => {
      if (prev.length <= 1) {
        result = { ok: false, reason: "Cần giữ ít nhất một giai đoạn" };
        return prev;
      }
      if (!prev.some((s) => s.key === key)) {
        return prev;
      }
      result = { ok: true };
      return prev.filter((s) => s.key !== key);
    });
    return result;
  }, []);

  const replaceStages = useCallback((next: OrderStageDefinition[]) => {
    if (next.length === 0) return;
    setStages(next.map((s) => ({ ...s, label: s.label.trim() || s.key })));
  }, []);

  const resetDefaults = useCallback(() => {
    setStages(defaultStages());
  }, []);

  const stageOptions = useMemo(
    () => stages.map((s) => ({ value: s.key, label: s.label, color: s.color })),
    [stages],
  );

  const value = useMemo(
    () => ({
      stages,
      ready,
      getMeta,
      updateStage,
      addStage,
      removeStage,
      replaceStages,
      resetDefaults,
      stageOptions,
    }),
    [
      stages,
      ready,
      getMeta,
      updateStage,
      addStage,
      removeStage,
      replaceStages,
      resetDefaults,
      stageOptions,
    ],
  );

  return <OrderStatusContext.Provider value={value}>{children}</OrderStatusContext.Provider>;
}

export function useOrderStatusConfig() {
  const ctx = useContext(OrderStatusContext);
  if (!ctx) throw new Error("useOrderStatusConfig must be used within OrderStatusProvider");
  return ctx;
}

export function useStatusMeta(module: StatusModule, status: string): DisplayStatusMeta {
  const ctx = useContext(OrderStatusContext);
  if (ctx) return ctx.getMeta(module, status);
  const meta = STATUS_CONFIG[module][status] ?? { label: status, color: "default" as StatusTone };
  return { label: meta.label, color: meta.color };
}

const TONE_DOT: Record<StatusTone, string> = {
  success: ds.accentGreen,
  warning: ds.accentOrange,
  error: ds.danger,
  processing: ds.primary,
  default: ds.inkFaint,
};

/** Resolve Tag/dot color — hex or Ant tone name */
export function resolveStatusColor(color: string): string {
  if (color.startsWith("#")) return color;
  return TONE_DOT[color as StatusTone] ?? color;
}
