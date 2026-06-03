import { useState } from "react";
import { View, Text, StyleSheet, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageUp, PackageOpen, LogOut } from "lucide-react-native";
import { colors, space, font, radius } from "@/theme";
import { Button } from "@/components/Button";
import { setPendingCapture } from "@/lib/captureStore";
import { useSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const { shop, signOut } = useSession();
  const [busy, setBusy] = useState(false);

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
          "CaroSpecs needs access to take or pick a photo of the part."
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

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.topBar}>
        <Text style={styles.shopName} numberOfLines={1}>
          {shop?.name ?? "Your shop"}
        </Text>
        <Pressable
          onPress={signOut}
          hitSlop={12}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
          <LogOut size={20} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={styles.title}>Photograph a part</Text>
          <Text style={styles.subtitle}>
            Snap a photo and we&apos;ll identify it, grade its condition, and
            draft a listing. You review and post.
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
          <Button
            label="My listings"
            variant="secondary"
            icon={<PackageOpen size={18} color={colors.foreground} />}
            onPress={() => router.push("/listings")}
            disabled={busy}
          />
        </View>

        <Text style={styles.disclaimer}>
          AI can make mistakes — always review before posting. Snap the VIN plate
          too and we&apos;ll keep the history on file.
        </Text>
      </View>
    </SafeAreaView>
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
  shopName: { color: colors.foreground, fontSize: font.h3, fontWeight: "700", flex: 1 },
  body: { flex: 1, padding: space.lg, justifyContent: "space-between" },
  hero: { alignItems: "center", marginTop: space.xl, gap: space.md },
  title: { color: colors.foreground, fontSize: font.h1, fontWeight: "800" },
  subtitle: {
    color: colors.muted,
    fontSize: font.body,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: space.md,
  },
  actions: { gap: space.md },
  disclaimer: {
    color: colors.muted,
    fontSize: font.small,
    textAlign: "center",
    lineHeight: 20,
  },
});
