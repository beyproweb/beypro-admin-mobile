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
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Takeaway Orders</Text>
        <Text style={styles.headerSubtitle}>Pickup orders overview</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {orders.length === 0 && !loading && (
          <Text style={styles.empty}>No takeaway orders</Text>
        )}

        {orders.map((order) => (
          <TouchableOpacity key={order.id} style={styles.orderCard}>
            <View>
              <Text style={styles.orderId}>Order #{order.id}</Text>
              {order.customer_name && (
                <Text style={styles.customerName}>{order.customer_name}</Text>
              )}

              <Text style={styles.orderStatus}>
                {order.status === "ready" && "Ready for pickup"}
                {order.status === "preparing" && "Preparing"}
                {order.status === "waiting" && "Waiting"}
              </Text>

              <Text style={styles.time}>
                {new Date(order.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            <Text style={styles.total}>₺{order.total}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/* ----------------------------- STYLES ----------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F5F7" },

  header: {
    paddingTop: 60,
    paddingBottom: 22,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },

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

  orderId: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },

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

  time: {
    marginTop: 4,
    fontSize: 12,
    color: "#9CA3AF",
  },

  total: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
});
