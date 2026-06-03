import { useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Store } from "lucide-react-native";
import { colors, space, font, radius } from "@/theme";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";

export default function Onboarding() {
  const { refreshShop, signOut } = useSession();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) {
      Alert.alert("Shop name required", "What's your shop called?");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_shop", {
        shop_name: name.trim(),
        shop_location: location.trim() || null,
        shop_phone: phone.trim() || null,
      });
      if (error) throw error;
      await refreshShop(); // routing gate moves us to home
    } catch (e) {
      Alert.alert("Couldn't create shop", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Store size={26} color={colors.white} />
          </View>
          <Text style={styles.title}>Set up your shop</Text>
          <Text style={styles.subtitle}>
            This is the business name that appears on your listings.
          </Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Shop name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Bay Area Auto Salvage"
            autoCapitalize="words"
          />
          <TextField
            label="Location (optional)"
            value={location}
            onChangeText={setLocation}
            placeholder="City, State"
            autoCapitalize="words"
          />
          <TextField
            label="Business phone (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <Button label="Create shop" onPress={create} loading={busy} />
          <Button label="Sign out" variant="secondary" onPress={signOut} disabled={busy} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, gap: space.xl, flexGrow: 1, justifyContent: "center" },
  hero: { alignItems: "center", gap: space.sm },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.foreground, fontSize: font.h2, fontWeight: "800" },
  subtitle: {
    color: colors.muted,
    fontSize: font.body,
    textAlign: "center",
    paddingHorizontal: space.md,
  },
  form: { gap: space.md },
});
