// app/orders/takeaway.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import api from "../../src/api/axiosClient";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";

type Order = {
  id: number;
  total: number;
  status: string;
  created_at: string;
  customer_name?: string;
};

export default function TakeawayScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { appearance, isDark, fontScale } = useAppearance();
  const highContrast = appearance.highContrast;

  const loadTakeaway = async () => {
    try {
      setLoading(true);
      const res = await api.get("/orders?mode=takeaway");
      setOrders(res.data || []);
    } catch (err) {
      console.log("❌ Takeaway load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTakeaway();
  }, []);

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
        <Text
          style={[
            styles.headerTitle,
            isDark && styles.headerTitleDark,
            { fontSize: 26 * fontScale },
          ]}
        >
          Takeaway Orders
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            isDark && styles.headerSubtitleDark,
          ]}
        >
          Pickup orders overview
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {orders.length === 0 && !loading && (
          <Text
            style={[
              styles.empty,
              isDark && styles.emptyDark,
              highContrast && styles.emptyHighContrast,
            ]}
          >
            No takeaway orders
          </Text>
        )}

        {orders.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={[styles.orderCard, isDark && styles.orderCardDark]}
          >
            <View>
              <Text
                style={[
                  styles.orderId,
                  isDark && styles.orderIdDark,
                  highContrast && styles.orderIdHighContrast,
                ]}
              >
                Order #{order.id}
              </Text>
              {order.customer_name && (
                <Text style={styles.customerName}>{order.customer_name}</Text>
              )}

              <Text
                style={[
                  styles.orderStatus,
                  isDark && styles.orderStatusDark,
                ]}
              >
                {order.status === "ready" && "Ready for pickup"}
                {order.status === "preparing" && "Preparing"}
                {order.status === "waiting" && "Waiting"}
              </Text>

              <Text style={[styles.time, isDark && styles.timeDark]}>
                {new Date(order.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            <Text
              style={[
                styles.total,
                isDark && styles.totalDark,
                highContrast && styles.totalHighContrast,
              ]}
            >
              ₺{order.total}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

/* ----------------------------- STYLES (Theme-aware) ----------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F5F7" },
  containerDark: { backgroundColor: "#020617" },
  containerHighContrast: { backgroundColor: "#000000" },

  header: {
    paddingTop: 60,
    paddingBottom: 22,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerTitleDark: { color: "#F9FAFB" },
  headerSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },
  headerSubtitleDark: { color: "#9CA3AF" },

  content: {
    padding: 24,
    paddingBottom: 160,
  },

  empty: {
    marginTop: 40,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 15,
  },
  emptyDark: { color: "#9CA3AF" },
  emptyHighContrast: { color: "#FFFFFF", fontWeight: "700" },

  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderCardDark: {
    backgroundColor: "#020617",
    borderColor: "#374151",
  },

  orderId: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  orderIdDark: { color: "#E5E7EB" },
  orderIdHighContrast: { color: "#FFFFFF" },

  customerName: {
    fontSize: 14,
    color: "#374151",
    marginTop: 4,
  },

  orderStatus: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
  },
  orderStatusDark: { color: "#E5E7EB" },

  time: {
    marginTop: 4,
    fontSize: 12,
    color: "#9CA3AF",
  },
  timeDark: { color: "#9CA3AF" },

  total: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  totalDark: { color: "#E5E7EB" },
  totalHighContrast: { color: "#FFFFFF" },
});
