import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Switch,
} from "react-native";
import { TriangleAlert, Check, ArrowLeftRight } from "lucide-react-native";
import {
  CONDITION_GRADES,
  CONDITION_RUBRIC,
  type AIPartOutput,
  type ConditionGrade,
} from "@ahlam/shared";
import { colors, space, radius, font, conditionColor } from "@/theme";

/** Editable draft for one detected part. Parent owns the array of these. */
export interface PartDraft {
  included: boolean;
  partName: string;
  partCategory: string;
  condition: ConditionGrade;
  conditionNotes: string;
  description: string;
  fitmentText: string;
  price: string;
}

/** Toggle the Left/Right side word in a part name (human override for the AI). */
export function swapSide(name: string): string {
  if (/\bleft\b/i.test(name)) {
    return name.replace(/\bleft\b/i, (m) =>
      m[0] === m[0].toUpperCase() ? "Right" : "right"
    );
  }
  if (/\bright\b/i.test(name)) {
    return name.replace(/\bright\b/i, (m) =>
      m[0] === m[0].toUpperCase() ? "Left" : "left"
    );
  }
  // No side yet — add "Left" after a leading Front/Rear, else prefix it.
  const m = name.match(/^(Front|Rear)\b\s*(.*)$/i);
  if (m) {
    const rest = m[2].trim();
    return `${m[1]} Left${rest ? ` ${rest}` : ""}`;
  }
  return `Left ${name}`;
}

/** Seed an editable draft from a raw AI part output. */
export function draftFromAI(ai: AIPartOutput): PartDraft {
  return {
    included: true,
    partName: ai.partName,
    partCategory: ai.partCategory,
    condition: ai.condition,
    conditionNotes: ai.conditionNotes,
    description: ai.description,
    fitmentText: ai.fitment
      .map((f) => `${f.yearStart}–${f.yearEnd} ${f.make} ${f.model}`.trim())
      .join("\n"),
    price: ai.suggestedPriceUsd != null ? String(ai.suggestedPriceUsd) : "",
  };
}

/**
 * One part's review card. Controlled: it reads from `draft` and reports every
 * edit via `onChange`. An "Include" switch toggles whether this part becomes a
 * listing. Collapses to just the header when excluded.
 */
