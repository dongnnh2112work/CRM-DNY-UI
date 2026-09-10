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
import type { Order, PaymentInstallment, PaymentRecord, PaymentStatus } from "@/lib/types";

function orderTotal(order: Order): number {
  return order.value;
}

function computeStatus(paidAmount: number, totalAmount: number, installments: PaymentInstallment[]): PaymentStatus {
  if (totalAmount <= 0) return "unpaid";
  if (paidAmount <= 0) {
    const hasOverdue = installments.some((i) => i.status === "overdue");
    return hasOverdue ? "overdue" : "unpaid";
  }
  if (paidAmount >= totalAmount) return "paid";
  const hasOverdue = installments.some((i) => i.status === "overdue" || (i.status === "pending" && i.dueDate < new Date().toISOString().slice(0, 10)));
  return hasOverdue ? "overdue" : "partial";
}

function recalc(record: PaymentRecord): PaymentRecord {
  const paidAmount = record.installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const remaining = Math.max(0, record.totalAmount - paidAmount);
  return {
    ...record,
    paidAmount,
    remaining,
    status: computeStatus(paidAmount, record.totalAmount, record.installments),
  };
}

function paymentFromOrder(order: Order, existing?: PaymentRecord): PaymentRecord {
  const totalAmount = orderTotal(order);
  const base: PaymentRecord = existing
    ? {
        ...existing,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        totalAmount,
      }
    : {
        id: `pay-${order.id}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        totalAmount,
        paidAmount: 0,
        remaining: totalAmount,
        status: "unpaid",
        installments: [],
      };
  return recalc(base);
}

type PaymentsContextValue = {
  payments: PaymentRecord[];
  ready: boolean;
  getById: (id: string) => PaymentRecord | undefined;
  getByOrderId: (orderId: string) => PaymentRecord | undefined;
  addInstallment: (
    paymentId: string,
    input: Omit<PaymentInstallment, "id" | "status"> & { status?: PaymentInstallment["status"] },
  ) => void;
  markInstallmentPaid: (paymentId: string, installmentId: string, method?: string) => void;
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
    setPayments((prev) => {
      const byOrder = new Map(prev.map((p) => [p.orderId, p]));
      return orders.map((order) => paymentFromOrder(order, byOrder.get(order.id)));
    });
  }, [orders, ordersReady, hydrated]);

  const replacePayments = useCallback((items: PaymentRecord[]) => {
    setPayments(items);
  }, []);

  const upsertPayment = useCallback((record: PaymentRecord) => {
    setPayments((prev) => {
      const next = prev.filter((p) => p.orderId !== record.orderId && p.id !== record.id);
      return [...next, record];
    });
  }, []);

  const getById = useCallback((id: string) => payments.find((p) => p.id === id), [payments]);

  const getByOrderId = useCallback(
    (orderId: string) => payments.find((p) => p.orderId === orderId),
    [payments],
  );

  const addInstallment = useCallback(
    (
      paymentId: string,
      input: Omit<PaymentInstallment, "id" | "status"> & { status?: PaymentInstallment["status"] },
    ) => {
      setPayments((prev) =>
        prev.map((p) => {
          if (p.id !== paymentId) return p;
          const installment: PaymentInstallment = {
            id: `pi-${Date.now()}`,
            amount: Number(input.amount),
            dueDate: input.dueDate,
            paidDate: input.paidDate,
            method: input.method,
            note: input.note,
            status: input.status ?? (input.paidDate ? "paid" : "pending"),
          };
          return recalc({ ...p, installments: [...p.installments, installment] });
        }),
      );
    },
    [],
  );

  const markInstallmentPaid = useCallback((paymentId: string, installmentId: string, method?: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== paymentId) return p;
        const installments = p.installments.map((i) =>
          i.id === installmentId
            ? { ...i, status: "paid" as const, paidDate: today, method: method ?? i.method ?? "Bank transfer" }
            : i,
        );
        return recalc({ ...p, installments });
      }),
    );
  }, []);

  const value = useMemo(
    () => ({
      payments,
      ready: hydrated && ordersReady,
      getById,
      getByOrderId,
      addInstallment,
      markInstallmentPaid,
      replacePayments,
      upsertPayment,
    }),
    [payments, hydrated, ordersReady, getById, getByOrderId, addInstallment, markInstallmentPaid, replacePayments, upsertPayment],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments() {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error("usePayments must be used within PaymentsProvider");
  return ctx;
}
