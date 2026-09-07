"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/http/errors";
import { useSession } from "@/lib/session/session-provider";
import type { Customer } from "@/lib/types";
import { customersApi } from "@/modules/customers/api";
import { mapApiCustomerToUi } from "@/modules/customers/map-to-ui";

export function useLiveCustomers(search: string) {
  const { status, can } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"forbidden" | "error" | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    if (!can("customer.view")) {
      setCustomers([]);
      setError("forbidden");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    customersApi
      .list({ page: 1, pageSize: 100, search: search.trim() || undefined })
      .then((res) => {
        if (cancelled) return;
        setCustomers(res.items.map(mapApiCustomerToUi));
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCustomers([]);
        setError(err instanceof ApiError && err.isForbidden ? "forbidden" : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, can, search]);

  const updateLocal = useCallback((id: string, patch: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeLocal = useCallback((id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addLocal = useCallback((items: Customer[]) => {
    setCustomers((prev) => [...items, ...prev]);
  }, []);

  return { customers, loading, error, updateLocal, removeLocal, addLocal };
}
