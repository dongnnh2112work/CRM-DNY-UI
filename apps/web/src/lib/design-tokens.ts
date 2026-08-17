/** Notion-inspired design tokens — adapted from DESIGN-notion.md */
export const ds = {
  primary: "#0075de",
  primaryActive: "#005bab",
  secondary: "#213183",
  onPrimary: "#ffffff",
  canvas: "#ffffff",
  canvasSoft: "#f6f5f4",
  surface: "#ffffff",
  ink: "#000000",
  inkSecondary: "#31302e",
  inkMuted: "#615d59",
  inkFaint: "#a39e98",
  hairline: "#e6e6e6",
  accentSky: "#62aef0",
  accentPurple: "#d6b6f6",
  accentPurpleDeep: "#391c57",
  accentPink: "#ff64c8",
  accentOrange: "#dd5b00",
  accentOrangeDeep: "#793400",
  accentTeal: "#2a9d99",
  accentGreen: "#1aae39",
  accentBrown: "#523410",
  danger: "#e03e3e",
  /** Soft fills for hover / selected rows */
  hover: "rgba(0, 0, 0, 0.04)",
  selected: "rgba(0, 117, 222, 0.08)",
  focusRing: "rgba(0, 117, 222, 0.35)",
  shadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)",
  radius: { xs: 4, sm: 5, md: 8, lg: 12, xl: 16, full: 9999 },
  /** Typography scale — crm-ui-ux-rules: 12, 14, 16, 20, 24, 32 */
  fontSize: {
    caption: 12, // text-caption
    bodySm: 14, // text-body-sm
    body: 16, // text-body
    h3: 20, // text-heading-3
    h2: 24, // text-heading-2
    h1: 32, // text-heading-1
  },
  /** Create/edit pages that use the dedicated-page form pattern */
  formPageMaxWidth: 640,
} as const;

/** @deprecated use `ds` — kept briefly for migration */
export const ph = ds;

export const fontStack =
  "var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
