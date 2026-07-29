import type { DashboardMetrics } from "./types";

export const MOCK_DASHBOARD: DashboardMetrics = {
  revenue: {
    total: 30_000_000,
    thisMonth: 17_500_000,
    byMonth: [
      { month: "2026-01", value: 8_000_000 },
      { month: "2026-02", value: 6_500_000 },
      { month: "2026-03", value: 9_200_000 },
      { month: "2026-04", value: 7_800_000 },
      { month: "2026-05", value: 11_000_000 },
      { month: "2026-06", value: 12_500_000 },
      { month: "2026-07", value: 17_500_000 },
    ],
  },
  orders: {
    total: 42,
    thisMonth: 8,
    byStatus: [
      { status: "Mới", count: 5 },
      { status: "Đang xử lý", count: 12 },
      { status: "Chờ", count: 8 },
      { status: "Hoàn thành", count: 15 },
      { status: "Đã hủy", count: 2 },
    ],
  },
  customers: { total: 128, newThisMonth: 12 },
  commission: {
    totalPaid: 5_600_000,
    topCtv: [
      { name: "Hoang CTV", amount: 2_800_000 },
      { name: "Linh Partner", amount: 1_200_000 },
      { name: "Minh Agent", amount: 900_000 },
      { name: "Lan Broker", amount: 450_000 },
      { name: "Khoa Partner", amount: 250_000 },
    ],
  },
};
