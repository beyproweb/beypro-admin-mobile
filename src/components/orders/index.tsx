// app/orders/index.tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAppearance } from "../../context/AppearanceContext";

export default function OrdersIndex() {
  const { isDark, fontScale } = useAppearance();

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
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
          Orders
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            isDark && styles.headerSubtitleDark,
            { fontSize: 14 * fontScale },
          ]}
        >
          Select an order category
        </Text>
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* ---------- DINE-IN ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/tables")}
        >
          <View>
            <Text
              style={[
                styles.cardTitle,
                { fontSize: 18 * fontScale },
              ]}
            >
              Dine-In Tables
            </Text>
            <Text
              style={[
                styles.cardDesc,
                { fontSize: 14 * fontScale },
              ]}
            >
              Active table orders
            </Text>
          </View>
        </TouchableOpacity>

        {/* ---------- TAKEAWAY ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/takeaway")}
        >
          <View>
            <Text
              style={[
                styles.cardTitle,
                { fontSize: 18 * fontScale },
              ]}
            >
              Takeaway
            </Text>
            <Text
              style={[
                styles.cardDesc,
                { fontSize: 14 * fontScale },
              ]}
            >
              Pickup orders overview
            </Text>
          </View>
        </TouchableOpacity>

        {/* ---------- PACKET ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/packet")}
        >
          <View>
            <Text
              style={[
                styles.cardTitle,
                { fontSize: 18 * fontScale },
              ]}
            >
              Packet Orders
            </Text>
            <Text
              style={[
                styles.cardDesc,
                { fontSize: 14 * fontScale },
              ]}
            >
              Bagged / packaged orders
            </Text>
          </View>
        </TouchableOpacity>

        {/* ---------- KITCHEN ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/kitchen")}
        >
          <View>
            <Text
              style={[
                styles.cardTitle,
                { fontSize: 18 * fontScale },
              ]}
            >
              Kitchen
            </Text>
            <Text
              style={[
                styles.cardDesc,
                { fontSize: 14 * fontScale },
              ]}
            >
              Live preparation queue
            </Text>
          </View>
        </TouchableOpacity>

        {/* ---------- HISTORY ---------- */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/orders/history")}
        >
          <View>
            <Text
              style={[
                styles.cardTitle,
                { fontSize: 18 * fontScale },
              ]}
            >
              History
            </Text>
            <Text
              style={[
                styles.cardDesc,
                { fontSize: 14 * fontScale },
              ]}
            >
              Completed orders & payments
            </Text>
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
  containerDark: {
    backgroundColor: "#020617",
  },

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
