// app/orders/tables.tsx
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Animated,
  Easing,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../src/api/axiosClient";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { usePermissions } from "../../src/context/PermissionsContext";
import { logger } from "../../src/utils/logger";

type Table = {
  number: number;
  active?: boolean;
  color?: string | null;
  label?: string | null;
  seats?: number | null;
  area?: string | null;
};

type OrderItemLite = {
  price: number;
  quantity: number;
  paid_at?: string | null;
  paid?: boolean;
  kitchen_status?: string | null;
};

type TableOrder = {
  order_type: string;
  id: number;
  table_number: number | null;
  total: number;
  status?: string | null;
  payment_status?: string | null;
  is_paid?: boolean;
  kitchen_status?: string | null;
  items?: OrderItemLite[];
};

const normalizeOrderStatus = (status?: string | null) => {
  if (!status) return "";
  const normalized = String(status).toLowerCase();
  return normalized === "occupied" ? "confirmed" : normalized;
};

// ✅ Memoized utility to compute status label
const getStatusLabel = (
  orderForTable: TableOrder | undefined,
  hasItems: boolean
): string => {
  if (!orderForTable || !hasItems) return "Free";

  const items = orderForTable.items || [];
  const anyUnpaid = items.some((i) => !i.paid_at && !i.paid);
  const isPaid =
    normalizeOrderStatus(orderForTable.status) === "paid" ||
    orderForTable.payment_status === "paid" ||
    orderForTable.is_paid ||
    !anyUnpaid;

  if (anyUnpaid) return "Unpaid";
  if (isPaid) return "Paid";
  return "Active";
};

// ✅ Memoized utility to compute kitchen status
const deriveKitchenStatus = (
  items: OrderItemLite[] | undefined
): string | null => {
  if (!Array.isArray(items) || items.length === 0) return null;

  const statuses = items
    .map((i) => i.kitchen_status)
    .filter((s): s is string => !!s && s !== "");

  if (statuses.includes("delivered")) return "ready";
  if (statuses.includes("ready")) return "ready";
  if (statuses.includes("preparing")) return "preparing";
  return statuses[0] || null;
};

