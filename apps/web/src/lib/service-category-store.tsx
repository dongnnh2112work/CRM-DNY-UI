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
import { tt } from "@/lib/i18n";
import { slugifyKey, uniqueKey } from "@/lib/status-palette";
import { SERVICE_CATEGORIES_CONFIG_KEY, patchConfigDebounced } from "@/modules/config/api";

export type ServiceCategoryDefinition = {
  key: string;
  /** Stored on Service.category / sent to API (human-readable). */
  label: string;
};

const DEFAULT_CATEGORIES: ServiceCategoryDefinition[] = [
  { key: "work_permit", label: "Work Permit" },
  { key: "visa", label: "Visa" },
  { key: "license", label: "License" },
  { key: "legal", label: "Legal" },
  { key: "other", label: "Other" },
];

function parseStored(raw: unknown): ServiceCategoryDefinition[] | null {
  if (!raw || typeof raw !== "object") return null;
  const rows = (raw as { categories?: ServiceCategoryDefinition[] }).categories;
  if (!Array.isArray(rows)) return null;
  const list = rows
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const label = String((c as ServiceCategoryDefinition).label ?? "").trim();
      const keyRaw = String((c as ServiceCategoryDefinition).key ?? "").trim();
      if (!label && !keyRaw) return null;
      const labelFinal = label || keyRaw;
      const key = keyRaw || slugifyKey(labelFinal);
      return { key, label: labelFinal };
    })
    .filter((c): c is ServiceCategoryDefinition => Boolean(c));
  return list.length > 0 ? list : null;
}

function persistCategories(categories: ServiceCategoryDefinition[]) {
  patchConfigDebounced(SERVICE_CATEGORIES_CONFIG_KEY, { categories });
}

type Ctx = {
  categories: ServiceCategoryDefinition[];
  ready: boolean;
  /** Select options — `value` is the label stored on services. */
  categoryOptions: { value: string; label: string }[];
  addCategory: (label: string) => ServiceCategoryDefinition | null;
  updateCategory: (key: string, patch: { label: string }) => void;
  removeCategory: (key: string) => { ok: true } | { ok: false; reason: string };
  /** Ensure a free-text category from existing services appears in the catalog. */
  ensureCategoryLabel: (label: string) => void;
  hydrateFromRemote: (raw: unknown | null) => void;
};

const ServiceCategoryContext = createContext<Ctx | null>(null);

export function ServiceCategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<ServiceCategoryDefinition[]>(DEFAULT_CATEGORIES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const hydrateFromRemote = useCallback((raw: unknown | null) => {
    const parsed = parseStored(raw);
    if (parsed) setCategories(parsed);
  }, []);

  const addCategory = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    let created: ServiceCategoryDefinition | null = null;
    setCategories((prev) => {
      if (prev.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const existing = new Set(prev.map((c) => c.key));
      const key = uniqueKey(slugifyKey(trimmed), existing);
      created = { key, label: trimmed };
      const next = [...prev, created];
      persistCategories(next);
      return next;
    });
    return created;
  }, []);

  const updateCategory = useCallback((key: string, patch: { label: string }) => {
    const trimmed = patch.label.trim();
    if (!trimmed) return;
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx < 0 || prev[idx].label === trimmed) return prev;
      const next = prev.map((c) => (c.key === key ? { ...c, label: trimmed } : c));
      persistCategories(next);
      return next;
    });
  }, []);

  const removeCategory = useCallback((key: string) => {
    let result: { ok: true } | { ok: false; reason: string } = {
      ok: false,
      reason: tt("service.categoryNotFound"),
    };
    setCategories((prev) => {
      if (prev.length <= 1) {
        result = { ok: false, reason: tt("service.categoryNeedOne") };
        return prev;
      }
      if (!prev.some((c) => c.key === key)) return prev;
      result = { ok: true };
      const next = prev.filter((c) => c.key !== key);
      persistCategories(next);
      return next;
    });
    return result;
  }, []);

  const ensureCategoryLabel = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setCategories((prev) => {
      if (prev.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())) return prev;
      const existing = new Set(prev.map((c) => c.key));
      const key = uniqueKey(slugifyKey(trimmed), existing);
      const next = [...prev, { key, label: trimmed }];
      persistCategories(next);
      return next;
    });
  }, []);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.label, label: c.label })),
    [categories],
  );

  const value = useMemo(
    () => ({
      categories,
      ready,
      categoryOptions,
      addCategory,
      updateCategory,
      removeCategory,
      ensureCategoryLabel,
      hydrateFromRemote,
    }),
    [
      categories,
      ready,
      categoryOptions,
      addCategory,
      updateCategory,
      removeCategory,
      ensureCategoryLabel,
      hydrateFromRemote,
    ],
  );

  return (
    <ServiceCategoryContext.Provider value={value}>{children}</ServiceCategoryContext.Provider>
  );
}

export function useServiceCategoryConfig() {
  const ctx = useContext(ServiceCategoryContext);
  if (!ctx) {
    throw new Error("useServiceCategoryConfig must be used within ServiceCategoryProvider");
  }
  return ctx;
}
