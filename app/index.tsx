// app/index.tsx
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useEffect } from "react";
import { router } from "expo-router";
import BottomNav from "../src/components/navigation/BottomNav";
import { useAuth } from "../src/context/AuthContext";

export default function Dashboard() {
  const { user, loading } = useAuth();

  // Redirect only after loading is finished
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user]);

  if (!user) return null;

  return (
    <View style={styles.container}>
      {/* ---------------------------------------------------- */}
      {/* HEADER */}
      {/* ---------------------------------------------------- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Beypro Admin</Text>
        <Text style={styles.headerSubtitle}>Daily Operations Overview</Text>
      </View>

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT */}
      {/* ---------------------------------------------------- */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pagePadding}
      >
        {/* ===================== KPI CARDS ===================== */}
        <View style={styles.section}>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Sales</Text>
              <Text style={styles.kpiValue}>₺4,520</Text>
              <Text style={styles.kpiSub}>Today</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Orders</Text>
              <Text style={styles.kpiValue}>86</Text>
              <Text style={styles.kpiSub}>Completed</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Avg. Order</Text>
              <Text style={styles.kpiValue}>₺52.56</Text>
              <Text style={styles.kpiSub}>Per transaction</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Low Stock</Text>
              <Text style={[styles.kpiValue, styles.warning]}>2</Text>
              <Text style={styles.kpiSub}>Items</Text>
            </View>
          </View>
        </View>

        {/* ===================== QUICK ACTIONS ===================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridItemTitle}>Orders</Text>
              <Text style={styles.gridItemDesc}>Tables / Delivery</Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridItemTitle}>Kitchen</Text>
              <Text style={styles.gridItemDesc}>Live queue</Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridItemTitle}>Products</Text>
              <Text style={styles.gridItemDesc}>Menu & pricing</Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridItemTitle}>Inventory</Text>
              <Text style={styles.gridItemDesc}>Stock & suppliers</Text>
            </View>
          </View>
        </View>

        {/* ===================== OPERATIONS OVERVIEW ===================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operations</Text>

          <View style={styles.operationCard}>
            <Text style={styles.operationTitle}>Live Kitchen Status</Text>
            <Text style={styles.operationSub}>• 6 orders in preparation</Text>
            <Text style={styles.operationSub}>• Avg prep time: 11m</Text>
          </View>

          <View style={styles.operationCard}>
            <Text style={styles.operationTitle}>Delivery Overview</Text>
            <Text style={styles.operationSub}>• 3 active deliveries</Text>
            <Text style={styles.operationSub}>• Avg delivery: 17m</Text>
          </View>
        </View>

        {/* ===================== INSIGHTS ===================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Insights</Text>

          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Revenue Trend</Text>
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartText}>Chart Placeholder</Text>
            </View>
          </View>

          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Category Breakdown</Text>
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartText}>Chart Placeholder</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

/* ================================================================
   Styles — Premium Enterprise UI
================================================================ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F7" },

  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },

  pagePadding: { paddingBottom: 120, paddingHorizontal: 24 },

  section: { marginTop: 28 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#111827",
  },

  /* KPI CARDS */
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  kpiCard: {
    width: "48%",
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  kpiLabel: { fontSize: 14, color: "#6B7280", marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: "700", color: "#111827" },
  kpiSub: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  warning: { color: "#D97706" },

  /* QUICK ACTION GRID */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  gridItem: {
    width: "48%",
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    marginBottom: 16,
  },

  gridItemTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  gridItemDesc: { marginTop: 4, fontSize: 13, color: "#6B7280" },

  /* OPERATIONS */
  operationCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },

  operationTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  operationSub: { marginTop: 4, fontSize: 13, color: "#6B7280" },

  /* INSIGHTS */
  insightCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },

  insightTitle: { fontSize: 16, fontWeight: "600", marginBottom: 10 },

  chartPlaceholder: {
    height: 160,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chartText: { color: "#9CA3AF" },
});
