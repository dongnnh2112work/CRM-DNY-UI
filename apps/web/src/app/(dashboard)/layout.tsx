import { AppConfigProvider } from "@/lib/app-config-store";
import { CustomersProvider } from "@/lib/customers-store";
import { CtvsProvider } from "@/lib/ctvs-store";
import { EmailsProvider } from "@/lib/emails-store";
import { ExpensesProvider } from "@/lib/expenses-store";
import { NotificationsProvider } from "@/lib/notifications-store";
import { OrdersProvider } from "@/lib/orders-store";
import { PaymentsProvider } from "@/lib/payments-store";
import { ServicesProvider } from "@/lib/services-store";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppConfigProvider>
      <ServicesProvider>
        <CustomersProvider>
          <CtvsProvider>
            <OrdersProvider>
              <PaymentsProvider>
                <ExpensesProvider>
                  <EmailsProvider>
                    <NotificationsProvider>
                      <AppShell>{children}</AppShell>
                    </NotificationsProvider>
                  </EmailsProvider>
                </ExpensesProvider>
              </PaymentsProvider>
            </OrdersProvider>
          </CtvsProvider>
        </CustomersProvider>
      </ServicesProvider>
    </AppConfigProvider>
  );
}
