import type { AppUser } from "./types";

export const MOCK_USERS: AppUser[] = [
  { id: "u1", name: "Nguyen Director", email: "director@dny.vn", role: "super_admin", status: "active", authMethod: "google", createdAt: "2026-01-01" },
  { id: "u2", name: "Tran Admin", email: "admin@dny.vn", role: "admin", status: "active", authMethod: "google", createdAt: "2026-02-01" },
  { id: "u3", name: "Le Staff A", email: "staff.a@dny.vn", role: "staff", status: "active", authMethod: "email", createdAt: "2026-03-01" },
  { id: "u4", name: "Pham Accountant", email: "accountant@dny.vn", role: "accountant", status: "active", authMethod: "email", createdAt: "2026-03-15" },
  { id: "u5", name: "Vo Staff B", email: "staff.b@dny.vn", role: "staff", status: "inactive", authMethod: "google", createdAt: "2026-04-01" },
];
