import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/theme";
import { SessionProvider, useSession } from "@/lib/auth";

/** Redirects based on auth + shop state. */
function useAuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const { loading, session, shop, shopLoading } = useSession();

  useEffect(() => {
    if (loading || shopLoading) return;
    const root = segments[0];
    const inAuth = root === "sign-in";
    const onOnboarding = root === "onboarding";

    if (!session) {
      if (!inAuth) router.replace("/sign-in");
    } else if (!shop) {
      if (!onOnboarding) router.replace("/onboarding");
    } else if (inAuth || onOnboarding) {
      router.replace("/");
    }
  }, [loading, shopLoading, session, shop, segments, router]);

  return loading;
}

function RootNav() {
  const loading = useAuthGate();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ title: "Set up your shop" }} />
      <Stack.Screen name="index" options={{ title: "CaroSpecs" }} />
      <Stack.Screen name="market" options={{ title: "Browse market" }} />
      <Stack.Screen name="review" options={{ title: "Review listing" }} />
      <Stack.Screen name="listings" options={{ title: "Inventory" }} />
      <Stack.Screen name="posts" options={{ title: "Posts" }} />
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
      <Stack.Screen name="listing/[id]" options={{ title: "Listing" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <RootNav />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
