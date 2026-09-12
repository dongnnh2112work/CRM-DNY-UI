import type { OrderChannel } from "@/lib/types";

export const CUSTOMER_CHANNELS: OrderChannel[] = ["direct", "website", "referral", "ctv"];

const PACKED = /^__ch:([a-z]+)__(.*)$/;

function asChannel(value: string | undefined): OrderChannel | undefined {
  if (value === "direct" || value === "website" || value === "referral" || value === "ctv") return value;
  return undefined;
}

export function packIndustryOrField(
  channel?: string | null,
  industry?: string | null,
): string | undefined {
  const ch = asChannel(channel ?? undefined);
  const ind = industry?.trim() ?? "";
  if (ch) return `__ch:${ch}__${ind}`;
  return ind || undefined;
}

export function unpackIndustryOrField(raw: string | null | undefined): {
  channel?: OrderChannel;
  industry?: string;
} {
  if (!raw) return {};
  const match = raw.match(PACKED);
  if (match) {
    return {
      channel: asChannel(match[1]),
      industry: match[2]?.trim() || undefined,
    };
  }
  return { industry: raw };
}
