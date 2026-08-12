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
import { MOCK_ORDER_EXPENSES } from "@/lib/mock-expenses";
import type { OrderExpense, OrderExpenseStatus } from "@/lib/types";

const KEY = "dny-crm-order-expenses";

export type NewExpenseInput = {
  orderId: string;
  orderNumber: string;
  amount: number;
  title: string;
  note?: string;
  requestedById: string;
  requestedByName: string;
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
};

const ExpensesContext = createContext<Ctx | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<OrderExpense[]>(MOCK_ORDER_EXPENSES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadJson<OrderExpense[]>(KEY);
    if (stored && Array.isArray(stored)) setExpenses(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(KEY, expenses);
  }, [expenses, ready]);

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

  const addExpense = useCallback((input: NewExpenseInput) => {
    const created: OrderExpense = {
      id: `ex-${Date.now()}`,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      amount: input.amount,
      title: input.title,
      note: input.note,
      requestedById: input.requestedById,
      requestedByName: input.requestedByName,
      requestedAt: new Date().toISOString().slice(0, 10),
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
    () => ({ expenses, ready, getByOrderId, totalApprovedChi, addExpense, reviewExpense }),
    [expenses, ready, getByOrderId, totalApprovedChi, addExpense, reviewExpense],
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses() {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error("useExpenses must be used within ExpensesProvider");
  return ctx;
}

export function canReviewExpense(
  actor: { id: string },
  orderReviewerId: string | undefined,
  /** true nếu ma trận phân quyền bật Sửa trên trang Duyệt chi */
  hasExpenseApprovePermission: boolean,
): boolean {
  if (hasExpenseApprovePermission) return true;
  return Boolean(orderReviewerId && actor.id === orderReviewerId);
}
