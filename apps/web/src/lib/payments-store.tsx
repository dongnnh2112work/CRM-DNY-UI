"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

function mergeInstallments(
  prev: PaymentInstallment[] | undefined,
  next: PaymentInstallment[],
): PaymentInstallment[] {
  if (!next.length) return prev ?? [];
  if (!prev?.length) return next;
  const byId = new Map(prev.map((installment) => [installment.id, installment]));
  for (const installment of next) byId.set(installment.id, installment);
  return [...byId.values()];
}

/** Giá HĐ lấy từ đơn đang có. Đợt thu giữ từ record thanh toán, không lấy tổng các đợt làm giá HĐ. */
function regroupWithOrders(orders: Order[], records: PaymentRecord[]): PaymentRecord[] {
  if (!orders.length) return records;
  const grouped = groupOrdersByContract(orders).map((group) =>
    paymentFromGroup(group, findExistingForGroup(group, records)),
  );
  const covered = new Set(grouped.flatMap((p) => [p.orderId, ...(p.groupedOrderIds ?? [])]));
  const extras = records.filter((p) => {
    const ids = [p.orderId, ...(p.groupedOrderIds ?? [])];
    return !ids.some((id) => covered.has(id));
  });
  return [...grouped, ...extras];
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
  /** Ghi đè một đợt sau khi sửa (số tiền, hạn, phương thức, ghi chú). */
  replaceInstallment: (paymentId: string, installmentId: string, next: PaymentInstallment) => void;
  patchInstallmentNote: (paymentId: string, apiPaymentId: string, note: string) => void;
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
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !ordersReady) return;
    setPayments((prev) => regroupWithOrders(orders, prev));
  }, [orders, ordersReady, hydrated]);

  const replacePayments = useCallback((items: PaymentRecord[]) => {
    setPayments(regroupWithOrders(ordersRef.current, items));
  }, []);

  const upsertPayment = useCallback((record: PaymentRecord) => {
    setPayments((prev) => {
      const ids = new Set([record.orderId, ...(record.groupedOrderIds ?? [])]);
      const existing = prev.find(
        (p) =>
          p.id === record.id ||
          ids.has(p.orderId) ||
          p.groupedOrderIds?.some((id) => ids.has(id)),
      );
      const draft: PaymentRecord = {
        ...(existing ?? record),
        ...record,
        installments: mergeInstallments(existing?.installments, record.installments),
        groupedOrderIds: record.groupedOrderIds?.length
          ? record.groupedOrderIds
          : existing?.groupedOrderIds,
      };
      const next = prev.filter(
        (p) =>
          p !== existing &&
          p.id !== record.id &&
          !ids.has(p.orderId) &&
          !p.groupedOrderIds?.some((id) => ids.has(id)),
      );
      return regroupWithOrders(ordersRef.current, [...next, draft]);
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

  const replaceInstallment = useCallback((paymentId: string, installmentId: string, next: PaymentInstallment) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== paymentId) return p;
        const installments = p.installments.map((row) => (row.id === installmentId ? next : row));
        return recalcPayment({ ...p, installments });
      }),
    );
  }, []);

  const patchInstallmentNote = useCallback((paymentId: string, apiPaymentId: string, note: string) => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== paymentId) return p;
        return {
          ...p,
          installments: p.installments.map((row) =>
            row.id === apiPaymentId || row.paymentId === apiPaymentId ? { ...row, note: trimmed } : row,
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
      replaceInstallment,
      patchInstallmentNote,
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
      replaceInstallment,
      patchInstallmentNote,
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
