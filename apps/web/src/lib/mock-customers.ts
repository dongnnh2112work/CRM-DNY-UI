import type { Customer, FieldDefinition } from "./types";

export const CUSTOMER_FIELD_DEFS: FieldDefinition[] = [
  { key: "name", label: "Tên", type: "text", required: true, order: 1, visible: true },
  { key: "phone", label: "SĐT", type: "text", required: true, order: 2, visible: true },
  { key: "email", label: "Email", type: "text", required: false, order: 3, visible: true },
  { key: "company", label: "Công ty", type: "text", required: false, order: 4, visible: true },
  { key: "taxCode", label: "Mã số thuế", type: "text", required: false, order: 5, visible: true },
  { key: "address", label: "Địa chỉ", type: "text", required: false, order: 6, visible: false },
  { key: "owner", label: "Phụ trách", type: "select", options: ["Le Staff A", "Vo Staff B", "Tran Admin"], required: true, order: 7, visible: true },
  { key: "status", label: "Trạng thái", type: "select", options: ["active", "lead", "archived"], required: true, order: 8, visible: true },
  { key: "usedServiceIds", label: "Dịch vụ đã dùng", type: "select", required: false, order: 9, visible: true },
  { key: "channel", label: "Kênh", type: "select", options: ["direct", "website", "referral", "ctv"], required: false, order: 10, visible: true },
  { key: "createdAt", label: "Ngày tạo", type: "date", required: false, order: 11, visible: false },
  { key: "industry", label: "Ngành", type: "select", options: ["Tech", "F&B", "Manufacturing", "Trading", "Other"], required: false, order: 12, visible: false },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: "c1", name: "ABC Corp", phone: "0901234567", email: "contact@abc.vn", company: "ABC Co., Ltd", taxCode: "0312345678", address: "123 Nguyen Hue, Q1", owner: "Le Staff A", status: "active", createdAt: "2026-01-15", usedServiceIds: ["s1", "s2"], channel: "direct", customFields: { industry: "Tech" } },
  { id: "c2", name: "Nguyen Van A", phone: "0912345678", email: "nguyenvana@mail.com", company: "", owner: "Vo Staff B", status: "lead", createdAt: "2026-03-01", usedServiceIds: ["s4", "s2"], channel: "website", customFields: {} },
  { id: "c3", name: "Tech Startup JSC", phone: "02838234567", email: "info@techstartup.vn", company: "Tech Startup JSC", taxCode: "0398765432", address: "456 Le Loi, Q3", owner: "Le Staff A", status: "active", createdAt: "2026-04-10", usedServiceIds: ["s1", "s3"], channel: "referral", customFields: { industry: "Tech" } },
  { id: "c4", name: "Tran Thi B", phone: "0987654321", email: "tranthib@mail.com", company: "Sunrise Trading", taxCode: "0301112223", owner: "Tran Admin", status: "active", createdAt: "2026-05-20", usedServiceIds: ["s1", "s2"], channel: "ctv", customFields: { industry: "Trading" } },
  { id: "c5", name: "Global Foods Ltd", phone: "02839999888", email: "info@globalfoods.vn", company: "Global Foods Ltd", taxCode: "0355556667", owner: "Le Staff A", status: "archived", createdAt: "2026-02-01", usedServiceIds: ["s1", "s3"], channel: "website", customFields: { industry: "F&B" } },
];
