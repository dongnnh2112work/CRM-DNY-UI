import { fetchAllPages, unwrapList } from "@/lib/http/paging";
import type { AppUser, Customer, Ctv, Order, OrderExpense, PaymentRecord, Service, VatInvoice } from "@/lib/types";
import type { AuthUser } from "@/modules/auth/api";
import { collaboratorsApi } from "@/modules/collaborators/api";
import { mapApiCollaboratorToUi } from "@/modules/collaborators/map-to-ui";
import { configApi, REMINDER_CONFIG_KEY } from "@/modules/config/api";
import { contractsApi } from "@/modules/contracts/api";
import { customersApi } from "@/modules/customers/api";
import { mapApiCustomerToUi } from "@/modules/customers/map-to-ui";
import { expensesApi } from "@/modules/expenses/api";
import { mapApiExpenseToUi } from "@/modules/expenses/map-to-ui";
import { identityAdminApi } from "@/modules/identity-admin/api";
import { mapAuthUserToUi, mapIdentityRoleToUi, mapIdentityUserToUi } from "@/modules/identity-admin/map-to-ui";
import { notificationsApi } from "@/modules/notifications/api";
import { mapApiNotificationToUi } from "@/modules/notifications/map-to-ui";
import { ordersApi } from "@/modules/orders/api";
import { mapApiOrderToUi } from "@/modules/orders/map-to-ui";
import { paymentsApi } from "@/modules/payments/api";
import { mapPaymentsToRecords, unwrapSchedule } from "@/modules/payments/map-to-ui";
import { servicesApi } from "@/modules/services/api";
import { mapApiServiceToUi } from "@/modules/services/map-to-ui";
import { vatApi } from "@/modules/vat/api";
import { mapApiVatToUi } from "@/modules/vat/map-to-ui";

export type RefreshScope =
  | "all"
  | "core"
  | "deferred"
  | "users"
  | "customers"
  | "services"
  | "orders"
  | "payments"
  | "expenses"
  | "vat"
  | "notifications";

