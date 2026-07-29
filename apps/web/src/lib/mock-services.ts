import type { FieldDefinition, Service } from "./types";

export const SERVICE_FIELD_DEFS: FieldDefinition[] = [
  { key: "name", label: "Tên dịch vụ", type: "text", required: true, order: 1, visible: true },
  { key: "code", label: "Mã", type: "text", required: true, order: 2, visible: true },
  { key: "category", label: "Danh mục", type: "select", options: ["Work Permit", "Visa", "License", "Legal", "Other"], required: true, order: 3, visible: true },
  { key: "unitPrice", label: "Đơn giá (VND)", type: "number", required: true, order: 4, visible: true },
  { key: "processingDays", label: "Thời gian xử lý (ngày)", type: "number", required: true, order: 5, visible: true },
  { key: "status", label: "Trạng thái", type: "select", options: ["active", "inactive"], required: true, order: 6, visible: true },
  { key: "requiredDocs", label: "Hồ sơ yêu cầu", type: "text", required: false, order: 7, visible: false },
];

export const MOCK_SERVICES: Service[] = [
  { id: "s1", name: "Work Permit", code: "SVC-WP", category: "Work Permit", unitPrice: 5_000_000, processingDays: 30, status: "active", customFields: { requiredDocs: "Passport, Labor contract, Health check" } },
  { id: "s2", name: "Visa Processing", code: "SVC-VISA", category: "Visa", unitPrice: 3_000_000, processingDays: 15, status: "active", customFields: {} },
  { id: "s3", name: "Business License", code: "SVC-BL", category: "License", unitPrice: 8_000_000, processingDays: 45, status: "active", customFields: {} },
  { id: "s4", name: "TRC Application", code: "SVC-TRC", category: "Work Permit", unitPrice: 4_000_000, processingDays: 20, status: "active", customFields: {} },
  { id: "s5", name: "Company Registration", code: "SVC-CR", category: "License", unitPrice: 12_000_000, processingDays: 60, status: "inactive", customFields: {} },
];
