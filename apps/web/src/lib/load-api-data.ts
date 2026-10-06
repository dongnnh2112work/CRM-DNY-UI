import { ROUTE_PAGE_SIZE, fetchPage, unwrapList } from "@/lib/http/paging";
import { ApiError } from "@/lib/http/errors";
import {
  clearEntityLookupCache,
  lookupContractNumber,
  lookupCustomerName,
  lookupCtvName,
  lookupOrderNumber,
  lookupServiceName,
  lookupUserName,
  rememberCustomerName,
  rememberCtvName,
  rememberOrderNumber,
  rememberServiceName,
  rememberUserName,
  resolveEntityLookups,
} from "@/lib/entity-lookups";
import { canLoadScope } from "@/lib/route-data-scopes";
import { hasHydratedName, looksLikeUuid } from "@/lib/order-helpers";
import { orderGroupKey, pickPrimaryOrder, siblingOrders } from "@/lib/order-group";
import type { AppUser, Customer, Ctv, Order, OrderExpense, PaymentRecord, Service, VatInvoice } from "@/lib/types";
import type { AuthUser } from "@/modules/auth/api";
import {
  configApi,
  CUSTOMER_STATUS_CATALOG_KEY,
  ORDER_STAGES_CONFIG_KEY,
  PAGE_PERMISSIONS_CONFIG_KEY,
  parseConfigValue,
  REMINDER_CONFIG_KEY,
  SERVICE_CATEGORIES_CONFIG_KEY,
} from "@/modules/config/api";
import { customersApi } from "@/modules/customers/api";
import { mapApiCustomerToUi } from "@/modules/customers/map-to-ui";
import type { ApiDocument } from "@/modules/documents/api";
import { expensesApi } from "@/modules/expenses/api";
import { mapApiExpenseToUi } from "@/modules/expenses/map-to-ui";
import { identityAdminApi } from "@/modules/identity-admin/api";
import { mapAuthUserToUi, mapIdentityRoleToUi, mapIdentityUserToUi, unwrapIdentityEntity } from "@/modules/identity-admin/map-to-ui";
import { fillMissingRoleCodes } from "@/modules/identity-admin/reassign-pending";
import type { IdentityUser } from "@/modules/identity-admin/api";
import { notificationsApi } from "@/modules/notifications/api";
import { mapApiNotificationToUi } from "@/modules/notifications/map-to-ui";
import { ordersApi, type ApiOrderDetail, type ApiScheduleLine } from "@/modules/orders/api";
import { mapApiOrderToUi } from "@/modules/orders/map-to-ui";
import { paymentsApi, type ApiPayment } from "@/modules/payments/api";
import { mapPaymentsToRecords, unwrapSchedule } from "@/modules/payments/map-to-ui";

function unwrapDetailList<T>(value: T[] | { items?: T[] } | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.items ?? [];
}
import { servicesApi } from "@/modules/services/api";
import { mapApiServiceToUi } from "@/modules/services/map-to-ui";
import { vatApi } from "@/modules/vat/api";
import { mapApiVatToUi } from "@/modules/vat/map-to-ui";

import type { RefreshScope } from "@/lib/route-data-scopes";

export type { RefreshScope } from "@/lib/route-data-scopes";
export { clearEntityLookupCache };
export type ListSliceMeta = {
  total: number;
  page: number;
  pageSize: number;
  loaded: number;
};

export type ApplyRemoteOptions = {
  page?: number;
  append?: boolean;
  /** `pageSize` for list endpoints in this batch. Default ROUTE_PAGE_SIZE. */
  pageSize?: number;
  /** Record `total` only. Do not write rows into the stores. */
  countsOnly?: boolean;
  /** Load CRM config. Page-permissions key is fetched only when the list omits it. */
  loadConfig?: boolean;
  /** Skip writing this batch (preview started on dashboard, user already left). */
  abandonIf?: () => boolean;
  /** Called when a scope returns 403 — hydrator marks it forbidden for the session. */
  onForbidden?: (scope: RefreshScope) => void;
  /**
   * How aggressively to resolve display names via GET /:id after list hydrate.
   * - full: all ids on the page (default)
   * - dashboardPreview: only customer+service for first 5 orders
   * - listLean: ids shown on list tables (skip contract/ctv noise)
   * - off: skip lookups
   */
  nameResolve?: "full" | "dashboardPreview" | "listLean" | "off";
};


export type ApiDataSnapshot = {
  users: AppUser[];
  customers: Customer[];
  services: Service[];
  ctvs: Ctv[];
  orders: Order[];
  payments: PaymentRecord[];
  expenses: OrderExpense[];
  invoices: VatInvoice[];
};

