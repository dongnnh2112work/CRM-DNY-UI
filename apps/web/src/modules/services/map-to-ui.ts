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
  };
}

export function mapUiServiceToApi(input: {
  name: string;
  code?: string;
  category?: string;
  unitPrice?: number;
  processingDays?: number;
  licenseExpiryWarnMonths?: number;
  customFields?: Record<string, unknown>;
}): CreateServiceBody {
  return {
    name: input.name,
    code: input.code || undefined,
    category: input.category || undefined,
    unitPrice: input.unitPrice,
    processingDays: input.processingDays,
    status: "ACTIVE",
    customFields: {
      ...(input.customFields ?? {}),
      ...(input.licenseExpiryWarnMonths != null
        ? { licenseExpiryWarnMonths: input.licenseExpiryWarnMonths }
        : {}),
    },
  };
}
