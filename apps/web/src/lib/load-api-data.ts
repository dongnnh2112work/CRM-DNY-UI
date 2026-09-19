import { CATALOG_PAGE_SIZE, LIST_PAGE_SIZE, fetchPage, unwrapList } from "@/lib/http/paging";
import { orderGroupKey, pickPrimaryOrder, siblingOrders } from "@/lib/order-group";
import type { AppUser, Customer, Ctv, Order, OrderExpense, PaymentRecord, Service, VatInvoice } from "@/lib/types";
import type { AuthUser } from "@/modules/auth/api";
import { collaboratorsApi } from "@/modules/collaborators/api";
import { mapApiCollaboratorToUi } from "@/modules/collaborators/map-to-ui";
import {
  configApi,
  CUSTOMER_STATUS_CATALOG_KEY,
  ORDER_STAGES_CONFIG_KEY,
  PAGE_PERMISSIONS_CONFIG_KEY,
  parseConfigValue,
  REMINDER_CONFIG_KEY,
} from "@/modules/config/api";
import { contractsApi } from "@/modules/contracts/api";
import { customersApi } from "@/modules/customers/api";
import { mapApiCustomerToUi } from "@/modules/customers/map-to-ui";
import { expensesApi } from "@/modules/expenses/api";
import { mapApiExpenseToUi } from "@/modules/expenses/map-to-ui";
import { identityAdminApi } from "@/modules/identity-admin/api";
import { mapAuthUserToUi, mapIdentityRoleToUi, mapIdentityUserToUi } from "@/modules/identity-admin/map-to-ui";
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
export type ListSliceMeta = {
  total: number;
  page: number;
  pageSize: number;
  loaded: number;
};

