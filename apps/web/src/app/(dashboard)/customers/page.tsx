import { Suspense } from "react";
import { PageLoading } from "@/components/shared/page-loading";
import { CustomersPageClient } from "./customers-page-client";

export default function CustomersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CustomersPageClient />
    </Suspense>
  );
}
