/**
 * One in-flight save. The lock always clears when the task settles,
 * including when the task throws or returns early.
 */
export async function runExclusive<T>(
  lock: { current: boolean },
  task: () => Promise<T>,
): Promise<T | undefined> {
  if (lock.current) return undefined;
  lock.current = true;
  try {
    return await task();
  } finally {
    lock.current = false;
  }
}
