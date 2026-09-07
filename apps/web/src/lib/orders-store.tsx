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
import { isContractNumberTaken, nextDossierNumber, normalizeOrder } from "@/lib/order-helpers";
import type { Order, OrderStage } from "@/lib/types";

export type NewOrderInput = {
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  channel: Order["channel"];
  ctvId?: string;
  ctvName?: string;
  value: number;
  commissionPercent?: number;
  zaloGroupUrl?: string;
  ctvPrice?: number;
  assignedUserId: string;
  assignedUserName: string;
  submitterId: string;
  submitterName: string;
  reviewerId?: string;
  reviewerName?: string;
  notes?: string;
  needsVat: boolean;
  contractNumber?: number;
  deadline?: string;
  vatIssueDeadline?: string;
};

type OrdersContextValue = {
  orders: Order[];
  ready: boolean;
  addOrder: (input: NewOrderInput) => Order;
  updateOrder: (id: string, patch: Partial<Omit<Order, "id">> | ((prev: Order) => Order)) => void;
  setOrderStage: (id: string, stage: OrderStage) => void;
  deleteOrder: (id: string) => void;
  replaceOrders: (items: Order[]) => void;
  getById: (id: string) => Order | undefined;
  isContractTaken: (contractNumber: number, excludeOrderId?: string) => boolean;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const isContractTaken = useCallback(
    (contractNumber: number, excludeOrderId?: string) =>
      isContractNumberTaken(orders, contractNumber, excludeOrderId),
    [orders],
  );

  const replaceOrders = useCallback((items: Order[]) => {
    setOrders(items.map(normalizeOrder));
  }, []);

  const addOrder = useCallback(
    (input: NewOrderInput) => {
      if (input.needsVat) {
        if (input.contractNumber == null || input.contractNumber < 1) {
          throw new Error(tt("order.contractRequiredVat"));
        }
        if (isContractNumberTaken(orders, input.contractNumber)) {
          throw new Error(tt("order.contractTakenStore"));
        }
      }
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const created: Order = {
        id: `o-${Date.now()}`,
        orderNumber: nextDossierNumber(orders, now),
        customerId: input.customerId,
        customerName: input.customerName,
        serviceId: input.serviceId,
        serviceName: input.serviceName,
        stage: "new",
        channel: input.channel,
        ctvId: input.ctvId,
        ctvName: input.ctvName,
        value: input.value,
        commissionPercent: input.commissionPercent,
        zaloGroupUrl: input.zaloGroupUrl?.trim() || undefined,
        ctvPrice: input.ctvPrice,
        assignedUserId: input.assignedUserId,
        assignedUserName: input.assignedUserName,
        submitterId: input.submitterId,
        submitterName: input.submitterName,
        reviewerId: input.reviewerId,
        reviewerName: input.reviewerName,
        attachments: [],
        licenseAttachments: [],
        approvalStatus: "none",
        approvalHistory: [],
        notes: input.notes,
        createdAt: `${y}-${m}-${d}`,
        month: `${y}-${m}`,
        needsVat: input.needsVat,
        contractNumber: input.needsVat ? input.contractNumber : undefined,
        deadline: input.deadline,
        vatIssueDeadline: input.needsVat ? input.vatIssueDeadline : undefined,
      };
      setOrders((prev) => [created, ...prev]);
      return created;
    },
    [orders],
  );

  const updateOrder = useCallback(
    (id: string, patch: Partial<Omit<Order, "id">> | ((prev: Order) => Order)) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          if (typeof patch === "function") return patch(o);
          return { ...o, ...patch };
        }),
      );
    },
    [],
  );

  const setOrderStage = useCallback((id: string, stage: OrderStage) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, stage, approvalStatus: "none" as const, pendingTransition: undefined }
          : o,
      ),
    );
  }, []);

  const deleteOrder = useCallback((id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const getById = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);

  const value = useMemo(
    () => ({
      orders,
      ready,
      addOrder,
      updateOrder,
      setOrderStage,
      deleteOrder,
      replaceOrders,
      getById,
      isContractTaken,
    }),
    [orders, ready, addOrder, updateOrder, setOrderStage, deleteOrder, replaceOrders, getById, isContractTaken],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
