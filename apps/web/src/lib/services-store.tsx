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
import { mergeSeedFieldDefs } from "@/lib/field-defs";
import { MOCK_SERVICES, SERVICE_FIELD_DEFS } from "@/lib/mock-services";
import { DEFAULT_LICENSE_WARN_MONTHS, licenseWarnMonthsOf } from "@/lib/order-helpers";
import type { FieldDefinition, Service, ServiceStatus } from "@/lib/types";

const SERVICES_KEY = "dny-crm-services";
const FIELDS_KEY = "dny-crm-service-fields";

export type NewServiceInput = {
  name: string;
  code: string;
  category: string;
  unitPrice: number;
  processingDays: number;
  licenseExpiryWarnMonths?: number;
  customFields?: Record<string, unknown>;
};
export type UpdateServiceInput = Partial<Omit<Service, "id">>;

type ServicesContextValue = {
  services: Service[];
  fieldDefs: FieldDefinition[];
  ready: boolean;
  addService: (input: NewServiceInput) => Service;
  updateService: (id: string, patch: UpdateServiceInput) => Service | undefined;
  setServiceStatus: (id: string, status: ServiceStatus) => void;
  deleteService: (id: string) => void;
  saveFieldDefs: (defs: FieldDefinition[]) => void;
  getById: (id: string) => Service | undefined;
  resetToSeed: () => void;
};

function normalizeService(s: Service): Service {
  return {
    ...s,
    licenseExpiryWarnMonths: licenseWarnMonthsOf(s),
    customFields: s.customFields ?? {},
  };
}

const ServicesContext = createContext<ServicesContextValue | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Service[]>(() => MOCK_SERVICES.map(normalizeService));
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>(SERVICE_FIELD_DEFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedServices = loadJson<Service[]>(SERVICES_KEY);
    const storedFields = loadJson<FieldDefinition[]>(FIELDS_KEY);
    if (storedServices && Array.isArray(storedServices)) {
      setServices(storedServices.map(normalizeService));
    }
    if (storedFields && Array.isArray(storedFields)) {
      setFieldDefs(mergeSeedFieldDefs(storedFields, SERVICE_FIELD_DEFS));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(SERVICES_KEY, services);
  }, [services, ready]);

  useEffect(() => {
    if (!ready) return;
    saveJson(FIELDS_KEY, fieldDefs);
  }, [fieldDefs, ready]);

  const addService = useCallback((input: NewServiceInput) => {
    const created: Service = {
      name: input.name,
      code: input.code,
      category: input.category,
      unitPrice: input.unitPrice,
      processingDays: input.processingDays,
      licenseExpiryWarnMonths: licenseWarnMonthsOf({
        licenseExpiryWarnMonths: input.licenseExpiryWarnMonths ?? DEFAULT_LICENSE_WARN_MONTHS,
      }),
      id: `s-${Date.now()}`,
      status: "active",
      customFields: input.customFields ?? {},
    };
    setServices((prev) => [...prev, created]);
    return created;
  }, []);

  const updateService = useCallback((id: string, patch: UpdateServiceInput) => {
    let updated: Service | undefined;
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        updated = normalizeService({
          ...s,
          ...patch,
          customFields: patch.customFields !== undefined ? patch.customFields : s.customFields,
        });
        return updated;
      }),
    );
    return updated;
  }, []);

  const setServiceStatus = useCallback((id: string, status: ServiceStatus) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const deleteService = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const saveFieldDefs = useCallback((defs: FieldDefinition[]) => {
    setFieldDefs(defs);
  }, []);

  const getById = useCallback(
    (id: string) => services.find((s) => s.id === id),
    [services],
  );

  const resetToSeed = useCallback(() => {
    setServices(MOCK_SERVICES.map(normalizeService));
    setFieldDefs(SERVICE_FIELD_DEFS);
  }, []);

  const value = useMemo(
    () => ({
      services,
      fieldDefs,
      ready,
      addService,
      updateService,
      setServiceStatus,
      deleteService,
      saveFieldDefs,
      getById,
      resetToSeed,
    }),
    [
      services,
      fieldDefs,
      ready,
      addService,
      updateService,
      setServiceStatus,
      deleteService,
      saveFieldDefs,
      getById,
      resetToSeed,
    ],
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices() {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("useServices must be used within ServicesProvider");
  return ctx;
}
