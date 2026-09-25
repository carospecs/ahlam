import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExternalLink, Trash2 } from "lucide-react-native";
import { Button } from "@/components/Button";
import { config } from "@/lib/config";
import { useSession } from "@/lib/auth";
import { colors, font, radius, space } from "@/theme";

const LEGAL = [
  { label: "Privacy Policy", url: "https://ahlam.io/privacy" },
  { label: "Terms of Service", url: "https://ahlam.io/terms" },
];

export default function Account() {
  const router = useRouter();
  const { session, shop, signOut } = useSession();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(url: string) {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  }

  function requestDeletion() {
    if (confirmation !== "DELETE") {
      setError('Type DELETE exactly to enable account deletion.');
      return;
    }
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account. If you are the only person in this shop, its listings and shop data will be deleted too.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: deleteAccount },
      ]
    );
  }

  async function deleteAccount() {
    if (!session?.access_token) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/account/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "We couldn't delete your account.");
      await signOut();
      router.replace("/sign-in");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't delete your account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>SIGNED IN AS</Text>
          <Text style={styles.email}>{session?.user.email ?? "Account"}</Text>
          {shop?.name && <Text style={styles.shop}>{shop.name}</Text>}
        </View>

        <Text style={styles.section}>Legal</Text>
        <View style={styles.card}>
          {LEGAL.map((item) => (
            <Pressable
              key={item.url}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              onPress={() => open(item.url)}
            >
              <Text style={styles.linkLabel}>{item.label}</Text>
              <ExternalLink size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.section, styles.dangerLabel]}>Delete account</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <View style={styles.dangerHeading}>
            <Trash2 size={20} color={colors.danger} />
            <Text style={styles.dangerTitle}>Permanently delete your account</Text>
          </View>
          <Text style={styles.copy}>
            This cannot be undone. Your personal account is deleted immediately. A shop with no other members, including its listings and drafts, is deleted as well.
          </Text>
          <Text style={styles.inputLabel}>Type DELETE to confirm</Text>
          <TextInput
            value={confirmation}
            onChangeText={(text) => {
              setConfirmation(text);
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="DELETE"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Type DELETE to confirm account deletion"
            style={styles.input}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            label="Delete my account"
            onPress={requestDeletion}
            loading={deleting}
            disabled={confirmation !== "DELETE"}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.md },
  section: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: space.sm,
    textTransform: "uppercase",
  },
  dangerLabel: { color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    padding: space.md,
  },
  label: { color: colors.muted, fontSize: font.tiny, fontWeight: "700", letterSpacing: 0.5 },
  email: { color: colors.foreground, fontSize: font.body, fontWeight: "700" },
  shop: { color: colors.muted, fontSize: font.small },
  linkRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  linkLabel: { color: colors.foreground, fontSize: font.body, fontWeight: "600" },
  pressed: { opacity: 0.65 },
  dangerCard: { borderColor: "rgba(239, 68, 68, 0.55)" },
  dangerHeading: { alignItems: "center", flexDirection: "row", gap: space.sm },
  dangerTitle: { color: colors.danger, fontSize: font.body, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: font.small, lineHeight: 20 },
  inputLabel: { color: colors.foreground, fontSize: font.small, fontWeight: "600", marginTop: space.xs },
  input: {
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: font.body,
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  error: { color: colors.danger, fontSize: font.small, lineHeight: 18 },
});
