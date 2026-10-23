/**
 * DNY CRM design tokens (UI foundation, v1).
 * Light values live in `ds`; the full light/dark semantic palettes live in `palette`.
 * Every text/background pair below was checked against WCAG AA (see ui-spec.md §2).
 */

export type ThemePalette = {
  appBg: string;
  sidebarBg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Button fill (white text on top must reach 4.5:1) */
  primary: string;
  primaryHover: string;
  /** Selected menu item / selected row background */
  primaryBg: string;
  /** Text-coloured primary (links, selected tab) — readable on `surface` */
  link: string;
  danger: string;
  success: string;
  warning: string;
  info: string;
  /** Soft badge fills (text colour = success / warning / danger / info on top, ≥4.5:1) */
  successBg: string;
  warningBg: string;
  dangerBg: string;
  infoBg: string;
  /** Text on a filled danger button (white on light, near-black on the lighter dark-mode red) */
  onDanger: string;
  /** Neutral tag / chip background */
  neutralBg: string;
  hover: string;
  focusRing: string;
};

const lightPalette: ThemePalette = {
  appBg: "#f5f7fa",
  sidebarBg: "#ffffff",
  surface: "#ffffff",
  surfaceElevated: "#ffffff",
  border: "#e2e8f0",
  borderStrong: "#8a94a6",
  text: "#0f172a",
  textSecondary: "#475569",
  textTertiary: "#5b6677",
  primary: "#0069c7",
  primaryHover: "#005bab",
  primaryBg: "#e8f2fd",
  link: "#0066c0",
  danger: "#c62828",
  success: "#157a2f",
  warning: "#a34700",
  info: "#0066c0",
  successBg: "#e0f5e5",
  warningBg: "#fff1de",
  dangerBg: "#fde8e7",
  infoBg: "#e3f0fd",
  onDanger: "#ffffff",
  neutralBg: "#eceff3",
  hover: "rgba(15, 23, 42, 0.04)",
  focusRing: "rgba(0, 105, 199, 0.35)",
};

const darkPalette: ThemePalette = {
  appBg: "#070d18",
  sidebarBg: "#0a1322",
  surface: "#0f1a2b",
  surfaceElevated: "#16233a",
  border: "#223048",
  borderStrong: "#5b6b85",
  text: "#e8edf5",
  textSecondary: "#aab4c5",
  textTertiary: "#8b97ab",
  primary: "#1a6dc7",
  primaryHover: "#2b7fd9",
  primaryBg: "rgba(43, 140, 240, 0.18)",
  link: "#6cb4ff",
  danger: "#ff8a80",
  success: "#5fd382",
  warning: "#ffb454",
  info: "#6cb4ff",
  successBg: "#1c3839",
  warningBg: "#353332",
  dangerBg: "#352c39",
  infoBg: "#20344d",
  onDanger: "#1a0a09",
  neutralBg: "#283344",
  hover: "rgba(255, 255, 255, 0.06)",
  focusRing: "rgba(108, 180, 255, 0.45)",
};

export const palette = { light: lightPalette, dark: darkPalette } as const;

export const ds = {
  primary: lightPalette.primary,
  primaryActive: lightPalette.primaryHover,
  secondary: "#213183",
  onPrimary: "#ffffff",
  canvas: lightPalette.surface,
  canvasSoft: lightPalette.appBg,
  surface: lightPalette.surface,
  ink: lightPalette.text,
  inkSecondary: "#334155",
  inkMuted: lightPalette.textSecondary,
  inkFaint: lightPalette.textTertiary,
  hairline: lightPalette.border,
  borderStrong: lightPalette.borderStrong,
  accentSky: "#4a9aea",
  accentPurple: "#6d4fe0",
  accentPurpleDeep: "#391c57",
  accentPink: "#ff64c8",
  /** Chart / icon orange (not for small text — use `warning`) */
  accentOrange: "#d9730d",
  accentOrangeDeep: "#793400",
  accentTeal: "#0b8a80",
  /** Green that is also readable as text on white (5.45:1) */
  accentGreen: lightPalette.success,
  accentBrown: "#523410",
  danger: lightPalette.danger,
  success: lightPalette.success,
  warning: lightPalette.warning,
  info: lightPalette.info,
  link: lightPalette.link,
  /** Soft fills for hover / selected rows */
  hover: lightPalette.hover,
  selected: lightPalette.primaryBg,
  focusRing: lightPalette.focusRing,
  shadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
  shadowElevated: "0 4px 16px rgba(15, 23, 42, 0.08)",
  /** r-sm 6 (buttons, inputs, badges) · r-md 10 (cards, tables) · r-lg 14 (modals, drawers) */
  radius: { xs: 4, sm: 6, md: 10, lg: 14, xl: 16, full: 9999 },
  /** Typography scale — crm-ui-ux-rules: 12, 14, 16, 20, 24, 32 */
  fontSize: {
    caption: 12, // text-caption
    bodySm: 14, // text-body-sm
    body: 16, // text-body
    h3: 20, // text-heading-3
    h2: 24, // text-heading-2
    h1: 32, // text-heading-1
  },
  /** Shell sizes */
  sidebarWidth: 240,
  sidebarCollapsedWidth: 64,
  /** Create/edit pages that use the dedicated-page form pattern */
  formPageMaxWidth: 640,
} as const;

/** @deprecated use `ds` — kept briefly for migration */
export const ph = ds;

export const fontStack =
  "var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
