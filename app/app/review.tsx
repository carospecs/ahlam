import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import type { AIPartOutput } from "@carospecs/shared";
import { colors, space, font, radius } from "@/theme";
import { Button } from "@/components/Button";
import { ReviewCard } from "@/components/ReviewCard";
import {
  getPendingCapture,
  clearPendingCapture,
} from "@/lib/captureStore";
import { identifyPart } from "@/lib/identify";
import { enqueueCapture } from "@/lib/queue";

type State =
  | { phase: "loading" }
  | { phase: "ready"; ai: AIPartOutput }
  | { phase: "error"; message: string; canRetry: boolean };

export default function Review() {
  const router = useRouter();
  const pending = getPendingCapture();
  const [state, setState] = useState<State>({ phase: "loading" });

  async function run() {
    if (!pending) {
      setState({ phase: "error", message: "No photo found.", canRetry: false });
      return;
    }
    setState({ phase: "loading" });
    const result = await identifyPart({ imageBase64: pending.imageBase64 });
    if (result.ok) {
      setState({ phase: "ready", ai: result.data });
    } else {
      setState({ phase: "error", message: result.userMessage, canRetry: true });
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (!pending) {
    return (
      <Centered>
        <Text style={styles.errText}>No photo found. Go back and try again.</Text>
      </Centered>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: pending.imageUri }} style={styles.photo} />

      {state.phase === "loading" && (
        <Centered>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Identifying the part…</Text>
        </Centered>
      )}

      {state.phase === "error" && (
        <Centered>
          <View style={styles.errBox}>
            <TriangleAlert size={28} color={colors.signal} />
            <Text style={styles.errText}>{state.message}</Text>
            <View style={styles.errActions}>
              {state.canRetry && (
                <Button label="Try again" onPress={run} />
              )}
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
        <ReviewCard
          ai={state.ai}
          onConfirm={(final) => {
            // v1: produce a copy-paste-ready listing. (Wire to Supabase + the
            // marketplace export flow next.)
            clearPendingCapture();
            Alert.alert(
              "Listing ready",
              `${final.partName} — $${final.priceUsd}\n\n` +
                "Next: copy to Facebook / OfferUp / eBay, or save to your shop.",
              [{ text: "Done", onPress: () => router.replace("/") }]
            );
          }}
        />
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  photo: {
    width: "100%",
    height: 200,
    backgroundColor: colors.surface,
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
});
