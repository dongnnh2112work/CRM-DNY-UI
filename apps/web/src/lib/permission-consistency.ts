export type ViewMutateGap = {
  resource: string;
  mutate: string[];
};

/** Mutate codes without a `*.view` code on the same resource. Warning only — no writes. */
export function missingViewPermissions(codes: string[]): ViewMutateGap[] {
  const byResource = new Map<string, string[]>();
  for (const code of codes) {
    const trimmed = code.trim();
    if (!trimmed) continue;
    const resource = trimmed.split(".")[0] || trimmed;
    const list = byResource.get(resource) ?? [];
    list.push(trimmed);
    byResource.set(resource, list);
  }
  const gaps: ViewMutateGap[] = [];
  for (const [resource, list] of byResource) {
    const hasView = list.some((code) => code.includes(".view"));
    const mutate = list.filter((code) => !code.includes(".view"));
    if (!hasView && mutate.length > 0) gaps.push({ resource, mutate });
  }
  return gaps.sort((a, b) => a.resource.localeCompare(b.resource));
}

export function formatViewGaps(gaps: ViewMutateGap[]): string {
  return gaps.map((gap) => `${gap.resource}: ${gap.mutate.join(", ")}`).join("; ");
}

/**
 * Saving is a full replace. Block it until GET /roles/:id has declared the groups,
 * including an explicit empty list. An empty draft is then either "already empty"
 * or the user cleared the known checkboxes — both are intentional.
 */
export function canReplaceRoleGroups(args: {
  groupsKnown: boolean;
  draftCodes: string[];
  loadedCodes: string[];
}): boolean {
  if (!args.groupsKnown) return false;
  if (args.draftCodes.length === 0 && args.loadedCodes.length > 0) return true;
  return true;
}