export type ApiDataApplier = {
  replaceUsers: (items: AppUser[], currentUserId?: string) => void;
  mergeRemoteRoles: (items: ReturnType<typeof mapIdentityRoleToUi>[]) => void;
  replaceCustomers: (items: Customer[]) => void;
  replaceServices: (items: Service[]) => void;
  replaceCtvs: (items: Ctv[]) => void;
  replaceOrders: (items: Order[]) => void;
  replacePayments: (items: ReturnType<typeof mapPaymentsToRecords>) => void;
  replaceExpenses: (items: OrderExpense[]) => void;
  replaceInvoices: (items: VatInvoice[]) => void;
  replaceNotifications: (items: ReturnType<typeof mapApiNotificationToUi>[]) => void;
  hydrateConfig: (next: { vatIssueWarnDays: number }) => void;
  hydrateOrderStages: (raw: unknown | null) => void;
  hydrateCustomerStatuses: (raw: unknown | null) => void;
  hydrateServiceCategories: (raw: unknown | null) => void;
  hydratePagePermissions: (raw: unknown | null) => void;
  setListMeta: (scope: RefreshScope, meta: ListSliceMeta) => void;
};

async function settled<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function wants(scopes: Set<RefreshScope>, key: RefreshScope) {
  return scopes.has("all") || scopes.has(key);
}

function wantsCore(scopes: Set<RefreshScope>) {
  return scopes.has("all") || scopes.has("core");
}

function wantsDeferred(scopes: Set<RefreshScope>) {
  return scopes.has("all") || scopes.has("deferred");
}

function mergeCustomerLocal(remote: Customer, local?: Customer): Customer {
  if (!local) return remote;
  return {
    ...remote,
    address: local.address ?? remote.address,
    usedServiceIds: local.usedServiceIds?.length ? local.usedServiceIds : remote.usedServiceIds,
    customFields: { ...remote.customFields, ...local.customFields },
    channel: local.channel ?? remote.channel,
  };
}

function mergeOrderLocal(remote: Order, local?: Order): Order {
  if (!local) return remote;
  return {
    ...remote,
    // Prefer BE once persisted; local only fills when API still returns null/missing.
    commissionPercent: remote.commissionPercent ?? local.commissionPercent,
    zaloGroupUrl: remote.zaloGroupUrl ?? local.zaloGroupUrl,
    deadline: remote.deadline ?? local.deadline,
    vatIssueDeadline: local.vatIssueDeadline ?? remote.vatIssueDeadline,
    ctvPrice: local.ctvPrice ?? remote.ctvPrice,
    attachments: remote.attachments.length ? remote.attachments : local.attachments,
    licenseAttachments: remote.licenseAttachments?.length
      ? remote.licenseAttachments
      : local.licenseAttachments,
  };
}

function mergeById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const map = new Map(prev.map((item) => [item.id, item]));
  for (const item of next) map.set(item.id, item);
  return [...map.values()];
}

/** Append must not replace a row that already has installments with an empty rebuild. */
function mergePaymentRecords(prev: PaymentRecord[], next: PaymentRecord[]): PaymentRecord[] {
  const map = new Map(prev.map((item) => [item.orderId, item]));
  for (const item of next) {
    const existing = map.get(item.orderId);
    if (!existing) {
      map.set(item.orderId, item);
      continue;
    }
    const incomingEmpty = item.installments.length === 0 && item.paidAmount === 0;
    const existingHasData = existing.installments.length > 0 || existing.paidAmount > 0;
    if (incomingEmpty && existingHasData) {
      map.set(item.orderId, {
        ...existing,
        orderNumber: item.orderNumber || existing.orderNumber,
        customerName: item.customerName || existing.customerName,
        totalAmount: item.totalAmount || existing.totalAmount,
      });
      continue;
    }
    map.set(item.orderId, item);
  }
  return [...map.values()];
}

