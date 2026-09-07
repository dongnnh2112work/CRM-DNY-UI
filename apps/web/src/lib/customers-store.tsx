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
import { CUSTOMER_FIELD_DEFS } from "@/lib/mock-customers";
import type { Customer, CustomerStatus, FieldDefinition } from "@/lib/types";

const FIELDS_KEY = "dny-crm-customer-fields";

export type NewCustomerInput = {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  taxCode?: string;
  address?: string;
  owner: string;
  status?: CustomerStatus;
  usedServiceIds?: string[];
  customFields?: Record<string, unknown>;
};

type CustomersContextValue = {
  customers: Customer[];
  fieldDefs: FieldDefinition[];
  ready: boolean;
  replaceCustomers: (items: Customer[]) => void;
  addCustomer: (input: NewCustomerInput) => Customer;
  addCustomers: (items: Customer[]) => void;
  updateCustomer: (id: string, patch: Partial<Omit<Customer, "id">>) => void;
  deleteCustomer: (id: string) => void;
  saveFieldDefs: (defs: FieldDefinition[]) => void;
  getById: (id: string) => Customer | undefined;
};

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function CustomersProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>(CUSTOMER_FIELD_DEFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedFields = loadJson<FieldDefinition[]>(FIELDS_KEY);
    if (storedFields && Array.isArray(storedFields)) {
      setFieldDefs(mergeSeedFieldDefs(storedFields, CUSTOMER_FIELD_DEFS));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(FIELDS_KEY, fieldDefs);
  }, [fieldDefs, ready]);

  const replaceCustomers = useCallback((items: Customer[]) => {
    setCustomers(items);
  }, []);

  const addCustomer = useCallback((input: NewCustomerInput) => {
    const created: Customer = {
      id: `c-${Date.now()}`,
      name: input.name,
      phone: input.phone,
      email: input.email ?? "",
      company: input.company,
      taxCode: input.taxCode,
      address: input.address,
      owner: input.owner,
      status: input.status ?? "lead",
      createdAt: new Date().toISOString().slice(0, 10),
      usedServiceIds: input.usedServiceIds ?? [],
      customFields: input.customFields ?? {},
    };
    setCustomers((prev) => [...prev, created]);
    return created;
  }, []);

  const addCustomers = useCallback((items: Customer[]) => {
    setCustomers((prev) => [...prev, ...items]);
  }, []);

  const updateCustomer = useCallback((id: string, patch: Partial<Omit<Customer, "id">>) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              ...patch,
              customFields: patch.customFields !== undefined ? patch.customFields : c.customFields,
            }
          : c,
      ),
    );
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const saveFieldDefs = useCallback((defs: FieldDefinition[]) => {
    setFieldDefs(defs);
  }, []);

  const getById = useCallback((id: string) => customers.find((c) => c.id === id), [customers]);

  const value = useMemo(
    () => ({
      customers,
      fieldDefs,
      ready,
      replaceCustomers,
      addCustomer,
      addCustomers,
      updateCustomer,
      deleteCustomer,
      saveFieldDefs,
      getById,
    }),
    [
      customers,
      fieldDefs,
      ready,
      replaceCustomers,
      addCustomer,
      addCustomers,
      updateCustomer,
      deleteCustomer,
      saveFieldDefs,
      getById,
    ],
  );

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
}

export function useCustomers() {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within CustomersProvider");
  return ctx;
}

export const CUSTOMER_LOCKED_FIELD_KEYS = [
  "name",
  "phone",
  "email",
  "company",
  "taxCode",
  "address",
  "owner",
  "status",
  "usedServiceIds",
  "createdAt",
];
