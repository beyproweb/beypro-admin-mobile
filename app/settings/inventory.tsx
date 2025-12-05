import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStock } from "../../src/context/StockContext";
import { useTranslation } from "react-i18next";
import { useCurrency } from "../../src/context/CurrencyContext";
import { usePermissions } from "../../src/hooks/usePermissions";
import StockItemCard from "../../src/components/stock/StockItemCard";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppearance } from "../../src/context/AppearanceContext";

export default function InventoryPage() {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { isDark } = useAppearance();
  const insets = useSafeAreaInsets();
  const { hasPermission } = usePermissions();
  const {
    groupedData,
    loading,
    error,
    fetchStock,
    handleDeleteStock,
    handleCriticalChange,
    handleReorderChange,
  } = useStock();

  const [selectedSupplier, setSelectedSupplier] = useState("__all__");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);

  // Permission check
  const hasStockAccess = hasPermission("stock");

  useEffect(() => {
    if (!hasStockAccess) {
      Alert.alert(t("Access Denied"), t("You do not have permission to view Stock."));
    }
  }, [hasStockAccess, t]);

  // Fetch stock on mount
  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  // Extract suppliers
  useEffect(() => {
    const suppliers = Array.from(
      new Set(groupedData.map(i => i.supplier_name || i.supplier).filter(Boolean))
    ) as string[];
    setAllSuppliers(suppliers);
  }, [groupedData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStock();
    setRefreshing(false);
  }, [fetchStock]);

  // Calculate KPIs
  const totalStockValue = useMemo(() => {
    return groupedData.reduce(
      (acc, item) =>
        acc + (Number(item.quantity) || 0) * (Number(item.price_per_unit) || 0),
      0
    );
  }, [groupedData]);

  const totalItems = groupedData.length;
  const totalUnitsOnHand = groupedData.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0),
    0
  );
  const lowStockCount = groupedData.filter((item) => {
    if (item.critical_quantity === null || item.critical_quantity === undefined) {
      return false;
    }
    return Number(item.quantity ?? 0) <= Number(item.critical_quantity ?? 0);
  }).length;

  // Filter items
  let filtered = groupedData;
  if (selectedSupplier !== "__all__") {
    filtered = filtered.filter(
      (item) => (item.supplier_name || item.supplier) === selectedSupplier
    );
  }
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.supplier || "").toLowerCase().includes(term)
    );
  }

  if (!hasStockAccess) {
    return (
      <View style={styles.accessDeniedContainer}>
        <MaterialCommunityIcons name="lock" size={48} color="#dc2626" />
        <Text style={styles.accessDeniedText}>{t("Access Denied")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero Section */}
        <LinearGradient
          colors={["#4f46e5", "#7c3aed", "#0ea5e9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <Text style={styles.heroSubtitle}>{t("Inventory Management")}</Text>
          <Text style={styles.heroTitle}>{t("Stock Levels")}</Text>
          <Text style={styles.heroDescription}>
            {t("Monitor and manage inventory from settings")}
          </Text>

          {/* Total Stock Value */}
          <View style={styles.valueCard}>
            <Text style={styles.valueLabel}>{t("Total Stock Value")}</Text>
            <Text style={styles.valueText}>{formatCurrency(totalStockValue)}</Text>
          </View>
        </LinearGradient>

        {/* KPI Cards */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiRow}>
            <StatCard
              title={t("Items")}
              value={totalItems.toLocaleString()}
              icon="package-variant"
              color="#0ea5e9"
            />
            <StatCard
              title={t("Units")}
              value={totalUnitsOnHand.toLocaleString()}
              icon="cube"
              color="#10b981"
            />
          </View>
          <View style={styles.kpiRow}>
            <StatCard
              title={t("Low Stock")}
              value={lowStockCount.toLocaleString()}
              icon="alert"
              color="#ef4444"
            />
            <StatCard
              title={t("Suppliers")}
              value={allSuppliers.length.toLocaleString()}
              icon="truck"
              color="#f59e0b"
            />
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          {/* Supplier Filter */}
          <View style={styles.supplierFilterCard}>
            <Text style={styles.filterLabel}>{t("Filter by Supplier")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.supplierScroll}
              contentContainerStyle={styles.supplierScrollContent}
            >
              <TouchableOpacity
                onPress={() => setSelectedSupplier("__all__")}
                style={[
                  styles.supplierPill,
                  selectedSupplier === "__all__" && styles.supplierPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.supplierPillText,
                    selectedSupplier === "__all__" && styles.supplierPillTextActive,
                  ]}
                >
                  {t("All")}
                </Text>
              </TouchableOpacity>
              {allSuppliers.map((supplier) => (
                <TouchableOpacity
                  key={supplier}
                  onPress={() => setSelectedSupplier(supplier)}
                  style={[
                    styles.supplierPill,
                    selectedSupplier === supplier && styles.supplierPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.supplierPillText,
                      selectedSupplier === supplier && styles.supplierPillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {supplier}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color="#9ca3af" />
            <TextInput
              placeholder={t("Search product...")}
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Stock Items or Empty State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.loadingText}>{t("Loading stock...")}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="inbox" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>{t("No stock items found")}</Text>
            <Text style={styles.emptySubtitle}>
              {t("Try adjusting your search or filters")}
            </Text>
          </View>
        ) : (
          <View style={styles.itemsContainer}>
            {filtered.map((item, index) => (
              <StockItemCard
                key={index}
                item={item}
                index={index}
                onCriticalChange={handleCriticalChange}
                onReorderChange={handleReorderChange}
                onDelete={() => handleDeleteStock(item)}
              />
            ))}
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },

  // Access Denied
  accessDeniedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
  },
  accessDeniedText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    color: "#dc2626",
  },

  // Hero Section
  heroSection: {
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255, 255, 255, 0.7)",
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
  },
  heroDescription: {
    marginTop: 8,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  valueCard: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.7)",
  },
  valueText: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },

  // KPI Cards
  kpiContainer: {
    marginBottom: 16,
    gap: 8,
    paddingHorizontal: 16,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statIconContainer: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#9ca3af",
  },
  statValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  // Filters
  filtersContainer: {
    marginBottom: 16,
    gap: 12,
    paddingHorizontal: 16,
  },
  supplierFilterCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 8,
  },
  supplierScroll: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  supplierScrollContent: {
    gap: 8,
  },
  supplierPill: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f3f4f6",
  },
  supplierPillActive: {
    backgroundColor: "#4f46e5",
  },
  supplierPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  supplierPillTextActive: {
    color: "#ffffff",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },

  // Loading & Empty States
  loadingContainer: {
    marginTop: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#9ca3af",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#6b7280",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#9ca3af",
  },

  // Items
  itemsContainer: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Error
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
  },
});
