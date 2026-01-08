import React from "react";
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from "react-native";
import { COLORS, TYPOGRAPHY } from "@/constants/theme";

interface TextProps extends RNTextProps {
  variant?: "h1" | "h2" | "h3" | "body" | "caption" | "label";
  color?: string;
  weight?: keyof typeof TYPOGRAPHY.weights;
  align?: "auto" | "left" | "right" | "center" | "justify";
}

export const Text = ({
  style,
  variant = "body",
  color = COLORS.text.primary,
  weight,
  align,
  ...props
}: TextProps) => {
  return (
    <RNText
      style={[
        styles[variant],
        { color, textAlign: align },
        weight && { fontWeight: TYPOGRAPHY.weights[weight] },
        style,
      ]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  h1: {
    fontSize: TYPOGRAPHY.sizes.xxxl,
    fontWeight: "700",
    lineHeight: 40,
  },
  h2: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: "700",
    lineHeight: 34,
  },
  h3: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: "600",
    lineHeight: 28,
  },
  body: {
    fontSize: TYPOGRAPHY.sizes.md,
    lineHeight: 24,
  },
  caption: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  label: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: "600",
    lineHeight: 20,
  },
});
