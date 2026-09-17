import { hasMessageKey, type MessageKey, type MessageVars } from "@/lib/i18n";

/** Full capability catalog (Authorization.md). Local bypass uses this list. */
export const ALL_PERMISSION_CODES = [
  "customer.view",
  "customer.create",
  "customer.update",
  "customer.delete",
  "customer.assign",
  "customer.import",
  "customer.export",
  "lead.view",
  "lead.create",
  "lead.update",
  "lead.delete",
  "lead.assign",
  "lead.convert",
  "lead.import",
  "contact.view",
  "contact.create",
  "contact.update",
  "contact.delete",
  "service.view",
  "service.create",
  "service.update",
  "service.archive",
  "contract.view",
  "contract.create",
  "contract.update",
  "contract.delete",
  "contract.change_status",
  "workflow_template.manage",
  "task.view",
  "task.create",
  "task.update",
  "document.upload",
  "order.view",
  "order.create",
  "order.update",
  "order.delete",
  "order.assign",
  "order.change_stage",
  "order.approve",
  "payment.view",
  "payment.create",
  "payment.verify",
  "payment.void",
  "vat.view",
  "vat.create",
  "vat.issue",
  "vat.cancel",
  "expense.view",
  "expense.create",
  "expense.approve",
  "commission.view",
  "commission.calculate",
  "commission.approve",
  "commission.pay",
  "collaborator.view",
  "collaborator.create",
  "collaborator.update",
  "collaborator.deactivate",
  "contract_request.create",
  "contract_request.view",
  "contract_request.review",
  "contract_request.approve",
  "contract_request.reject",
  "collaborator_customer.assign",
  "user.manage",
  "role.manage",
  "permission.manage",
  "notification.view_own",
  "config.manage",
] as const;

export const PERMISSION_RESOURCE_ORDER = [
  "customer",
  "lead",
  "contact",
  "order",
  "payment",
  "expense",
  "vat",
  "commission",
  "service",
  "contract",
  "document",
  "task",
  "workflow_template",
  "collaborator",
  "contract_request",
  "collaborator_customer",
  "user",
  "role",
  "permission",
  "notification",
  "config",
] as const;

export function splitPermissionCode(code: string): { resource: string; action: string } {
  const trimmed = code.trim();
  const i = trimmed.indexOf(".");
  if (i <= 0) return { resource: trimmed, action: "" };
  return { resource: trimmed.slice(0, i), action: trimmed.slice(i + 1) };
}

export function permissionTitleKey(code: string): MessageKey | null {
  const key = `cap.${code.trim()}`;
  return hasMessageKey(key) ? key : null;
}

export function permissionResourceTitleKey(resource: string): MessageKey {
  const key = `cap.res.${resource}`;
  return hasMessageKey(key) ? key : "cap.res.other";
}

type Translate = (key: MessageKey, vars?: MessageVars) => string;

export function permissionTitle(code: string, translate: Translate): string {
  const full = permissionTitleKey(code);
  if (full) return translate(full);
  const { resource, action } = splitPermissionCode(code);
  const resKey = `cap.res.${resource}`;
  const actKey = `cap.act.${action}`;
  if (hasMessageKey(resKey) && hasMessageKey(actKey)) {
    return translate("cap.composed", { action: translate(actKey), resource: translate(resKey) });
  }
  if (hasMessageKey(resKey)) return `${translate(resKey)} (${code})`;
  return code;
}

export function permissionMatchesQuery(code: string, query: string, translate: Translate): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = permissionTitle(code, translate).toLowerCase();
  const { resource, action } = splitPermissionCode(code);
  const resourceTitle = translate(permissionResourceTitleKey(resource)).toLowerCase();
  return (
    code.toLowerCase().includes(q) ||
    title.includes(q) ||
    resource.toLowerCase().includes(q) ||
    action.toLowerCase().includes(q) ||
    resourceTitle.includes(q)
  );
}

export function groupPermissionCodes<T extends { code: string }>(items: T[]): { resource: string; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const { resource } = splitPermissionCode(item.code);
    const key = resource || "other";
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  const rank = new Map(PERMISSION_RESOURCE_ORDER.map((name, i) => [name, i]));
  return [...buckets.entries()]
    .sort((a, b) => {
      const ra = rank.get(a[0] as (typeof PERMISSION_RESOURCE_ORDER)[number]) ?? 1000;
      const rb = rank.get(b[0] as (typeof PERMISSION_RESOURCE_ORDER)[number]) ?? 1000;
      if (ra !== rb) return ra - rb;
      return a[0].localeCompare(b[0]);
    })
    .map(([resource, grouped]) => ({
      resource,
      items: grouped.sort((a, b) => a.code.localeCompare(b.code)),
    }));
}
