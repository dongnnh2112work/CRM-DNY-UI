/**
 * Live body is `{ newPassword }` only (`document/api/auth.md`).
 * Do not send `currentPassword` until BE accepts it — the profile field stays
 * visible but disabled so the UI does not imply the old password was checked.
 */
export function changePasswordBody(newPassword: string): { newPassword: string } {
  return { newPassword };
}
