import { loadJson, saveJson } from "@/lib/demo-storage";

export type OrdersViewMode = "kanban" | "table";

const listeners = new Set<() => void>();

export function ordersViewModeKey(userId?: string | null) {
  const who = userId?.trim() || "anonymous";
  return `dny-crm-orders-view:${who}`;
}

export function loadOrdersViewMode(userId?: string | null): OrdersViewMode {
  const stored = loadJson<string>(ordersViewModeKey(userId));
  return stored === "table" ? "table" : "kanban";
}

export function saveOrdersViewMode(mode: OrdersViewMode, userId?: string | null) {
  saveJson(ordersViewModeKey(userId), mode);
  listeners.forEach((listener) => listener());
}

export function subscribeOrdersViewMode(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