export default function TablesScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [openOrders, setOpenOrders] = useState<TableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "paid" | "unpaid">(
    "all"
  );

  const { appearance, isDark, fontScale } = useAppearance();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const highContrast = appearance.highContrast;
  const router = useRouter();

  // ✅ Track last refresh time to avoid excessive API calls
  const lastRefreshRef = useRef<number>(0);
  const autoRefreshTimerRef = useRef<number | null>(null);

  // ✅ Batch load orders with items more efficiently
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [tablesRes, ordersRes] = await Promise.all([
        api.get<Table[]>("/tables"),
        api.get<TableOrder[]>("/orders"),
      ]);

      const tablesData = Array.isArray(tablesRes.data) ? tablesRes.data : [];
      const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];

      const openTableOrders = allOrders.filter(
        (o) =>
          o &&
          o.order_type === "table" &&
          o.status !== "closed" &&
          o.status !== "cancelled"
      );

      // ✅ Fetch all items in parallel with allSettled
      const itemsResults = await Promise.allSettled(
        openTableOrders.map((order) =>
          api
            .get<OrderItemLite[]>(`/orders/${order.id}/items`)
            .then((res) => ({
              orderId: order.id,
              items: Array.isArray(res.data) ? res.data : [],
            }))
            .catch(() => ({
              orderId: order.id,
              items: [],
            }))
        )
      );

      // ✅ Build map of orderId -> items
      const itemsByOrderId = new Map<number, OrderItemLite[]>();
      itemsResults.forEach((result) => {
        if (result.status === "fulfilled") {
          itemsByOrderId.set(result.value.orderId, result.value.items);
        }
      });

      // ✅ Merge orders with items
      const mergedByTable: Record<number, TableOrder> = {};

      for (const order of openTableOrders) {
        const tableNo = order.table_number;
        if (!tableNo) continue;

        const items = itemsByOrderId.get(order.id) || [];
        const status = normalizeOrderStatus(order.status);
        const anyUnpaid = items.some((i) => !i.paid_at && !i.paid);

        const existing = mergedByTable[tableNo];
        if (!existing) {
          mergedByTable[tableNo] = {
            ...order,
            table_number: tableNo,
            status,
            items,
            is_paid: !anyUnpaid,
            kitchen_status: deriveKitchenStatus(items),
            total: Number(order.total || 0),
          };
        } else {
          existing.items = [...(existing.items || []), ...items];
          existing.total =
            Number(existing.total || 0) + Number(order.total || 0);
          existing.is_paid = existing.is_paid && !anyUnpaid;
          existing.status =
            existing.status === "paid" && status === "paid"
              ? "paid"
              : "confirmed";
        }
      }

      const activeTables = tablesData.filter((t) => t.active !== false);
      setTables(activeTables);
      setOpenOrders(Object.values(mergedByTable));
      lastRefreshRef.current = Date.now();
    } catch (err) {
      logger.error("Tables screen error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Memoized handleCloseTable with proper dependencies
  const handleCloseTable = useCallback(
    async (orderId: number, tableNumber: number) => {
      Alert.alert(
        t("Close Table"),
        t("Are you sure you want to close this table?"),
        [
          { text: t("Cancel"), onPress: () => {}, style: "cancel" },
          {
            text: t("Close"),
            onPress: async () => {
              try {
                logger.log(`Closing order ${orderId} for table ${tableNumber}`);
                const closeRes = await api.post(`/orders/${orderId}/close`);
                logger.log(`Close response:`, closeRes.data);

                // Immediately remove the closed order from local state
                setOpenOrders((prev) => {
                  const updated = prev.filter((o) => o.id !== orderId);
                  logger.log(`Updated openOrders after close:`, updated);
                  return updated;
                });

                Alert.alert(t("Success"), t("Table closed successfully"));

                // Update refresh timer to prevent auto-refresh from undoing our state change
                lastRefreshRef.current = Date.now();

                // Refresh the full data after a longer delay to ensure backend has processed
                setTimeout(() => {
                  loadData();
                }, 1000);
              } catch (err) {
                Alert.alert(t("Error"), t("Failed to close table"));
                logger.error("Failed to close table:", err);
              }
            },
            style: "destructive",
          },
        ]
      );
    },
    [t, loadData]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ✅ Smarter auto-refresh with debouncing
  useEffect(() => {
    const setupAutoRefresh = () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }

      autoRefreshTimerRef.current = setInterval(() => {
        const now = Date.now();
        // Only refresh if 3+ seconds have passed
        if (now - lastRefreshRef.current >= 3000) {
          loadData();
        }
      }, 3000);
    };

    setupAutoRefresh();

    return () => {
      if (autoRefreshTimerRef.current !== null) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [loadData]);

  // ✅ Memoize filtered tables to avoid recomputation
  const visibleTables = useMemo(() => {
    return (tables || []).filter((table) => {
      if (!table || typeof table.number !== "number") return false;

      const q = String(query || "")
        .trim()
        .toLowerCase();
      if (q) {
        const numMatch = String(table.number).includes(q);
        const labelMatch = String(table.label || "")
          .toLowerCase()
          .includes(q);
        const areaMatch = String(table.area || "")
          .toLowerCase()
          .includes(q);
        if (!numMatch && !labelMatch && !areaMatch) return false;
      }

      if (filter && filter !== "all") {
        const tableOrders = (openOrders || []).filter(
          (o) => o.table_number === table.number
        );
        const orderForTable = tableOrders[0];
        const hasItems = (orderForTable?.items?.length || 0) > 0;
        const statusLabel = getStatusLabel(orderForTable, hasItems);

        if (filter === "free" && statusLabel !== "Free") return false;
        if (filter === "paid" && statusLabel !== "Paid") return false;
        if (filter === "unpaid" && statusLabel !== "Unpaid") return false;
      }

      return true;
    });
  }, [tables, query, filter, openOrders]);

  // Animated Table Card component
  function TableCard({
    table,
    isDark,
    highContrast,
    router,
    openOrders,
  }: {
    table: Table;
    isDark: boolean;
    highContrast: boolean;
    router: any;
    openOrders: TableOrder[];
  }) {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
      Animated.timing(scale, {
        toValue: 0.985,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }).start();
    };

    // ✅ compute order info for this table (optimized)
    const tableOrders = useMemo(
      () => (openOrders || []).filter((o) => o.table_number === table.number),
      [openOrders, table.number]
    );
    const orderForTable = tableOrders[0];
    const hasItems =
      orderForTable &&
      Array.isArray(orderForTable.items) &&
      orderForTable.items.length > 0;

    const statusLabel = useMemo(
      () => getStatusLabel(orderForTable, hasItems || false),
      [orderForTable, hasItems]
    );

    let total = 0;
    if (hasItems) {
      const items = orderForTable!.items as OrderItemLite[];
      total = items
        .filter((item) => !item.paid_at && !item.paid)
        .reduce(
          (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
          0
        );
      if (!total) total = Number(orderForTable!.total || 0);
    }

    const seats = Number(table.seats || 0);

    return (
      <Animated.View
        style={[
          styles.tableCard,
          // Apply status-specific styles (which include dark variants)
          statusLabel === "Free" && !isDark && styles.tableCardFree,
          statusLabel === "Free" && isDark && styles.tableCardFreeDark,
          statusLabel === "Unpaid" && !isDark && styles.tableCardUnpaid,
          statusLabel === "Unpaid" && isDark && styles.tableCardUnpaidDark,
          statusLabel === "Paid" && !isDark && styles.tableCardPaid,
          statusLabel === "Paid" && isDark && styles.tableCardPaidDark,
          // For other statuses, apply dark mode override if needed
          statusLabel !== "Free" &&
            statusLabel !== "Unpaid" &&
            statusLabel !== "Paid" &&
            isDark &&
            styles.tableCardDark,
          { transform: [{ scale }], position: "relative" },
        ]}
      >
        {/* Close button in top right - positioned absolutely, outside the main touchable */}
        {orderForTable?.kitchen_status === "ready" &&
          statusLabel === "Paid" && (
            <TouchableOpacity
              style={[
                styles.closeTableButton,
                isDark && styles.closeTableButtonDark,
                { position: "absolute", top: 12, right: 12, zIndex: 10 },
              ]}
              onPress={() =>
                handleCloseTable(orderForTable?.id || 0, table.number)
              }
              activeOpacity={0.7}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="close-circle" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}

        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => {
            // If this table already has an open order, open the table and show cart modal
            const tableOrders = (openOrders || []).filter(
              (o) => o.table_number === table.number
            );
            const orderForTable = tableOrders[0];
            if (orderForTable) {
              router.push(`/orders/table/${table.number}?openCart=1`);
            } else {
              router.push(`/orders/table/${table.number}`);
            }
          }}
          style={{ flex: 1, justifyContent: "space-between" }}
        >
          {/* Top Section with Header */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.tableNumber,
                  isDark && styles.tableNumberDark,
                  highContrast && styles.tableNumberHighContrast,
                ]}
              >
                {t("Table")} {table.number}
              </Text>
            </View>
          </View>

          {/* Seats count */}
          <View style={styles.seatsRow}>
            <Text
              style={[
                styles.seatsText,
                isDark && styles.seatsTextDark,
                highContrast && styles.seatsTextHighContrast,
              ]}
            >
              {t("Seats")}: {seats}
            </Text>
          </View>

          {/* Bottom: Status badges and kitchen status - always aligned */}
          <View style={styles.bottomSection}>
            {statusLabel === "Free" ? (
              <View
                style={[
                  styles.statusBadge,
                  styles.statusBadgeEmpty,
                  isDark && styles.statusBadgeDark,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isDark && styles.statusBadgeTextDark,
                  ]}
                >
                  {t("Free")}
                </Text>
              </View>
            ) : statusLabel === "Paid" ? (
              <View
                style={[
                  styles.statusBadge,
                  styles.statusBadgePaid,
                  isDark && styles.statusBadgeDark,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isDark && styles.statusBadgeTextDark,
                  ]}
                >
                  {t("Paid")}
                </Text>
              </View>
            ) : statusLabel === "Unpaid" ? (
              <View
                style={[
                  styles.statusBadge,
                  styles.statusBadgeUnpaid,
                  isDark && styles.statusBadgeDark,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isDark && styles.statusBadgeTextDark,
                  ]}
                >
                  {t("Unpaid")}
                </Text>
              </View>
            ) : (
              hasItems &&
              total > 0 && (
                <View
                  style={[styles.totalPill, isDark && styles.totalPillDark]}
                >
                  <Text
                    style={[
                      styles.totalPillText,
                      isDark && styles.totalPillTextDark,
                    ]}
                  >
                    ₺{total}
                  </Text>
                </View>
              )
            )}

            {/* Kitchen status badge - show below status */}
            {orderForTable?.kitchen_status && (
              <View
                style={[
                  styles.kitchenBadge,
                  orderForTable.kitchen_status === "ready" &&
                    styles.kitchenBadgeReady,
                  orderForTable.kitchen_status === "preparing" &&
                    styles.kitchenBadgePreparing,
                  orderForTable.kitchen_status === "pending" &&
                    styles.kitchenBadgePending,
                ]}
              >
                <Ionicons
                  name={
                    orderForTable.kitchen_status === "ready"
                      ? "checkmark-circle"
                      : orderForTable.kitchen_status === "preparing"
                        ? "hourglass"
                        : "ellipsis-horizontal"
                  }
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.kitchenBadgeText}>
                  {orderForTable.kitchen_status === "ready"
                    ? t("Order Ready!")
                    : orderForTable.kitchen_status === "preparing"
                      ? t("Preparing")
                      : t("Pending")}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        highContrast && styles.containerHighContrast,
      ]}
    >
      {/* HEADER */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleArea}>
            <Ionicons
              name="restaurant"
              size={24}
              color={isDark ? "#818CF8" : "#6366F1"}
            />
            <View>
              <Text
                style={[
                  styles.headerTitle,
                  isDark && styles.headerTitleDark,
                  { fontSize: 26 * fontScale },
                ]}
              >
                {t("Tables")}
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  isDark && styles.headerSubtitleDark,
                ]}
              >
                {tables.length} {t("available")}
              </Text>
            </View>
          </View>
          <TextInput
            placeholder={t("Search...")}
            placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
            value={query}
            onChangeText={setQuery}
            style={[
              styles.headerSearchInput,
              isDark && styles.headerSearchInputDark,
            ]}
            keyboardType="default"
          />
        </View>
      </View>

      {/* Filters - below header */}
      <View style={styles.filtersRow}>
        {(["all", "free", "paid", "unpaid"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterPill,
              filter === f && styles.filterPillActive,
              isDark && filter === f && styles.filterPillActiveDark,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                isDark && styles.filterTextDark,
                filter === f && styles.filterTextActive,
              ]}
            >
              {t(f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#818CF8" : "#6366F1"}
          />
        }
      >
        {!loading && tables.length === 0 && (
          <Text
            style={[
              styles.emptyText,
              isDark && styles.emptyTextDark,
              highContrast && styles.emptyTextHighContrast,
            ]}
          >
            {t("No tables found")}
          </Text>
        )}

        <View style={styles.grid}>
          {(Array.isArray(visibleTables) ? visibleTables : []).map((table) => {
            if (!table || typeof table.number !== "number") return null;

            const tableOrders = (
              Array.isArray(openOrders) ? openOrders : []
            ).filter((o) => o.table_number === table.number);

            const orderForTable = tableOrders[0];
            const hasItems =
              orderForTable &&
              Array.isArray(orderForTable.items) &&
              orderForTable.items.length > 0;

            let statusLabel = "Free";
            let statusStyle: any[] = [
              styles.tableStatusEmpty,
              isDark && styles.tableStatusEmptyDark,
            ];
            let total = 0;

            if (orderForTable && hasItems) {
              const items = orderForTable.items as OrderItemLite[];
              const anyUnpaid = items.some(
                (item) => !item.paid_at && !item.paid
              );

              const isPaid =
                normalizeOrderStatus(orderForTable.status) === "paid" ||
                orderForTable.payment_status === "paid" ||
                orderForTable.is_paid ||
                !anyUnpaid;

              if (anyUnpaid) {
                statusLabel = "Unpaid";
                statusStyle = [
                  styles.tableStatusUnpaid,
                  isDark && styles.tableStatusUnpaidDark,
                ];
              } else if (isPaid) {
                statusLabel = "Paid";
                statusStyle = [
                  styles.tableStatusPaid,
                  isDark && styles.tableStatusPaidDark,
                ];
              } else {
                statusLabel = "Active";
                statusStyle = [
                  styles.tableStatusActive,
                  isDark && styles.tableStatusActiveDark,
                ];
              }

              total = items
                .filter((item) => !item.paid_at && !item.paid)
                .reduce(
                  (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
                  0
                );

              if (!total) {
                total = Number(orderForTable.total || 0);
              }
            }

            const showTotal = hasItems && total > 0;

            return (
              <TableCard
                key={table.number}
                table={table}
                isDark={isDark}
                highContrast={highContrast}
                router={router}
                openOrders={openOrders}
              />
            );
          })}
        </View>
      </ScrollView>

      {hasPermission("orders") && <BottomNav />}
    </View>
  );
}

/* ------------------------------------------------------------
   Styles — Professional Enterprise Look
------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },
  containerDark: {
    backgroundColor: "#020617",
  },
  containerHighContrast: {
    backgroundColor: "#000000",
  },

  header: {
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
  },

  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },

  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },

  content: {
    padding: 24,
    paddingBottom: 160,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
    color: "#6B7280",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
  emptyTextHighContrast: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  tableCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 5,
  },
  tableCardDark: {
    backgroundColor: "#0F172A",
    borderColor: "transparent",
  },

  /* Status-based card colors */
  tableCardFree: {
    backgroundColor: "rgba(239,246,255,0.95)",
    borderColor: "#87CEEB",
  },
  tableCardFreeDark: {
    backgroundColor: "#1E3A8A",
    borderColor: "#60A5FA",
  },
  tableCardUnpaid: {
    backgroundColor: "rgba(254,226,226,0.98)",
    borderColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOpacity: 0.25,
  },
  tableCardUnpaidDark: {
    backgroundColor: "#7F1D1D",
    borderColor: "#DC2626",
    shadowColor: "#EF4444",
    shadowOpacity: 0.4,
  },
  tableCardPaid: {
    backgroundColor: "rgba(240,253,244,0.95)",
    borderColor: "#86EFAC",
  },
  tableCardPaidDark: {
    backgroundColor: "#14532D",
    borderColor: "#4ADE80",
  },

  tableNumber: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  tableNumberDark: {
    color: "#E5E7EB",
  },
  tableNumberHighContrast: {
    color: "#FFFFFF",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  topSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  bottomSection: {
    gap: 8,
  },

  kitchenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#6B7280",
    alignSelf: "flex-start",
  },
  kitchenBadgeReady: {
    backgroundColor: "#10B981",
  },
  kitchenBadgePreparing: {
    backgroundColor: "#F59E0B",
  },
  kitchenBadgePending: {
    backgroundColor: "#EF4444",
  },
  kitchenBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },

  tableStatusActive: {
    marginTop: 6,
    color: "#16A34A",
    fontWeight: "600",
  },
  tableStatusActiveDark: {
    color: "#4ADE80",
  },

  tableStatusPaid: {
    marginTop: 6,
    color: "#16A34A",
    fontWeight: "700",
  },
  tableStatusPaidDark: {
    color: "#BBF7D0",
  },

  tableStatusUnpaid: {
    marginTop: 6,
    color: "#DC2626",
    fontWeight: "700",
  },
  tableStatusUnpaidDark: {
    color: "#FCA5A5",
  },

  tableStatusEmpty: {
    marginTop: 6,
    color: "#6B7280",
  },
  tableStatusEmptyDark: {
    color: "#9CA3AF",
  },

  tableTotal: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  tableTotalDark: {
    color: "#FFFFFF",
  },
  tableTotalHighContrast: {
    color: "#FFFFFF",
  },
  /* New header / search / filters styles */
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitleArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerSearchInput: {
    width: 120,
    height: 36,
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 13,
  },
  headerSearchInputDark: {
    backgroundColor: "#0B1220",
    borderColor: "#24303f",
    color: "#E5E7EB",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    width: 220,
    paddingLeft: 12,
  },
  searchBarContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInputDark: {
    backgroundColor: "#0B1220",
    borderColor: "#24303f",
    color: "#E5E7EB",
  },
  filtersRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterPillActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  filterPillActiveDark: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  filterText: {
    color: "#111827",
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  filterTextDark: {
    color: "#F8FAFC",
  },

  /* Status & total badges */
  statusBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  statusBadgeDark: {
    backgroundColor: "transparent",
  },
  statusBadgeActive: {
    backgroundColor: "rgba(34,197,94,0.2)",
  },
  statusBadgePaid: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderRadius: 6,
  },
  statusBadgeUnpaid: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderRadius: 6,
  },
  statusBadgeEmpty: {
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statusBadgeTextDark: {
    color: "#FFFFFF",
  },

  closeTableButton: {
    backgroundColor: "#10B981",
    borderRadius: 999,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  closeTableButtonDark: {
    backgroundColor: "#059669",
    shadowColor: "#059669",
  },

  totalPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#6366F1",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  totalPillDark: {
    backgroundColor: "#4F46E5",
  },
  totalPillText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  totalPillTextDark: {
    color: "#E6EEF8",
  },
  /* Seats display */
  seatsRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  seatsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  seatsTextDark: {
    color: "#E5E7EB",
  },
  seatsTextHighContrast: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
