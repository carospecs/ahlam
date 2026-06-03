import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import type { ReactNode } from "react";
import { colors, radius, font, space } from "@/theme";

type Variant = "primary" | "secondary";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      // Press feedback: subtle scale per design system (interruptible, 44pt+ target)
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && { transform: [{ scale: 0.97 }] },
        (disabled || loading) && { opacity: 0.6 },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={isPrimary ? colors.white : colors.foreground} />
        ) : (
          icon
        )}
        <Text style={[styles.label, !isPrimary && { color: colors.foreground }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  label: { color: colors.white, fontSize: font.body, fontWeight: "600" },
});
