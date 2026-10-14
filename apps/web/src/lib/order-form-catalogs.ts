"use client";

import { useEffect, useState } from "react";
import { useApiHydrate, useApiRefresh, useRemoteList } from "@/components/api-hydrator";
import type { ListSliceMeta } from "@/lib/load-api-data";
import { lookupCustomerName, resolveEntityLookups } from "@/lib/entity-lookups";
import { hasHydratedName } from "@/lib/order-helpers";
import type { RefreshScope } from "@/lib/route-data-scopes";
import { useSession } from "@/lib/session/session-provider";

/** Counts-only dashboard meta uses page 0 and does not fill the store. */
function listFetched(meta: ListSliceMeta | undefined) {
  return meta != null && meta.page >= 1;
}

/**
 * Service / customer / user lists are not on the order detail or create-form
 * critical path. Load them only while a form that needs the catalogs is open.
 */
export function useOrderFormCatalogs(enabled: boolean) {
  const refresh = useApiRefresh();
  const { listMeta } = useApiHydrate();
  const services = useRemoteList("services");
  const customers = useRemoteList("customers");
  const users = useRemoteList("users");
  const servicesLoaded = listFetched(listMeta.services);
  const customersLoaded = listFetched(listMeta.customers);
  const usersLoaded = listFetched(listMeta.users);

  useEffect(() => {
    if (!enabled) return;
    const need: RefreshScope[] = [];
    if (!servicesLoaded) need.push("services");
    if (!customersLoaded) need.push("customers");
    if (!usersLoaded) need.push("users");
    if (need.length) void refresh(need);
  }, [enabled, servicesLoaded, customersLoaded, usersLoaded, refresh]);

  return {
    servicesLoading: services.bootLoading,
    customersLoading: customers.bootLoading,
    usersLoading: users.bootLoading,
  };
}

export type SelectOption = { value: string; label: string };

export function firstUsableLabel(...labels: Array<string | null | undefined>): string | undefined {
  for (const label of labels) {
    const text = label?.trim();
    if (text && text !== "—" && hasHydratedName(text)) return text;
  }
  return undefined;
}

/** Keep the current id selectable with its name when that row is not in the loaded page. */
export function withCurrentSelectOption(
  options: SelectOption[],
  current?: { value?: string | null; label?: string | null },
): SelectOption[] {
  const value = current?.value?.trim();
  if (!value || options.some((option) => option.value === value)) return options;
  const label = firstUsableLabel(current?.label);
  if (!label) return options;
  return [...options, { value, label }];
}

export function resolveCatalogEntity<T extends { id: string; name: string }>(
  rows: readonly T[],
  id: string | undefined,
  fallback?: { id?: string; name?: string },
): { id: string; name: string } | undefined {
  if (!id) return undefined;
  const found = rows.find((row) => row.id === id);
  if (found) return found;
  if (fallback?.id !== id) return undefined;
  return { id, name: firstUsableLabel(fallback.name) ?? "" };
}

/** Name for `?customerId=` when that customer is outside the loaded list page. */
export function usePrefillCustomerOption(customerId?: string, knownLabel?: string) {
  const { user } = useSession();
  const known = firstUsableLabel(knownLabel);
  const cached = customerId ? lookupCustomerName(customerId) : undefined;
  const immediate = known ?? (cached && hasHydratedName(cached) ? cached : undefined);
  const [fetched, setFetched] = useState<SelectOption | null>(null);

  useEffect(() => {
    if (!customerId || immediate) return;
    let cancelled = false;
    void resolveEntityLookups({ customerIds: [customerId] }, user?.permissions).then(() => {
      if (cancelled) return;
      const name = lookupCustomerName(customerId);
      if (!name || !hasHydratedName(name)) return;
      setFetched((prev) =>
        prev?.value === customerId && prev.label === name ? prev : { value: customerId, label: name },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, immediate, user?.permissions]);

  if (!customerId) return null;
  if (immediate) return { value: customerId, label: immediate };
  if (fetched?.value === customerId) return fetched;
  return null;
}