export async function applyRemoteData(
  applier: ApiDataApplier,
  sessionUser: AuthUser | null | undefined,
  scopesInput: RefreshScope | RefreshScope[],
  getSnapshot: () => ApiDataSnapshot,
  options: ApplyRemoteOptions = {},
): Promise<void> {
  const scopes = new Set(Array.isArray(scopesInput) ? scopesInput : [scopesInput]);
  const core = wantsCore(scopes);
  const page = Math.max(1, options.page ?? 1);
  const append = Boolean(options.append) && page > 1;
  const listSize = options.pageSize ?? ROUTE_PAGE_SIZE;
  const perms = sessionUser?.permissions;
  const noteForbidden = (scope: RefreshScope) => options.onForbidden?.(scope);

  async function settledScope<T>(
    scope: RefreshScope,
    promise: Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await promise;
    } catch (err) {
      if (err instanceof ApiError && err.isForbidden) {
        noteForbidden(scope);
        return fallback;
      }
      return fallback;
    }
  }

  const may = (scope: RefreshScope) => canLoadScope(scope, perms);

  const loadUsers = !options.countsOnly && (core || wants(scopes, "users")) && may("users");
  const loadCustomers = wants(scopes, "customers") && may("customers");
  const loadServices = wants(scopes, "services") && may("services");
  const loadOrders = wants(scopes, "orders") && may("orders");
  const loadPayments = wants(scopes, "payments") && may("payments");
  const loadExpenses = wants(scopes, "expenses") && may("expenses");
  const loadVat = wants(scopes, "vat") && may("vat");
  const loadNotifs =
    !options.countsOnly &&
    (core || wants(scopes, "notifications") || wantsDeferred(scopes)) &&
    may("notifications");
  const loadConfig = !options.countsOnly && (Boolean(options.loadConfig) || core);

  const [
    apiUsers,
    apiCustomers,
    apiServices,
    apiOrders,
    apiPayments,
    apiExpenses,
    apiVat,
    apiNotifs,
    apiConfig,
    apiRoles,
  ] = await Promise.all([
    loadUsers
      ? settledScope(
          "users",
          fetchPage((p, s) => identityAdminApi.listUsers({ page: p, pageSize: s }), page, listSize),
          null,
        )
      : Promise.resolve(null),
    loadCustomers
      ? settledScope(
          "customers",
          fetchPage((p, s) => customersApi.list({ page: p, pageSize: s }), page, listSize),
          null,
        )
      : Promise.resolve(null),
    loadServices
      ? settledScope(
          "services",
          fetchPage((p, s) => servicesApi.list({ page: p, pageSize: s }), page, listSize),
          null,
        )
      : Promise.resolve(null),
    loadOrders
      ? settledScope(
          "orders",
          fetchPage((p, s) => ordersApi.list({ page: p, pageSize: s }), page, listSize),
          null,
        )
      : Promise.resolve(null),
    loadPayments
      ? settledScope(
          "payments",
          fetchPage((p, s) => paymentsApi.list({ page: p, pageSize: s }), page, listSize),
          null,
        )
      : Promise.resolve(null),
    loadExpenses
      ? settledScope(
          "expenses",
          fetchPage((p, s) => expensesApi.list({ page: p, pageSize: s }), page, listSize),
          null,
        )
      : Promise.resolve(null),
    loadVat
      ? settledScope(
          "vat",
          fetchPage((p, s) => vatApi.list({ page: p, pageSize: s }), page, listSize),
          null,
        )
      : Promise.resolve(null),
    loadNotifs
      ? settledScope(
          "notifications",
          fetchPage((p, s) => notificationsApi.list({ page: p, pageSize: s }), page, listSize),
          null,
        )
      : Promise.resolve(null),
    loadConfig
      ? settled(
          Promise.all([
            configApi.list(),
            configApi.get(PAGE_PERMISSIONS_CONFIG_KEY, { silent: true }).catch(() => undefined),
          ]).then(([list, pagePerms]) => {
            const items = [...(list.items ?? [])];
            if (
              pagePerms?.key &&
              !items.some((row) => row.key === PAGE_PERMISSIONS_CONFIG_KEY)
            ) {
              items.push(pagePerms);
            }
            return { items };
          }),
          { items: [] as { key?: string; valueJson?: unknown }[] },
        )
      : Promise.resolve(null),
    loadUsers
      ? settledScope("users", identityAdminApi.listRoles().then(unwrapList), [])
      : Promise.resolve(null),
  ]);

  if (options.abandonIf?.()) return;

  if (options.countsOnly) {
    const publishCount = (
      scope: RefreshScope,
      pageResult: { total: number } | null,
    ) => {
      if (!pageResult) return;
      applier.setListMeta(scope, {
        total: pageResult.total,
        page: 0,
        pageSize: 1,
        loaded: 0,
      });
    };
    publishCount("orders", apiOrders);
    publishCount("customers", apiCustomers);
    publishCount("payments", apiPayments);
    return;
  }

  const current = getSnapshot();

  let uiUsers = current.users;
  if (apiUsers) {
    const withRoles = await fillMissingRoleCodes(
      apiUsers.items.map((row) => unwrapIdentityEntity<IdentityUser>(row) ?? row),
    );
    const mapped = withRoles.map(mapIdentityUserToUi);
    uiUsers = append ? mergeById(current.users, mapped) : mapped;
    if (sessionUser && !uiUsers.some((u) => u.id === sessionUser.id)) {
      uiUsers.unshift(mapAuthUserToUi(sessionUser));
    }
    for (const u of uiUsers) rememberUserName(u.id, u.name);
    applier.replaceUsers(uiUsers, sessionUser?.id);
    applier.setListMeta("users", {
      total: apiUsers.total,
      page: apiUsers.page,
      pageSize: apiUsers.pageSize,
      loaded: uiUsers.length,
    });
  }
  if (apiRoles) {
    applier.mergeRemoteRoles(apiRoles.map(mapIdentityRoleToUi));
  }

  let customers = current.customers;
  if (apiCustomers) {
    const localById = new Map(current.customers.map((c) => [c.id, c]));
    const mapped = apiCustomers.items.map((c) => mergeCustomerLocal(mapApiCustomerToUi(c), localById.get(c.id)));
    customers = append ? mergeById(current.customers, mapped) : mapped;
    for (const c of mapped) rememberCustomerName(c.id, c.name);
    applier.replaceCustomers(customers);
    applier.setListMeta("customers", {
      total: apiCustomers.total,
      page: apiCustomers.page,
      pageSize: apiCustomers.pageSize,
      loaded: customers.length,
    });
    // Owner names resolve in the background — do not block the list.
    const ownerIds = mapped.map((c) => c.owner).filter(Boolean);
    if (ownerIds.length) {
      void resolveEntityLookups({ userIds: ownerIds }, perms);
    }
  }

  let services = current.services;
  if (apiServices) {
    const mapped = apiServices.items.map(mapApiServiceToUi);
    services = append ? mergeById(current.services, mapped) : mapped;
    for (const s of mapped) rememberServiceName(s.id, s.name);
    applier.replaceServices(services);
    applier.setListMeta("services", {
      total: apiServices.total,
      page: apiServices.page,
      pageSize: apiServices.pageSize,
      loaded: services.length,
    });
  }

  const userName = new Map(uiUsers.map((u) => [u.id, u.name]));
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const ctvName = new Map(current.ctvs.map((c) => [c.id, c.name]));

  let orders = current.orders;
  if (apiOrders) {
    const localById = new Map(current.orders.map((o) => [o.id, o]));
    const mapped = apiOrders.items.map((o) => {
      const existing = localById.get(o.id);
          const mappedOrder = mapApiOrderToUi(o, {
        // Prefer names already JOINed on the order payload, then local catalogs / lookup cache.
        customerName:
          o.customerName ||
          customerName.get(o.customerId) ||
          lookupCustomerName(o.customerId) ||
          existing?.customerName,
        serviceName:
          o.serviceName ||
          serviceName.get(o.serviceId) ||
          lookupServiceName(o.serviceId) ||
          existing?.serviceName,
        assignedUserName:
          o.assignedUserName ||
          userName.get(o.assignedUserId) ||
          lookupUserName(o.assignedUserId) ||
          existing?.assignedUserName,
        submitterName:
          o.submitterName ||
          userName.get(o.submitterUserId) ||
          lookupUserName(o.submitterUserId) ||
          existing?.submitterName,
        reviewerName: o.reviewerUserId
          ? o.reviewerName ||
            userName.get(o.reviewerUserId) ||
            lookupUserName(o.reviewerUserId) ||
            existing?.reviewerName
          : undefined,
        ctvName: o.collaboratorId
          ? o.collaboratorName ||
            ctvName.get(o.collaboratorId) ||
            lookupCtvName(o.collaboratorId) ||
            existing?.ctvName
          : undefined,
        contractNumber: (() => {
          const fromLookup = lookupContractNumber(o.contractId);
          const n = fromLookup != null ? Number(fromLookup) : undefined;
          return Number.isFinite(n) ? n : existing?.contractNumber;
        })(),
      });
      rememberOrderNumber(o.id, mappedOrder.orderNumber);
      if (o.customerId && o.customerName && !looksLikeUuid(o.customerName)) {
        rememberCustomerName(o.customerId, o.customerName);
      }
      if (o.serviceId && o.serviceName && !looksLikeUuid(o.serviceName)) {
        rememberServiceName(o.serviceId, o.serviceName);
      }
      if (o.assignedUserId && o.assignedUserName && !looksLikeUuid(o.assignedUserName)) {
        rememberUserName(o.assignedUserId, o.assignedUserName);
      }
      if (o.submitterUserId && o.submitterName && !looksLikeUuid(o.submitterName)) {
        rememberUserName(o.submitterUserId, o.submitterName);
      }
      if (o.reviewerUserId && o.reviewerName && !looksLikeUuid(o.reviewerName)) {
        rememberUserName(o.reviewerUserId, o.reviewerName);
      }
      if (o.collaboratorId && o.collaboratorName && !looksLikeUuid(o.collaboratorName)) {
        rememberCtvName(o.collaboratorId, o.collaboratorName);
      }
      return mergeOrderLocal(mappedOrder, existing);
    });
    orders = append ? mergeById(current.orders, mapped) : mapped;
    applier.replaceOrders(orders);
    applier.setListMeta("orders", {
      total: apiOrders.total,
      page: apiOrders.page,
      pageSize: apiOrders.pageSize,
      loaded: orders.length,
    });

    // BE hydrates *Name on list (2026-10-06). Only GET /:id for fields still missing.
    const nameResolve = options.nameResolve ?? "full";
    if (nameResolve !== "off") {
      void (async () => {
        const preview = nameResolve === "dashboardPreview" ? mapped.slice(0, 5) : mapped;
        const customerIds = preview
          .filter((o) => o.customerId && !hasHydratedName(o.customerName))
          .map((o) => o.customerId);
        const serviceIds = preview
          .filter((o) => o.serviceId && !hasHydratedName(o.serviceName))
          .map((o) => o.serviceId);
        const userIds = preview
          .flatMap((o) => {
            const ids: string[] = [];
            if (o.assignedUserId && !hasHydratedName(o.assignedUserName)) ids.push(o.assignedUserId);
            if (o.submitterId && !hasHydratedName(o.submitterName)) ids.push(o.submitterId);
            if (o.reviewerId && !hasHydratedName(o.reviewerName)) ids.push(o.reviewerId);
            return ids;
          });
        const lookupReq =
          nameResolve === "dashboardPreview" || nameResolve === "listLean"
            ? { customerIds, serviceIds, userIds }
            : {
                customerIds: mapped
                  .filter((o) => o.customerId && !hasHydratedName(o.customerName))
                  .map((o) => o.customerId),
                serviceIds: mapped
                  .filter((o) => o.serviceId && !hasHydratedName(o.serviceName))
                  .map((o) => o.serviceId),
                userIds: mapped.flatMap((o) => {
                  const ids: string[] = [];
                  if (o.assignedUserId && !hasHydratedName(o.assignedUserName)) ids.push(o.assignedUserId);
                  if (o.submitterId && !hasHydratedName(o.submitterName)) ids.push(o.submitterId);
                  if (o.reviewerId && !hasHydratedName(o.reviewerName)) ids.push(o.reviewerId);
                  return ids;
                }),
                contractIds: mapped
                  .filter((o) => o.contractId && o.contractNumber == null)
                  .map((o) => o.contractId)
                  .filter(Boolean) as string[],
                ctvIds: mapped
                  .filter((o) => o.ctvId && !hasHydratedName(o.ctvName))
                  .map((o) => o.ctvId)
                  .filter(Boolean) as string[],
              };
        const needsLookup =
          (lookupReq.customerIds?.length ?? 0) +
            (lookupReq.serviceIds?.length ?? 0) +
            (lookupReq.userIds?.length ?? 0) +
            (lookupReq.contractIds?.length ?? 0) +
            (lookupReq.ctvIds?.length ?? 0) >
          0;
        if (!needsLookup) return;
        await resolveEntityLookups(lookupReq, perms);
        if (options.abandonIf?.()) return;
        applier.replaceOrders(
          orders.map((o) => ({
            ...o,
            customerName: hasHydratedName(o.customerName)
              ? o.customerName
              : lookupCustomerName(o.customerId) || o.customerName,
            serviceName: hasHydratedName(o.serviceName)
              ? o.serviceName
              : lookupServiceName(o.serviceId) || o.serviceName,
            assignedUserName: hasHydratedName(o.assignedUserName)
              ? o.assignedUserName
              : lookupUserName(o.assignedUserId) || o.assignedUserName,
            submitterName: hasHydratedName(o.submitterName)
              ? o.submitterName
              : lookupUserName(o.submitterId) || o.submitterName,
            reviewerName: o.reviewerId
              ? hasHydratedName(o.reviewerName)
                ? o.reviewerName
                : lookupUserName(o.reviewerId) || o.reviewerName
              : o.reviewerName,
            ctvName: o.ctvId
              ? hasHydratedName(o.ctvName)
                ? o.ctvName
                : lookupCtvName(o.ctvId) || o.ctvName
              : o.ctvName,
            contractNumber: (() => {
              if (o.contractNumber != null) return o.contractNumber;
              const raw = o.contractId ? lookupContractNumber(o.contractId) : undefined;
              const n = raw != null ? Number(raw) : undefined;
              return Number.isFinite(n) ? n : o.contractNumber;
            })(),
          })),
        );
      })();
    }
  }

  if (apiPayments) {
    for (const p of apiPayments.items) {
      if (p.orderId && hasHydratedName(p.orderNumber)) rememberOrderNumber(p.orderId, p.orderNumber!);
      if (p.customerId && hasHydratedName(p.customerName)) {
        rememberCustomerName(p.customerId, p.customerName!);
      }
    }
    const paymentRecords = mapPaymentsToRecords(orders, apiPayments.items);
    for (const p of paymentRecords) {
      if (p.orderId && hasHydratedName(p.orderNumber)) rememberOrderNumber(p.orderId, p.orderNumber);
    }
    const paymentRows = append ? mergePaymentRecords(current.payments, paymentRecords) : paymentRecords;
    const hydratedPayments = paymentRows.map((p) => {
      const apiRow = apiPayments.items.find((row) => {
        const recordIds = p.groupedOrderIds?.length ? p.groupedOrderIds : [p.orderId];
        return recordIds.includes(row.orderId);
      });
      return {
        ...p,
        orderNumber:
          (hasHydratedName(apiRow?.orderNumber) ? apiRow!.orderNumber! : undefined) ||
          lookupOrderNumber(p.orderId) ||
          p.orderNumber,
        customerId: apiRow?.customerId || p.customerId,
        customerName:
          (hasHydratedName(apiRow?.customerName) ? apiRow!.customerName! : undefined) ||
          p.customerName ||
          lookupCustomerName(
            apiRow?.customerId || orders.find((o) => o.id === p.orderId)?.customerId,
          ) ||
          "",
      };
    });
    applier.replacePayments(hydratedPayments);
    applier.setListMeta("payments", {
      total: apiPayments.total,
      page: apiPayments.page,
      pageSize: apiPayments.pageSize,
      loaded: Math.min(
        apiPayments.total,
        append
          ? listSize * (apiPayments.page - 1) + apiPayments.items.length
          : apiPayments.items.length,
      ),
    });
    const nameResolve = options.nameResolve ?? "full";
    const orderIds = [
      ...new Set(
        apiPayments.items
          .filter((p) => p.orderId && !hasHydratedName(p.orderNumber))
          .map((p) => p.orderId),
      ),
    ];
    if (orderIds.length && (nameResolve === "full" || nameResolve === "listLean")) {
      void (async () => {
        await resolveEntityLookups({ orderIds }, perms);
        if (options.abandonIf?.()) return;
        applier.replacePayments(
          hydratedPayments.map((p) => ({
            ...p,
            orderNumber: hasHydratedName(p.orderNumber)
              ? p.orderNumber
              : lookupOrderNumber(p.orderId) || p.orderNumber,
            customerName: hasHydratedName(p.customerName)
              ? p.customerName
              : lookupCustomerName(orders.find((o) => o.id === p.orderId)?.customerId) ||
                p.customerName ||
                "",
          })),
        );
      })();
    }
  }

  const orderNumber = new Map(orders.map((o) => [o.id, o.orderNumber]));
  if (apiExpenses) {
    for (const e of apiExpenses.items) {
      if (e.orderId && hasHydratedName(e.orderNumber)) rememberOrderNumber(e.orderId, e.orderNumber!);
      if (e.requestedByUserId && hasHydratedName(e.requestedByName)) {
        rememberUserName(e.requestedByUserId, e.requestedByName!);
      }
      if (e.reviewedByUserId && hasHydratedName(e.reviewedByName)) {
        rememberUserName(e.reviewedByUserId, e.reviewedByName!);
      }
    }
    const mapped = apiExpenses.items.map((e) =>
      mapApiExpenseToUi(
        e,
        (hasHydratedName(e.orderNumber) ? e.orderNumber! : undefined) ||
          orderNumber.get(e.orderId) ||
          lookupOrderNumber(e.orderId),
        {
          requestedByName:
            (hasHydratedName(e.requestedByName) ? e.requestedByName! : undefined) ||
            userName.get(e.requestedByUserId) ||
            lookupUserName(e.requestedByUserId),
          reviewedByName: e.reviewedByUserId
            ? (hasHydratedName(e.reviewedByName) ? e.reviewedByName! : undefined) ||
              userName.get(e.reviewedByUserId) ||
              lookupUserName(e.reviewedByUserId)
            : undefined,
        },
      ),
    );
    const expenses = append ? mergeById(current.expenses, mapped) : mapped;
    applier.replaceExpenses(expenses);
    applier.setListMeta("expenses", {
      total: apiExpenses.total,
      page: apiExpenses.page,
      pageSize: apiExpenses.pageSize,
      loaded: expenses.length,
    });
    void (async () => {
      const nameResolve = options.nameResolve ?? "full";
      if (nameResolve === "off" || nameResolve === "dashboardPreview") return;
      const orderIds = mapped
        .filter((e) => e.orderId && !hasHydratedName(e.orderNumber))
        .map((e) => e.orderId!);
      const userIds = mapped.flatMap((e) => {
        const ids: string[] = [];
        if (e.requestedById && !hasHydratedName(e.requestedByName)) ids.push(e.requestedById);
        if (e.reviewedById && !hasHydratedName(e.reviewedByName)) ids.push(e.reviewedById);
        return ids;
      });
      if (!orderIds.length && !userIds.length) return;
      await resolveEntityLookups({ orderIds, userIds }, perms);
      if (options.abandonIf?.()) return;
      applier.replaceExpenses(
        expenses.map((e) => ({
          ...e,
          orderNumber: hasHydratedName(e.orderNumber)
            ? e.orderNumber
            : lookupOrderNumber(e.orderId) || e.orderNumber,
          requestedByName: hasHydratedName(e.requestedByName)
            ? e.requestedByName
            : lookupUserName(e.requestedById) || e.requestedByName,
          reviewedByName: e.reviewedById
            ? hasHydratedName(e.reviewedByName)
              ? e.reviewedByName
              : lookupUserName(e.reviewedById) || e.reviewedByName
            : e.reviewedByName,
        })),
      );
    })();
  }
  if (apiVat) {
    const mapped = apiVat.items.map((v) => {
      const order = orders.find((o) => o.id === v.orderId);
      return mapApiVatToUi(
        v,
        order?.orderNumber || lookupOrderNumber(v.orderId),
        order?.contractNumber,
      );
    });
    const invoices = append ? mergeById(current.invoices, mapped) : mapped;
    applier.replaceInvoices(invoices);
    applier.setListMeta("vat", {
      total: apiVat.total,
      page: apiVat.page,
      pageSize: apiVat.pageSize,
      loaded: mapped.length,
    });
    void (async () => {
      const nameResolve = options.nameResolve ?? "full";
      if (nameResolve === "off" || nameResolve === "dashboardPreview") return;
      await resolveEntityLookups({ orderIds: mapped.map((v) => v.orderId).filter(Boolean) }, perms);
      if (options.abandonIf?.()) return;
      applier.replaceInvoices(
        invoices.map((v) => ({
          ...v,
          orderNumber: lookupOrderNumber(v.orderId) || v.orderNumber,
        })),
      );
    })();
  }
  if (apiNotifs) {
    const mapped = apiNotifs.items.map(mapApiNotificationToUi);
    applier.replaceNotifications(mapped);
    applier.setListMeta("notifications", {
      total: apiNotifs.total,
      page: apiNotifs.page,
      pageSize: apiNotifs.pageSize,
      loaded: mapped.length,
    });
  }
  if (apiConfig) {
    const items = apiConfig.items ?? [];
    const byKey = new Map(items.map((row) => [row.key, parseConfigValue(row.valueJson)]));
    const reminders = byKey.get(REMINDER_CONFIG_KEY);
    if (reminders && typeof reminders === "object" && reminders !== null && "vatIssueWarnDays" in reminders) {
      const days = Number((reminders as { vatIssueWarnDays?: unknown }).vatIssueWarnDays);
      if (Number.isFinite(days)) applier.hydrateConfig({ vatIssueWarnDays: days });
    }
    applier.hydrateOrderStages(byKey.get(ORDER_STAGES_CONFIG_KEY) ?? null);
    applier.hydrateCustomerStatuses(byKey.get(CUSTOMER_STATUS_CATALOG_KEY) ?? null);
    applier.hydrateServiceCategories(byKey.get(SERVICE_CATEGORIES_CONFIG_KEY) ?? null);
    applier.hydratePagePermissions(byKey.get(PAGE_PERMISSIONS_CONFIG_KEY) ?? null);
  }
}

