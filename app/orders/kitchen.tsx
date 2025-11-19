// app/orders/kitchen.tsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Audio } from "expo-av";
import SwipeRow from "../../src/components/SwipeRow";
import api from "../../src/api/axiosClient";

/* ============================================================
   TYPES
============================================================ */

type KitchenOrderType = "table" | "phone" | "packet" | "takeaway";
type KitchenStatus = "new" | "preparing" | "ready" | "delivered";

interface KitchenOrderItem {
  item_id: number;
  order_id: number;
  order_type: KitchenOrderType;
  table_number?: number | null;
  product_name: string;
  quantity: number;
  note?: string | null;
  kitchen_status: KitchenStatus;
  created_at: string;
  kitchen_started_at?: string | null;
}

interface KitchenOrderGroup {
  type: KitchenOrderType;
  header: KitchenOrderItem;
  items: KitchenOrderItem[];
}

type GroupedKitchenOrders = Record<string, KitchenOrderGroup>;

/* ============================================================
   COMPONENT
============================================================ */

export default function KitchenScreen() {
  const [orders, setOrders] = useState<KitchenOrderItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [now, setNow] = useState<number>(Date.now());

  const prevIdsRef = useRef<Set<number>>(new Set());
  const soundRef = useRef<Audio.Sound | null>(null);

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  /* ---------------- NEW ORDER SOUND ---------------- */
const playNewOrderSound = useCallback(async () => {
  try {
    if (soundRef.current) {
      await soundRef.current.replayAsync();
      return;
    }

    const sound = new Audio.Sound();
    await sound.loadAsync(
      require("../../assets/sounds/new-order.mp3")
    );

    soundRef.current = sound;
    await sound.playAsync();
  } catch (err) {
    console.log("🔊 Sound error:", err);
  }
}, []);

useEffect(() => {
  return () => {
    soundRef.current?.unloadAsync();
  };
}, []);
  /* ---------------- LOAD ORDERS ---------------- */
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<KitchenOrderItem[]>("/kitchen-orders");

      const incoming = (res.data || []).filter((o) =>
        ["table", "phone", "packet", "takeaway"].includes(o.order_type)
      );

      // Detect NEW order items
      const prevIds = prevIdsRef.current;
      const newIds = new Set(incoming.map((o) => o.item_id));
      const hasNew = Array.from(newIds).some((id) => !prevIds.has(id));

      if (hasNew) await playNewOrderSound();

      prevIdsRef.current = newIds;
      setOrders(incoming);
    } catch (err) {
      console.log("❌ kitchen fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [playNewOrderSound]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 8000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  /* ---------------- UPDATE STATUS ---------------- */
  const updateStatus = async (status: KitchenStatus) => {
    if (selectedIds.length === 0) return;
    try {
      await api.put("/order-items/kitchen-status", {
        ids: selectedIds,
        status,
      });

      setSelectedIds([]);
      await loadOrders();
    } catch (err) {
      console.log("❌ status update failed:", err);
    }
  };

  /* ---------------- GROUP ORDERS ---------------- */
  const grouped: GroupedKitchenOrders = orders.reduce<GroupedKitchenOrders>(
    (acc, item) => {
      const type = item.order_type;
      let key = "";

      if (type === "table") {
        key = `table-${item.table_number ?? "?"}`;
      } else {
        key = `${type}-${item.order_id}`;
      }

      if (!acc[key]) {
        acc[key] = { type, header: item, items: [] };
      }

      acc[key].items.push(item);
      return acc;
    },
    {}
  );

  /* ---------------- TIMER FORMAT ---------------- */
  const formatTimer = (start: string | null | undefined) => {
    if (!start) return "--:--";
    const startMs = new Date(start).getTime();
    const diff = Math.max(0, Math.floor((now - startMs) / 1000));
    const m = Math.floor(diff / 60)
      .toString()
      .padStart(2, "0");
    const s = (diff % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /* ---------------- UI ---------------- */
  if (loading && orders.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  const hasSelected = selectedIds.length > 0;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kitchen</Text>
        <Text style={styles.headerSubtitle}>Live kitchen queue</Text>
      </View>

      {/* ACTION BUTTONS */}
      <View style={styles.actions}>
        <View
          style={[
            styles.actionBtn,
            { backgroundColor: hasSelected ? "#4B5563" : "#A0AEC0" },
          ]}
        >
          <Text
            style={styles.actionText}
            onPress={() => hasSelected && updateStatus("preparing")}
          >
            Preparing
          </Text>
        </View>

        <View
          style={[
            styles.actionBtn,
            { backgroundColor: hasSelected ? "#111827" : "#A0AEC0" },
          ]}
        >
          <Text
            style={styles.actionText}
            onPress={() => hasSelected && updateStatus("delivered")}
          >
            Delivered
          </Text>
        </View>
      </View>

      {/* ORDER LIST */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {Object.keys(grouped).length === 0 && (
          <Text style={styles.empty}>No orders in kitchen</Text>
        )}

        {Object.entries(grouped).map(([groupKey, group]) => (
          <View key={groupKey} style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>
                {group.type === "table" &&
                  `Table ${group.header.table_number ?? "-"}`}
                {group.type === "phone" && "Phone Delivery"}
                {group.type === "packet" && "Packet Order"}
                {group.type === "takeaway" && "Takeaway Order"}
              </Text>

              <Text style={styles.groupSub}>
                {group.items.length} item{group.items.length > 1 ? "s" : ""}
              </Text>
            </View>

            {group.items.map((item) => {
              const isSelected = selectedIds.includes(item.item_id);
              const isPreparing = item.kitchen_status === "preparing";
              const timer = isPreparing
                ? formatTimer(item.kitchen_started_at || item.created_at)
                : null;

              return (
                <SwipeRow
                  key={item.item_id}
                  onSwipeRight={() => updateStatus("preparing")}
                  onSwipeLeft={() => updateStatus("delivered")}
                >
                  <View
                    style={[
                      styles.itemCard,
                      isSelected && styles.itemSelected,
                      isPreparing && styles.itemPreparing,
                    ]}
                  >
                    {/* LEFT SIDE */}
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemTitle}>
                        {item.product_name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        Qty: {item.quantity}
                      </Text>

                      {item.note && (
                        <Text style={styles.itemNote}>Note: {item.note}</Text>
                      )}
                    </View>

                    {/* RIGHT SIDE */}
                    <View style={styles.itemRight}>
                      <Text
                        style={[
                          styles.statusBadge,
                          item.kitchen_status === "new" && styles.badgeNew,
                          item.kitchen_status === "preparing" &&
                            styles.badgePreparing,
                          item.kitchen_status === "ready" &&
                            styles.badgeReady,
                          item.kitchen_status === "delivered" &&
                            styles.badgeDelivered,
                        ]}
                      >
                        {item.kitchen_status.toUpperCase()}
                      </Text>

                      {timer && (
                        <Text style={styles.timerText}>{timer}</Text>
                      )}
                    </View>
                  </View>
                </SwipeRow>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F5F7" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  actionBtn: {
    width: "48%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  actionText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },

  empty: {
    marginTop: 60,
    textAlign: "center",
    color: "#9CA3AF",
  },

  groupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 18,
  },
  groupHeader: {
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    paddingBottom: 8,
    marginBottom: 10,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  groupSub: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },

  itemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  itemSelected: {
    borderColor: "#4B5563",
    backgroundColor: "#F3F4F6",
  },
  itemPreparing: {
    borderColor: "#F59E0B",
    backgroundColor: "#FFFAEB",
  },

  itemLeft: { flex: 1, paddingRight: 10 },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  itemMeta: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  itemNote: { fontSize: 12, color: "#DC2626", marginTop: 4 },

  itemRight: { alignItems: "flex-end" },

  statusBadge: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    color: "#FFF",
    fontWeight: "700",
  },
  badgeNew: { backgroundColor: "#3B82F6" },
  badgePreparing: { backgroundColor: "#F97316" },
  badgeReady: { backgroundColor: "#10B981" },
  badgeDelivered: { backgroundColor: "#6B7280" },

  timerText: {
    marginTop: 6,
    fontSize: 12,
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
});
