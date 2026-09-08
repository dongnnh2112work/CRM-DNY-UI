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
import type { OrderExpense, OrderExpenseStatus } from "@/lib/types";

export type NewExpenseInput = {
  orderId?: string;
  orderNumber?: string;
  projectName: string;
  amount: number;
  title: string;
  note?: string;
  requestedById: string;
  requestedByName: string;
  payeeName: string;
  bankAccount: string;
  bankName: string;
};

type Ctx = {
  expenses: OrderExpense[];
  ready: boolean;
  getByOrderId: (orderId: string) => OrderExpense[];
  totalApprovedChi: (orderId: string) => number;
  addExpense: (input: NewExpenseInput) => OrderExpense;
  reviewExpense: (
    id: string,
    status: Extract<OrderExpenseStatus, "approved" | "rejected">,
    reviewer: { id: string; name: string },
    reviewNote?: string,
  ) => void;
  replaceExpenses: (items: OrderExpense[]) => void;
  mergeExpensesForOrder: (orderId: string, items: OrderExpense[]) => void;
};

function normalizeExpense(e: OrderExpense): OrderExpense {
  return {
    ...e,
    projectName: (e.projectName || e.orderNumber || "").trim(),
    payeeName: e.payeeName ?? "",
    bankAccount: e.bankAccount ?? "",
    bankName: e.bankName ?? "",
  };
}

export function expenseProjectLabel(
  e: Pick<OrderExpense, "projectName" | "orderNumber">,
): string {
  return (e.projectName || e.orderNumber || "—").trim() || "—";
}

const ExpensesContext = createContext<Ctx | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<OrderExpense[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const getByOrderId = useCallback(
    (orderId: string) => expenses.filter((e) => e.orderId === orderId),
    [expenses],
  );

  const totalApprovedChi = useCallback(
    (orderId: string) =>
      expenses
        .filter((e) => e.orderId === orderId && e.status === "approved")
        .reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const replaceExpenses = useCallback((items: OrderExpense[]) => {
    setExpenses(items.map(normalizeExpense));
  }, []);

  const mergeExpensesForOrder = useCallback((orderId: string, items: OrderExpense[]) => {
    setExpenses((prev) => [
      ...prev.filter((e) => e.orderId !== orderId),
      ...items.map(normalizeExpense),
    ]);
  }, []);

  const addExpense = useCallback((input: NewExpenseInput) => {
    const created: OrderExpense = {
      id: `ex-${Date.now()}`,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      projectName: input.projectName.trim(),
      amount: input.amount,
      title: input.title,
      note: input.note,
      requestedById: input.requestedById,
      requestedByName: input.requestedByName,
      requestedAt: new Date().toISOString().slice(0, 10),
      payeeName: input.payeeName.trim(),
      bankAccount: input.bankAccount.trim(),
      bankName: input.bankName.trim(),
      status: "pending",
    };
    setExpenses((prev) => [created, ...prev]);
    return created;
  }, []);

  const reviewExpense = useCallback(
    (
      id: string,
      status: Extract<OrderExpenseStatus, "approved" | "rejected">,
      reviewer: { id: string; name: string },
      reviewNote?: string,
    ) => {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                status,
                reviewedById: reviewer.id,
                reviewedByName: reviewer.name,
                reviewedAt: new Date().toISOString().slice(0, 10),
                reviewNote,
              }
            : e,
        ),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      expenses,
      ready,
      getByOrderId,
      totalApprovedChi,
      addExpense,
      reviewExpense,
      replaceExpenses,
      mergeExpensesForOrder,
    }),
    [expenses, ready, getByOrderId, totalApprovedChi, addExpense, reviewExpense, replaceExpenses, mergeExpensesForOrder],
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses() {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error("useExpenses must be used within ExpensesProvider");
  return ctx;
}

/** Duyệt đề nghị: vừa có quyền trang, vừa là người được chọn trên đơn. */
export function canReviewExpense(args: {
  hasExpenseApprovePermission: boolean;
  currentUserId?: string;
  reviewerId?: string;
}): boolean {
  if (!args.hasExpenseApprovePermission || !args.currentUserId) return false;
  if (!args.reviewerId) return false;
  return args.reviewerId === args.currentUserId;
}
