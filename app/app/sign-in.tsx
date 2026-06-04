import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Wrench } from "lucide-react-native";
import { colors, space, font, radius } from "@/theme";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from "@/lib/auth";

export default function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Inline feedback — Alert.alert is a no-op on react-native-web, so failures
  // would otherwise be silent in the browser.
  const [notice, setNotice] = useState<{
    type: "error" | "info";
    text: string;
  } | null>(null);

  async function submit() {
    setNotice(null);
    if (!email || !password) {
      setNotice({ type: "error", text: "Enter your email and password." });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUpWithEmail(email, password);
        if (needsConfirmation) {
          setNotice({
            type: "info",
            text: "Check your email for a verification link, then sign in.",
          });
          setMode("signin");
        }
        // Otherwise a session was created — the auth listener redirects us in.
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e) {
      setNotice({
        type: "error",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setNotice(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setNotice({
        type: "error",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.body}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Wrench size={26} color={colors.white} />
            </View>
            <Text style={styles.title}>CaroSpecs</Text>
            <Text style={styles.subtitle}>
              {mode === "signin"
                ? "Sign in to your shop"
                : "Create your shop account"}
            </Text>
          </View>

          <View style={styles.form}>
            {notice && (
              <View
                style={[
                  styles.notice,
                  notice.type === "error" ? styles.noticeError : styles.noticeInfo,
                ]}
              >
                <Text
                  style={[
                    styles.noticeText,
                    notice.type === "error"
                      ? styles.noticeTextError
                      : styles.noticeTextInfo,
                  ]}
                >
                  {notice.text}
                </Text>
              </View>
            )}
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@yourshop.com"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
            />
            <Button
              label={mode === "signin" ? "Sign in" : "Create account"}
              onPress={submit}
              loading={busy}
            />

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.or}>or</Text>
              <View style={styles.line} />
            </View>

            <Button
              label="Continue with Google"
              variant="secondary"
              onPress={google}
              disabled={busy}
            />
          </View>

          <Pressable
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            accessibilityRole="button"
          >
            <Text style={styles.switch}>
              {mode === "signin"
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flex: 1, padding: space.lg, justifyContent: "center", gap: space.xl },
  brand: { alignItems: "center", gap: space.sm },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.foreground, fontSize: font.h1, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: font.body },
  form: { gap: space.md },
  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  noticeError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: colors.danger,
  },
  noticeInfo: { backgroundColor: colors.signalBg, borderColor: colors.signal },
  noticeText: { fontSize: font.small, lineHeight: 20 },
  noticeTextError: { color: colors.danger },
  noticeTextInfo: { color: colors.signal },
  divider: { flexDirection: "row", alignItems: "center", gap: space.md },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { color: colors.muted, fontSize: font.small },
  switch: {
    color: colors.accent,
    textAlign: "center",
    fontSize: font.small,
    fontWeight: "600",
  },
});
