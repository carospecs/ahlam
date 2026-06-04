import { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Copy,
  Share2,
  CheckCheck,
  TriangleAlert,
  Info,
} from "lucide-react-native";
import { colors, space, font, radius, conditionColorOf } from "@/theme";
import { Button } from "@/components/Button";
import {
  fetchListing,
  markSold,
  type SavedListing,
} from "@/lib/listings";
import { buildListingText } from "@/lib/format";
import { useSession } from "@/lib/auth";

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { shop } = useSession();
  const [listing, setListing] = useState<SavedListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setListing(await fetchListing(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  if (!listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Listing not found.</Text>
      </View>
    );
  }

  const c = listing.corrected;
  const grade = c?.condition ?? listing.ai_output.condition;
  const text = buildListingText(
    {
      partName: c?.partName ?? listing.ai_output.partName,
      condition: grade,
      conditionNotes: c?.conditionNotes ?? listing.ai_output.conditionNotes,
      description: c?.description ?? listing.ai_output.description,
      priceUsd: c?.priceUsd ?? listing.price_usd ?? 0,
      fitment: c?.fitment ?? listing.ai_output.fitment,
    },
    shop
  );

  async function copy() {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      await Share.share({ message: text });
    } catch (e) {
      Alert.alert("Share failed", e instanceof Error ? e.message : String(e));
    }
  }

  async function sold() {
    if (!listing) return;
    try {
      await markSold(listing.id);
      await load();
    } catch (e) {
      Alert.alert("Couldn't update", e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: space.xl * 2 }}
    >
      <Image source={{ uri: listing.photo_url }} style={styles.photo} />

      <View style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {c?.partName ?? listing.ai_output.partName}
          </Text>
          {listing.status === "sold" && <Text style={styles.soldTag}>SOLD</Text>}
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.badge, { color: conditionColorOf(grade) }]}>
            {grade}
          </Text>
          {listing.price_usd != null && (
            <Text style={styles.price}>${listing.price_usd}</Text>
          )}
        </View>
      </View>

      {/* The exact text that gets posted */}
      <View style={styles.section}>
        <Text style={styles.label}>Listing text</Text>
        <View style={styles.preview}>
          <Text style={styles.previewText}>{text}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.note}>
          <Info size={16} color={colors.muted} />
          <Text style={styles.noteText}>
            Facebook Marketplace and OfferUp don&apos;t allow auto-posting. Copy
            this text and paste it in, then attach the photo (it&apos;s already in
            your camera roll).
          </Text>
        </View>

        <View style={{ gap: space.md, marginTop: space.md }}>
          <Button
            label={copied ? "Copied!" : "Copy listing text"}
            icon={
              copied ? (
                <CheckCheck size={18} color={colors.white} />
              ) : (
                <Copy size={18} color={colors.white} />
              )
            }
            onPress={copy}
          />
          <Button
            label="Share to OfferUp / other apps"
            variant="secondary"
            icon={<Share2 size={18} color={colors.foreground} />}
            onPress={share}
          />
          {listing.status !== "sold" && (
            <Button label="Mark as sold" variant="secondary" onPress={sold} />
          )}
        </View>
      </View>

      {listing.ai_output.confidence === "low" && (
        <View style={[styles.section, styles.lowConf]}>
          <TriangleAlert size={16} color={colors.signal} />
          <Text style={styles.lowConfText}>
            The AI wasn&apos;t fully confident on this part. Double-check the
            details before posting.
          </Text>
        </View>
      )}

      <Pressable onPress={() => router.replace("/")} style={styles.section}>
        <Text style={styles.backHome}>Back to home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { color: colors.muted, fontSize: font.body },
  photo: { width: "100%", height: 240, backgroundColor: colors.surface },
  section: { paddingHorizontal: space.md, paddingTop: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.foreground, fontSize: font.h2, fontWeight: "800", flex: 1 },
  soldTag: { color: colors.muted, fontSize: font.small, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xs },
  badge: { fontSize: font.body, fontWeight: "700" },
  price: { color: colors.foreground, fontSize: font.body, fontWeight: "700" },
  label: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: space.sm,
  },
  preview: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  previewText: { color: colors.foreground, fontSize: font.body, lineHeight: 22 },
  note: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  noteText: { color: colors.muted, fontSize: font.small, flex: 1, lineHeight: 20 },
  lowConf: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "flex-start",
    marginTop: space.md,
    marginHorizontal: space.md,
    backgroundColor: colors.signalBg,
    borderColor: colors.signal,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  lowConfText: { color: colors.signal, fontSize: font.small, flex: 1, lineHeight: 20 },
  backHome: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: font.body,
    textAlign: "center",
    marginTop: space.md,
  },
});
