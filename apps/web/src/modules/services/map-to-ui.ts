import { num } from "@/lib/http/message";
import { licenseWarnMonthsOf } from "@/lib/order-helpers";
import type { Service } from "@/lib/types";
import type { ApiService, CreateServiceBody } from "@/modules/services/api";

export function mapApiServiceToUi(s: ApiService): Service {
  const customFields = s.customFields ?? {};
  return {
    id: s.id,
    name: s.name,
    code: s.code ?? "",
    category: s.category ?? "",
    unitPrice: num(s.unitPrice),
    processingDays: s.processingDays ?? 0,
    licenseExpiryWarnMonths: licenseWarnMonthsOf({
      licenseExpiryWarnMonths:
        typeof customFields.licenseExpiryWarnMonths === "number"
          ? customFields.licenseExpiryWarnMonths
          : undefined,
    }),
    status: s.status?.toUpperCase() === "ARCHIVED" ? "inactive" : "active",
    customFields,
    createdAt: s.createdAt?.slice(0, 10),
  };
}

export function mapUiServiceToApi(input: {
  name: string;
  code?: string;
  category?: string;
  unitPrice?: number;
  processingDays?: number;
  licenseExpiryWarnMonths?: number;
  status?: "active" | "inactive";
  customFields?: Record<string, unknown>;
}): CreateServiceBody {
  const body: CreateServiceBody = {
    name: input.name,
    category: input.category || undefined,
    processingDays: input.processingDays,
    status: input.status === "inactive" ? "ARCHIVED" : "ACTIVE",
    customFields: {
      ...(input.customFields ?? {}),
      ...(input.licenseExpiryWarnMonths != null
        ? { licenseExpiryWarnMonths: input.licenseExpiryWarnMonths }
        : {}),
    },
  };
  if (input.code?.trim()) body.code = input.code.trim();
  if (typeof input.unitPrice === "number" && Number.isFinite(input.unitPrice) && input.unitPrice > 0) {
    body.unitPrice = input.unitPrice;
  }
  return body;
}
