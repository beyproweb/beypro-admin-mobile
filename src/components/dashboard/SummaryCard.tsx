import { View, Text, StyleSheet } from "react-native";
import { useAppearance } from "../../context/AppearanceContext";

export default function SummaryCard({ sales, orders, alerts }: any) {
  const { isDark, fontScale } = useAppearance();

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <Text
        style={[
          styles.value,
          isDark && styles.valueDark,
          { fontSize: 32 * fontScale },
        ]}
      >
        {sales}
      </Text>
      <Text
        style={[
          styles.label,
          isDark && styles.labelDark,
          { fontSize: 16 * fontScale },
        ]}
      >
        Today’s Sales
      </Text>

      <View style={styles.row}>
        <Text
          style={[
            styles.stat,
            isDark && styles.statDark,
            { fontSize: 14 * fontScale },
          ]}
        >
          📦 {orders} Orders
        </Text>
        <Text
          style={[
            styles.stat,
            isDark && styles.statDark,
            { fontSize: 14 * fontScale },
          ]}
        >
          ⚠️ {alerts} Alerts
        </Text>
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
  cardDark: {
    backgroundColor: "#020617",
    shadowOpacity: 0.2,
  },
  value: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111",
  },
  valueDark: {
    color: "#F9FAFB",
  },
  label: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 10,
  },
  labelDark: {
    color: "#9CA3AF",
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
  statDark: {
    color: "#E5E7EB",
  },
});
