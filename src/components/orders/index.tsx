// app/orders/index.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function OrdersIndex() {
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <Text style={styles.headerSubtitle}>Select an order category</Text>
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* ---------- DINE-IN ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/tables")}
        >
          <View>
            <Text style={styles.cardTitle}>Dine-In Tables</Text>
            <Text style={styles.cardDesc}>Active table orders</Text>
          </View>
        </TouchableOpacity>

        {/* ---------- TAKEAWAY ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/takeaway")}
        >
          <View>
            <Text style={styles.cardTitle}>Takeaway</Text>
            <Text style={styles.cardDesc}>Pickup orders overview</Text>
          </View>
        </TouchableOpacity>

        {/* ---------- DELIVERY ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/phone")}
        >
          <View>
            <Text style={styles.cardTitle}>Delivery</Text>
            <Text style={styles.cardDesc}>Phone delivery orders</Text>
          </View>
        </TouchableOpacity>

        {/* ---------- PACKET ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/packet")}
        >
          <View>
            <Text style={styles.cardTitle}>Packet Orders</Text>
            <Text style={styles.cardDesc}>Bagged / packaged orders</Text>
          </View>
        </TouchableOpacity>

        {/* ---------- KITCHEN ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/kitchen")}
        >
          <View>
            <Text style={styles.cardTitle}>Kitchen</Text>
            <Text style={styles.cardDesc}>Live preparation queue</Text>
          </View>
        </TouchableOpacity>

        {/* ---------- HISTORY ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/history")}
        >
          <View>
            <Text style={styles.cardTitle}>History</Text>
            <Text style={styles.cardDesc}>Completed orders & payments</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
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

  content: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 150,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },

  cardDesc: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
});

