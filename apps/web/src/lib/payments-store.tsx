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
import { useOrders } from "@/lib/orders-store";
import {
  groupContractTotal,
  groupOrdersByContract,
  pickPrimaryOrder,
  recalcPayment,
} from "@/lib/order-group";
import { isUuid } from "@/lib/http/message";
import type { Order, PaymentInstallment, PaymentRecord } from "@/lib/types";

function paymentFromGroup(group: Order[], existing?: PaymentRecord): PaymentRecord {
  const primary = pickPrimaryOrder(group);
  const totalAmount = groupContractTotal(group);
  const ids = group.map((o) => o.id);
  const base: PaymentRecord = existing
    ? {
        ...existing,
        orderId: primary.id,
        orderNumber: primary.orderNumber,
        customerId: primary.customerId,
        customerName: primary.customerName,
        totalAmount,
        groupedOrderIds: ids,
        installments: existing.installments,
      }
    : {
        id: `pay-${primary.id}`,
        orderId: primary.id,
        orderNumber: primary.orderNumber,
        customerId: primary.customerId,
        customerName: primary.customerName,
        totalAmount,
        paidAmount: 0,
        remaining: totalAmount,
        status: "unpaid",
        installments: [],
        groupedOrderIds: ids,
      };
  return recalcPayment(base);
}

function findExistingForGroup(group: Order[], prev: PaymentRecord[]): PaymentRecord | undefined {
  const ids = new Set(group.map((o) => o.id));
  return prev.find(
    (p) =>
      ids.has(p.orderId) ||
      p.groupedOrderIds?.some((id) => ids.has(id)) ||
      ids.has(String(p.id ?? "").replace(/^pay-/, "")),
  );
}

type PaymentsContextValue = {
  payments: PaymentRecord[];
  ready: boolean;
  getById: (id: string) => PaymentRecord | undefined;
  getByOrderId: (orderId: string) => PaymentRecord | undefined;
  addInstallment: (
    paymentId: string,
    input: Omit<PaymentInstallment, "id" | "status"> & {
      id?: string;
      status?: PaymentInstallment["status"];
    },
  ) => void;
  /** Gắn id phiếu thật vào dòng tạm `pi-…` trước khi verify. */
  linkInstallmentPayment: (paymentId: string, installmentId: string, apiPaymentId: string) => void;
  markInstallmentPaid: (
    paymentId: string,
    installmentId: string,
    patch?: { method?: string; paymentId?: string },
  ) => void;
  replacePayments: (items: PaymentRecord[]) => void;
  upsertPayment: (record: PaymentRecord) => void;
};

const PaymentsContext = createContext<PaymentsContextValue | null>(null);

export function PaymentsProvider({ children }: { children: ReactNode }) {
  const { orders, ready: ordersReady } = useOrders();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !ordersReady) return;
    setPayments((prev) =>
      groupOrdersByContract(orders).map((group) => paymentFromGroup(group, findExistingForGroup(group, prev))),
    );
  }, [orders, ordersReady, hydrated]);

  const replacePayments = useCallback((items: PaymentRecord[]) => {
    setPayments(items);
  }, []);

  const upsertPayment = useCallback((record: PaymentRecord) => {
    setPayments((prev) => {
      const ids = new Set([record.orderId, ...(record.groupedOrderIds ?? [])]);
      const next = prev.filter(
        (p) =>
          p.id !== record.id &&
          !ids.has(p.orderId) &&
          !p.groupedOrderIds?.some((id) => ids.has(id)),
      );
      return [...next, record];
    });
  }, []);

  const getById = useCallback((id: string) => payments.find((p) => p.id === id), [payments]);

  const getByOrderId = useCallback(
    (orderId: string) =>
      payments.find(
        (p) => p.orderId === orderId || p.groupedOrderIds?.includes(orderId) || p.id === `pay-${orderId}`,
      ),
    [payments],
  );

  const addInstallment = useCallback(
    (
      paymentId: string,
      input: Omit<PaymentInstallment, "id" | "status"> & {
        id?: string;
        status?: PaymentInstallment["status"];
      },
    ) => {
      setPayments((prev) =>
        prev.map((p) => {
          if (p.id !== paymentId) return p;
          const id = input.id?.trim() || `pi-${Date.now()}`;
          const linked = input.paymentId ?? (isUuid(id) ? id : undefined);
          const installment: PaymentInstallment = {
            id,
            paymentId: linked,
            amount: Number(input.amount),
            dueDate: input.dueDate,
            paidDate: input.paidDate,
            method: input.method,
            note: input.note,
            status: input.status ?? (input.paidDate ? "paid" : "pending"),
            voidable: input.voidable ?? Boolean(linked),
          };
          return recalcPayment({ ...p, installments: [...p.installments, installment] });
        }),
      );
    },
    [],
  );

  const linkInstallmentPayment = useCallback((paymentId: string, installmentId: string, apiPaymentId: string) => {
    if (!isUuid(apiPaymentId)) return;
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== paymentId) return p;
        return {
          ...p,
          installments: p.installments.map((i) =>
            i.id === installmentId ? { ...i, paymentId: apiPaymentId, voidable: i.status !== "cancelled" } : i,
          ),
        };
      }),
    );
  }, []);

  const markInstallmentPaid = useCallback(
    (paymentId: string, installmentId: string, patch?: { method?: string; paymentId?: string }) => {
      const today = new Date().toISOString().slice(0, 10);
      setPayments((prev) =>
        prev.map((p) => {
          if (p.id !== paymentId) return p;
          const installments = p.installments.map((i) => {
            if (i.id !== installmentId) return i;
            const linked = patch?.paymentId ?? i.paymentId;
            return {
              ...i,
              status: "paid" as const,
              paidDate: today,
              method: patch?.method ?? i.method ?? "BANK_TRANSFER",
              paymentId: linked,
              voidable: true,
            };
          });
          return recalcPayment({ ...p, installments });
        }),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      payments,
      ready: hydrated && ordersReady,
      getById,
      getByOrderId,
      addInstallment,
      linkInstallmentPayment,
      markInstallmentPaid,
      replacePayments,
      upsertPayment,
    }),
    [
      payments,
      hydrated,
      ordersReady,
      getById,
      getByOrderId,
      addInstallment,
      linkInstallmentPayment,
      markInstallmentPaid,
      replacePayments,
      upsertPayment,
    ],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments() {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error("usePayments must be used within PaymentsProvider");
  return ctx;
}
