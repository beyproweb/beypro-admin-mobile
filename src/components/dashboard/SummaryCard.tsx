import { View, Text, StyleSheet } from "react-native";

export default function SummaryCard({ sales, orders, alerts }: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{sales}</Text>
      <Text style={styles.label}>Today’s Sales</Text>

      <View style={styles.row}>
        <Text style={styles.stat}>📦 {orders} Orders</Text>
        <Text style={styles.stat}>⚠️ {alerts} Alerts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  value: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111",
  },
  label: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
  },
});
