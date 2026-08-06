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
import { MOCK_CTVS } from "@/lib/mock-ctv";
import type { Ctv, CtvJob, CtvStatus } from "@/lib/types";

const CTVS_KEY = "dny-crm-ctvs";

export type NewCtvInput = {
  name: string;
  phone: string;
  email: string;
  status?: CtvStatus;
};

type CtvsContextValue = {
  ctvs: Ctv[];
  ready: boolean;
  addCtv: (input: NewCtvInput) => Ctv;
  updateCtv: (id: string, patch: Partial<Omit<Ctv, "id">>) => void;
  deleteCtv: (id: string) => void;
  addJob: (ctvId: string, job: CtvJob) => void;
  getById: (id: string) => Ctv | undefined;
};

const CtvsContext = createContext<CtvsContextValue | null>(null);

function withTotals(ctv: Ctv): Ctv {
  return {
    ...ctv,
    totalJobs: ctv.jobs.length,
    totalCommission: ctv.jobs.reduce((sum, j) => sum + j.commission, 0),
  };
}

export function CtvsProvider({ children }: { children: ReactNode }) {
  const [ctvs, setCtvs] = useState<Ctv[]>(MOCK_CTVS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadJson<Ctv[]>(CTVS_KEY);
    if (stored && Array.isArray(stored)) setCtvs(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(CTVS_KEY, ctvs);
  }, [ctvs, ready]);

  const addCtv = useCallback((input: NewCtvInput) => {
    const created = withTotals({
      id: `ctv-${Date.now()}`,
      name: input.name,
      phone: input.phone,
      email: input.email,
      status: input.status ?? "active",
      jobs: [],
      totalJobs: 0,
      totalCommission: 0,
    });
    setCtvs((prev) => [...prev, created]);
    return created;
  }, []);

  const updateCtv = useCallback((id: string, patch: Partial<Omit<Ctv, "id">>) => {
    setCtvs((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch, jobs: patch.jobs ?? c.jobs };
        return withTotals(next);
      }),
    );
  }, []);

  const deleteCtv = useCallback((id: string) => {
    setCtvs((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addJob = useCallback((ctvId: string, job: CtvJob) => {
    setCtvs((prev) =>
      prev.map((c) => {
        if (c.id !== ctvId) return c;
        if (c.jobs.some((j) => j.orderId === job.orderId)) return c;
        return withTotals({ ...c, jobs: [...c.jobs, job] });
      }),
    );
  }, []);

  const getById = useCallback((id: string) => ctvs.find((c) => c.id === id), [ctvs]);

  const value = useMemo(
    () => ({ ctvs, ready, addCtv, updateCtv, deleteCtv, addJob, getById }),
    [ctvs, ready, addCtv, updateCtv, deleteCtv, addJob, getById],
  );

  return <CtvsContext.Provider value={value}>{children}</CtvsContext.Provider>;
}

export function useCtvs() {
  const ctx = useContext(CtvsContext);
  if (!ctx) throw new Error("useCtvs must be used within CtvsProvider");
  return ctx;
}
