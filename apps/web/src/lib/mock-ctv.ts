import type { Ctv } from "./types";

/** Commission = Giá CTV − Giá trị Ratecard */
export const MOCK_CTVS: Ctv[] = [
  {
    id: "ctv1",
    name: "Hoang CTV",
    phone: "0909111222",
    email: "hoang.ctv@mail.com",
    status: "active",
    totalJobs: 2,
    totalCommission: 2_800_000,
    jobs: [
      {
        orderId: "o2",
        orderNumber: "ORD-2026-002",
        customerName: "Tech Startup JSC",
        serviceName: "Business License",
        ratecard: 7_000_000,
        ctvPrice: 8_800_000,
        commission: 1_800_000,
      },
      {
        orderId: "o7",
        orderNumber: "ORD-2026-007",
        customerName: "XYZ Ltd",
        serviceName: "Work Permit",
        ratecard: 4_000_000,
        ctvPrice: 5_000_000,
        commission: 1_000_000,
      },
    ],
  },
  {
    id: "ctv2",
    name: "Linh Partner",
    phone: "0909333444",
    email: "linh.partner@mail.com",
    status: "active",
    totalJobs: 1,
    totalCommission: 500_000,
    jobs: [
      {
        orderId: "o5",
        orderNumber: "ORD-2026-005",
        customerName: "ABC Corp",
        serviceName: "Visa Processing",
        ratecard: 2_500_000,
        ctvPrice: 3_000_000,
        commission: 500_000,
      },
    ],
  },
];
