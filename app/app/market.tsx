import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  Store,
  MessageSquare,
  Wrench,
  Car,
  X,
  Eye,
  MapPin,
  PackageOpen,
} from "lucide-react-native";
import { colors, space, font, radius, conditionColorOf } from "@/theme";
import { Button } from "@/components/Button";
import { useSession } from "@/lib/auth";
import {
  fetchMarketplace,
  contactSeller,
  contactShop,
  incrementListingView,
  incrementVehicleView,
  type MarketPart,
  type MarketVehicle,
} from "@/lib/marketplace";

type Target =
  | { kind: "listing"; id: string; title: string }
  | { kind: "shop"; shopId: string; subject: string; title: string };

type Detail =
  | { kind: "part"; data: MarketPart }
  | { kind: "vehicle"; data: MarketVehicle };

export default function Market() {
  const { shop } = useSession();
  const [tab, setTab] = useState<"parts" | "vehicles">("parts");
  const [parts, setParts] = useState<MarketPart[]>([]);
  const [vehicles, setVehicles] = useState<MarketVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  function openPart(p: MarketPart) {
    incrementListingView(p.id);
    setParts((prev) => prev.map((x) => (x.id === p.id ? { ...x, views: x.views + 1 } : x)));
    setDetail({ kind: "part", data: { ...p, views: p.views + 1 } });
  }
  function openVehicle(v: MarketVehicle) {
    incrementVehicleView(v.id);
    setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...x, views: x.views + 1 } : x)));
    setDetail({ kind: "vehicle", data: { ...v, views: v.views + 1 } });
  }

  const load = useCallback(async () => {
    try {
      const d = await fetchMarketplace(shop?.id ?? null);
      setParts(d.parts);
      setVehicles(d.vehicles);
    } catch {
      // soft-fail: keep whatever we have
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shop?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const ql = q.trim().toLowerCase();
  const fParts = useMemo(
    () => parts.filter((p) => !ql || `${p.part} ${p.fitment} ${p.category} ${p.shopName}`.toLowerCase().includes(ql)),
    [parts, ql]
  );
  const fVehicles = useMemo(
    () => vehicles.filter((v) => !ql || `${v.year} ${v.make} ${v.model} ${v.trim} ${v.shopName}`.toLowerCase().includes(ql)),
    [vehicles, ql]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.tabs}>
        {(["parts", "vehicles"] as const).map((t) => {
          const on = tab === t;
          const Icon = t === "parts" ? Wrench : Car;
          const n = t === "parts" ? fParts.length : fVehicles.length;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, on && styles.tabOn]}>
              <Icon size={16} color={on ? colors.white : colors.muted} />
              <Text style={[styles.tabLabel, on && { color: colors.white }]}>
                {t === "parts" ? "Parts" : "Vehicles"} {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.search}>
        <Search size={16} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search parts, cars, shops…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : tab === "parts" ? (
        <FlatList
          data={fParts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.muted} />}
          ListEmptyComponent={<Empty label="No parts listed nearby yet." />}
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]} onPress={() => openPart(item)}>
              <View style={styles.thumb}>
                {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.thumbImg} /> : <Wrench size={22} color={colors.muted} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.part}</Text>
                {!!item.fitment && <Text style={styles.cardSub} numberOfLines={1}>Fits {item.fitment}</Text>}
                <View style={styles.metaRow}>
                  <Store size={12} color={colors.muted} />
                  <Text style={styles.meta} numberOfLines={1}>{item.shopName}{item.location ? ` · ${item.location}` : ""}</Text>
                </View>
                <View style={styles.cardFoot}>
                  <Text style={[styles.grade, { color: conditionColorOf(item.grade) }]}>{item.grade}</Text>
                  <View style={styles.viewsRow}><Eye size={11} color={colors.muted} /><Text style={styles.viewsText}>{item.views}</Text></View>
                  <Text style={styles.price}>${item.price.toLocaleString()}</Text>
                </View>
              </View>
              <Pressable
                style={styles.msgBtn}
                onPress={() => setTarget({ kind: "listing", id: item.id, title: `${item.part} · ${item.shopName}` })}
              >
                <MessageSquare size={18} color={colors.white} />
              </Pressable>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={fVehicles}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.muted} />}
          ListEmptyComponent={<Empty label="No vehicles listed nearby yet." />}
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]} onPress={() => openVehicle(item)}>
              <View style={styles.thumb}>
                <Car size={24} color={colors.muted} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.year} {item.make} {item.model} {item.trim}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{[item.mileage, item.body, item.color].filter(Boolean).join(" · ")}</Text>
                <View style={styles.metaRow}>
                  <Store size={12} color={colors.muted} />
                  <Text style={styles.meta} numberOfLines={1}>{item.shopName}{item.location ? ` · ${item.location}` : ""}</Text>
                </View>
                <View style={styles.cardFoot}>
                  <Text style={styles.grade}>{item.sellMode === "both" ? "Car + parts" : "Whole car"}</Text>
                  <View style={styles.viewsRow}><Eye size={11} color={colors.muted} /><Text style={styles.viewsText}>{item.views}</Text></View>
                  {item.askingPrice ? <Text style={styles.price}>${item.askingPrice.toLocaleString()}</Text> : <Text style={[styles.price, { color: colors.accent }]}>Parting out</Text>}
                </View>
              </View>
              <Pressable
                style={styles.msgBtn}
                onPress={() => setTarget({ kind: "shop", shopId: item.shopId, subject: `${item.year} ${item.make} ${item.model}`, title: `${item.year} ${item.make} ${item.model} · ${item.shopName}` })}
              >
                <MessageSquare size={18} color={colors.white} />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      <DetailSheet
        detail={detail}
        onClose={() => setDetail(null)}
        onContact={() => {
          if (!detail) return;
          if (detail.kind === "part") setTarget({ kind: "listing", id: detail.data.id, title: `${detail.data.part} · ${detail.data.shopName}` });
          else setTarget({ kind: "shop", shopId: detail.data.shopId, subject: `${detail.data.year} ${detail.data.make} ${detail.data.model}`, title: `${detail.data.year} ${detail.data.make} ${detail.data.model} · ${detail.data.shopName}` });
          setDetail(null);
        }}
      />
      <ContactModal target={target} onClose={() => setTarget(null)} />
    </SafeAreaView>
  );
}

