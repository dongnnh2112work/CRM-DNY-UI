"use client";

import { Tag } from "antd";
import type { CustomerUsedService } from "@/lib/customer-helpers";

export function UsedServiceTags({
  services,
  max = 3,
}: {
  services: CustomerUsedService[];
  max?: number;
}) {
  if (services.length === 0) return <>—</>;
  const visible = services.slice(0, max);
  const rest = services.length - visible.length;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
      {visible.map((s) => (
        <Tag key={s.serviceId} style={{ marginInlineEnd: 0 }}>
          {s.serviceName}
        </Tag>
      ))}
      {rest > 0 ? (
        <Tag style={{ marginInlineEnd: 0 }} color="default">
          +{rest}
        </Tag>
      ) : null}
    </span>
  );
}
