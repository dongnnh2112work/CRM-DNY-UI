import { isDevAuthBypass } from "@/lib/dev-auth-bypass";
import { ALL_PERMISSION_CODES } from "@/lib/permission-catalog";
import type { AuthUser } from "@/modules/auth/api";

export { isDevAuthBypass };

export const DEV_BYPASS_USER: AuthUser = {
  id: "u2",
  email: "admin@dny.vn",
  displayName: "Tran Admin",
  status: "ACTIVE",
  roleCodes: ["SUPER_ADMIN", "ADMIN"],
  permissions: [...ALL_PERMISSION_CODES],
};