export type ApiDataSnapshot = {
  users: AppUser[];
  customers: Customer[];
  services: Service[];
  ctvs: Ctv[];
  orders: Order[];
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
    status: local.status ?? remote.status,
    usedServiceIds: local.usedServiceIds?.length ? local.usedServiceIds : remote.usedServiceIds,
    customFields: { ...remote.customFields, ...local.customFields },
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

export async function applyRemoteData(
  applier: ApiDataApplier,
  sessionUser: AuthUser | null | undefined,
  scopesInput: RefreshScope | RefreshScope[],
  getSnapshot: () => ApiDataSnapshot,
): Promise<void> {
  const scopes = new Set(Array.isArray(scopesInput) ? scopesInput : [scopesInput]);
  const core = wantsCore(scopes);
  const deferred = wantsDeferred(scopes);
  const loadUsers = core || wants(scopes, "users");
  const loadCustomers = core || wants(scopes, "customers");
  const loadServices = core || wants(scopes, "services");
  const loadOrders = core || wants(scopes, "orders") || wants(scopes, "payments");
  const loadExpenses = deferred || wants(scopes, "expenses");
  const loadVat = deferred || wants(scopes, "vat");
  const loadNotifs = deferred || wants(scopes, "notifications");
  const loadConfig = deferred;

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
      ? settled(fetchAllPages((page, pageSize) => identityAdminApi.listUsers({ page, pageSize })), [])
      : Promise.resolve(null),
    loadCustomers
      ? settled(fetchAllPages((page, pageSize) => customersApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadServices
      ? settled(fetchAllPages((page, pageSize) => servicesApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadOrders
      ? settled(fetchAllPages((page, pageSize) => ordersApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadOrders
      ? settled(fetchAllPages((page, pageSize) => contractsApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadOrders
      ? settled(fetchAllPages((page, pageSize) => collaboratorsApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadOrders
      ? settled(fetchAllPages((page, pageSize) => paymentsApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadExpenses
      ? settled(fetchAllPages((page, pageSize) => expensesApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadVat
      ? settled(fetchAllPages((page, pageSize) => vatApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadNotifs
      ? settled(fetchAllPages((page, pageSize) => notificationsApi.list({ page, pageSize })), [])
      : Promise.resolve(null),
    loadConfig
      ? settled(configApi.list(REMINDER_CONFIG_KEY), { items: [] as { valueJson?: unknown }[] })
      : Promise.resolve(null),
    loadUsers
      ? settled(identityAdminApi.listRoles().then(unwrapList), [])
      : Promise.resolve(null),
  ]);

  const current = getSnapshot();

  let uiUsers = current.users;
  if (apiUsers) {
    uiUsers = apiUsers.map(mapIdentityUserToUi);
    if (sessionUser && !uiUsers.some((u) => u.id === sessionUser.id)) {
      uiUsers.unshift(mapAuthUserToUi(sessionUser));
    }
    applier.replaceUsers(uiUsers, sessionUser?.id);
  }
  if (apiRoles) {
    applier.mergeRemoteRoles(apiRoles.map(mapIdentityRoleToUi));
  }

  let customers = current.customers;
  if (apiCustomers) {
    const localById = new Map(current.customers.map((c) => [c.id, c]));
    customers = apiCustomers.map((c) => mergeCustomerLocal(mapApiCustomerToUi(c), localById.get(c.id)));
    applier.replaceCustomers(customers);
  }

  let services = current.services;
  if (apiServices) {
    services = apiServices.map(mapApiServiceToUi);
    applier.replaceServices(services);
  }

  let ctvs = current.ctvs;
  if (apiCollaborators) {
    ctvs = apiCollaborators.map(mapApiCollaboratorToUi);
    applier.replaceCtvs(ctvs);
  }

  const userName = new Map(uiUsers.map((u) => [u.id, u.name]));
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const ctvName = new Map(ctvs.map((c) => [c.id, c.name]));

  let orders = current.orders;
  if (apiOrders) {
    const contractById = new Map((apiContracts ?? []).map((c) => [c.id, c]));
    const localById = new Map(current.orders.map((o) => [o.id, o]));
    orders = apiOrders.map((o) => {
      const contract = contractById.get(o.contractId);
      const contractNumber = contract ? Number(contract.contractNumber) : undefined;
      const mapped = mapApiOrderToUi(o, {
        customerName: customerName.get(o.customerId),
        serviceName: serviceName.get(o.serviceId),
        assignedUserName: userName.get(o.assignedUserId),
        submitterName: userName.get(o.submitterUserId),
        reviewerName: o.reviewerUserId ? userName.get(o.reviewerUserId) : undefined,
        ctvName: o.collaboratorId ? ctvName.get(o.collaboratorId) : undefined,
        contractNumber: Number.isFinite(contractNumber) ? contractNumber : undefined,
      });
      return mergeOrderLocal(mapped, localById.get(o.id));
    });
    applier.replaceOrders(orders);
    applier.replacePayments(mapPaymentsToRecords(orders, apiPayments ?? []));
  }

  const orderNumber = new Map(orders.map((o) => [o.id, o.orderNumber]));
  if (apiExpenses) {
    applier.replaceExpenses(
      apiExpenses.map((e) =>
        mapApiExpenseToUi(e, orderNumber.get(e.orderId), {
          requestedByName: userName.get(e.requestedByUserId),
          reviewedByName: e.reviewedByUserId ? userName.get(e.reviewedByUserId) : undefined,
        }),
      ),
    );
  }
  if (apiVat) {
    applier.replaceInvoices(
      apiVat.map((v) => {
        const order = orders.find((o) => o.id === v.orderId);
        return mapApiVatToUi(v, order?.orderNumber, order?.contractNumber);
      }),
    );
  }
  if (apiNotifs) {
    applier.replaceNotifications(apiNotifs.map(mapApiNotificationToUi));
  }
  if (apiConfig) {
    const row = apiConfig.items?.[0];
    const json = row?.valueJson;
    if (json && typeof json === "object" && json !== null && "vatIssueWarnDays" in json) {
      const days = Number((json as { vatIssueWarnDays?: unknown }).vatIssueWarnDays);
      if (Number.isFinite(days)) applier.hydrateConfig({ vatIssueWarnDays: days });
    }
  }
}

export async function reloadOrderFinance(args: {
  order: Order;
  users: AppUser[];
  upsertPayment: (record: PaymentRecord) => void;
  mergeExpensesForOrder: (orderId: string, items: OrderExpense[]) => void;
}): Promise<void> {
  const { order, users, upsertPayment, mergeExpensesForOrder } = args;
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const [payments, schedule, expenses] = await Promise.all([
    settled(fetchAllPages((page, pageSize) => paymentsApi.list({ page, pageSize, orderId: order.id })), []),
    settled(ordersApi.listSchedule(order.id).then(unwrapSchedule), []),
    settled(fetchAllPages((page, pageSize) => expensesApi.list({ page, pageSize, orderId: order.id })), []),
  ]);
  const [record] = mapPaymentsToRecords([order], payments, new Map([[order.id, schedule]]));
  if (record) upsertPayment(record);
  mergeExpensesForOrder(
    order.id,
    expenses.map((e) =>
      mapApiExpenseToUi(e, order.orderNumber, {
        requestedByName: userName.get(e.requestedByUserId),
        reviewedByName: e.reviewedByUserId ? userName.get(e.reviewedByUserId) : undefined,
      }),
    ),
  );
}
