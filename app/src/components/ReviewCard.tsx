import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { TriangleAlert, Check } from "lucide-react-native";
import {
  CONDITION_GRADES,
  CONDITION_RUBRIC,
  type AIPartOutput,
  type ConditionGrade,
} from "@carospecs/shared";
import { colors, space, radius, font, conditionColor } from "@/theme";
import { Button } from "@/components/Button";

/**
 * The review card — the critical-path UI. Shows AI-prefilled fields; every field
 * is tappable to edit. Low-confidence results turn the card amber with a banner.
 * Target: ~10s to confirm a correct output, ~30s to fix one.
 */
export function ReviewCard({
  ai,
  onConfirm,
  saving,
}: {
  ai: AIPartOutput;
  saving?: boolean;
  onConfirm: (final: {
    partName: string;
    partCategory: string;
    condition: ConditionGrade;
    conditionNotes: string;
    description: string;
    fitmentText: string;
    priceUsd: number;
  }) => void;
}) {
  const lowConf = ai.confidence === "low";
  const lowFields = new Set(ai.lowConfidenceFields ?? []);

  const [partName, setPartName] = useState(ai.partName);
  const [partCategory, setPartCategory] = useState(ai.partCategory);
  const [condition, setCondition] = useState<ConditionGrade>(ai.condition);
  const [conditionNotes, setConditionNotes] = useState(ai.conditionNotes);
  const [description, setDescription] = useState(ai.description);
  const [fitmentText, setFitmentText] = useState(
    ai.fitment
      .map((f) => `${f.yearStart}–${f.yearEnd} ${f.make} ${f.model}`.trim())
      .join("\n")
  );
  const [price, setPrice] = useState(
    ai.suggestedPriceUsd != null ? String(ai.suggestedPriceUsd) : ""
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {lowConf && (
        <View style={styles.banner}>
          <TriangleAlert size={18} color={colors.signal} />
          <Text style={styles.bannerText}>Not sure — please review carefully</Text>
        </View>
      )}

      <Field
        label="Part name"
        value={partName}
        onChange={setPartName}
        warn={lowConf || lowFields.has("partName")}
      />
      <Field
        label="Category"
        value={partCategory}
        onChange={setPartCategory}
        warn={lowConf || lowFields.has("partCategory")}
      />
      <Field
        label="Fits (one vehicle per line)"
        value={fitmentText}
        onChange={setFitmentText}
        multiline
        warn={lowConf || lowFields.has("fitment")}
      />

      <Text style={styles.fieldLabel}>Condition</Text>
      <View style={styles.gradeRow}>
        {CONDITION_GRADES.map((g) => {
          const active = g === condition;
          return (
            <Pressable
              key={g}
              onPress={() => setCondition(g)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.grade,
                {
                  borderColor: active ? conditionColor[g] : colors.line,
                  backgroundColor: active ? `${conditionColor[g]}22` : "transparent",
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
      <Text style={styles.rubric}>{CONDITION_RUBRIC[condition].summary}</Text>

      <Field
        label="Condition notes"
        value={conditionNotes}
        onChange={setConditionNotes}
        multiline
        warn={lowFields.has("conditionNotes")}
      />
      <Field
        label="Description"
        value={description}
        onChange={setDescription}
        multiline
        warn={lowFields.has("description")}
      />
      <Field
        label="Your price (USD)"
        value={price}
        onChange={setPrice}
        keyboardType="numeric"
        warn={lowFields.has("suggestedPriceUsd")}
      />

      <Text style={styles.disclaimer}>
        AI can make mistakes. Double-check the details before you post.
      </Text>

      <View style={{ height: space.sm }} />
      <Button
        label="Looks right — make listing"
        loading={saving}
        icon={<Check size={18} color={colors.white} />}
        onPress={() =>
          onConfirm({
            partName,
            partCategory,
            condition,
            conditionNotes,
            description,
            fitmentText,
            priceUsd: Number(price) || 0,
          })
        }
      />
    </ScrollView>
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
  scroll: { padding: space.md, paddingBottom: space.xl * 2, gap: space.sm },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.signalBg,
    borderColor: colors.signal,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
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
    backgroundColor: colors.surface,
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
  gradeRow: { flexDirection: "row", gap: space.sm },
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
  disclaimer: {
    color: colors.muted,
    fontSize: font.tiny,
    textAlign: "center",
    marginTop: space.md,
  },
});