const FINANCE_CACHE_TTL_MS = 45_000;
/** Shared-contract payment/schedule cache — skip N+1 when hopping siblings. */
const financePaymentCache = new Map<string, { at: number; hasSchedule: boolean }>();
const financeInflight = new Map<string, Promise<void>>();

/**
 * Apply finance + expense rows from GET /orders/:id/detail (1 RTT).
 * Marks the contract payment cache fresh so sibling hops skip refetch.
 */
export function applyOrderDetailFinance(args: {
  order: Order;
  groupOrders?: Order[];
  detail: ApiOrderDetail;
  upsertPayment: (record: PaymentRecord) => void;
  mergeExpensesForOrder: (orderId: string, items: OrderExpense[]) => void;
}): ApiDocument[] {
  const group = siblingOrders(args.groupOrders?.length ? args.groupOrders : [args.order], args.order);
  const primary = pickPrimaryOrder(group.length ? group : [args.order]);
  const payments = unwrapDetailList(args.detail.payments);
  const scheduleLines = unwrapSchedule(args.detail.paymentSchedule);
  const schedules = new Map<string, ApiScheduleLine[]>();
  schedules.set(primary.id, scheduleLines);
  const [record] = mapPaymentsToRecords(group, payments, schedules);
  if (record) args.upsertPayment(record);
  financePaymentCache.set(orderGroupKey(primary), {
    at: Date.now(),
    hasSchedule: true,
  });

  const expenses = unwrapDetailList(args.detail.expenses);
  for (const e of expenses) {
    if (e.orderId && hasHydratedName(e.orderNumber)) rememberOrderNumber(e.orderId, e.orderNumber!);
    if (e.requestedByUserId && hasHydratedName(e.requestedByName)) {
      rememberUserName(e.requestedByUserId, e.requestedByName!);
    }
    if (e.reviewedByUserId && hasHydratedName(e.reviewedByName)) {
      rememberUserName(e.reviewedByUserId, e.reviewedByName!);
    }
  }
  args.mergeExpensesForOrder(
    args.order.id,
    expenses.map((e) =>
      mapApiExpenseToUi(e, args.order.orderNumber, {
        requestedByName: hasHydratedName(e.requestedByName) ? e.requestedByName! : undefined,
        reviewedByName: hasHydratedName(e.reviewedByName) ? e.reviewedByName! : undefined,
      }),
    ),
  );

  return unwrapDetailList(args.detail.documents);
}

