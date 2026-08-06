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
import { MOCK_PAYMENTS } from "@/lib/mock-payments";
import { useOrders } from "@/lib/orders-store";
import type { Order, PaymentInstallment, PaymentRecord, PaymentStatus } from "@/lib/types";

const PAYMENTS_KEY = "dny-crm-payments";

function orderTotal(order: Order): number {
  if (order.channel === "ctv" && order.ctvPrice != null) return order.ctvPrice;
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
};

const PaymentsContext = createContext<PaymentsContextValue | null>(null);

export function PaymentsProvider({ children }: { children: ReactNode }) {
  const { orders, ready: ordersReady } = useOrders();
  const [payments, setPayments] = useState<PaymentRecord[]>(MOCK_PAYMENTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadJson<PaymentRecord[]>(PAYMENTS_KEY);
    if (stored && Array.isArray(stored)) setPayments(stored);
    setHydrated(true);
  }, []);

  // Sync payment records with orders (create missing, update order info, drop orphaned)
  useEffect(() => {
    if (!hydrated || !ordersReady) return;
    setPayments((prev) => {
      const byOrder = new Map(prev.map((p) => [p.orderId, p]));
      const next = orders.map((order) => paymentFromOrder(order, byOrder.get(order.id)));
      // Keep seed payments that still match an order; drop orphans for deleted orders
      const same =
        next.length === prev.length &&
        next.every((p, i) => {
          const o = prev[i];
          return (
            o &&
            o.id === p.id &&
            o.orderNumber === p.orderNumber &&
            o.customerName === p.customerName &&
            o.totalAmount === p.totalAmount &&
            o.paidAmount === p.paidAmount &&
            o.remaining === p.remaining &&
            o.status === p.status &&
            JSON.stringify(o.installments) === JSON.stringify(p.installments)
          );
        });
      return same ? prev : next;
    });
  }, [orders, ordersReady, hydrated]);

  useEffect(() => {
    if (!hydrated || !ordersReady) return;
    saveJson(PAYMENTS_KEY, payments);
  }, [payments, hydrated, ordersReady]);

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
    }),
    [payments, hydrated, ordersReady, getById, getByOrderId, addInstallment, markInstallmentPaid],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments() {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error("usePayments must be used within PaymentsProvider");
  return ctx;
}
