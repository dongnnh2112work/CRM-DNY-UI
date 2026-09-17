"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RolePermissionGroupsAdmin } from "@/components/users/role-permission-groups-modal";

function PermissionsPageInner() {
  const searchParams = useSearchParams();
  return <RolePermissionGroupsAdmin initialUiRole={searchParams.get("role")} />;
}

export default function PermissionsPage() {
  return (
    <Suspense>
      <PermissionsPageInner />
    </Suspense>
  );
}