/** Shared payment lives on the contract primary; do not fan out to every sibling. */
export async function reloadOrderFinance(args: {
  order: Order;
  groupOrders?: Order[];
  users: AppUser[];
  upsertPayment: (record: PaymentRecord) => void;
  mergeExpensesForOrder: (orderId: string, items: OrderExpense[]) => void;
  force?: boolean;
  /**
   * Fetch payment-schedule. Empty schedule is 200 + lines:[]; 404 means order missing/out of scope.
   * Default false on order detail (prefer GET /orders/:id/detail); true after schedule edits.
   */
  includeSchedule?: boolean;
}): Promise<void> {
  const {
    order,
    users,
    upsertPayment,
    mergeExpensesForOrder,
    force = false,
    includeSchedule = false,
  } = args;
  const group = siblingOrders(args.groupOrders?.length ? args.groupOrders : [order], order);
  const primary = pickPrimaryOrder(group.length ? group : [order]);
  const cacheKey = orderGroupKey(primary);
  const cached = financePaymentCache.get(cacheKey);
  const paymentsFresh = !force && Boolean(cached && Date.now() - cached.at < FINANCE_CACHE_TTL_MS);
  const scheduleFresh =
    !includeSchedule ||
    (!force && Boolean(cached?.hasSchedule && Date.now() - (cached?.at ?? 0) < FINANCE_CACHE_TTL_MS));
  const needSchedule = includeSchedule && !scheduleFresh;
  // Remap installments needs payment rows whenever we (re)load schedule.
  const needPayments = !paymentsFresh || needSchedule;
  const inflightKey = `${cacheKey}:${order.id}:${needPayments ? "pay" : "nopay"}:${needSchedule ? "sch" : "nosch"}`;
  const existing = financeInflight.get(inflightKey);
  if (existing) return existing;

  const userName = new Map(users.map((u) => [u.id, u.name]));

  const run = async () => {
    const paymentPromise: Promise<ApiPayment[] | null> = needPayments
      ? settled(
          fetchPage(
            (page, pageSize) => paymentsApi.list({ page, pageSize, orderId: primary.id }),
            1,
            ROUTE_PAGE_SIZE,
          ).then((r) => r.items),
          [],
        )
      : Promise.resolve(null);

    // Empty schedule = 200 + empty/lines:[]. Do not treat 404 as empty.
    const schedulePromise: Promise<ApiScheduleLine[] | null> = needSchedule
      ? ordersApi.listSchedule(primary.id).then(unwrapSchedule)
      : Promise.resolve(null);

    const expensesPromise = settled(
      fetchPage(
        (page, pageSize) => expensesApi.list({ page, pageSize, orderId: order.id }),
        1,
        ROUTE_PAGE_SIZE,
      ).then((r) => r.items),
      [],
    );

    const [paymentRows, scheduleLines, expenses] = await Promise.all([
      paymentPromise,
      schedulePromise,
      expensesPromise,
    ]);

    if (paymentRows) {
      const schedules = new Map<string, ApiScheduleLine[]>();
      if (scheduleLines) schedules.set(primary.id, scheduleLines);
      const [record] = mapPaymentsToRecords(group, paymentRows, schedules);
      if (record) upsertPayment(record);
      financePaymentCache.set(cacheKey, {
        at: Date.now(),
        hasSchedule: Boolean(cached?.hasSchedule || scheduleLines != null),
      });
    }

    mergeExpensesForOrder(
      order.id,
      expenses.map((e) =>
        mapApiExpenseToUi(e, order.orderNumber, {
          requestedByName:
            (hasHydratedName(e.requestedByName) ? e.requestedByName! : undefined) ||
            userName.get(e.requestedByUserId),
          reviewedByName: e.reviewedByUserId
            ? (hasHydratedName(e.reviewedByName) ? e.reviewedByName! : undefined) ||
              userName.get(e.reviewedByUserId)
            : undefined,
        }),
      ),
    );
  };

  const promise = run().finally(() => {
    financeInflight.delete(inflightKey);
  });
  financeInflight.set(inflightKey, promise);
  return promise;
}
