"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageLoading } from "@/components/shared/page-loading";
import { fetchAllPages } from "@/lib/http/paging";
import { useAppReminderConfig } from "@/lib/app-config-store";
import { useCustomers } from "@/lib/customers-store";
import { useCtvs } from "@/lib/ctvs-store";
import { useExpenses } from "@/lib/expenses-store";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { useServices } from "@/lib/services-store";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { useVat } from "@/lib/vat-store";
import { collaboratorsApi } from "@/modules/collaborators/api";
import { mapApiCollaboratorToUi } from "@/modules/collaborators/map-to-ui";
import { configApi, REMINDER_CONFIG_KEY } from "@/modules/config/api";
import { contractsApi } from "@/modules/contracts/api";
import { customersApi } from "@/modules/customers/api";
import { mapApiCustomerToUi } from "@/modules/customers/map-to-ui";
import { documentsApi } from "@/modules/documents/api";
import { mapApiDocumentToAttachment, isLicenseDocument } from "@/modules/documents/map-to-ui";
import { expensesApi } from "@/modules/expenses/api";
import { mapApiExpenseToUi } from "@/modules/expenses/map-to-ui";
import { identityAdminApi } from "@/modules/identity-admin/api";
import { mapAuthUserToUi, mapIdentityRoleToUi, mapIdentityUserToUi } from "@/modules/identity-admin/map-to-ui";
import { notificationsApi } from "@/modules/notifications/api";
import { mapApiNotificationToUi } from "@/modules/notifications/map-to-ui";
import { ordersApi } from "@/modules/orders/api";
import { mapApiOrderToUi } from "@/modules/orders/map-to-ui";
import { paymentsApi } from "@/modules/payments/api";
import { mapPaymentsToRecords } from "@/modules/payments/map-to-ui";
import { servicesApi } from "@/modules/services/api";
import { mapApiServiceToUi } from "@/modules/services/map-to-ui";
import { vatApi } from "@/modules/vat/api";
import { mapApiVatToUi } from "@/modules/vat/map-to-ui";

async function settled<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export function ApiHydrator({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const { replaceCustomers } = useCustomers();
  const { replaceServices } = useServices();
  const { replaceOrders } = useOrders();
  const { replaceCtvs } = useCtvs();
  const { replaceExpenses } = useExpenses();
  const { replaceInvoices } = useVat();
  const { replacePayments } = usePayments();
  const { replaceNotifications } = useNotifications();
  const { replaceUsers, mergeRemoteRoles } = useUsers();
  const { hydrateConfig } = useAppReminderConfig();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    const run = async () => {
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
        apiDocs,
        apiConfig,
        apiRoles,
      ] = await Promise.all([
        settled(fetchAllPages((page, pageSize) => identityAdminApi.listUsers({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => customersApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => servicesApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => ordersApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => contractsApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => collaboratorsApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => paymentsApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => expensesApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => vatApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => notificationsApi.list({ page, pageSize })), []),
        settled(fetchAllPages((page, pageSize) => documentsApi.list({ page, pageSize })), []),
        settled(configApi.list(REMINDER_CONFIG_KEY), { items: [] }),
        settled(fetchAllPages(() => identityAdminApi.listRoles()), []),
      ]);

      if (cancelled) return;

      const uiUsers = apiUsers.map(mapIdentityUserToUi);
      if (user && !uiUsers.some((u) => u.id === user.id)) {
        uiUsers.unshift(mapAuthUserToUi(user));
      }
      replaceUsers(uiUsers, user?.id);
      mergeRemoteRoles(apiRoles.map(mapIdentityRoleToUi));

      const customers = apiCustomers.map(mapApiCustomerToUi);
      const services = apiServices.map(mapApiServiceToUi);
      const ctvs = apiCollaborators.map(mapApiCollaboratorToUi);
      replaceCustomers(customers);
      replaceServices(services);
      replaceCtvs(ctvs);

      const userName = new Map(uiUsers.map((u) => [u.id, u.name]));
      const customerName = new Map(customers.map((c) => [c.id, c.name]));
      const serviceName = new Map(services.map((s) => [s.id, s.name]));
      const ctvName = new Map(ctvs.map((c) => [c.id, c.name]));
      const contractById = new Map(apiContracts.map((c) => [c.id, c]));

      const docsByOrder = new Map<string, { att: ReturnType<typeof mapApiDocumentToAttachment>; license: boolean }[]>();
      for (const doc of apiDocs) {
        if (!doc.orderId) continue;
        const list = docsByOrder.get(doc.orderId) ?? [];
        list.push({
          att: mapApiDocumentToAttachment(doc, userName.get(doc.uploadedByUserId)),
          license: isLicenseDocument(doc),
        });
        docsByOrder.set(doc.orderId, list);
      }

      const orders = apiOrders.map((o) => {
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
        const files = docsByOrder.get(o.id) ?? [];
        return {
          ...mapped,
          attachments: files.filter((f) => !f.license).map((f) => f.att),
          licenseAttachments: files.filter((f) => f.license).map((f) => f.att),
        };
      });
      replaceOrders(orders);

      const orderNumber = new Map(orders.map((o) => [o.id, o.orderNumber]));
      replacePayments(mapPaymentsToRecords(orders, apiPayments));
      replaceExpenses(apiExpenses.map((e) => mapApiExpenseToUi(e, orderNumber.get(e.orderId))));
      replaceInvoices(
        apiVat.map((v) => {
          const order = orders.find((o) => o.id === v.orderId);
          return mapApiVatToUi(v, order?.orderNumber, order?.contractNumber);
        }),
      );
      replaceNotifications(apiNotifs.map(mapApiNotificationToUi));

      const row = apiConfig.items?.[0];
      const json = row?.valueJson;
      if (json && typeof json === "object" && json !== null && "vatIssueWarnDays" in json) {
        const days = Number((json as { vatIssueWarnDays?: unknown }).vatIssueWarnDays);
        if (Number.isFinite(days)) hydrateConfig({ vatIssueWarnDays: days });
      }

      setReady(true);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    status,
    user,
    replaceCustomers,
    replaceServices,
    replaceOrders,
    replaceCtvs,
    replaceExpenses,
    replaceInvoices,
    replacePayments,
    replaceNotifications,
    replaceUsers,
    mergeRemoteRoles,
    hydrateConfig,
  ]);

  if (status === "authenticated" && !ready) return <PageLoading />;
  return <>{children}</>;
}