export type ApplyRemoteOptions = {
  page?: number;
  append?: boolean;
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
  const listSize = LIST_PAGE_SIZE;
  const catalogSize = CATALOG_PAGE_SIZE;
  const loadUsers = core || wants(scopes, "users");
  const loadCustomers = wants(scopes, "customers");
  const loadServices = core || wants(scopes, "services");
  const loadOrders = wants(scopes, "orders");
  const loadPayments = wants(scopes, "payments");
  const loadContracts = wants(scopes, "contracts");
  const loadExpenses = wants(scopes, "expenses") || wantsDeferred(scopes);
  const loadVat = wants(scopes, "vat") || wantsDeferred(scopes);
  const loadNotifs = core || wants(scopes, "notifications") || wantsDeferred(scopes);
  const loadConfig = core;

  const [
    apiUsers,
    apiCustomers,
    apiServices,
    apiOrders,
    apiContracts,
    apiCollaborators,
    apiPayments,
    apiExpenses,
    apiVat,
    apiNotifs,
    apiConfig,
    apiRoles,
  ] = await Promise.all([
    loadUsers
      ? settled(fetchPage((p, s) => identityAdminApi.listUsers({ page: p, pageSize: s }), page, catalogSize), null)
      : Promise.resolve(null),
    loadCustomers
      ? settled(fetchPage((p, s) => customersApi.list({ page: p, pageSize: s }), page, listSize), null)
      : Promise.resolve(null),
    loadServices
      ? settled(fetchPage((p, s) => servicesApi.list({ page: p, pageSize: s }), page, catalogSize), null)
      : Promise.resolve(null),
    loadOrders
      ? settled(fetchPage((p, s) => ordersApi.list({ page: p, pageSize: s }), page, listSize), null)
      : Promise.resolve(null),
    loadContracts
      ? settled(fetchPage((p, s) => contractsApi.list({ page: p, pageSize: s }), page, listSize), null)
      : Promise.resolve(null),
    loadContracts
      ? settled(fetchPage((p, s) => collaboratorsApi.list({ page: p, pageSize: s }), 1, catalogSize), null)
      : Promise.resolve(null),
    loadPayments
      ? settled(fetchPage((p, s) => paymentsApi.list({ page: p, pageSize: s }), page, listSize), null)
      : Promise.resolve(null),
    loadExpenses
      ? settled(fetchPage((p, s) => expensesApi.list({ page: p, pageSize: s }), page, listSize), null)
      : Promise.resolve(null),
    loadVat
      ? settled(fetchPage((p, s) => vatApi.list({ page: p, pageSize: s }), page, listSize), null)
      : Promise.resolve(null),
    loadNotifs
      ? settled(fetchPage((p, s) => notificationsApi.list({ page: p, pageSize: s }), page, listSize), null)
      : Promise.resolve(null),
    loadConfig
      ? settled(
          Promise.all([
            configApi.list(),
            configApi.get(PAGE_PERMISSIONS_CONFIG_KEY, { silent: true }).catch(() => undefined),
          ]).then(([list, pagePerms]) => {
            const items = [...(list.items ?? [])];
            if (pagePerms?.key) {
              const idx = items.findIndex((row) => row.key === pagePerms.key);
              if (idx >= 0) items[idx] = pagePerms;
              else items.push(pagePerms);
            }
            return { items };
          }),
          { items: [] as { key?: string; valueJson?: unknown }[] },
        )
      : Promise.resolve(null),
    loadUsers
      ? settled(identityAdminApi.listRoles().then(unwrapList), [])
      : Promise.resolve(null),
  ]);

  const current = getSnapshot();

  let uiUsers = current.users;
  if (apiUsers) {
    const mapped = apiUsers.items.map(mapIdentityUserToUi);
    uiUsers = append ? mergeById(current.users, mapped) : mapped;
    if (sessionUser && !uiUsers.some((u) => u.id === sessionUser.id)) {
      uiUsers.unshift(mapAuthUserToUi(sessionUser));
    }
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
    applier.replaceCustomers(customers);
    applier.setListMeta("customers", {
      total: apiCustomers.total,
      page: apiCustomers.page,
      pageSize: apiCustomers.pageSize,
      loaded: customers.length,
    });
  }

  let services = current.services;
  if (apiServices) {
    const mapped = apiServices.items.map(mapApiServiceToUi);
    services = append ? mergeById(current.services, mapped) : mapped;
    applier.replaceServices(services);
    applier.setListMeta("services", {
      total: apiServices.total,
      page: apiServices.page,
      pageSize: apiServices.pageSize,
      loaded: services.length,
    });
  }

  let ctvs = current.ctvs;
  if (apiCollaborators) {
    const mapped = apiCollaborators.items.map(mapApiCollaboratorToUi);
    ctvs = append ? mergeById(current.ctvs, mapped) : mapped;
    applier.replaceCtvs(ctvs);
  }

  if (apiContracts) {
    applier.setListMeta("contracts", {
      total: apiContracts.total,
      page: apiContracts.page,
      pageSize: apiContracts.pageSize,
      loaded: apiContracts.items.length,
    });
  }

  const userName = new Map(uiUsers.map((u) => [u.id, u.name]));
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const ctvName = new Map(ctvs.map((c) => [c.id, c.name]));

  let orders = current.orders;
  if (apiOrders) {
    const contractById = new Map((apiContracts?.items ?? []).map((c) => [c.id, c]));
    const localById = new Map(current.orders.map((o) => [o.id, o]));
    const mapped = apiOrders.items.map((o) => {
      const contract = contractById.get(o.contractId);
      const contractNumber = contract ? Number(contract.contractNumber) : undefined;
      const existing = localById.get(o.id);
      const mappedOrder = mapApiOrderToUi(o, {
        customerName: customerName.get(o.customerId),
        serviceName: serviceName.get(o.serviceId),
        assignedUserName: userName.get(o.assignedUserId),
        submitterName: userName.get(o.submitterUserId),
        reviewerName: o.reviewerUserId ? userName.get(o.reviewerUserId) : undefined,
        ctvName: o.collaboratorId ? ctvName.get(o.collaboratorId) : undefined,
        contractNumber: Number.isFinite(contractNumber)
          ? contractNumber
          : existing?.contractNumber,
      });
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
  } else if (apiContracts?.items.length || apiCollaborators) {
    const contractById = new Map((apiContracts?.items ?? []).map((c) => [c.id, c]));
    let changed = false;
    orders = current.orders.map((o) => {
      let next = o;
      if (o.contractId && contractById.size) {
        const contract = contractById.get(o.contractId);
        const contractNumber = contract ? Number(contract.contractNumber) : undefined;
        if (Number.isFinite(contractNumber) && next.contractNumber !== contractNumber) {
          next = { ...next, contractNumber };
          changed = true;
        }
      }
      if (o.ctvId) {
        const name = ctvName.get(o.ctvId);
        if (name && next.ctvName !== name) {
          next = { ...next, ctvName: name };
          changed = true;
        }
      }
      return next;
    });
    if (changed) applier.replaceOrders(orders);
  }

  if (apiPayments) {
    const paymentRecords = mapPaymentsToRecords(orders, apiPayments.items);
    applier.replacePayments(
      append ? mergePaymentRecords(current.payments, paymentRecords) : paymentRecords,
    );
    applier.setListMeta("payments", {
      total: apiPayments.total,
      page: apiPayments.page,
      pageSize: apiPayments.pageSize,
      loaded: paymentRecords.length,
    });
  }

  const orderNumber = new Map(orders.map((o) => [o.id, o.orderNumber]));
  if (apiExpenses) {
    const mapped = apiExpenses.items.map((e) =>
      mapApiExpenseToUi(e, orderNumber.get(e.orderId), {
        requestedByName: userName.get(e.requestedByUserId),
        reviewedByName: e.reviewedByUserId ? userName.get(e.reviewedByUserId) : undefined,
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
  }
  if (apiVat) {
    const mapped = apiVat.items.map((v) => {
      const order = orders.find((o) => o.id === v.orderId);
      return mapApiVatToUi(v, order?.orderNumber, order?.contractNumber);
    });
    applier.replaceInvoices(append ? mergeById(current.invoices, mapped) : mapped);
    applier.setListMeta("vat", {
      total: apiVat.total,
      page: apiVat.page,
      pageSize: apiVat.pageSize,
      loaded: mapped.length,
    });
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
    applier.hydratePagePermissions(byKey.get(PAGE_PERMISSIONS_CONFIG_KEY) ?? null);
  }
}

const FINANCE_CACHE_TTL_MS = 45_000;
/** Shared-contract payment/schedule cache — skip N+1 when hopping siblings. */
const financePaymentCache = new Map<string, { at: number }>();
const financeInflight = new Map<string, Promise<void>>();

/** Shared payment lives on the contract primary; do not fan out to every sibling. */
export async function reloadOrderFinance(args: {
  order: Order;
  groupOrders?: Order[];
  users: AppUser[];
  upsertPayment: (record: PaymentRecord) => void;
  mergeExpensesForOrder: (orderId: string, items: OrderExpense[]) => void;
  force?: boolean;
}): Promise<void> {
  const { order, users, upsertPayment, mergeExpensesForOrder, force = false } = args;
  const group = siblingOrders(args.groupOrders?.length ? args.groupOrders : [order], order);
  const primary = pickPrimaryOrder(group.length ? group : [order]);
  const cacheKey = orderGroupKey(primary);
  const cached = financePaymentCache.get(cacheKey);
  const paymentsFresh = !force && Boolean(cached && Date.now() - cached.at < FINANCE_CACHE_TTL_MS);
  const inflightKey = `${cacheKey}:${order.id}:${paymentsFresh ? "exp" : "full"}`;
  const existing = financeInflight.get(inflightKey);
  if (existing) return existing;

  const userName = new Map(users.map((u) => [u.id, u.name]));

  const run = async () => {
    const paymentPromise: Promise<ApiPayment[] | null> = paymentsFresh
      ? Promise.resolve(null)
      : settled(
          fetchPage(
            (page, pageSize) => paymentsApi.list({ page, pageSize, orderId: primary.id }),
            1,
            CATALOG_PAGE_SIZE,
          ).then((r) => r.items),
          [],
        );

    // 404 "Payment schedule not found" → empty via settled; only primary (not × siblings).
    const schedulePromise: Promise<ApiScheduleLine[]> = paymentsFresh
      ? Promise.resolve([])
      : settled(ordersApi.listSchedule(primary.id).then(unwrapSchedule), []);

    const expensesPromise = settled(
      fetchPage(
        (page, pageSize) => expensesApi.list({ page, pageSize, orderId: order.id }),
        1,
        CATALOG_PAGE_SIZE,
      ).then((r) => r.items),
      [],
    );

    const [paymentRows, scheduleLines, expenses] = await Promise.all([
      paymentPromise,
      schedulePromise,
      expensesPromise,
    ]);

    if (paymentRows) {
      const schedules = new Map<string, ApiScheduleLine[]>([[primary.id, scheduleLines]]);
      const [record] = mapPaymentsToRecords(group, paymentRows, schedules);
      if (record) upsertPayment(record);
      financePaymentCache.set(cacheKey, { at: Date.now() });
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
