export type AssigneeUser = {
  id: string;
  name: string;
  status?: string;
  role?: string;
};

export type AssigneeOrder = {
  assignedUserId?: string;
  assignedUserName?: string;
};

/**
 * Mọi user đang hoạt động có thể phụ trách đơn (không chỉ staff/admin),
 * cộng người đã được gán trên các dòng đã tải dù role không nằm trong danh sách.
 */
export function orderAssigneeOptions(users: AssigneeUser[], orders: AssigneeOrder[] = []): { value: string; label: string }[] {
  const options = new Map<string, string>();
  for (const user of users) {
    if (user.status && user.status !== "active") continue;
    if (!user.id) continue;
    options.set(user.id, user.name?.trim() || user.id);
  }
  for (const order of orders) {
    const id = order.assignedUserId?.trim();
    if (!id || options.has(id)) continue;
    options.set(id, order.assignedUserName?.trim() || id);
  }
  return [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}
