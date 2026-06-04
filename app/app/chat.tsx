import { View, Text, StyleSheet } from "react-native";
import { MessageSquare } from "lucide-react-native";
import { colors, space, font, radius } from "@/theme";

/**
 * Conversational assistant — "talk to the car / ask about a part or VIN".
 * Stubbed until the chat backend + AI billing are wired up; intentionally does
 * NOT fake responses. See NEXT_STEPS.md.
 */
const EXAMPLES = [
  "What does a P0301 code mean on a 2018 Outback?",
  "Is this front bumper worth pulling?",
  "Decode VIN 4S4BSANC9J3201234",
];

export default function Chat() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <MessageSquare size={32} color={colors.accent} />
      </View>
      <Text style={styles.title}>Chat is coming soon</Text>
      <Text style={styles.body}>
        Ask about a part, a diagnostic code, or a VIN and get an answer in plain
        language — with the matching OEM parts. We&apos;re wiring up the
        assistant now.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>You&apos;ll be able to ask</Text>
        {EXAMPLES.map((q) => (
          <View key={q} style={styles.bubble}>
            <Text style={styles.bubbleText}>{q}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    padding: space.lg,
    gap: space.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xl,
  },
  title: { color: colors.foreground, fontSize: font.h2, fontWeight: "800" },
  body: {
    color: colors.muted,
    fontSize: font.body,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 360,
  },
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    marginTop: space.md,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bubble: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  bubbleText: { color: colors.foreground, fontSize: font.small, lineHeight: 20 },
});
