import { useCallback, useMemo, useState } from "react";
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
import { Megaphone, ChevronRight, CheckCircle2 } from "lucide-react-native";
import { colors, space, font, radius, conditionColorOf } from "@/theme";
import { fetchListings, type SavedListing } from "@/lib/listings";

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/**
 * Posts queue: parts that are saved and active but not yet posted to a
 * marketplace (no marketplace_url). Tap a row to open the detail screen where
 * the shop copies the listing text and marks it posted.
 */
export default function Posts() {
  const router = useRouter();
  const [listings, setListings] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      setListings(await fetchListings());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const ready = useMemo(
    () => listings.filter((l) => l.status === "active"),
    [listings]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (ready.length === 0) {
    return (
      <View style={styles.center}>
        <CheckCircle2 size={40} color={colors.success} />
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptyText}>
          No parts waiting to be posted. Photograph a part to add one.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={ready}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.banner}>
          <Megaphone size={18} color={colors.muted} />
          <Text style={styles.bannerText}>
            {ready.length} part{ready.length === 1 ? "" : "s"} ready to post.
            Open one to copy the listing text for Facebook or OfferUp.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.muted}
        />
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
                <Text style={[styles.badge, { color: conditionColorOf(grade) }]}>
                  {grade}
                </Text>
                {item.price_usd != null && (
                  <Text style={styles.price}>{money(item.price_usd)}</Text>
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
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  bannerText: { color: colors.muted, fontSize: font.small, flex: 1, lineHeight: 20 },

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
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  rowBody: { flex: 1, gap: space.xs },
  rowTitle: { color: colors.foreground, fontSize: font.body, fontWeight: "600" },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: space.md },
  badge: { fontSize: font.small, fontWeight: "700" },
  price: { color: colors.foreground, fontSize: font.small, fontWeight: "600" },
});
