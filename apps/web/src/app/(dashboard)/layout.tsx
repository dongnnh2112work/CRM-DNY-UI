import { AppConfigProvider } from "@/lib/app-config-store";
import { CustomersProvider } from "@/lib/customers-store";
import { CtvsProvider } from "@/lib/ctvs-store";
import { CustomerStatusProvider } from "@/lib/customer-status-store";
import { EmailsProvider } from "@/lib/emails-store";
import { ExpensesProvider } from "@/lib/expenses-store";
import { NotificationsProvider } from "@/lib/notifications-store";
import { OrderStatusProvider } from "@/lib/order-status-store";
import { OrdersProvider } from "@/lib/orders-store";
import { PaymentsProvider } from "@/lib/payments-store";
import { ServicesProvider } from "@/lib/services-store";
import { VatProvider } from "@/lib/vat-store";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppConfigProvider>
      <OrderStatusProvider>
        <CustomerStatusProvider>
        <ServicesProvider>
          <CustomersProvider>
            <CtvsProvider>
              <OrdersProvider>
                <VatProvider>
                  <PaymentsProvider>
                    <ExpensesProvider>
                      <EmailsProvider>
                        <NotificationsProvider>
                          <AppShell>{children}</AppShell>
                        </NotificationsProvider>
                      </EmailsProvider>
                    </ExpensesProvider>
                  </PaymentsProvider>
                </VatProvider>
              </OrdersProvider>
            </CtvsProvider>
          </CustomersProvider>
        </ServicesProvider>
        </CustomerStatusProvider>
      </OrderStatusProvider>
    </AppConfigProvider>
  );
}
