import React from "react";
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  PressableProps,
} from "react-native";
import { Text } from "./Text";
import { COLORS, RADIUS, SPACING } from "@/constants/theme";

interface ButtonProps extends PressableProps {
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  label: string;
  loading?: boolean;
  style?: ViewStyle;
}

export const Button = ({
  variant = "primary",
  size = "md",
  label,
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "outline" ? COLORS.primary : COLORS.text.inverse}
          size="small"
        />
      ) : (
        <Text
          variant={size === "lg" ? "h3" : "body"}
          weight="semibold"
          style={{
            color:
              variant === "outline"
                ? COLORS.primary
                : variant === "secondary"
                ? COLORS.text.primary
                : COLORS.text.inverse,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
  },
  // Variants
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.border,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  danger: {
    backgroundColor: COLORS.error,
  },
  // Sizes
  sm: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  md: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    minHeight: 48,
  },
  lg: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    minHeight: 56,
  },
  // States
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
