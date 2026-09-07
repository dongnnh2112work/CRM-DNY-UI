import type { Ctv } from "@/lib/types";
import type { ApiCollaborator } from "@/modules/collaborators/api";

export function mapApiCollaboratorToUi(c: ApiCollaborator): Ctv {
  return {
    id: c.id,
    name: c.displayName,
    phone: c.phone ?? "",
    email: c.email ?? "",
    status: c.status?.toUpperCase() === "INACTIVE" ? "inactive" : "active",
    totalJobs: 0,
    totalCommission: 0,
    jobs: [],
  };
}
