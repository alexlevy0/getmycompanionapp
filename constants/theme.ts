export const COLORS = {
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  secondary: "#6b7280",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  background: "#f5f5f5",
  surface: "#ffffff",
  text: {
    primary: "#1a1a1a",
    secondary: "#666666",
    tertiary: "#999999",
    inverse: "#ffffff",
  },
  border: "#e5e7eb",
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  jumbo: 64,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 9999,
} as const;

export const TYPOGRAPHY = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 28,
    xxxl: 32,
    jumbo: 64,
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  } as const,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
} as const;
