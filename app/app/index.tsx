import { useState, useEffect, type ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  ImageUp,
  PackageOpen,
  Megaphone,
  MessageSquare,
  Store,
  LogOut,
  ChevronRight,
  List,
} from "lucide-react-native";
import { colors, space, font, radius } from "@/theme";
import { Button } from "@/components/Button";
import { setPendingCapture } from "@/lib/captureStore";
import { useSession } from "@/lib/auth";
import { queueCount } from "@/lib/queue";

export default function Home() {
  const router = useRouter();
  const { shop, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [queueItems, setQueueItems] = useState(0);

  async function capture(mode: "camera" | "library") {
    setBusy(true);
    try {
      const perm =
        mode === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Ahlam needs access to take or pick a photo of the part."
        );
        return;
      }

      const opts: ImagePicker.ImagePickerOptions = {
        quality: 0.6,
        base64: true,
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      };
      const result =
        mode === "camera"
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);

      if (result.canceled || !result.assets?.[0]?.base64) return;
      const asset = result.assets[0];
      setPendingCapture({
        imageBase64: asset.base64 as string,
        imageUri: asset.uri,
      });
      router.push("/review");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    queueCount().then(setQueueItems);
    const id = setInterval(() => queueCount().then(setQueueItems), 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Dashboard</Text>
          <Text style={styles.shopName} numberOfLines={1}>
            {shop?.name ?? "Your shop"}
          </Text>
        </View>
        {queueItems > 0 && (
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>
              📷 {queueItems} items waiting to upload
            </Text>
          </View>
        )}
        <Pressable
          onPress={signOut}
          hitSlop={12}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
          <LogOut size={20} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary action: photograph a part */}
        <View style={styles.hero}>
          <Text style={styles.title}>Photograph the vehicle</Text>
          <Text style={styles.subtitle}>
            Snap one photo and we&apos;ll find every sellable part, grade each
            one, and draft the listings. You review and post.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Take a photo"
            icon={<Camera size={18} color={colors.white} />}
            onPress={() => capture("camera")}
            loading={busy}
          />
          <Button
            label="Upload from library"
            variant="secondary"
            icon={<ImageUp size={18} color={colors.foreground} />}
            onPress={() => capture("library")}
            disabled={busy}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="List a whole vehicle"
            variant="secondary"
            icon={<List size={18} color={colors.foreground} />}
            onPress={() => router.push("/bulk")}
          />
        </View>

        {/* Marketplace */}
        <Text style={styles.sectionLabel}>Marketplace</Text>
        <View style={styles.tiles}>
          <Tile
            icon={<Store size={22} color={colors.foreground} />}
            label="Browse market"
            sub="Buy parts & cars from other shops"
            onPress={() => router.push("/market")}
          />
        </View>

        {/* Navigation hub */}
        <Text style={styles.sectionLabel}>My shop</Text>
        <View style={styles.tiles}>
          <Tile
            icon={<PackageOpen size={22} color={colors.foreground} />}
            label="Inventory"
            sub="Browse & search saved parts"
            onPress={() => router.push("/listings")}
          />
          <Tile
            icon={<Megaphone size={22} color={colors.foreground} />}
            label="Posts"
            sub="Parts ready to post"
            onPress={() => router.push("/posts")}
          />
          <Tile
            icon={<MessageSquare size={22} color={colors.foreground} />}
            label="Chat"
            sub="Ask about a part or VIN"
            onPress={() => router.push("/chat")}
          />
        </View>

        <Text style={styles.disclaimer}>
          AI can make mistakes — always review before posting. Snap the VIN plate
          too and we&apos;ll keep the history on file.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.tileIcon}>{icon}</View>
      <View style={styles.tileBody}>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={styles.tileSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  shopName: { color: colors.foreground, fontSize: font.h3, fontWeight: "700" },
  body: { padding: space.lg, gap: space.lg },
  hero: { alignItems: "center", marginTop: space.sm, gap: space.sm },
  title: { color: colors.foreground, fontSize: font.h1, fontWeight: "800" },
  subtitle: {
    color: colors.muted,
    fontSize: font.body,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: space.md,
  },
  actions: { gap: space.md },
  sectionLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: space.sm,
  },
  tiles: { gap: space.sm },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileBody: { flex: 1, gap: 2 },
  tileLabel: { color: colors.foreground, fontSize: font.body, fontWeight: "700" },
  tileSub: { color: colors.muted, fontSize: font.small },
  disclaimer: {
    color: colors.muted,
    fontSize: font.small,
    textAlign: "center",
    lineHeight: 20,
    marginTop: space.sm,
  },
  queueBadge: {
    backgroundColor: colors.signalBg,
    borderWidth: 1,
    borderColor: colors.signal,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    marginRight: space.sm,
  },
  queueBadgeText: {
    color: colors.signal,
    fontSize: font.tiny,
    fontWeight: "700",
  },
});
