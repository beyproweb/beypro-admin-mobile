// app/orders/packet.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import api from "../../src/api/axiosClient";

type PacketOrder = {
  id: number;
  total: number;
  status: string;
  created_at: string;
  customer_name?: string;
};

export default function PacketOrdersScreen() {
  const [orders, setOrders] = useState<PacketOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPacketOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get("/orders?mode=packet");
      setOrders(res.data || []);
    } catch (err) {
      console.log("❌ Packet orders load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPacketOrders();
  }, []);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Packet Orders</Text>
        <Text style={styles.headerSubtitle}>Bagged takeaway orders</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {orders.length === 0 && !loading && (
          <Text style={styles.empty}>No packet orders</Text>
        )}

        {orders.map((order) => (
          <TouchableOpacity key={order.id} style={styles.orderCard}>
            <View style={styles.leftBlock}>
              <Text style={styles.orderId}>Order #{order.id}</Text>

              {order.customer_name && (
                <Text style={styles.customerName}>{order.customer_name}</Text>
              )}

              <Text style={styles.status}>
                {order.status === "preparing" && "Preparing"}
                {order.status === "ready" && "Ready for pickup"}
                {order.status === "packed" && "Packed"}
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

/* ------------------------------------------------------------
   Styles — Enterprise Packet Orders UI
------------------------------------------------------------ */

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

  content: { padding: 24, paddingBottom: 160 },

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
  },

  leftBlock: {
    flex: 1,
    paddingRight: 14,
  },

  orderId: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },

  customerName: {
    fontSize: 15,
    marginTop: 4,
    color: "#374151",
  },

  status: {
    marginTop: 8,
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "600",
  },

  time: {
    marginTop: 4,
    fontSize: 12,
    color: "#9CA3AF",
  },

  total: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    alignSelf: "center",
  },
});
