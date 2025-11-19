// app/orders/history.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import api from "../../src/api/axiosClient";

/* ================================
   TYPES
=================================*/
type PaymentMethod =
  | "cash"
  | "card"
  | "yemeksepeti"
  | "getir"
  | "trendyol"
  | "multinet"
  | "sodexo"
  | "metropol"
  | "other";

interface OrderHistoryItem {
  id: number;
  total: number;
  created_at: string;
  order_type: "table" | "phone" | "packet" | "takeaway";
  table_number?: number | null;
  customer_name?: string | null;
  payment_method: PaymentMethod | null;
}

/* ================================
   COMPONENT
=================================*/

export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [visible, setVisible] = useState<boolean>(false);
  const [currentOrder, setCurrentOrder] = useState<OrderHistoryItem | null>(null);

  /* -------------------------------
     Fetch Data
  --------------------------------*/
  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get("/orders?status=completed");
      setOrders(res.data || []);
    } catch (err) {
      console.log("❌ Load history error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  /* -------------------------------
     Update Payment Method
  --------------------------------*/
  const updatePayment = async (method: PaymentMethod) => {
    if (!currentOrder) return;

    try {
      await api.put(`/orders/${currentOrder.id}/payment-method`, {
        payment_method: method,
      });

      setVisible(false);
      setCurrentOrder(null);
      loadHistory();
    } catch (err) {
      console.log("❌ Payment update failed:", err);
    }
  };

  /* -------------------------------
     Render Payment method label
  --------------------------------*/
  const formatPayment = (method: PaymentMethod | null) => {
    if (!method) return "No Payment";
    switch (method) {
      case "cash":
        return "Cash";
      case "card":
        return "Card";
      case "yemeksepeti":
        return "Yemeksepeti";
      case "getir":
        return "Getir";
      case "trendyol":
        return "Trendyol";
      case "multinet":
        return "Multinet";
      case "sodexo":
        return "Sodexo";
      case "metropol":
        return "Metropol";
      default:
        return "Other";
    }
  };

  /* -------------------------------
     RENDER
  --------------------------------*/
  return (
    <View style={styles.container}>
      {/* ----- HEADER ----- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order History</Text>
        <Text style={styles.headerSubtitle}>Completed orders overview</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.wrapper}
      >
        {orders.length === 0 && !loading && (
          <Text style={styles.empty}>No completed orders yet.</Text>
        )}

        {/* ----- ORDER CARDS ----- */}
        {orders.map((order) => (
          <TouchableOpacity
            key={order.id}
            onPress={() => {
              setCurrentOrder(order);
              setVisible(true);
            }}
            style={styles.orderCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.orderId}>Order #{order.id}</Text>

              {/* ORDER TYPE */}
              <Text style={styles.type}>
                {order.order_type === "table" &&
                  `Table ${order.table_number ?? "-"}`}
                {order.order_type === "phone" && "Phone Delivery"}
                {order.order_type === "packet" && "Packet Order"}
                {order.order_type === "takeaway" && "Takeaway"}
              </Text>

              {/* TIME */}
              <Text style={styles.time}>
                {new Date(order.created_at).toLocaleString()}
              </Text>

              {/* PAYMENT */}
              <Text style={styles.payment}>
                Payment: {formatPayment(order.payment_method)}
              </Text>
            </View>

            <Text style={styles.total}>₺{order.total}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ==========================
          PAYMENT METHOD MODAL
     ========================== */}
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Change Payment Method</Text>
            <Text style={styles.modalSubtitle}>
              Order #{currentOrder?.id}
            </Text>

            {/* PAYMENT OPTIONS */}
            {(
              [
                "cash",
                "card",
                "yemeksepeti",
                "getir",
                "trendyol",
                "multinet",
                "sodexo",
                "metropol",
                "other",
              ] as PaymentMethod[]
            ).map((method) => (
              <Pressable
                key={method}
                style={styles.methodBtn}
                onPress={() => updatePayment(method)}
              >
                <Text style={styles.methodText}>
                  {formatPayment(method)}
                </Text>
              </Pressable>
            ))}

            <Pressable
              style={styles.cancelBtn}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================================
   STYLES
=================================*/

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },

  header: {
    paddingTop: 60,
    paddingBottom: 22,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },

  wrapper: {
    padding: 24,
    paddingBottom: 150,
  },

  empty: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
    color: "#6B7280",
  },

  /* ORDER CARD */

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

  orderId: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  type: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },

  time: {
    marginTop: 6,
    fontSize: 12,
    color: "#9CA3AF",
  },

  payment: {
    marginTop: 6,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },

  total: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    alignSelf: "center",
  },

  /* MODAL */

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  modalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  modalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },

  methodBtn: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },

  methodText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },

  cancelBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },

  cancelText: {
    textAlign: "center",
    fontSize: 15,
    color: "#374151",
  },
});
