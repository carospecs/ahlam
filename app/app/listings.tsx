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
  TextInput,
  ScrollView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { PackageOpen, ChevronRight, Search } from "lucide-react-native";
import { colors, space, font, radius, conditionColorOf } from "@/theme";
import { fetchListings, type SavedListing } from "@/lib/listings";

type Filter = "all" | "active" | "sold";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "sold", label: "Sold" },
];

/** Tabular-friendly money: $1,234 (no cents — asking prices are whole dollars). */
function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export default function Inventory() {
  const router = useRouter();
  const [listings, setListings] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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

  // Summary stats across the whole inventory (not just the filtered view).
  const stats = useMemo(() => {
    const active = listings.filter((l) => l.status === "active");
    const sold = listings.filter((l) => l.status === "sold");
    const activeValue = active.reduce((sum, l) => sum + (l.price_usd ?? 0), 0);
    return {
      total: listings.length,
      activeCount: active.length,
      soldCount: sold.length,
      activeValue,
    };
  }, [listings]);

  // Apply the status filter + name/category search.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l) => {
      if (filter === "active" && l.status !== "active") return false;
      if (filter === "sold" && l.status !== "sold") return false;
      if (!q) return true;
      const name = (l.corrected?.partName ?? l.ai_output.partName).toLowerCase();
      const cat = (
        l.corrected?.partCategory ?? l.ai_output.partCategory
      ).toLowerCase();
      return name.includes(q) || cat.includes(q);
    });
  }, [listings, filter, query]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  // Fresh shop, nothing photographed yet.
  if (listings.length === 0) {
    return (
      <View style={styles.center}>
        <PackageOpen size={40} color={colors.muted} />
        <Text style={styles.emptyTitle}>No inventory yet</Text>
        <Text style={styles.emptyText}>
          Photograph a part from the home screen to create your first listing.
        </Text>
      </View>
    );
  }

  const header = (
    <View style={styles.headerWrap}>
      {/* Summary stat tiles */}
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Parts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{money(stats.activeValue)}</Text>
          <Text style={styles.statLabel}>Active value</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.soldCount}</Text>
          <Text style={styles.statLabel}>Sold</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Search size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search parts…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search parts"
        />
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map((f) => {
          const selected = filter === f.key;
          const count =
            f.key === "all"
              ? stats.total
              : f.key === "active"
              ? stats.activeCount
              : stats.soldCount;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {f.label} · {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      data={visible}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.muted}
        />
      }
      ListEmptyComponent={
        <View style={styles.noMatch}>
          <Text style={styles.emptyText}>No parts match your search.</Text>
        </View>
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
                {item.status === "sold" && <Text style={styles.sold}>SOLD</Text>}
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
  noMatch: { alignItems: "center", paddingVertical: space.xl },

  list: { padding: space.md, gap: space.sm },

  headerWrap: { gap: space.md, marginBottom: space.sm },

  statRow: { flexDirection: "row", gap: space.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: "center",
    gap: space.xs,
  },
  statValue: { color: colors.foreground, fontSize: font.h3, fontWeight: "800" },
  statLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: font.body,
    paddingVertical: space.sm,
  },

  chips: { gap: space.sm, paddingRight: space.md },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: font.small, fontWeight: "600" },
  chipTextActive: { color: colors.white },

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
  sold: { color: colors.muted, fontSize: font.tiny, fontWeight: "700" },
});
