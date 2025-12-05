import { View, Text, StyleSheet } from "react-native";
import { useAppearance } from "../../context/AppearanceContext";

export default function StatsRow() {
  const { isDark, fontScale } = useAppearance();

  return (
    <View style={styles.container}>
      <View style={[styles.stat, isDark && styles.statDark]}>
        <Text
          style={[
            styles.value,
            isDark && styles.valueDark,
            { fontSize: 20 * fontScale },
          ]}
        >
          92%
        </Text>
        <Text
          style={[
            styles.label,
            isDark && styles.labelDark,
            { fontSize: 12 * fontScale },
          ]}
        >
          Order Accuracy
        </Text>
      </View>

      <View style={[styles.stat, isDark && styles.statDark]}>
        <Text
          style={[
            styles.value,
            isDark && styles.valueDark,
            { fontSize: 20 * fontScale },
          ]}
        >
          18m
        </Text>
        <Text
          style={[
            styles.label,
            isDark && styles.labelDark,
            { fontSize: 12 * fontScale },
          ]}
        >
          Avg Prep Time
        </Text>
      </View>

      <View style={[styles.stat, isDark && styles.statDark]}>
        <Text
          style={[
            styles.value,
            isDark && styles.valueDark,
            { fontSize: 20 * fontScale },
          ]}
        >
          12
        </Text>
        <Text
          style={[
            styles.label,
            isDark && styles.labelDark,
            { fontSize: 12 * fontScale },
          ]}
        >
          Pending Tasks
        </Text>
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
  statDark: {
    backgroundColor: "#020617",
    shadowOpacity: 0.2,
  },

  value: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
  },
  valueDark: {
    color: "#F9FAFB",
  },

  label: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  labelDark: {
    color: "#9CA3AF",
  },
});
