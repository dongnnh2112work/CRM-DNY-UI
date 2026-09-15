import { fetchPage } from "@/lib/http/paging";
import {
  identityAdminApi,
  type IdentityRole,
  type IdentityUser,
} from "@/modules/identity-admin/api";
import {
  roleGroupCodes,
  roleHasGroupField,
  unwrapIdentityEntity,
} from "@/modules/identity-admin/map-to-ui";

export type PendingParkResult = {
  parked: IdentityUser[];
  stripped: IdentityUser[];
  skippedSelf: IdentityUser | null;
  failed: Array<{ user: IdentityUser; message: string }>;
};

function sameCode(a: string, b: string) {
  return a.toUpperCase() === b.toUpperCase();
}

function sameRoleSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a.map((code) => code.toUpperCase()));
  return b.every((code) => set.has(code.toUpperCase()));
}

export function formatIdentityUser(user: Pick<IdentityUser, "displayName" | "email">) {
  const name = user.displayName?.trim();
  if (name && name !== user.email) return `${name} · ${user.email}`;
  return user.email;
}

export async function listAllIdentityUsers(): Promise<IdentityUser[]> {
  const pageSize = 100;
  const all: IdentityUser[] = [];
  for (let page = 1; page <= 30; page++) {
    const chunk = await fetchPage(
      (p, s) => identityAdminApi.listUsers({ page: p, pageSize: s }),
      page,
      pageSize,
    );
    all.push(...chunk.items.map((row) => unwrapIdentityEntity<IdentityUser>(row) ?? row));
    if (!chunk.hasMore) break;
  }
  return all.filter((row) => row?.id);
}

async function fillMissingRoleCodes(users: IdentityUser[]): Promise<IdentityUser[]> {
  const missing = users.filter((user) => !user.roleCodes);
  if (!missing.length) return users;
  const filled = new Map<string, IdentityUser>();
  const concurrency = 5;
  for (let i = 0; i < missing.length; i += concurrency) {
    const slice = missing.slice(i, i + concurrency);
    const rows = await Promise.all(
      slice.map(async (user) => {
        try {
          const raw = await identityAdminApi.getUser(user.id);
          return unwrapIdentityEntity<IdentityUser>(raw) ?? user;
        } catch {
          return user;
        }
      }),
    );
    for (const row of rows) filled.set(row.id, row);
  }
  return users.map((user) => filled.get(user.id) ?? user);
}

export async function loadUsersWithRoles(): Promise<IdentityUser[]> {
  return fillMissingRoleCodes(await listAllIdentityUsers());
}

export async function hydrateRolePermissionGroups(roles: IdentityRole[]): Promise<IdentityRole[]> {
  return Promise.all(
    roles.map(async (role) => {
      if (roleHasGroupField(role)) return role;
      try {
        const raw = await identityAdminApi.getRole(role.id);
        return { ...role, ...(unwrapIdentityEntity<IdentityRole>(raw) ?? {}) };
      } catch {
        return role;
      }
    }),
  );
}

export function remainingRoleCodesAfterGroupRemoval(
  user: IdentityUser,
  roles: IdentityRole[],
  groupCode: string,
): string[] {
  const rolesByCode = new Map(roles.map((role) => [role.code.toUpperCase(), role]));
  return (user.roleCodes ?? []).filter((code) => {
    const role = rolesByCode.get(code.toUpperCase());
    if (!role) return true;
    return roleGroupCodes(role).some((item) => !sameCode(item, groupCode));
  });
}

export function rolesUsingGroup(roles: IdentityRole[], groupCode: string): IdentityRole[] {
  return roles.filter((role) => roleGroupCodes(role).some((item) => sameCode(item, groupCode)));
}

export async function applyLostRoles(args: {
  users: IdentityUser[];
  remainingByUserId: Map<string, string[]>;
  skipUserId?: string;
}): Promise<PendingParkResult> {
  const parked: IdentityUser[] = [];
  const stripped: IdentityUser[] = [];
  const failed: PendingParkResult["failed"] = [];
  let skippedSelf: IdentityUser | null = null;

  for (const user of args.users) {
    const remaining = args.remainingByUserId.get(user.id);
    if (!remaining) continue;
    const current = user.roleCodes ?? [];
    if (sameRoleSet(remaining, current)) continue;

    if (args.skipUserId && user.id === args.skipUserId && remaining.length === 0) {
      skippedSelf = user;
      continue;
    }

    try {
      if (remaining.length === 0) {
        await identityAdminApi.setUserRoles(user.id, []);
        await identityAdminApi.updateUser(user.id, { status: "PENDING_APPROVAL" });
        parked.push({ ...user, roleCodes: [], status: "PENDING_APPROVAL" });
      } else {
        await identityAdminApi.setUserRoles(user.id, remaining);
        stripped.push({ ...user, roleCodes: remaining });
      }
    } catch (err) {
      failed.push({
        user,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { parked, stripped, skippedSelf, failed };
}

export async function detachGroupFromRoles(roles: IdentityRole[], groupCode: string): Promise<IdentityRole[]> {
  const next: IdentityRole[] = [];
  for (const role of roles) {
    const codes = roleGroupCodes(role);
    if (!codes.some((item) => sameCode(item, groupCode))) {
      next.push(role);
      continue;
    }
    const remaining = codes.filter((item) => !sameCode(item, groupCode));
    const updated = await identityAdminApi.setRolePermissionGroups(role.id, remaining);
    const entity = unwrapIdentityEntity<IdentityRole>(updated) ?? updated;
    next.push({ ...role, ...entity, permissionGroupCodes: remaining });
  }
  return next;
}
