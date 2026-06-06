import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { TriangleAlert, Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import type { AIPartOutput } from "@carospecs/shared";
import { colors, space, font } from "@/theme";
import { Button } from "@/components/Button";
import {
  PartReviewCard,
  draftFromAI,
  type PartDraft,
} from "@/components/ReviewCard";
import { getPendingCapture, clearPendingCapture } from "@/lib/captureStore";
import { identifyPart } from "@/lib/identify";
import { enqueueCapture } from "@/lib/queue";
import { useSession } from "@/lib/auth";
import { saveListings, parseFitment } from "@/lib/listings";

type State =
  | { phase: "loading" }
  | { phase: "ready"; ais: AIPartOutput[] }
  | { phase: "error"; message: string; canRetry: boolean };

export default function Review() {
  const router = useRouter();
  const { session, shop } = useSession();
  const pending = getPendingCapture();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [drafts, setDrafts] = useState<PartDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [scannedWith, setScannedWith] = useState<"gpt" | "gemini">("gemini");
  const [showConfidence, setShowConfidence] = useState(true);

  async function run(useProvider: "gpt" | "gemini" = "gemini") {
    if (!pending) {
      setState({ phase: "error", message: "No photo found.", canRetry: false });
      return;
    }
    setState({ phase: "loading" });
    const result = await identifyPart({ imageBase64: pending.imageBase64, provider: useProvider });
    if (!result.ok) {
      setState({ phase: "error", message: result.userMessage, canRetry: true });
      return;
    }
    if (result.data.length === 0) {
      setState({
        phase: "error",
        message:
          "We couldn't spot any sellable parts in this photo. Try a clearer shot or a different angle.",
        canRetry: true,
      });
      return;
    }
    setDrafts(result.data.map(draftFromAI));
    setScannedWith(useProvider);
    setState({ phase: "ready", ais: result.data });
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patchDraft(index: number, patch: Partial<PartDraft>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d))
    );
  }

  async function queueForLater() {
    if (!pending) return;
    await enqueueCapture({ imageBase64: pending.imageBase64 });
    clearPendingCapture();
    Alert.alert(
      "Saved for later",
      "We'll process this photo automatically once you're back online."
    );
    router.back();
  }

  async function saveAll() {
    if (!pending || state.phase !== "ready") return;
    if (!session || !shop) {
      Alert.alert("Not signed in", "Please sign in again.");
      return;
    }
    const chosen = drafts
      .map((d, i) => ({ d, ai: state.ais[i] }))
      .filter(({ d }) => d.included);
    if (chosen.length === 0) {
      Alert.alert("Nothing selected", "Include at least one part to save.");
      return;
    }
    setSaving(true);
    try {
      await saveListings({
        shopId: shop.id,
        userId: session.user.id,
        imageBase64: pending.imageBase64,
        parts: chosen.map(({ d, ai }) => ({
          aiOutput: ai,
          corrected: {
            partName: d.partName,
            partCategory: d.partCategory,
            condition: d.condition,
            conditionNotes: d.conditionNotes,
            description: d.description,
            fitment: parseFitment(d.fitmentText),
            priceUsd: Number(d.price) || 0,
          },
        })),
      });
      clearPendingCapture();
      router.replace("/listings");
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!pending) {
    return (
      <Centered>
        <Text style={styles.errText}>No photo found. Go back and try again.</Text>
      </Centered>
    );
  }

  const includedCount = drafts.filter((d) => d.included).length;

  return (
    <View style={styles.container}>
      <Image source={{ uri: pending.imageUri }} style={styles.photo} />

      {state.phase === "loading" && (
        <Centered>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Finding parts in your photo…</Text>
        </Centered>
      )}

      {state.phase === "error" && (
        <Centered>
          <View style={styles.errBox}>
            <TriangleAlert size={28} color={colors.signal} />
            <Text style={styles.errText}>{state.message}</Text>
            <View style={styles.errActions}>
              {state.canRetry && <Button label="Try again" onPress={run} />}
              <Button
                label="Save & finish later"
                variant="secondary"
                onPress={queueForLater}
              />
            </View>
          </View>
        </Centered>
      )}

      {state.phase === "ready" && (
        <>
          <ConfidenceBar
            ais={state.ais}
            provider={scannedWith}
            show={showConfidence}
            onToggle={() => setShowConfidence((v) => !v)}
          />
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.foundLabel}>
              {state.ais.length} part{state.ais.length === 1 ? "" : "s"} found —
              review, edit, and pick which to list.
            </Text>
            {drafts.map((d, i) => (
              <PartReviewCard
                key={i}
                ai={state.ais[i]}
                draft={d}
                onChange={(patch) => patchDraft(i, patch)}
              />
            ))}
            <Text style={styles.disclaimer}>
              AI can make mistakes. Double-check each part before you post.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={
                includedCount === 0
                  ? "Select parts to save"
                  : `Save ${includedCount} listing${
                      includedCount === 1 ? "" : "s"
                    }`
              }
              loading={saving}
              disabled={includedCount === 0}
              onPress={saveAll}
            />
          </View>
        </>
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const CONF_COLOR: Record<string, string> = {
  high: colors.success,
  medium: colors.signal,
  low: colors.danger,
};
const CONF_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

function ConfidenceBar({
  ais,
  provider,
  show,
  onToggle,
}: {
  ais: AIPartOutput[];
  provider: "gpt" | "gemini";
  show: boolean;
  onToggle: () => void;
}) {
  const levels = ais.map((a) => a.confidence);
  const overall = levels.includes("low") ? "low" : levels.includes("medium") ? "medium" : "high";
  const counts = {
    high: levels.filter((l) => l === "high").length,
    medium: levels.filter((l) => l === "medium").length,
    low: levels.filter((l) => l === "low").length,
  };
  const breakdown = [
    counts.high ? `${counts.high} high` : "",
    counts.medium ? `${counts.medium} medium` : "",
    counts.low ? `${counts.low} low` : "",
  ].filter(Boolean).join(" · ");
  const engine = provider === "gpt" ? "GPT-4o Vision" : "Gemini";

  return (
    <View style={styles.confBar}>
      {show ? (
        <>
          <ShieldCheck size={16} color={CONF_COLOR[overall]} />
          <View style={[styles.confBadge, { backgroundColor: CONF_COLOR[overall] + "22" }]}>
            <Text style={[styles.confBadgeText, { color: CONF_COLOR[overall] }]}>{CONF_LABEL[overall]} confidence</Text>
          </View>
          <Text style={styles.confMeta} numberOfLines={1}>
            {breakdown} · via {engine}
          </Text>
          <Pressable onPress={onToggle} hitSlop={8} style={styles.confToggle}>
            <EyeOff size={15} color={colors.muted} />
            <Text style={styles.confToggleText}>Hide</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={onToggle} hitSlop={8} style={styles.confToggle}>
          <Eye size={15} color={colors.muted} />
          <Text style={styles.confToggleText}>Show scan confidence</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  photo: { width: "100%", height: 180, backgroundColor: colors.surface },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  providerLabel: { color: colors.muted, fontSize: font.small, fontWeight: "600", marginRight: 2 },
  provBtn: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  provBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  provText: { color: colors.muted, fontSize: font.small, fontWeight: "700" },
  confBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  confBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  confBadgeText: { fontSize: font.tiny, fontWeight: "700" },
  confMeta: { flex: 1, color: colors.muted, fontSize: font.tiny },
  confToggle: { flexDirection: "row", alignItems: "center", gap: 5 },
  confToggleText: { color: colors.muted, fontSize: font.small, fontWeight: "600" },
  scroll: { padding: space.md, paddingBottom: space.xl, gap: space.md },
  foundLabel: {
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    gap: space.md,
  },
  loadingText: { color: colors.muted, fontSize: font.body },
  errBox: { alignItems: "center", gap: space.md, maxWidth: 320 },
  errText: {
    color: colors.foreground,
    fontSize: font.body,
    textAlign: "center",
    lineHeight: 24,
  },
  errActions: { gap: space.sm, alignSelf: "stretch", marginTop: space.sm },
  disclaimer: {
    color: colors.muted,
    fontSize: font.tiny,
    textAlign: "center",
    marginTop: space.sm,
  },
  footer: {
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.background,
  },
});
