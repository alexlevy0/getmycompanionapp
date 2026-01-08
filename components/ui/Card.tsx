import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { COLORS, RADIUS, SHADOWS, SPACING } from "@/constants/theme";

interface CardProps extends ViewProps {
  variant?: "default" | "outlined" | "flat";
  padding?: keyof typeof SPACING;
}

export const Card = ({
  style,
  variant = "default",
  padding = "lg",
  children,
  ...props
}: CardProps) => {
  return (
    <View
      style={[
        styles.base,
        styles[variant],
        { padding: SPACING[padding] },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
  },
  default: {
    ...SHADOWS.sm,
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  flat: {
    backgroundColor: COLORS.background,
  },
});
