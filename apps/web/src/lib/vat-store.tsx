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
import { tt } from "@/lib/i18n";
import { MOCK_VAT_INVOICES } from "@/lib/mock-vat";
import type { VatInvoice, VatStatus } from "@/lib/types";

const KEY = "dny-crm-vat-invoices-v2";

export type NewVatInvoiceInput = Omit<VatInvoice, "id" | "invoiceNumber" | "issueDate" | "status"> & {
  invoiceNumber?: string;
  issueDate?: string;
  status?: VatStatus;
};

type Ctx = {
  invoices: VatInvoice[];
  ready: boolean;
  addInvoice: (input: NewVatInvoiceInput) => VatInvoice;
  updateInvoice: (id: string, patch: Partial<VatInvoice>) => void;
  deleteInvoices: (ids: string[]) => void;
};

const VatContext = createContext<Ctx | null>(null);

function nextInvoiceNumber(existing: VatInvoice[]) {
  const year = new Date().getFullYear();
  const prefix = `VAT-${year}-`;
  let max = 0;
  for (const inv of existing) {
    if (!inv.invoiceNumber.startsWith(prefix)) continue;
    const n = Number(inv.invoiceNumber.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function ensureLines(inv: VatInvoice): VatInvoice {
  const existing = Array.isArray(inv.lines) ? inv.lines : [];
  const line1 = existing[0] ?? { description: "", amount: inv.amount ?? 0 };
  const line2 = existing[1] ?? { description: "", amount: 0 };
  return { ...inv, lines: [line1, line2, ...existing.slice(2)] };
}

export function VatProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<VatInvoice[]>(MOCK_VAT_INVOICES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadJson<VatInvoice[]>(KEY);
    if (stored && Array.isArray(stored)) setInvoices(stored.map(ensureLines));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(KEY, invoices);
  }, [invoices, ready]);

  const addInvoice = useCallback((input: NewVatInvoiceInput) => {
    if (input.contractNumber == null || input.contractNumber < 1) {
      throw new Error(tt("vat.storeNeedContract"));
    }
    let created: VatInvoice | undefined;
    setInvoices((prev) => {
      created = ensureLines({
        ...input,
        id: `v-${Date.now()}`,
        invoiceNumber: input.invoiceNumber ?? nextInvoiceNumber(prev),
        issueDate: input.issueDate ?? new Date().toISOString().slice(0, 10),
        status: input.status ?? "draft",
        lines: input.lines,
      });
      return [created, ...prev];
    });
    return created!;
  }, []);

  const updateInvoice = useCallback((id: string, patch: Partial<VatInvoice>) => {
    setInvoices((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);

  const deleteInvoices = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setInvoices((prev) => prev.filter((v) => !set.has(v.id)));
  }, []);

  const value = useMemo(
    () => ({ invoices, ready, addInvoice, updateInvoice, deleteInvoices }),
    [invoices, ready, addInvoice, updateInvoice, deleteInvoices],
  );

  return <VatContext.Provider value={value}>{children}</VatContext.Provider>;
}

export function useVat() {
  const ctx = useContext(VatContext);
  if (!ctx) throw new Error("useVat must be used within VatProvider");
  return ctx;
}
