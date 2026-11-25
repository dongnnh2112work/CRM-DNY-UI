export type ListFooterMode = "loaded" | "filtered";

/**
 * Unfiltered lists keep “loaded/total”.
 * A filter that hides rows must not read as if every loaded row is on screen.
 */
export function listFooterMode(visible: number, loaded: number): ListFooterMode {
  return visible !== loaded ? "filtered" : "loaded";
}
