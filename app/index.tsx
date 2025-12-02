// app/index.tsx
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
} from "react-native";
import { useCallback, useEffect, useState, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_700Bold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import BottomNav from "../src/components/navigation/BottomNav";
import { useAuth } from "../src/context/AuthContext";
import { useAppearance } from "../src/context/AppearanceContext";
import { useCurrency } from "../src/context/CurrencyContext";
import secureFetch from "../src/api/secureFetch";
import RegisterModal from "../src/components/register/RegisterModal";

type DashboardTab = {
  key: string;
  label: string;
  description: string;
  route: string;
  icon: string;
  background: string;
  backgroundDark: string;
};

const DASHBOARD_TABS: DashboardTab[] = [
  {
    key: "orders",
    label: "Orders",
    description: "Active orders",
    route: "/orders",
    icon: "📋",
    background: "#0EA5E9",
    backgroundDark: "#0369A1",
  },
  {
    key: "stock",
    label: "Inventory",
    description: "Stock & suppliers",
    route: "/stock",
    icon: "📊",
    background: "#22C55E",
    backgroundDark: "#15803D",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Sales & Analytics",
    route: "/reports",
    icon: "📈",
    background: "#F59E0B",
    backgroundDark: "#D97706",
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "Manage costs",
    route: "/finance/expenses",
    icon: "💰",
    background: "#EF4444",
    backgroundDark: "#DC2626",
  },
  {
    key: "products",
    label: "Products",
    description: "Manage items",
    route: "/products",
    icon: "📦",
    background: "#8B5CF6",
    backgroundDark: "#7C3AED",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Settings & alerts",
    route: "/settings/notifications-settings",
    icon: "🔔",
    background: "#EC4899",
    backgroundDark: "#DB2777",
  },
  {
    key: "register",
    label: "Register",
    description: "Cash register",
    route: "/register",
    icon: "🔐",
    background: "#06B6D4",
    backgroundDark: "#0891B2",
  },
  {
    key: "phone",
    label: "Phone Orders",
    description: "Phone-in orders",
    route: "/orders/phone",
    icon: "☎️",
    background: "#10B981",
    backgroundDark: "#059669",
  },
];

type DashboardSummary = {
  daily_sales: number;
  gross_sales?: number;
  net_sales?: number;
  expenses_today?: number;
  profit?: number;
  average_order_value: number;
};

type RevenuePoint = {
  date: string;
  profit: number;
  loss: number;
};

type CategoryBreakdown = {
  category: string;
  total: number;
};

type RegisterStatus = {
  status?: string;
  opening_cash?: number | null;
  last_open_at?: string | null;
  yesterday_close?: number | null;
};

export default function Dashboard() {
  const [fontsLoaded] = useFonts({ Inter_700Bold, Inter_900Black });
  const { user, loading } = useAuth();
  const { appearance, isDark, fontScale } = useAppearance();
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [kitchenStats, setKitchenStats] = useState({
    preparingItems: 0,
    avgPrepMinutes: 0,
  });
  const [deliveryStats, setDeliveryStats] = useState({
    activeDeliveries: 0,
    avgDeliveryMinutes: 0,
  });
  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<
    CategoryBreakdown[]
  >([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [registerStatus, setRegisterStatus] = useState<RegisterStatus | null>(
    null
  );
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [tabPage, setTabPage] = useState(0);

  const panResponderRef = useRef<any>(null);

  // Setup pan responder for swipe gestures
  useEffect(() => {
    const totalPages = Math.ceil(DASHBOARD_TABS.length / 2);

    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (evt, gestureState) => {
        const xDistance = Math.abs(gestureState.dx);
        const yDistance = Math.abs(gestureState.dy);

        if (xDistance > yDistance && xDistance > 50) {
          setTabPage((prev) => {
            if (gestureState.dx > 0) {
              // Swiped right - go to previous page
              return Math.max(0, prev - 1);
            } else {
              // Swiped left - go to next page
              return Math.min(totalPages - 1, prev + 1);
            }
          });
        }
      },
    });
  }, [DASHBOARD_TABS.length]);

  const formatLabel = (value: string) => {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setDashboardError(null);
    setDashboardLoading(true);

    const today = new Date();
    const toDate = today.toISOString().slice(0, 10);
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 6);
    const fromDateString = fromDate.toISOString().slice(0, 10);

    try {
      const [
        summaryData,
        kitchenData,
        criticalStock,
        confirmedOrders,
        closedOrders,
        profitLossData,
        categoryData,
      ] = await Promise.all([
        secureFetch(`/reports/summary?from=${toDate}&to=${toDate}`),
        secureFetch("/kitchen-orders"),
        secureFetch("/stock/critical"),
        secureFetch("/orders?status=confirmed"),
        secureFetch("/orders?status=closed"),
        secureFetch(
          `/reports/profit-loss?timeframe=daily&from=${fromDateString}&to=${toDate}`
        ),
        secureFetch(
          `/reports/sales-by-category?from=${fromDateString}&to=${toDate}`
        ),
      ]);

      setSummary(summaryData || null);
      console.log("🔍 DEBUG: Summary response:", summaryData);
      setLowStockCount(Array.isArray(criticalStock) ? criticalStock.length : 0);

      const kitchenOrders = Array.isArray(kitchenData) ? kitchenData : [];
      const preparing = kitchenOrders.filter(
        (item) => item?.kitchen_status === "preparing"
      );
      const totalPrepMs = preparing.reduce((sum, item) => {
        const created = Number(new Date(item.created_at).getTime());
        if (!Number.isFinite(created)) return sum;
        return sum + Math.max(0, Date.now() - created);
      }, 0);
      setKitchenStats({
        preparingItems: preparing.length,
        avgPrepMinutes:
          preparing.length > 0 ? totalPrepMs / preparing.length / 60000 : 0,
      });

      const confirmedList = Array.isArray(confirmedOrders)
        ? confirmedOrders
        : [];
      const activeDeliveries = confirmedList.filter((order) => {
        const status = String(order?.driver_status || "").toLowerCase();
        return status === "on_road";
      }).length;

      const closedList = Array.isArray(closedOrders) ? closedOrders : [];
      const deliveryDurations = closedList
        .map((order) => {
          if (!order?.picked_up_at || !order?.delivered_at) return null;
          const picked = Number(new Date(order.picked_up_at).getTime());
          const delivered = Number(new Date(order.delivered_at).getTime());
          if (
            !Number.isFinite(picked) ||
            !Number.isFinite(delivered) ||
            delivered <= picked
          ) {
            return null;
          }
          return delivered - picked;
        })
        .filter((value): value is number => typeof value === "number");
      const avgDeliveryMinutes =
        deliveryDurations.length > 0
          ? deliveryDurations.reduce((sum, item) => sum + item, 0) /
            deliveryDurations.length /
            60000
          : 0;
      setDeliveryStats({
        activeDeliveries,
        avgDeliveryMinutes,
      });

      const trendArray = Array.isArray(profitLossData)
        ? profitLossData.map((row) => ({
            date: row.date,
            profit: Number(row.profit) || 0,
            loss: Number(row.loss) || 0,
          }))
        : [];
      setRevenueTrend(trendArray);

      const categories = Array.isArray(categoryData) ? categoryData : [];
      const normalized = categories
        .map((cat) => ({
          category: cat.category || "Uncategorized",
          total: Number(cat.total) || 0,
        }))
        .sort((a, b) => b.total - a.total);
      setCategoryBreakdown(normalized);
    } catch (err) {
      console.log("❌ Dashboard load error:", err);
      console.log("❌ Error stack:", err instanceof Error ? err.stack : "no stack");
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard data";
      setDashboardError(message);
    } finally {
      setDashboardLoading(false);
    }
  }, [user]);

  // Redirect only after loading is finished
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  if (!user) return null;

  const totalSales = summary?.daily_sales ?? 0;
  const avgOrderValue = summary?.average_order_value ?? 0;
  const expensesToday = summary?.expenses_today ?? 0;
  const estimatedOrders =
    summary && summary.average_order_value > 0
      ? Math.round(totalSales / summary.average_order_value)
      : 0;
  const sortedTrend = [...revenueTrend].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const trendPoints = sortedTrend.slice(-5);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* ---------------------------------------------------- */}
      {/* HEADER */}
      {/* ---------------------------------------------------- */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text
              style={[
                styles.headerTitle,
                isDark && styles.headerTitleDark,
                { fontSize: 26 * fontScale },
              ]}
            >
              {user?.name || user?.full_name || user?.first_name || "Admin"}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                isDark && styles.headerSubtitleDark,
              ]}
            >
              {t("Daily Operations Overview")}
            </Text>
          </View>
          <View style={styles.headerBrand}>
            <View>
              <Text
                style={[
                  styles.logoText,
                  isDark && styles.logoTextDark,
                  { fontSize: 22 * fontScale },
                ]}
              >
                Beypr
                <Text
                  style={[
                    styles.logoText,
                    styles.globalO,
                    isDark && styles.globalODark,
                  ]}
                >
                  o
                </Text>
              </Text>
              <View style={styles.amazonLineContainer}>
                <View
                  style={[styles.amazonLine, isDark && styles.amazonLineDark]}
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT */}
      {/* ---------------------------------------------------- */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pagePadding}
      >
        {/* ===================== QUICK TABS ===================== */}
        <View style={styles.section}>
          <View style={styles.tabHeader}>
            <Text
              style={[
                styles.sectionTitle,
                isDark && styles.sectionTitleDark,
                { marginBottom: 4, fontSize: 18 * fontScale },
              ]}
            >
              {t("Quick tabs")}
            </Text>
            <Text
              style={[
                styles.tabHint,
                isDark && styles.tabHintDark,
                { fontSize: 12 * fontScale },
              ]}
            >
              {t("Swipe to navigate your toolkit")}
            </Text>
          </View>

          <View
            style={styles.tabPaginationContainer}
            {...(panResponderRef.current?.panHandlers || {})}
          >
            <View style={styles.tabsRow}>
              {DASHBOARD_TABS.slice(tabPage * 2, tabPage * 2 + 2).map((tab) => {
                const backgroundColor = isDark
                  ? (tab.backgroundDark ?? tab.background)
                  : tab.background;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabCard,
                      { backgroundColor, shadowColor: backgroundColor },
                    ]}
                    activeOpacity={0.9}
                    onPress={() => router.push(tab.route as any)}
                  >
                    <View style={styles.tabIconWrapper}>
                      <Text
                        style={[styles.tabIcon, { fontSize: 24 * fontScale }]}
                      >
                        {tab.icon}
                      </Text>
                    </View>
                    <Text
                      style={[styles.tabLabel, { fontSize: 16 * fontScale }]}
                    >
                      {t(tab.label)}
                    </Text>
                    <Text
                      style={[styles.tabDesc, { fontSize: 12 * fontScale }]}
                    >
                      {t(tab.description)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {Math.ceil(DASHBOARD_TABS.length / 2) > 1 && (
              <View style={styles.tabPaginationDots}>
                {Array.from({
                  length: Math.ceil(DASHBOARD_TABS.length / 2),
                }).map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.paginationDot,
                      tabPage === index && styles.paginationDotActive,
                    ]}
                    onPress={() => setTabPage(index)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {dashboardLoading && (
          <Text
            style={[
              styles.loadingText,
              isDark && styles.loadingTextDark,
              { fontSize: 12 * fontScale },
            ]}
          >
            Refreshing live metrics…
          </Text>
        )}

        {dashboardError && (
          <Text
            style={[styles.errorText, { fontSize: 12 * fontScale }]}
            numberOfLines={2}
          >
            {dashboardError}
          </Text>
        )}

        {/* ===================== KPI CARDS ===================== */}
        <View style={styles.section}>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, isDark && styles.kpiCardDark]}>
              <Text
                style={[
                  styles.kpiLabel,
                  isDark && styles.kpiLabelDark,
                  { fontSize: 14 * fontScale },
                ]}
              >
                {t("Total Sales")}
              </Text>
              <Text
                style={[
                  styles.kpiValue,
                  isDark && styles.kpiValueDark,
                  { fontSize: 20 * fontScale },
                ]}
              >
                {formatCurrency(totalSales)}
              </Text>
              <Text
                style={[
                  styles.kpiSub,
                  isDark && styles.kpiSubDark,
                  { fontSize: 12 * fontScale },
                ]}
              >
                {t("Today")}
              </Text>
            </View>

            <View style={[styles.kpiCard, isDark && styles.kpiCardDark]}>
              <Text
                style={[
                  styles.kpiLabel,
                  isDark && styles.kpiLabelDark,
                  { fontSize: 14 * fontScale },
                ]}
              >
                {t("Expenses")}
              </Text>
              <Text
                style={[
                  styles.kpiValue,
                  isDark && styles.kpiValueDark,
                  { fontSize: 20 * fontScale },
                ]}
              >
                {formatCurrency(expensesToday)}
              </Text>
              <Text
                style={[
                  styles.kpiSub,
                  isDark && styles.kpiSubDark,
                  { fontSize: 12 * fontScale },
                ]}
              >
                {t("Today")}
              </Text>
            </View>

            <View style={[styles.kpiCard, isDark && styles.kpiCardDark]}>
              <Text
                style={[
                  styles.kpiLabel,
                  isDark && styles.kpiLabelDark,
                  { fontSize: 14 * fontScale },
                ]}
              >
                {t("Avg. Order")}
              </Text>
              <Text
                style={[
                  styles.kpiValue,
                  isDark && styles.kpiValueDark,
                  { fontSize: 20 * fontScale },
                ]}
              >
                {formatCurrency(avgOrderValue)}
              </Text>
              <Text
                style={[
                  styles.kpiSub,
                  isDark && styles.kpiSubDark,
                  { fontSize: 12 * fontScale },
                ]}
              >
                {t("Per transaction")}
              </Text>
            </View>

            <View style={[styles.kpiCard, isDark && styles.kpiCardDark]}>
              <Text
                style={[
                  styles.kpiLabel,
                  isDark && styles.kpiLabelDark,
                  { fontSize: 14 * fontScale },
                ]}
              >
                {t("Low Stock")}
              </Text>
              <Text
                style={[
                  styles.kpiValue,
                  styles.warning,
                  isDark && styles.kpiValueDark,
                  { fontSize: 20 * fontScale },
                ]}
              >
                {lowStockCount}
              </Text>
              <Text
                style={[
                  styles.kpiSub,
                  isDark && styles.kpiSubDark,
                  { fontSize: 12 * fontScale },
                ]}
              >
                {t("Items")}
              </Text>
            </View>
          </View>
        </View>

        {/* ===================== QUICK ACTIONS ===================== */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              isDark && styles.sectionTitleDark,
              { fontSize: 18 * fontScale },
            ]}
          >
            {t("Quick Actions")}
          </Text>

          <View style={styles.grid}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.gridItem, isDark && styles.gridItemDark]}
              onPress={() => router.push("/orders")}
            >
              <Text
                style={[
                  styles.gridItemTitle,
                  isDark && styles.gridItemTitleDark,
                  { fontSize: 16 * fontScale },
                ]}
              >
                {t("Orders")}
              </Text>
              <Text
                style={[
                  styles.gridItemDesc,
                  isDark && styles.gridItemDescDark,
                  { fontSize: 13 * fontScale },
                ]}
              >
                {t("Tables / Delivery")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.gridItem, isDark && styles.gridItemDark]}
              onPress={() => router.push("/orders/kitchen")}
            >
              <Text
                style={[
                  styles.gridItemTitle,
                  isDark && styles.gridItemTitleDark,
                  { fontSize: 16 * fontScale },
                ]}
              >
                {t("Kitchen")}
              </Text>
              <Text
                style={[
                  styles.gridItemDesc,
                  isDark && styles.gridItemDescDark,
                  { fontSize: 13 * fontScale },
                ]}
              >
                {t("Live queue")}: {kitchenStats.preparingItems}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.gridItem]}
              onPress={() => router.push("/products")}
            >
              <Text
                style={[styles.gridItemTitle, { fontSize: 16 * fontScale }]}
              >
                {t("Products")}
              </Text>
              <Text style={[styles.gridItemDesc, { fontSize: 13 * fontScale }]}>
                {t("Menu & pricing")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.gridItem]}
              onPress={() => router.push("/stock")}
            >
              <Text
                style={[styles.gridItemTitle, { fontSize: 16 * fontScale }]}
              >
                {t("Inventory")}
              </Text>
              <Text style={[styles.gridItemDesc, { fontSize: 13 * fontScale }]}>
                {t("Stock & suppliers")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.gridItem, styles.gridItemAction]}
              onPress={() => setRegisterModalVisible(true)}
            >
              <Text
                style={[styles.gridItemTitle, { fontSize: 16 * fontScale }]}
              >
                {t("Cash Register")}
              </Text>
              <Text style={[styles.gridItemDesc, { fontSize: 13 * fontScale }]}>
                {t("Open / Close drawer")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.gridItem]}
              onPress={() => router.push("/finance/expenses")}
            >
              <Text
                style={[styles.gridItemTitle, { fontSize: 16 * fontScale }]}
              >
                {t("Expenses")}
              </Text>
              <Text style={[styles.gridItemDesc, { fontSize: 13 * fontScale }]}>
                {t("Manage costs")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===================== OPERATIONS OVERVIEW ===================== */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              isDark && styles.sectionTitleDark,
              { fontSize: 18 * fontScale },
            ]}
          >
            {t("Operations")}
          </Text>

          <View
            style={[styles.operationCard, isDark && styles.operationCardDark]}
          >
            <Text
              style={[
                styles.operationTitle,
                isDark && styles.operationTitleDark,
                { fontSize: 16 * fontScale },
              ]}
            >
              {t("Live Kitchen Status")}
            </Text>
            <Text
              style={[
                styles.operationSub,
                isDark && styles.operationSubDark,
                { fontSize: 13 * fontScale },
              ]}
            >
              • {kitchenStats.preparingItems} {t("items in preparation")}
            </Text>
            <Text
              style={[
                styles.operationSub,
                isDark && styles.operationSubDark,
                { fontSize: 13 * fontScale },
              ]}
            >
              • {t("Avg prep time:")}{" "}
              {Math.max(0, Math.round(kitchenStats.avgPrepMinutes))}m
            </Text>
          </View>

          <View
            style={[styles.operationCard, isDark && styles.operationCardDark]}
          >
            <Text
              style={[
                styles.operationTitle,
                isDark && styles.operationTitleDark,
                { fontSize: 16 * fontScale },
              ]}
            >
              {t("Delivery Overview")}
            </Text>
            <Text
              style={[
                styles.operationSub,
                isDark && styles.operationSubDark,
                { fontSize: 13 * fontScale },
              ]}
            >
              • {deliveryStats.activeDeliveries} {t("active deliveries")}
            </Text>
            <Text
              style={[
                styles.operationSub,
                isDark && styles.operationSubDark,
                { fontSize: 13 * fontScale },
              ]}
            >
              • {t("Avg delivery:")}{" "}
              {Math.max(0, Math.round(deliveryStats.avgDeliveryMinutes))}m
            </Text>
          </View>
        </View>

        {/* ===================== INSIGHTS ===================== */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              isDark && styles.sectionTitleDark,
              { fontSize: 18 * fontScale },
            ]}
          >
            {t("Performance Insights")}
          </Text>

          <View style={[styles.insightCard, isDark && styles.insightCardDark]}>
            <Text
              style={[
                styles.insightTitle,
                isDark && styles.insightTitleDark,
                { fontSize: 16 * fontScale },
              ]}
            >
              {t("Revenue Trend")}
            </Text>
            <View style={styles.trendRow}>
              {trendPoints.length === 0 ? (
                <Text
                  style={[
                    styles.trendEmpty,
                    { fontSize: 13 * fontScale },
                    isDark && styles.trendEmptyDark,
                  ]}
                >
                  {t("Waiting for live trend data")}
                </Text>
              ) : (
                trendPoints.map((point) => {
                  const net = point.profit - point.loss;
                  return (
                    <View
                      key={point.date}
                      style={[styles.trendItem, isDark && styles.trendItemDark]}
                    >
                      <Text
                        style={[
                          styles.trendDate,
                          { fontSize: 11 * fontScale },
                          isDark && styles.trendDateDark,
                        ]}
                      >
                        {formatLabel(point.date)}
                      </Text>
                      <Text
                        style={[
                          styles.trendValue,
                          { fontSize: 14 * fontScale },
                          isDark && styles.trendValueDark,
                        ]}
                      >
                        {formatCurrency(net)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <View style={[styles.insightCard, isDark && styles.insightCardDark]}>
            <Text
              style={[
                styles.insightTitle,
                isDark && styles.insightTitleDark,
                { fontSize: 16 * fontScale },
              ]}
            >
              {t("Category Breakdown")}
            </Text>
            {categoryBreakdown.length === 0 ? (
              <Text
                style={[
                  styles.trendEmpty,
                  { fontSize: 13 * fontScale },
                  isDark && styles.trendEmptyDark,
                ]}
              >
                {t("Category sales will appear when orders close")}
              </Text>
            ) : (
              <View style={styles.categoryList}>
                {categoryBreakdown.slice(0, 4).map((cat) => (
                  <View style={styles.categoryRow} key={cat.category}>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { fontSize: 14 * fontScale },
                        isDark && styles.categoryLabelDark,
                      ]}
                    >
                      {cat.category}
                    </Text>
                    <Text
                      style={[
                        styles.categoryValue,
                        { fontSize: 14 * fontScale },
                        isDark && styles.categoryValueDark,
                      ]}
                    >
                      {formatCurrency(cat.total)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <RegisterModal
        visible={registerModalVisible}
        onClose={() => setRegisterModalVisible(false)}
        onStateChange={loadDashboardData}
      />

      <BottomNav />
    </View>
  );
}

/* ================================================================
   Styles — Premium Enterprise UI
================================================================ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F7" },
  containerDark: { backgroundColor: "#020617" },

  header: {
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderBottomColor: "transparent",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  headerLeft: { flex: 1 },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 16,
    marginTop: 2,
  },
  logoSymbol: {
    fontWeight: "900",
    color: "#0EA5E9",
    textShadowColor: "rgba(14, 165, 233, 0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  logoSymbolDark: {
    color: "#38BDF8",
    textShadowColor: "rgba(56, 189, 248, 0.5)",
  },
  logoText: {
    fontWeight: "900",
    color: "#0EA5E9",
    letterSpacing: -0.3,
    fontFamily: "Inter_900Black",
    textShadowColor: "rgba(14, 165, 233, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  logoTextDark: {
    color: "#38BDF8",
    textShadowColor: "rgba(56, 189, 248, 0.4)",
  },
  globalO: {
    color: "#10B981",
    textShadowColor: "rgba(16, 185, 129, 0.3)",
  },
  globalODark: {
    color: "#34D399",
    textShadowColor: "rgba(52, 211, 153, 0.4)",
  },
  logoBolt: {
    height: 2,
    width: 60,
    backgroundColor: "#0EA5E9",
    marginTop: 4,
    borderRadius: 1,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  logoBoltDark: {
    backgroundColor: "#38BDF8",
    shadowColor: "#38BDF8",
    shadowOpacity: 0.4,
  },
  amazonLineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 0,
  },
  amazonLine: {
    height: 2,
    width: 50,
    backgroundColor: "#0EA5E9",
    borderRadius: 10,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
    transform: [{ skewY: "-5deg" }],
  },
  amazonLineDark: {
    backgroundColor: "#38BDF8",
    shadowColor: "#38BDF8",
    shadowOpacity: 0.4,
  },
  amazonArrow: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    marginLeft: -4,
    marginTop: -1,
  },
  amazonArrowDark: {
    color: "#34D399",
  },
  wireY: {
    color: "#0EA5E9",
    fontWeight: "900",
    letterSpacing: -0.5,
    marginHorizontal: -3,
  },
  wordmarkWrap: {
    position: "relative",
    height: 44,
    justifyContent: "center",
    display: "none",
  },
  wordmarkShadowTop: {
    position: "absolute",
    left: 0,
    top: -1,
    color: "rgba(255,255,255,0.95)",
    zIndex: 3,
    fontWeight: "900",
    letterSpacing: -0.4,
    display: "none",
  },
  wordmarkShadowBottom: {
    position: "absolute",
    left: 0,
    top: 1.5,
    color: "rgba(0,0,0,0.22)",
    zIndex: 1,
    fontWeight: "900",
    letterSpacing: -0.4,
    display: "none",
  },
  wordmarkMain: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 2,
    fontWeight: "900",
    letterSpacing: -0.4,
    display: "none",
  },
  segmentA: { color: "#0EA5E9" },
  segmentB: { color: "#8B5CF6" },
  segmentC: { color: "#EC4899" },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  headerTitleDark: { color: "#F0F9FF" },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },
  headerSubtitleDark: { color: "#CBD5E1" },
  // Logo handled by SVG component
  brandWordmark: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0EA5E9",
    letterSpacing: -0.4,
    textShadowColor: "rgba(14,165,233,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    fontFamily: "Inter_900Black",
  },
  brandWordmarkDark: {
    color: "#38BDF8",
    textShadowColor: "rgba(56,189,248,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
    fontFamily: "Inter_900Black",
  },

  pagePadding: { paddingBottom: 120, paddingHorizontal: 24 },

  section: { marginTop: 32 },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  sectionTitleDark: {
    color: "#F0F9FF",
  },
  tabHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  tabHint: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  tabHintDark: {
    color: "#CBD5E1",
  },
  tabScrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  tabPaginationContainer: {
    alignItems: "center",
    gap: 12,
  },
  tabsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    width: "100%",
  },
  tabPaginationDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(15, 23, 42, 0.3)",
  },
  paginationDotActive: {
    backgroundColor: "#0EA5E9",
    width: 24,
  },
  loadingText: {
    marginTop: 8,
    color: "#6B7280",
    paddingHorizontal: 4,
  },
  loadingTextDark: {
    color: "#9CA3AF",
  },
  errorText: {
    marginTop: 4,
    paddingHorizontal: 4,
    color: "#EF4444",
  },
  tabCard: {
    flex: 1,
    padding: 18,
    borderRadius: 24,
    marginRight: 0,
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.4)",
    overflow: "hidden",
    justifyContent: "space-between",
    minHeight: 180,
  },
  tabIconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  tabIcon: {
    color: "#FFF",
  },
  tabLabel: {
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    fontSize: 15,
  },
  tabDesc: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
    lineHeight: 16,
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
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
    overflow: "hidden",
  },
  kpiCardDark: {
    backgroundColor: "rgba(15,23,42,0.97)",
    borderColor: "rgba(148,163,184,0.28)",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 5,
  },

  kpiLabel: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  kpiLabelDark: { color: "#94A3B8" },
  kpiValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  kpiValueDark: { color: "#F0F9FF" },
  kpiSub: { fontSize: 12, color: "#94A3B8", marginTop: 6, fontWeight: "500" },
  kpiSubDark: { color: "#94A3B8" },
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
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    borderColor: "rgba(15,23,42,0.08)",
    borderWidth: 1,
    marginBottom: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
    overflow: "hidden",
  },
  gridItemDark: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderColor: "rgba(148,163,184,0.2)",
    shadowOpacity: 0.2,
  },

  gridItemAction: {
    backgroundColor: "rgba(238,242,255,0.98)",
    borderColor: "rgba(199,210,254,0.6)",
  },

  gridItemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  gridItemTitleDark: { color: "#F0F9FF" },
  gridItemDesc: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  gridItemDescDark: { color: "#94A3B8" },

  /* OPERATIONS */
  operationCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    marginBottom: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
    overflow: "hidden",
  },
  operationCardDark: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderColor: "rgba(148,163,184,0.2)",
    shadowOpacity: 0.2,
  },

  operationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  operationTitleDark: { color: "#F0F9FF" },
  operationSub: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  operationSubDark: { color: "#94A3B8" },

  /* INSIGHTS */
  insightCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    marginBottom: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
    overflow: "hidden",
  },
  insightCardDark: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderColor: "rgba(148,163,184,0.2)",
    shadowOpacity: 0.2,
  },

  insightTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  insightTitleDark: { color: "#F0F9FF" },

  trendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 12,
  },
  trendItem: {
    flex: 1,
    minWidth: "48%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.06)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  trendItemDark: {
    backgroundColor: "rgba(148,163,184,0.12)",
    borderColor: "rgba(148,163,184,0.2)",
  },
  trendDate: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.2,
  },
  trendDateDark: {
    color: "#CBD5E1",
  },
  trendValue: {
    marginTop: 6,
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 13,
  },
  trendValueDark: {
    color: "#F0F9FF",
  },
  trendEmpty: {
    color: "#6B7280",
  },
  trendEmptyDark: {
    color: "#9CA3AF",
  },

  categoryList: {
    marginTop: 12,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryLabel: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: -0.1,
  },
  categoryLabelDark: {
    color: "#F0F9FF",
  },
  categoryValue: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 14,
  },
  categoryValueDark: {
    color: "#CBD5E1",
  },

  chartPlaceholder: {
    height: 160,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chartText: { color: "#9CA3AF" },
  chartTextDark: { color: "#D1D5DB" },
});
