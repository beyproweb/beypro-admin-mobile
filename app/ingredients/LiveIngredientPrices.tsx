import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import secureFetch from "../../src/api/secureFetch";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useTranslation } from "react-i18next";

interface IngredientPrice {
  name: string;
  supplier: string;
  unit: string;
  price_per_unit: number;
  previous_price: number | null;
  reason: string;
}

type LiveIngredientPricesProps = {
  compact?: boolean;
  maxItems?: number;
};

const getPriceChangeIcon = (
  current: number,
  previous: number | null
): React.ReactNode => {
  if (previous == null) return null;
  if (current > previous)
    return <Ionicons name="arrow-up" size={18} color="#10B981" />;
  if (current < previous)
    return <Ionicons name="arrow-down" size={18} color="#EF4444" />;
  return <Ionicons name="remove" size={18} color="#9CA3AF" />;
};

export default function LiveIngredientPrices({
  compact = false,
  maxItems,
}: LiveIngredientPricesProps) {
  const { isDark } = useAppearance();
  const { t } = useTranslation();
  const [prices, setPrices] = useState<IngredientPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const res = await secureFetch("/ingredient-prices");
      setPrices(Array.isArray(res) ? res : []);
    } catch (err) {
      setPrices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPrices();
    setRefreshing(false);
  };

  const limitedData = useMemo(() => {
    if (!compact) return prices;
    const cap = typeof maxItems === "number" ? maxItems : 4;
    return prices.slice(0, cap);
  }, [prices, compact, maxItems]);

  const renderItem = ({ item }: { item: IngredientPrice }) => (
    <View
      style={[
        styles.row,
        isDark && styles.rowDark,
        compact && styles.rowCompact,
      ]}
    >
      <View style={styles.nameCol}>
        <Text
          style={[
            styles.name,
            isDark && styles.nameDark,
            compact && styles.nameCompact,
          ]}
          numberOfLines={1}
        >
          {item.name || t("Unknown")}
        </Text>
        {!!item.supplier && (
          <Text
            style={[styles.supplier, compact && styles.supplierCompact]}
            numberOfLines={1}
          >
            {item.supplier}
          </Text>
        )}
      </View>
      <Text style={[styles.unit, compact && styles.unitCompact]}>
        {item.unit || "—"}
      </Text>
      <Text style={[styles.price, compact && styles.priceCompact]}>
        {item.price_per_unit ?? "—"}
      </Text>
      {!compact && (
        <Text style={styles.pricePrev}>{item.previous_price ?? "—"}</Text>
      )}
      <View style={[styles.iconCol, compact && styles.iconCompact]}>
        {getPriceChangeIcon(item.price_per_unit, item.previous_price)}
      </View>
      {!compact && <Text style={styles.reason}>{item.reason}</Text>}
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        compact && styles.containerCompact,
      ]}
    >
      {!compact && (
        <Text style={[styles.title, isDark && styles.titleDark]}>
          🧪 {t("Live Ingredient Prices")}
        </Text>
      )}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#F59E0B"
          style={{ marginTop: 32 }}
        />
      ) : (
        <FlatList
          data={limitedData}
          keyExtractor={(_, idx) => idx.toString()}
          renderItem={renderItem}
          scrollEnabled={!compact}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              enabled={!compact}
            />
          }
          contentContainerStyle={compact && styles.listCompact}
          ListHeaderComponent={() => (
            <View
              style={[
                styles.headerRow,
                isDark && styles.headerRowDark,
                compact && styles.headerRowCompact,
              ]}
            >
              <Text
                style={[styles.headerText, compact && styles.headerTextCompact]}
              >
                {t("Ingredient")}
              </Text>
              <Text
                style={[styles.headerText, compact && styles.headerTextCompact]}
              >
                {t("Unit")}
              </Text>
              <Text
                style={[styles.headerText, compact && styles.headerTextCompact]}
              >
                {t("Current")}
              </Text>
              {!compact && <Text style={styles.headerText}>{t("Last")}</Text>}
              <Text
                style={[styles.headerText, compact && styles.headerTextCompact]}
              >
                {t("Change")}
              </Text>
              {!compact && <Text style={styles.headerText}>{t("Reason")}</Text>}
            </View>
          )}
        />
      )}
      {!compact && (
        <Text style={styles.note}>
          {t(
            "Live updates every 10 seconds. Green = up, Red = down, Gray = no change."
          )}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  containerDark: { backgroundColor: "#181c24" },
  containerCompact: { paddingHorizontal: 0, paddingVertical: 0 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#23283a",
  },
  titleDark: { color: "#fff" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingBottom: 8,
    marginBottom: 8,
  },
  headerRowDark: { borderColor: "#23283a" },
  headerRowCompact: { paddingBottom: 4, marginBottom: 4 },
  headerText: { flex: 1, fontWeight: "bold", color: "#888" },
  headerTextCompact: { fontSize: 12, color: "#9CA3AF" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#f3f3f3",
  },
  rowDark: { borderColor: "#23283a" },
  rowCompact: { paddingVertical: 6 },
  nameCol: { flex: 2 },
  name: { fontWeight: "600", fontSize: 16, color: "#23283a" },
  nameCompact: { fontSize: 14 },
  nameDark: { color: "#fff" },
  supplier: { fontSize: 12, color: "#888" },
  supplierCompact: { fontSize: 11, color: "#9CA3AF" },
  unit: { flex: 1, color: "#888" },
  unitCompact: { fontSize: 12 },
  price: { flex: 1, color: "#10B981", fontWeight: "bold" },
  priceCompact: { fontSize: 14 },
  pricePrev: { flex: 1, color: "#aaa" },
  iconCol: { flex: 0.7, alignItems: "center" },
  iconCompact: { flex: 0.5 },
  reason: { flex: 2, color: "#8ef" },
  note: { marginTop: 16, color: "#888", fontSize: 13, textAlign: "center" },
  listCompact: { paddingBottom: 4 },
});
