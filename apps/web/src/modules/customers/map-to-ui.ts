import { packIndustryOrField, unpackIndustryOrField } from "@/lib/customer-channel";
import type { Customer, CustomerStatus } from "@/lib/types";
import type { ApiCustomer, CreateCustomerBody, UpdateCustomerBody } from "@/modules/customers/types";
import { isUuid } from "@/lib/http/message";

function mapCustomerStatus(raw: string | null | undefined): CustomerStatus {
  const key = (raw ?? "").trim().toLowerCase();
  return (key || "active") as CustomerStatus;
}

export function mapApiCustomerToUi(c: ApiCustomer): Customer {
  const { channel, industry } = unpackIndustryOrField(c.industryOrField);
  return {
    id: c.id,
    name: c.displayName || c.legalName,
    phone: c.phone ?? "",
    email: c.email ?? "",
    company: c.type === "COMPANY" ? c.legalName : undefined,
    taxCode: c.taxId ?? undefined,
    owner: c.ownerId,
    status: mapCustomerStatus(c.status),
    createdAt: c.createdAt.slice(0, 10),
    usedServiceIds: [],
    customFields: industry ? { industry } : {},
    channel,
  };
}

export function mapUiCustomerToApi(input: {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  taxCode?: string;
  owner?: string;
  status?: string;
  customFields?: Record<string, unknown>;
  channel?: string;
}): CreateCustomerBody {
  const company = input.company?.trim();
  const industry =
    typeof input.customFields?.industry === "string" ? input.customFields.industry : undefined;
  const body: CreateCustomerBody = {
    type: company ? "COMPANY" : "INDIVIDUAL",
    legalName: company || input.name,
    displayName: input.name,
    phone: input.phone || undefined,
    email: input.email || undefined,
    taxId: input.taxCode || undefined,
    industryOrField: packIndustryOrField(input.channel, industry),
    status: input.status?.trim() || undefined,
  };
  if (isUuid(input.owner)) body.ownerId = input.owner;
  return body;
}

export function mapUiCustomerPatchToApi(
  input: Partial<{
    name: string;
    phone: string;
    email: string;
    company: string;
    taxCode: string;
    owner: string;
    status: string;
    customFields: Record<string, unknown>;
    channel: string;
  }>,
): UpdateCustomerBody {
  const patch: UpdateCustomerBody = {};
  if (input.name != null || input.company != null) {
    const company = input.company?.trim();
    if (company) {
      patch.type = "COMPANY";
      patch.legalName = company;
    } else if (input.name) {
      patch.type = "INDIVIDUAL";
      patch.legalName = input.name;
    }
    if (input.name) patch.displayName = input.name;
  }
  if (input.phone !== undefined) patch.phone = input.phone || undefined;
  if (input.email !== undefined) patch.email = input.email || undefined;
  if (input.taxCode !== undefined) patch.taxId = input.taxCode || undefined;
  if (input.status !== undefined) patch.status = input.status;
  if (input.channel !== undefined || input.customFields !== undefined) {
    const industry =
      input.customFields && typeof input.customFields.industry === "string"
        ? input.customFields.industry
        : undefined;
    patch.industryOrField = packIndustryOrField(input.channel, industry);
  }
  if (isUuid(input.owner)) patch.ownerId = input.owner;
  return patch;
}