function DetailSheet({ detail, onClose, onContact }: { detail: Detail | null; onClose: () => void; onContact: () => void }) {
  const isPart = detail?.kind === "part";
  const title = !detail
    ? ""
    : detail.kind === "part"
    ? detail.data.part
    : `${detail.data.year} ${detail.data.make} ${detail.data.model} ${detail.data.trim}`.trim();
  const sub = !detail
    ? ""
    : detail.kind === "part"
    ? detail.data.fitment ? `Fits ${detail.data.fitment}` : detail.data.category
    : [detail.data.mileage, detail.data.body, detail.data.color].filter(Boolean).join(" · ");
  const priceLabel = !detail
    ? ""
    : detail.kind === "part"
    ? `$${detail.data.price.toLocaleString()}`
    : detail.data.askingPrice ? `$${detail.data.askingPrice.toLocaleString()}` : "Parting out";
  const body = !detail
    ? ""
    : detail.kind === "part"
    ? detail.data.desc || detail.data.note
    : detail.data.sellMode === "both"
    ? "Selling whole or parting out — message for specific parts or the full vehicle."
    : "Whole-car sale. Message the seller for mileage, history, and condition details.";

  return (
    <Modal visible={!!detail} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {detail && (
            <>
              <View style={styles.sheetHead}>
                <View style={{ flex: 1, paddingRight: space.md }}>
                  <Text style={styles.sheetTitle} numberOfLines={2}>{title}</Text>
                  {!!sub && <Text style={styles.sheetSub} numberOfLines={1}>{sub}</Text>}
                </View>
                <Pressable onPress={onClose} hitSlop={10}><X size={20} color={colors.muted} /></Pressable>
              </View>

              <View style={styles.detailThumb}>
                {isPart && detail.kind === "part" && detail.data.photoUrl ? (
                  <Image source={{ uri: detail.data.photoUrl }} style={styles.thumbImg} />
                ) : isPart ? (
                  <Wrench size={40} color={colors.muted} />
                ) : (
                  <Car size={44} color={colors.muted} />
                )}
              </View>

              <View style={styles.detailRow}>
                {isPart && detail.kind === "part" && (
                  <Text style={[styles.grade, { color: conditionColorOf(detail.data.grade) }]}>{detail.data.grade}</Text>
                )}
                <Text style={styles.detailPrice}>{priceLabel}</Text>
              </View>

              {!!body && <Text style={styles.detailBody}>{body}</Text>}

              <View style={styles.detailMeta}>
                <View style={styles.metaRow}><Store size={13} color={colors.muted} /><Text style={styles.meta}>{detail.data.shopName}</Text></View>
                {!!detail.data.location && <View style={styles.metaRow}><MapPin size={13} color={colors.muted} /><Text style={styles.meta}>{detail.data.location}</Text></View>}
                <View style={styles.metaRow}><Eye size={13} color={colors.muted} /><Text style={styles.meta}>{detail.data.views} {detail.data.views === 1 ? "view" : "views"}</Text></View>
              </View>

              <Button label="Message seller" onPress={onContact} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ContactModal({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const [msg, setMsg] = useState("Hi — is this still available?");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) setMsg("Hi — is this still available?");
  }, [target]);

  async function send() {
    if (!target || !msg.trim()) return;
    setBusy(true);
    try {
      if (target.kind === "listing") await contactSeller(target.id, msg.trim());
      else await contactShop(target.shopId, target.subject, msg.trim());
      onClose();
      Alert.alert("Message sent", "The seller will see your message in their inbox.");
    } catch (e: any) {
      Alert.alert("Couldn't send", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Message seller</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={20} color={colors.muted} /></Pressable>
          </View>
          {target && <Text style={styles.sheetSub} numberOfLines={1}>{target.title}</Text>}
          <TextInput
            value={msg}
            onChangeText={setMsg}
            multiline
            style={styles.sheetInput}
            placeholder="Write a message…"
            placeholderTextColor={colors.muted}
          />
          <Button label={busy ? "Sending…" : "Send message"} onPress={send} loading={busy} disabled={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <View style={styles.empty}>
      <PackageOpen size={32} color={colors.muted} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: "row", gap: space.sm, padding: space.md },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  tabOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabLabel: { color: colors.muted, fontSize: font.small, fontWeight: "700" },
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, marginHorizontal: space.md, marginBottom: space.sm, paddingHorizontal: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  searchInput: { flex: 1, color: colors.foreground, fontSize: font.body, paddingVertical: space.sm + 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: space.md, gap: space.sm, flexGrow: 1 },
  card: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  cardTitle: { color: colors.foreground, fontSize: font.body, fontWeight: "700" },
  cardSub: { color: colors.muted, fontSize: font.small },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { color: colors.muted, fontSize: font.tiny, flex: 1 },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: 2 },
  grade: { fontSize: font.tiny, fontWeight: "700", color: colors.muted },
  viewsRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  viewsText: { color: colors.muted, fontSize: font.tiny, fontWeight: "600" },
  price: { color: colors.success, fontSize: font.body, fontWeight: "800", marginLeft: "auto" },
  msgBtn: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingVertical: space.xl * 2 },
  emptyText: { color: colors.muted, fontSize: font.body },
  overlay: { flex: 1, backgroundColor: "rgba(7,11,22,0.72)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: colors.line },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: colors.foreground, fontSize: font.h3, fontWeight: "700" },
  sheetSub: { color: colors.muted, fontSize: font.small },
  sheetInput: { minHeight: 90, textAlignVertical: "top", color: colors.foreground, fontSize: font.body, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md },
  detailThumb: { height: 180, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  detailPrice: { color: colors.success, fontSize: font.h3, fontWeight: "800", marginLeft: "auto" },
  detailBody: { color: colors.foreground, fontSize: font.body, lineHeight: 21 },
  detailMeta: { gap: space.xs },
});
