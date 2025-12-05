import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import { usePermissions } from "../../src/context/PermissionsContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import secureFetch from "../../src/api/secureFetch";
import { PermissionGate } from "../../src/components/PermissionGate";
import LiveIngredientPrices from "./LiveIngredientPrices";

type Ingredient = {
  id: string | number;
  name: string;
  unit?: string;
  quantity?: number;
  price?: number;
  old_price?: number;
  supplier?: string;
  reorder_level?: number;
  category?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

type PriceHistory = {
  [key: string]: { oldPrice: number; newPrice: number };
};

type IngredientOption = {
  name: string;
  unit: string;
};

export default function IngredientsScreen() {
  const { isDark } = useAppearance();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const { formatCurrency } = useCurrency();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [ingredientOptions, setIngredientOptions] = useState<
    IngredientOption[]
  >([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "quantity">("name");
  const [showLivePrice, setShowLivePrice] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    unit: "kg",
    quantity: "",
    price: "",
    supplier: "",
    reorder_level: "",
    category: "General",
    description: "",
  });

  // Fetch ingredients and suppliers
  const fetchIngredients = useCallback(async () => {
    try {
      setLoading(true);
      const stockData = await secureFetch("/stock").catch((err) => {
        console.error("❌ Failed to fetch /stock:", err);
        return [];
      });
      const suppliersData = await secureFetch("/suppliers").catch((err) => {
        console.error("❌ Failed to fetch /suppliers:", err);
        return [];
      });

      console.log("📦 Stock/Ingredients fetched:", stockData);
      console.log("🏪 Suppliers fetched:", suppliersData);

      // Track price changes
      const newPriceHistory: PriceHistory = {};

      // Convert stock items to ingredients format
      const ingredientsArray = Array.isArray(stockData)
        ? stockData.map((item: any) => {
            const id = item.stock_id || item.id;
            const currentPrice = item.price_per_unit || item.price;

            // Find old price from existing ingredients
            const oldIngredient = ingredients.find((ing) => ing.id === id);
            if (
              oldIngredient &&
              oldIngredient.price &&
              currentPrice !== oldIngredient.price
            ) {
              newPriceHistory[id] = {
                oldPrice: Number(oldIngredient.price),
                newPrice: Number(currentPrice),
              };
            }

            return {
              id,
              name: item.name,
              unit: item.unit || "kg",
              quantity: item.quantity,
              price: currentPrice,
              supplier: item.supplier_name || item.supplier,
              reorder_level: item.critical_quantity || item.reorder_level,
              category: item.category,
              description: item.description,
              created_at: item.created_at,
              updated_at: item.updated_at,
            };
          })
        : [];

      setIngredients(ingredientsArray);
      if (Object.keys(newPriceHistory).length > 0) {
        setPriceHistory(newPriceHistory);
      }

      // Extract unique ingredient names with units
      const ingredientMap = new Map<string, string>();
      ingredientsArray.forEach((ing) => {
        if (ing.name) {
          ingredientMap.set(ing.name, ing.unit || "kg");
        }
      });
      const options = Array.from(ingredientMap.entries())
        .map(([name, unit]) => ({ name, unit }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setIngredientOptions(options);

      // Extract unique supplier names from suppliers or ingredients
      const supplierNames = new Set<string>();
      if (Array.isArray(suppliersData)) {
        suppliersData.forEach((s: any) => {
          if (s.name) supplierNames.add(s.name);
        });
      }
      if (Array.isArray(ingredientsArray)) {
        ingredientsArray.forEach((ing: Ingredient) => {
          if (ing.supplier) supplierNames.add(ing.supplier);
        });
      }
      setSuppliers(Array.from(supplierNames).sort());
    } catch (err) {
      console.error("❌ Failed to load ingredients:", err);
      Alert.alert(t("Error"), t("Failed to load ingredients"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  // Refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchIngredients();
    }, [fetchIngredients])
  );

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchIngredients();
    setRefreshing(false);
  }, [fetchIngredients]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      unit: "kg",
      quantity: "",
      price: "",
      supplier: "",
      reorder_level: "",
      category: "General",
      description: "",
    });
    setEditingId(null);
  };

  // Open modal for editing
  const handleEdit = (ingredient: Ingredient) => {
    setFormData({
      name: ingredient.name,
      unit: ingredient.unit || "kg",
      quantity: String(ingredient.quantity || ""),
      price: String(ingredient.price || ""),
      supplier: ingredient.supplier || "",
      reorder_level: String(ingredient.reorder_level || ""),
      category: ingredient.category || "General",
      description: ingredient.description || "",
    });
    setEditingId(ingredient.id);
    setModalOpen(true);
  };

  // Save ingredient
  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert(t("Error"), t("Ingredient name is required"));
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        unit: formData.unit,
        quantity: Number(formData.quantity) || 0,
        price: Number(formData.price) || 0,
        supplier: formData.supplier.trim(),
        reorder_level: Number(formData.reorder_level) || 0,
        category: formData.category,
        description: formData.description.trim(),
      };

      let result: Ingredient;
      if (editingId) {
        result = await secureFetch(`/ingredients/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setIngredients((prev) =>
          prev.map((ing) => (ing.id === editingId ? result : ing))
        );
        Alert.alert(t("Success"), t("Ingredient updated"));
      } else {
        result = await secureFetch("/ingredients", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setIngredients((prev) => [result, ...prev]);
        Alert.alert(t("Success"), t("Ingredient created"));
      }

      resetForm();
      setModalOpen(false);
    } catch (err) {
      console.error("❌ Failed:", err);
      Alert.alert(
        t("Error"),
        editingId ? t("Failed to update") : t("Failed to create")
      );
    }
  };

  // Delete ingredient
  const handleDelete = (id: string | number) => {
    Alert.alert(t("Delete"), t("Are you sure?"), [
      { text: t("Cancel") },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await secureFetch(`/ingredients/${id}`, { method: "DELETE" });
            setIngredients((prev) => prev.filter((ing) => ing.id !== id));
            Alert.alert(t("Success"), t("Ingredient deleted"));
          } catch (err) {
            console.error("❌ Failed:", err);
            Alert.alert(t("Error"), t("Failed to delete"));
          }
        },
      },
    ]);
  };

  // Get unique categories
  const categories = [
    "all",
    ...new Set(ingredients.map((ing) => ing.category || "General")),
  ];

  // Filter and sort
  const filteredIngredients = ingredients
    .filter((ing) => {
      const matchesSearch =
        !searchTerm.trim() ||
        ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ing.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" ||
        (ing.category || "General") === categoryFilter;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price":
          return (b.price || 0) - (a.price || 0);
        case "quantity":
          return (b.quantity || 0) - (a.quantity || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });

  // Stats
  const totalIngredients = ingredients.length;
  const lowStockCount = ingredients.filter(
    (ing) =>
      ing.quantity && ing.reorder_level && ing.quantity <= ing.reorder_level
  ).length;
  const totalValue = ingredients.reduce((sum, ing) => {
    return sum + (ing.price || 0) * (ing.quantity || 0);
  }, 0);

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            {t("Loading ingredients...")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <PermissionGate permission={["inventory", "products"]}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#F59E0B"
              colors={["#F59E0B"]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[styles.headerTitle, isDark && styles.headerTitleDark]}
            >
              🥘 {t("Ingredients")}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                isDark && styles.headerSubtitleDark,
              ]}
            >
              {t("Manage ingredient inventory")}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={styles.statIcon}>📦</Text>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                {t("Total")}
              </Text>
              <Text style={styles.statValue}>{totalIngredients}</Text>
            </View>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={styles.statIcon}>⚠️</Text>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                {t("Low Stock")}
              </Text>
              <Text
                style={[
                  styles.statValue,
                  lowStockCount > 0 && styles.statValueAlert,
                ]}
              >
                {lowStockCount}
              </Text>
            </View>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={styles.statIcon}>💰</Text>
              <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                {t("Total Value")}
              </Text>
              <Text style={styles.statValue}>{formatCurrency(totalValue)}</Text>
            </View>
          </View>

          {/* Price Analytics Cards */}
          <View style={styles.priceAnalyticsContainer}>
            <Text
              style={[
                styles.analyticsTitle,
                isDark && styles.analyticsTitleDark,
              ]}
            >
              💹 {t("Price Analytics")}
            </Text>

            {/* Top Expensive Ingredients */}
            <View
              style={[styles.analyticsCard, isDark && styles.analyticsCardDark]}
            >
              <View style={styles.analyticsCardHeader}>
                <Text
                  style={[
                    styles.analyticsCardTitle,
                    isDark && styles.analyticsCardTitleDark,
                  ]}
                >
                  💎 {t("Most Expensive")}
                </Text>
              </View>
              <View style={styles.analyticsCardContent}>
                {ingredients
                  .filter((ing) => ing.price)
                  .sort((a, b) => Number(b.price) - Number(a.price))
                  .slice(0, 3)
                  .map((ing, idx) => (
                    <View key={ing.id} style={styles.priceRow}>
                      <View style={styles.priceRowContent}>
                        <Text
                          style={[
                            styles.priceRowName,
                            isDark && styles.priceRowNameDark,
                          ]}
                        >
                          {idx + 1}. {ing.name}
                        </Text>
                        <Text
                          style={[
                            styles.priceRowCategory,
                            isDark && styles.priceRowCategoryDark,
                          ]}
                        >
                          {ing.category || "General"} • {ing.supplier || "N/A"}
                        </Text>
                      </View>
                      <Text style={styles.priceRowPrice}>
                        {formatCurrency(Number(ing.price))}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>

            {/* Average Price by Category */}
            <View
              style={[styles.analyticsCard, isDark && styles.analyticsCardDark]}
            >
              <View style={styles.analyticsCardHeader}>
                <Text
                  style={[
                    styles.analyticsCardTitle,
                    isDark && styles.analyticsCardTitleDark,
                  ]}
                >
                  📊 {t("Price by Category")}
                </Text>
              </View>
              <View style={styles.analyticsCardContent}>
                {(() => {
                  const categoryPrices: {
                    [key: string]: { total: number; count: number };
                  } = {};
                  ingredients.forEach((ing) => {
                    const cat = ing.category || "General";
                    if (!categoryPrices[cat]) {
                      categoryPrices[cat] = { total: 0, count: 0 };
                    }
                    if (ing.price) {
                      categoryPrices[cat].total += Number(ing.price);
                      categoryPrices[cat].count += 1;
                    }
                  });

                  return Object.entries(categoryPrices)
                    .map(([cat, data]) => ({
                      category: cat,
                      average: data.total / data.count,
                      count: data.count,
                    }))
                    .sort((a, b) => b.average - a.average)
                    .slice(0, 3)
                    .map((item) => (
                      <View key={item.category} style={styles.priceRow}>
                        <View style={styles.priceRowContent}>
                          <Text
                            style={[
                              styles.priceRowName,
                              isDark && styles.priceRowNameDark,
                            ]}
                          >
                            {item.category}
                          </Text>
                          <Text
                            style={[
                              styles.priceRowCategory,
                              isDark && styles.priceRowCategoryDark,
                            ]}
                          >
                            {item.count} {t("items")} • {t("avg")}
                          </Text>
                        </View>
                        <Text style={styles.priceRowPrice}>
                          {formatCurrency(item.average)}
                        </Text>
                      </View>
                    ));
                })()}
              </View>
            </View>

            {/* Price Change Tracker */}
            <View
              style={[styles.analyticsCard, isDark && styles.analyticsCardDark]}
            >
              <View style={styles.analyticsCardHeader}>
                <Text
                  style={[
                    styles.analyticsCardTitle,
                    isDark && styles.analyticsCardTitleDark,
                  ]}
                >
                  📈 {t("Inventory Investment")}
                </Text>
              </View>
              <View style={styles.investmentGrid}>
                <View style={styles.investmentItem}>
                  <Text
                    style={[
                      styles.investmentLabel,
                      isDark && styles.investmentLabelDark,
                    ]}
                  >
                    {t("Total Invested")}
                  </Text>
                  <Text style={styles.investmentValue}>
                    {formatCurrency(totalValue)}
                  </Text>
                </View>

                <View style={styles.investmentItem}>
                  <Text
                    style={[
                      styles.investmentLabel,
                      isDark && styles.investmentLabelDark,
                    ]}
                  >
                    {t("Avg Price")}
                  </Text>
                  <Text style={styles.investmentValue}>
                    {ingredients.length > 0
                      ? formatCurrency(
                          ingredients.reduce(
                            (sum, ing) => sum + Number(ing.price || 0),
                            0
                          ) / ingredients.length
                        )
                      : "$0.00"}
                  </Text>
                </View>

                <View style={styles.investmentItem}>
                  <Text
                    style={[
                      styles.investmentLabel,
                      isDark && styles.investmentLabelDark,
                    ]}
                  >
                    {t("Items Tracked")}
                  </Text>
                  <Text style={styles.investmentValue}>
                    {ingredients.length}
                  </Text>
                </View>
              </View>
            </View>

            {/* Price Changes Card */}
            {Object.keys(priceHistory).length > 0 && (
              <View
                style={[
                  styles.analyticsCard,
                  isDark && styles.analyticsCardDark,
                ]}
              >
                <View style={styles.analyticsCardHeader}>
                  <Text
                    style={[
                      styles.analyticsCardTitle,
                      isDark && styles.analyticsCardTitleDark,
                    ]}
                  >
                    📊 {t("Price Changes")}
                  </Text>
                </View>
                <View style={styles.analyticsCardContent}>
                  {Object.entries(priceHistory).map(([ingId, prices]) => {
                    const ingredient = ingredients.find(
                      (ing) => ing.id === ingId || ing.id === Number(ingId)
                    );
                    if (!ingredient) return null;

                    const difference = prices.newPrice - prices.oldPrice;
                    const percentChange = (
                      (difference / prices.oldPrice) *
                      100
                    ).toFixed(1);
                    const isIncrease = difference > 0;
                    const isNoChange = difference === 0;

                    return (
                      <View
                        key={ingId}
                        style={[
                          styles.priceChangeRow,
                          isIncrease && styles.priceChangeRowUp,
                          !isIncrease &&
                            !isNoChange &&
                            styles.priceChangeRowDown,
                        ]}
                      >
                        <View style={styles.priceChangeContent}>
                          <Text
                            style={[
                              styles.priceChangeName,
                              isDark && styles.priceChangeNameDark,
                            ]}
                            numberOfLines={1}
                          >
                            {ingredient.name}
                          </Text>
                          <View style={styles.priceChangeValues}>
                            <View style={styles.priceChangeValue}>
                              <Text
                                style={[
                                  styles.priceChangeLabel,
                                  isDark && styles.priceChangeLabelDark,
                                ]}
                              >
                                {t("Before")}
                              </Text>
                              <Text style={styles.priceChangeOld}>
                                {formatCurrency(prices.oldPrice)}
                              </Text>
                            </View>
                            <Ionicons
                              name={
                                isIncrease
                                  ? "arrow-forward"
                                  : isNoChange
                                    ? "remove"
                                    : "arrow-back"
                              }
                              size={16}
                              color={
                                isIncrease
                                  ? "#EF4444"
                                  : isNoChange
                                    ? "#9CA3AF"
                                    : "#10B981"
                              }
                              style={styles.priceChangeArrow}
                            />
                            <View style={styles.priceChangeValue}>
                              <Text
                                style={[
                                  styles.priceChangeLabel,
                                  isDark && styles.priceChangeLabelDark,
                                ]}
                              >
                                {t("After")}
                              </Text>
                              <Text
                                style={[
                                  styles.priceChangeNew,
                                  isIncrease && styles.priceChangeNewUp,
                                  !isIncrease &&
                                    !isNoChange &&
                                    styles.priceChangeNewDown,
                                ]}
                              >
                                {formatCurrency(prices.newPrice)}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.priceChangeBadge,
                            isIncrease && styles.priceChangeBadgeUp,
                            !isIncrease &&
                              !isNoChange &&
                              styles.priceChangeBadgeDown,
                          ]}
                        >
                          <Text
                            style={[
                              styles.priceChangeBadgeText,
                              isIncrease && styles.priceChangeBadgeTextUp,
                              !isIncrease &&
                                !isNoChange &&
                                styles.priceChangeBadgeTextDown,
                            ]}
                          >
                            {isNoChange ? "—" : isIncrease ? "+" : ""}
                            {isNoChange ? "0%" : `${percentChange}%`}
                          </Text>
                          <Text
                            style={[
                              styles.priceChangeDiff,
                              isIncrease && styles.priceChangeDiffUp,
                              !isIncrease &&
                                !isNoChange &&
                                styles.priceChangeDiffDown,
                            ]}
                          >
                            {isNoChange ? "" : isIncrease ? "+" : ""}
                            {formatCurrency(difference)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={18}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
              <TextInput
                style={[styles.searchInput, isDark && styles.searchInputDark]}
                placeholder={t("Search ingredients...")}
                placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>

            {/* Category Filter */}
            <Text
              style={[styles.filterLabel, isDark && styles.filterLabelDark]}
            >
              {t("Category")}
            </Text>
            <View style={styles.filterRow}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterButton,
                    categoryFilter === category && styles.filterButtonActive,
                  ]}
                  onPress={() => setCategoryFilter(category)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      categoryFilter === category &&
                        styles.filterButtonTextActive,
                    ]}
                  >
                    {t(category)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sort Options */}
            <Text
              style={[styles.filterLabel, isDark && styles.filterLabelDark]}
            >
              {t("Sort By")}
            </Text>
            <View style={styles.filterRow}>
              {(["name", "price", "quantity"] as const).map((sort) => (
                <TouchableOpacity
                  key={sort}
                  style={[
                    styles.filterButton,
                    sortBy === sort && styles.filterButtonActive,
                  ]}
                  onPress={() => setSortBy(sort)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      sortBy === sort && styles.filterButtonTextActive,
                    ]}
                  >
                    {t(sort)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                resetForm();
                setModalOpen(true);
              }}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>{t("Add Ingredient")}</Text>
            </TouchableOpacity>
          </View>

          {/* Live Ingredient Prices Button */}
          <View style={{ marginVertical: 16, alignItems: "center" }}>
            <TouchableOpacity
              style={{
                backgroundColor: "#23283a",
                borderRadius: 24,
                paddingVertical: 10,
                paddingHorizontal: 24,
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={() => setShowLivePrice(true)}
            >
              <Ionicons
                name="pulse"
                size={20}
                color="#F59E0B"
                style={{ marginRight: 8 }}
              />
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                {t("Live Ingredient Prices")}
              </Text>
            </TouchableOpacity>
          </View>
          {showLivePrice ? (
            <Modal
              visible={showLivePrice}
              animationType="slide"
              onRequestClose={() => setShowLivePrice(false)}
            >
              <LiveIngredientPrices />
              <TouchableOpacity
                style={{ position: "absolute", top: 40, right: 24, zIndex: 10 }}
                onPress={() => setShowLivePrice(false)}
              >
                <Ionicons name="close-circle" size={36} color="#F59E0B" />
              </TouchableOpacity>
            </Modal>
          ) : null}

          {/* Ingredients List */}
          {filteredIngredients.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                {t("No ingredients found")}
              </Text>
            </View>
          ) : (
            <View style={styles.ingredientList}>
              {filteredIngredients.map((ingredient) => {
                const isLowStock =
                  ingredient.quantity &&
                  ingredient.reorder_level &&
                  ingredient.quantity <= ingredient.reorder_level;

                return (
                  <View
                    key={ingredient.id}
                    style={[
                      styles.ingredientCard,
                      isDark && styles.ingredientCardDark,
                      ...(isLowStock ? [styles.ingredientCardWarning] : []),
                    ]}
                  >
                    <View style={styles.ingredientHeader}>
                      <View style={styles.ingredientInfo}>
                        <Text
                          style={[
                            styles.ingredientName,
                            isDark && styles.ingredientNameDark,
                          ]}
                          numberOfLines={1}
                        >
                          {ingredient.name}
                        </Text>
                        {ingredient.category && (
                          <Text
                            style={[
                              styles.ingredientCategory,
                              isDark && styles.ingredientCategoryDark,
                            ]}
                          >
                            {ingredient.category}
                          </Text>
                        )}
                      </View>

                      {isLowStock && (
                        <View style={styles.lowStockBadge}>
                          <Text style={styles.lowStockText}>⚠️ {t("Low")}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.ingredientDetails}>
                      {ingredient.quantity !== undefined && (
                        <View style={styles.detailItem}>
                          <Text
                            style={[
                              styles.detailLabel,
                              isDark && styles.detailLabelDark,
                            ]}
                          >
                            {t("Qty")}
                          </Text>
                          <Text style={styles.detailValue}>
                            {ingredient.quantity} {ingredient.unit}
                          </Text>
                        </View>
                      )}

                      {ingredient.price && (
                        <View style={styles.detailItem}>
                          <Text
                            style={[
                              styles.detailLabel,
                              isDark && styles.detailLabelDark,
                            ]}
                          >
                            {t("Price")}
                          </Text>
                          <Text style={styles.detailValue}>
                            {formatCurrency(Number(ingredient.price))}
                          </Text>
                        </View>
                      )}

                      {ingredient.supplier && (
                        <View style={styles.detailItem}>
                          <Text
                            style={[
                              styles.detailLabel,
                              isDark && styles.detailLabelDark,
                            ]}
                          >
                            {t("Supplier")}
                          </Text>
                          <Text style={styles.detailValue}>
                            {ingredient.supplier}
                          </Text>
                        </View>
                      )}
                    </View>

                    {ingredient.description && (
                      <Text
                        style={[
                          styles.description,
                          isDark && styles.descriptionDark,
                        ]}
                        numberOfLines={1}
                      >
                        {ingredient.description}
                      </Text>
                    )}

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEdit(ingredient)}
                      >
                        <Ionicons name="pencil" size={16} color="#06B6D4" />
                        <Text style={styles.editButtonText}>{t("Edit")}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(ingredient.id)}
                      >
                        <Ionicons name="trash" size={16} color="#EF4444" />
                        <Text style={styles.deleteButtonText}>
                          {t("Delete")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal
          visible={modalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setModalOpen(false)}
        >
          <View
            style={[styles.modalContainer, isDark && styles.modalContainerDark]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, isDark && styles.modalTitleDark]}
              >
                {editingId ? t("Edit Ingredient") : t("Add Ingredient")}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Name")} *
              </Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.dropdownInput,
                  isDark && styles.inputDark,
                ]}
                onPress={() => setShowNameDropdown(!showNameDropdown)}
              >
                <Text
                  style={[
                    formData.name
                      ? styles.dropdownValue
                      : styles.dropdownPlaceholder,
                    isDark && styles.dropdownValueDark,
                  ]}
                >
                  {formData.name || t("Select ingredient")}
                </Text>
                <Ionicons
                  name={showNameDropdown ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>

              {showNameDropdown && (
                <View style={[styles.dropdown, isDark && styles.dropdownDark]}>
                  {ingredientOptions.map((option) => (
                    <TouchableOpacity
                      key={`${option.name}-${option.unit}`}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({
                          ...formData,
                          name: option.name,
                          unit: option.unit,
                        });
                        setShowNameDropdown(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.dropdownItemText,
                            formData.name === option.name &&
                              styles.dropdownItemTextActive,
                          ]}
                        >
                          {option.name}
                        </Text>
                        <Text
                          style={[
                            styles.dropdownItemSubtext,
                            isDark && styles.dropdownItemSubtextDark,
                          ]}
                        >
                          {option.unit}
                        </Text>
                      </View>
                      {formData.name === option.name && (
                        <Ionicons name="checkmark" size={16} color="#F59E0B" />
                      )}
                    </TouchableOpacity>
                  ))}
                  {ingredientOptions.length === 0 && (
                    <Text
                      style={[
                        styles.dropdownItemText,
                        styles.dropdownEmptyText,
                      ]}
                    >
                      {t("No ingredients")}
                    </Text>
                  )}
                </View>
              )}

              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Or enter new ingredient")}
                value={formData.name}
                onChangeText={(v) => setFormData({ ...formData, name: v })}
              />

              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Category")}
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Category")}
                value={formData.category}
                onChangeText={(v) => setFormData({ ...formData, category: v })}
              />

              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Unit")}
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("kg, L, pieces, etc.")}
                value={formData.unit}
                onChangeText={(v) => setFormData({ ...formData, unit: v })}
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>
                    {t("Quantity")}
                  </Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
                    placeholder="0"
                    value={formData.quantity}
                    onChangeText={(v) =>
                      setFormData({ ...formData, quantity: v })
                    }
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.halfInput}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>
                    {t("Price")}
                  </Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
                    placeholder="0.00"
                    value={formData.price}
                    onChangeText={(v) => setFormData({ ...formData, price: v })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Reorder Level")}
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Low stock threshold")}
                value={formData.reorder_level}
                onChangeText={(v) =>
                  setFormData({ ...formData, reorder_level: v })
                }
                keyboardType="decimal-pad"
              />

              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Supplier")}
              </Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.dropdownInput,
                  isDark && styles.inputDark,
                ]}
                onPress={() => setShowSupplierDropdown(!showSupplierDropdown)}
              >
                <Text
                  style={[
                    formData.supplier
                      ? styles.dropdownValue
                      : styles.dropdownPlaceholder,
                    isDark && styles.dropdownValueDark,
                  ]}
                >
                  {formData.supplier || t("Select supplier")}
                </Text>
                <Ionicons
                  name={showSupplierDropdown ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>

              {showSupplierDropdown && (
                <View style={[styles.dropdown, isDark && styles.dropdownDark]}>
                  {suppliers.map((supplier) => (
                    <TouchableOpacity
                      key={supplier}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({ ...formData, supplier });
                        setShowSupplierDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          formData.supplier === supplier &&
                            styles.dropdownItemTextActive,
                        ]}
                      >
                        {supplier}
                      </Text>
                      {formData.supplier === supplier && (
                        <Ionicons name="checkmark" size={16} color="#F59E0B" />
                      )}
                    </TouchableOpacity>
                  ))}
                  {suppliers.length === 0 && (
                    <Text
                      style={[
                        styles.dropdownItemText,
                        styles.dropdownEmptyText,
                      ]}
                    >
                      {t("No suppliers")}
                    </Text>
                  )}
                </View>
              )}

              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Or enter new supplier")}
                value={formData.supplier}
                onChangeText={(v) => setFormData({ ...formData, supplier: v })}
              />

              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Description")}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputMultiline,
                  isDark && styles.inputDark,
                ]}
                placeholder={t("Notes")}
                value={formData.description}
                onChangeText={(v) =>
                  setFormData({ ...formData, description: v })
                }
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {editingId ? t("Update") : t("Create")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        <BottomNav />
      </View>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F7",
  },
  containerDark: {
    backgroundColor: "#020617",
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  loadingTextDark: {
    color: "#9CA3AF",
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerTitleDark: {
    color: "#F3F4F6",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  statLabelDark: {
    color: "#9CA3AF",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 4,
  },
  statValueAlert: {
    color: "#EF4444",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    color: "#1F2937",
  },
  searchInputDark: {
    color: "#F3F4F6",
    backgroundColor: "#111827",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  filterLabelDark: {
    color: "#D1D5DB",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  filterButtonActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  addButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
  ingredientList: {
    gap: 12,
  },
  ingredientCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ingredientCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  ingredientCardWarning: {
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  ingredientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  ingredientNameDark: {
    color: "#F3F4F6",
  },
  ingredientCategory: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  ingredientCategoryDark: {
    color: "#9CA3AF",
  },
  lowStockBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  lowStockText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  ingredientDetails: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 8,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  detailLabelDark: {
    color: "#9CA3AF",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F59E0B",
  },
  description: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 8,
  },
  descriptionDark: {
    color: "#9CA3AF",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#DBEAFE",
    borderRadius: 6,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369A1",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 20,
  },
  modalContainerDark: {
    backgroundColor: "#1F2937",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalTitleDark: {
    color: "#F3F4F6",
  },
  modalContent: {
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 6,
  },
  labelDark: {
    color: "#D1D5DB",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#1F2937",
    marginBottom: 12,
  },
  inputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#F3F4F6",
  },
  inputMultiline: {
    height: 70,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  dropdownInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropdownValue: {
    fontSize: 13,
    color: "#1F2937",
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: 13,
    color: "#9CA3AF",
    flex: 1,
  },
  dropdownValueDark: {
    color: "#F3F4F6",
  },
  dropdown: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 12,
    maxHeight: 200,
  },
  dropdownDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  dropdownItemText: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  dropdownItemTextActive: {
    color: "#F59E0B",
    fontWeight: "600",
  },
  dropdownItemSubtext: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  dropdownItemSubtextDark: {
    color: "#9CA3AF",
  },
  dropdownEmptyText: {
    textAlign: "center",
    paddingVertical: 12,
  },
  priceAnalyticsContainer: {
    marginBottom: 16,
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  analyticsTitleDark: {
    color: "#F3F4F6",
  },
  analyticsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  analyticsCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  analyticsCardHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  analyticsCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  analyticsCardTitleDark: {
    color: "#F3F4F6",
  },
  analyticsCardContent: {
    gap: 8,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
  },
  priceRowContent: {
    flex: 1,
    marginRight: 8,
  },
  priceRowName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
  },
  priceRowNameDark: {
    color: "#F3F4F6",
  },
  priceRowCategory: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  priceRowCategoryDark: {
    color: "#9CA3AF",
  },
  priceRowPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F59E0B",
    minWidth: 70,
    textAlign: "right",
  },
  investmentGrid: {
    flexDirection: "row",
    gap: 12,
  },
  investmentItem: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  investmentLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
  },
  investmentLabelDark: {
    color: "#9CA3AF",
  },
  investmentValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F59E0B",
  },
  priceChangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#9CA3AF",
  },
  priceChangeRowUp: {
    backgroundColor: "#FEF2F2",
    borderLeftColor: "#EF4444",
  },
  priceChangeRowDown: {
    backgroundColor: "#F0FDF4",
    borderLeftColor: "#10B981",
  },
  priceChangeContent: {
    flex: 1,
  },
  priceChangeName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  priceChangeNameDark: {
    color: "#F3F4F6",
  },
  priceChangeValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceChangeValue: {
    flex: 1,
    alignItems: "center",
  },
  priceChangeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  priceChangeLabelDark: {
    color: "#9CA3AF",
  },
  priceChangeOld: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  priceChangeNew: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  priceChangeNewUp: {
    color: "#EF4444",
  },
  priceChangeNewDown: {
    color: "#10B981",
  },
  priceChangeArrow: {
    marginHorizontal: 4,
  },
  priceChangeBadge: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    minWidth: 60,
  },
  priceChangeBadgeUp: {
    backgroundColor: "#FECACA",
  },
  priceChangeBadgeDown: {
    backgroundColor: "#DCFCE7",
  },
  priceChangeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  priceChangeBadgeTextUp: {
    color: "#991B1B",
  },
  priceChangeBadgeTextDown: {
    color: "#15803D",
  },
  priceChangeDiff: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 2,
  },
  priceChangeDiffUp: {
    color: "#DC2626",
  },
  priceChangeDiffDown: {
    color: "#059669",
  },
});
