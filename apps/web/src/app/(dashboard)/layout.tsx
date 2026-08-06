import { AppShell } from "@/components/layout/app-shell";
import { CustomersProvider } from "@/lib/customers-store";
import { CtvsProvider } from "@/lib/ctvs-store";
import { OrdersProvider } from "@/lib/orders-store";
import { PaymentsProvider } from "@/lib/payments-store";
import { ServicesProvider } from "@/lib/services-store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ServicesProvider>
      <CustomersProvider>
        <CtvsProvider>
          <OrdersProvider>
            <PaymentsProvider>
              <AppShell>{children}</AppShell>
            </PaymentsProvider>
          </OrdersProvider>
        </CtvsProvider>
      </CustomersProvider>
    </ServicesProvider>
  );
}
