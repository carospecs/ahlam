import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { PackageOpen, ChevronRight } from "lucide-react-native";
import { colors, space, font, radius, conditionColor } from "@/theme";
import { fetchListings, type SavedListing } from "@/lib/listings";

export default function Listings() {
  const router = useRouter();
  const [listings, setListings] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setListings(await fetchListings());
    } finally {
      setLoading(false);
    }
  }, []);

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

  if (listings.length === 0) {
    return (
      <View style={styles.center}>
        <PackageOpen size={40} color={colors.muted} />
        <Text style={styles.emptyTitle}>No listings yet</Text>
        <Text style={styles.emptyText}>
          Photograph a part from the home screen to create your first listing.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.muted} />
      }
      renderItem={({ item }) => {
        const title = item.corrected?.partName ?? item.ai_output.partName;
        const grade = item.corrected?.condition ?? item.ai_output.condition;
        return (
          <Pressable
            onPress={() => router.push(`/listing/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Image source={{ uri: item.photo_url }} style={styles.thumb} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.rowMeta}>
                <Text style={[styles.badge, { color: conditionColor[grade] }]}>
                  {grade}
                </Text>
                {item.price_usd != null && (
                  <Text style={styles.price}>${item.price_usd}</Text>
                )}
                {item.status === "sold" && (
                  <Text style={styles.sold}>SOLD</Text>
                )}
              </View>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.md,
  },
  emptyTitle: { color: colors.foreground, fontSize: font.h3, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: font.body, textAlign: "center" },
  list: { padding: space.md, gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.sm,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface2 },
  rowBody: { flex: 1, gap: space.xs },
  rowTitle: { color: colors.foreground, fontSize: font.body, fontWeight: "600" },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: space.md },
  badge: { fontSize: font.small, fontWeight: "700" },
  price: { color: colors.foreground, fontSize: font.small, fontWeight: "600" },
  sold: { color: colors.muted, fontSize: font.tiny, fontWeight: "700" },
});
