// app/orders/tables.tsx
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import api from "../../src/api/axiosClient";

type Table = {
  id: number;
  number: number;
  status?: string;
};

type Order = {
  id: number;
  table_number: number;
  total: number;
};

export default function TablesScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);

      const [tablesRes, openOrdersRes] = await Promise.all([
        api.get("/tables"),
        api.get("/orders?status=open"),
      ]);

      setTables(tablesRes.data || []);
      setOpenOrders(openOrdersRes.data || []);
    } catch (err) {
      console.log("❌ Tables screen error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dine-In Tables</Text>
        <Text style={styles.headerSubtitle}>Manage table orders</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!loading && tables.length === 0 && (
          <Text style={styles.emptyText}>No tables found</Text>
        )}

        <View style={styles.grid}>
          {tables.map((table) => {
            const tableOrders = openOrders.filter(
              (o) => o.table_number === table.number
            );

            const isActive = tableOrders.length > 0;
            const total = tableOrders.reduce((acc, o) => acc + o.total, 0);

            return (
              <TouchableOpacity key={table.id} style={styles.tableCard}>
                <Text style={styles.tableNumber}>Table {table.number}</Text>

                {isActive ? (
                  <>
                    <Text style={styles.tableStatusActive}>Active Order</Text>
                    <Text style={styles.tableTotal}>₺{total}</Text>
                  </>
                ) : (
                  <Text style={styles.tableStatusEmpty}>Empty</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------
   Styles — Professional Enterprise Look
------------------------------------------------------------ */
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
    padding: 24,
    paddingBottom: 160,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
    color: "#6B7280",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  tableCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  tableNumber: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },

  tableStatusActive: {
    marginTop: 6,
    color: "#16A34A",
    fontWeight: "600",
  },

  tableStatusEmpty: {
    marginTop: 6,
    color: "#6B7280",
  },

  tableTotal: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "700",
  },
});
