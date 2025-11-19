import { View, Text, StyleSheet } from "react-native";

export default function StatsRow() {
  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Text style={styles.value}>92%</Text>
        <Text style={styles.label}>Order Accuracy</Text>
      </View>

      <View style={styles.stat}>
        <Text style={styles.value}>18m</Text>
        <Text style={styles.label}>Avg Prep Time</Text>
      </View>

      <View style={styles.stat}>
        <Text style={styles.value}>12</Text>
        <Text style={styles.label}>Pending Tasks</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  stat: {
    width: "32%",
    backgroundColor: "white",
    paddingVertical: 18,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  value: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
  },

  label: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
});