export function PartReviewCard({
  ai,
  draft,
  onChange,
}: {
  ai: AIPartOutput;
  draft: PartDraft;
  onChange: (patch: Partial<PartDraft>) => void;
}) {
  const lowConf = ai.confidence === "low";
  const lowFields = new Set(ai.lowConfidenceFields ?? []);

  return (
    <View style={[styles.card, !draft.included && styles.cardOff]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {draft.partName || "Unnamed part"}
        </Text>
        <View style={styles.includeWrap}>
          <Text style={styles.includeLabel}>Include</Text>
          <Switch
            value={draft.included}
            onValueChange={(v) => onChange({ included: v })}
            trackColor={{ false: colors.surface2, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {draft.included && (
        <View style={styles.cardBody}>
          {lowConf && (
            <View style={styles.banner}>
              <TriangleAlert size={16} color={colors.signal} />
              <Text style={styles.bannerText}>
                Not sure — please review carefully
              </Text>
            </View>
          )}

          <Field
            label="Part name"
            value={draft.partName}
            onChange={(v) => onChange({ partName: v })}
            warn={lowConf || lowFields.has("partName")}
          />
          <Pressable
            onPress={() => onChange({ partName: swapSide(draft.partName) })}
            accessibilityRole="button"
            accessibilityLabel="Swap left or right side"
            style={({ pressed }) => [styles.swapBtn, pressed && { opacity: 0.6 }]}
          >
            <ArrowLeftRight size={14} color={colors.muted} />
            <Text style={styles.swapText}>Swap L/R side</Text>
          </Pressable>
          <Field
            label="Category"
            value={draft.partCategory}
            onChange={(v) => onChange({ partCategory: v })}
            warn={lowConf || lowFields.has("partCategory")}
          />
          <Field
            label="Fits (one vehicle per line)"
            value={draft.fitmentText}
            onChange={(v) => onChange({ fitmentText: v })}
            multiline
            warn={lowConf || lowFields.has("fitment")}
          />

          <Text style={styles.fieldLabel}>Condition</Text>
          <View style={styles.gradeRow}>
            {CONDITION_GRADES.map((g) => {
              const active = g === draft.condition;
              return (
                <Pressable
                  key={g}
                  onPress={() => onChange({ condition: g })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.grade,
                    {
                      borderColor: active ? conditionColor[g] : colors.line,
                      backgroundColor: active
                        ? `${conditionColor[g]}22`
                        : "transparent",
                    },
                  ]}
                >
                  {active && <Check size={14} color={conditionColor[g]} />}
                  <Text
                    style={[
                      styles.gradeText,
                      { color: active ? conditionColor[g] : colors.muted },
                    ]}
                  >
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.rubric}>
            {CONDITION_RUBRIC[draft.condition].summary}
          </Text>

          <Field
            label="Condition notes"
            value={draft.conditionNotes}
            onChange={(v) => onChange({ conditionNotes: v })}
            multiline
            warn={lowFields.has("conditionNotes")}
          />
          <Field
            label="Description"
            value={draft.description}
            onChange={(v) => onChange({ description: v })}
            multiline
            warn={lowFields.has("description")}
          />
          {ai.pricingInsight && (
            <View style={styles.pricingInsight}>
              <Text style={styles.insightText}>
                Market avg: ${ai.pricingInsight.suggestedPrice} | Similar:{" "}
                {ai.pricingInsight.similarCount} listed
              </Text>
            </View>
          )}
          {(() => {
            const entered = Number(draft.price);
            const suggested = ai.suggestedPriceUsd;
            const pct =
              entered && suggested
                ? Math.abs(entered - suggested) / suggested
                : 0;
            return pct > 0.2 ? (
              <View style={styles.priceWarn}>
                <Text style={styles.priceWarnText}>
                  Price is {Math.round(pct * 100)}% above market — double-check
                </Text>
              </View>
            ) : null;
          })()}
          <Field
            label="Your price (USD)"
            value={draft.price}
            onChange={(v) => onChange({ price: v })}
            keyboardType="numeric"
            warn={lowFields.has("suggestedPriceUsd")}
          />
        </View>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  warn,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  warn?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && { minHeight: 64, textAlignVertical: "top" },
          warn && styles.inputWarn,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  cardOff: { opacity: 0.6 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  cardTitle: {
    flex: 1,
    color: colors.foreground,
    fontSize: font.body,
    fontWeight: "700",
  },
  includeWrap: { flexDirection: "row", alignItems: "center", gap: space.sm },
  includeLabel: { color: colors.muted, fontSize: font.small, fontWeight: "600" },
  cardBody: { gap: space.xs, marginTop: space.sm },
  swapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    alignSelf: "flex-start",
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    marginTop: space.xs,
  },
  swapText: { color: colors.muted, fontSize: font.small, fontWeight: "600" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.signalBg,
    borderColor: colors.signal,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.xs,
  },
  bannerText: { color: colors.signal, fontWeight: "600", fontSize: font.small },
  fieldWrap: { gap: space.xs },
  fieldLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: space.sm,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    color: colors.foreground,
    fontSize: font.body,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    minHeight: 48,
  },
  inputWarn: { borderColor: colors.signal, backgroundColor: colors.signalBg },
  pricingInsight: {
    backgroundColor: colors.surface2,
    padding: space.sm,
    borderRadius: radius.sm,
    marginTop: space.sm,
  },
  insightText: { color: colors.muted, fontSize: font.small, fontWeight: "600" },
  priceWarn: {
    backgroundColor: colors.signalBg,
    borderWidth: 1,
    borderColor: colors.signal,
    borderRadius: radius.sm,
    padding: space.sm,
    marginTop: space.sm,
  },
  priceWarnText: { color: colors.signal, fontSize: font.small, fontWeight: "600" },
  gradeRow: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  grade: {
    flex: 1,
    flexDirection: "row",
    gap: space.xs,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
  },
  gradeText: { fontSize: font.body, fontWeight: "600" },
  rubric: { color: colors.muted, fontSize: font.small, marginTop: space.xs },
});
