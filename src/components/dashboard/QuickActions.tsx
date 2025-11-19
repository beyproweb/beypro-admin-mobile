import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function QuickActions() {
  return (
    <View style={styles.row}>
      <Action icon="🧾" label="Orders" goto="/orders" />
      <Action icon="👨‍🍳" label="Kitchen" goto="/orders/kitchen" />
      <Action icon="🍔" label="Products" goto="/products" />
      <Action icon="📦" label="Stock" goto="/stock" />
    </View>
  );
}

function Action({ icon, label, goto }: any) {
  return (
    <TouchableOpacity style={styles.box} onPress={() => router.push(goto)}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  box: {
    width: "23%",
    backgroundColor: "#fff",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  icon: {
    fontSize: 26,
  },
  text: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#111",
  },
});
