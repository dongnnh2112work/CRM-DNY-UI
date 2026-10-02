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
import { expensesApi } from "@/modules/expenses/api";
import { mapApiExpenseToUi } from "@/modules/expenses/map-to-ui";
import { identityAdminApi } from "@/modules/identity-admin/api";
import { mapAuthUserToUi, mapIdentityRoleToUi, mapIdentityUserToUi, unwrapIdentityEntity } from "@/modules/identity-admin/map-to-ui";
import { fillMissingRoleCodes } from "@/modules/identity-admin/reassign-pending";
import type { IdentityUser } from "@/modules/identity-admin/api";
import { notificationsApi } from "@/modules/notifications/api";
import { mapApiNotificationToUi } from "@/modules/notifications/map-to-ui";
import { ordersApi, type ApiScheduleLine } from "@/modules/orders/api";
import { mapApiOrderToUi } from "@/modules/orders/map-to-ui";
import { paymentsApi, type ApiPayment } from "@/modules/payments/api";
import { mapPaymentsToRecords, unwrapSchedule } from "@/modules/payments/map-to-ui";
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
   * - off: skip lookups
   */
  nameResolve?: "full" | "dashboardPreview" | "off";
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
    commissionPercent: local.commissionPercent ?? remote.commissionPercent,
    zaloGroupUrl: local.zaloGroupUrl ?? remote.zaloGroupUrl,
    deadline: local.deadline ?? remote.deadline,
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
          configApi.list().then(async (list) => {
            const items = [...(list.items ?? [])];
            const hasPagePerms = items.some((row) => row.key === PAGE_PERMISSIONS_CONFIG_KEY);
            if (!hasPagePerms) {
              const pagePerms = await configApi
                .get(PAGE_PERMISSIONS_CONFIG_KEY, { silent: true })
                .catch(() => undefined);
              if (pagePerms?.key) items.push(pagePerms);
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
        customerName:
          customerName.get(o.customerId) ||
          lookupCustomerName(o.customerId) ||
          existing?.customerName,
        serviceName:
          serviceName.get(o.serviceId) || lookupServiceName(o.serviceId) || existing?.serviceName,
        assignedUserName:
          userName.get(o.assignedUserId) ||
          lookupUserName(o.assignedUserId) ||
          existing?.assignedUserName,
        submitterName:
          userName.get(o.submitterUserId) ||
          lookupUserName(o.submitterUserId) ||
          existing?.submitterName,
        reviewerName: o.reviewerUserId
          ? userName.get(o.reviewerUserId) ||
            lookupUserName(o.reviewerUserId) ||
            existing?.reviewerName
          : undefined,
        ctvName: o.collaboratorId
          ? ctvName.get(o.collaboratorId) ||
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

    // Name cells fill in after first paint (plan: rows render immediately).
    const nameResolve = options.nameResolve ?? "full";
    if (nameResolve !== "off") {
      void (async () => {
        const preview = nameResolve === "dashboardPreview" ? mapped.slice(0, 5) : mapped;
        await resolveEntityLookups(
          nameResolve === "dashboardPreview"
            ? {
                customerIds: preview.map((o) => o.customerId).filter(Boolean),
                serviceIds: preview.map((o) => o.serviceId).filter(Boolean),
              }
            : {
                customerIds: mapped.map((o) => o.customerId).filter(Boolean),
                serviceIds: mapped.map((o) => o.serviceId).filter(Boolean),
                userIds: mapped
                  .flatMap((o) => [o.assignedUserId, o.submitterId, o.reviewerId])
                  .filter(Boolean) as string[],
                contractIds: mapped.map((o) => o.contractId).filter(Boolean) as string[],
                ctvIds: mapped.map((o) => o.ctvId).filter(Boolean) as string[],
              },
          perms,
        );
        if (options.abandonIf?.()) return;
        applier.replaceOrders(
          orders.map((o) => ({
            ...o,
            customerName: lookupCustomerName(o.customerId) || o.customerName,
            serviceName: lookupServiceName(o.serviceId) || o.serviceName,
            assignedUserName: lookupUserName(o.assignedUserId) || o.assignedUserName,
            submitterName: lookupUserName(o.submitterId) || o.submitterName,
            reviewerName: o.reviewerId ? lookupUserName(o.reviewerId) || o.reviewerName : o.reviewerName,
            ctvName: o.ctvId ? lookupCtvName(o.ctvId) || o.ctvName : o.ctvName,
            contractNumber: (() => {
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
    const paymentRecords = mapPaymentsToRecords(orders, apiPayments.items);
    for (const p of paymentRecords) {
      if (p.orderId) rememberOrderNumber(p.orderId, p.orderNumber);
    }
    const paymentRows = append ? mergePaymentRecords(current.payments, paymentRecords) : paymentRecords;
    applier.replacePayments(paymentRows);
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
    const orderIds = [...new Set(apiPayments.items.map((p) => p.orderId).filter(Boolean))];
    // Dashboard already resolves names from the orders preview; skip payment orphan lookups.
    if (orderIds.length && nameResolve === "full") {
      void (async () => {
        await resolveEntityLookups({ orderIds }, perms);
        if (options.abandonIf?.()) return;
        const withNames = paymentRows.map((p) => ({
          ...p,
          orderNumber: lookupOrderNumber(p.orderId) || p.orderNumber,
          customerName:
            p.customerName ||
            lookupCustomerName(orders.find((o) => o.id === p.orderId)?.customerId) ||
            "",
        }));
        applier.replacePayments(withNames);
      })();
    }
  }

  const orderNumber = new Map(orders.map((o) => [o.id, o.orderNumber]));
  if (apiExpenses) {
    const mapped = apiExpenses.items.map((e) =>
      mapApiExpenseToUi(e, orderNumber.get(e.orderId) || lookupOrderNumber(e.orderId), {
        requestedByName: userName.get(e.requestedByUserId) || lookupUserName(e.requestedByUserId),
        reviewedByName: e.reviewedByUserId
          ? userName.get(e.reviewedByUserId) || lookupUserName(e.reviewedByUserId)
          : undefined,
      }),
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
      await resolveEntityLookups(
        {
          orderIds: mapped.map((e) => e.orderId).filter(Boolean) as string[],
          userIds: mapped
            .flatMap((e) => [e.requestedById, e.reviewedById])
            .filter(Boolean) as string[],
        },
        perms,
      );
      if (options.abandonIf?.()) return;
      applier.replaceExpenses(
        expenses.map((e) => ({
          ...e,
          orderNumber: lookupOrderNumber(e.orderId) || e.orderNumber,
          requestedByName: lookupUserName(e.requestedById) || e.requestedByName,
          reviewedByName: e.reviewedById
            ? lookupUserName(e.reviewedById) || e.reviewedByName
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

/** Shared payment lives on the contract primary; do not fan out to every sibling. */
export async function reloadOrderFinance(args: {
  order: Order;
  groupOrders?: Order[];
  users: AppUser[];
  upsertPayment: (record: PaymentRecord) => void;
  mergeExpensesForOrder: (orderId: string, items: OrderExpense[]) => void;
  force?: boolean;
  /**
   * Fetch payment-schedule (often 404/~3s when empty). Default false on order detail;
   * true on payment detail / after schedule edits.
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

    // 404 "Payment schedule not found" → empty via settled; only primary (not × siblings).
    const schedulePromise: Promise<ApiScheduleLine[] | null> = needSchedule
      ? settled(ordersApi.listSchedule(primary.id).then(unwrapSchedule), [])
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
          requestedByName: userName.get(e.requestedByUserId),
          reviewedByName: e.reviewedByUserId ? userName.get(e.reviewedByUserId) : undefined,
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
