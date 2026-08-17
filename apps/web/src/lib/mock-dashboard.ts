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
    total: 6,
    thisMonth: 4,
    byStatus: [
      { status: "Mới", count: 2 },
      { status: "Đang xử lý", count: 1 },
      { status: "Chờ khách", count: 1 },
      { status: "Chờ cơ quan", count: 1 },
      { status: "Hoàn thành", count: 1 },
      { status: "Đã hủy", count: 0 },
    ],
  },
  customers: { total: 128, newThisMonth: 12 },
  commission: {
    totalPaid: 5_600_000,
  },
};
