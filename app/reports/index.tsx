import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import secureFetch from "../../src/api/secureFetch";
import { useAuth } from "../../src/context/AuthContext";
import { usePermissions } from "../../src/hooks/usePermissions";
import BottomNav from "../../src/components/navigation/BottomNav";
import { Ionicons } from "@expo/vector-icons";
import { getItem, setItem } from "../../src/utils/storage";

const windowWidth = Dimensions.get("window").width;

interface DashboardSummary {
  daily_sales: number;
  gross_sales?: number;
  net_sales?: number;
  expenses_today?: number;
  profit?: number;
  average_order_value: number;
}

interface CategoryItem {
  name: string;
  quantity: number;
  total: number;
}

interface ProfitLossData {
  date: string;
  profit: number;
  loss: number;
}

interface CategoryTrendItem {
  date: string;
  [key: string]: string | number;
}

interface SalesTrendItem {
  label: string;
  sales: number;
  date?: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  deniedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  deniedText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 12,
  },
  kpiGrid: {
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 100,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
    opacity: 0.9,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  dateRangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dateRangeText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  refreshButton: {
    padding: 8,
    marginLeft: 8,
  },
  categoryCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  categoryTotal: {
    fontSize: 14,
    fontWeight: "700",
  },
  categoryExpanded: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    fontSize: 12,
  },
  categoryItemName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "400",
  },
  categoryItemPrice: {
    fontSize: 12,
    fontWeight: "500",
  },
  chartContainer: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  chartPlaceholder: {
    fontSize: 12,
    textAlign: "center",
  },
  expensesList: {
    maxHeight: 250,
  },
  expenseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  expenseType: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: "700",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1.5,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  profitLossGrid: {
    marginBottom: 12,
  },
  profitLossCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    justifyContent: "center",
  },
  profitLossDate: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    opacity: 0.85,
  },
  profitLossRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    fontSize: 12,
  },
  profitLossLabel: {
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },
  profitLossValue: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  retryButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  selectContainer: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  selectText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default function ReportsScreen() {
  const { isDark } = useAppearance();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  // Permission check
  const hasDashboardAccess = useMemo(
    () => hasPermission("dashboard"),
    [hasPermission]
  );

  if (!hasDashboardAccess) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
          },
        ]}
      >
        <View style={styles.deniedContainer}>
          <Text
            style={[
              styles.deniedText,
              {
                color: isDark ? "#FFFFFF" : "#000000",
              },
            ]}
          >
            Access Denied
          </Text>
          <Text
            style={[
              styles.deniedText,
              {
                color: isDark ? "#9CA3AF" : "#6B7280",
                fontSize: 14,
              },
            ]}
          >
            You do not have permission to view the Reports Dashboard.
          </Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  // Date range state
  const [dateRange, setDateRange] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute date range
  const { from, to } = useMemo(() => {
    const today = new Date();
    let from = "";
    let to = today.toISOString().split("T")[0];

    if (dateRange === "today") {
      from = to;
    } else if (dateRange === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);
      from = weekStart.toISOString().split("T")[0];
    } else if (dateRange === "month") {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      from = monthStart.toISOString().split("T")[0];
    } else if (dateRange === "custom" && customFrom && customTo) {
      from = customFrom;
      to = customTo;
    }

    return { from, to };
  }, [dateRange, customFrom, customTo]);

  // Data states
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [productSalesData, setProductSalesData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [categoryDetails, setCategoryDetails] = useState<{
    [key: string]: CategoryItem[];
  }>({});
  const [profitLossData, setProfitLossData] = useState<ProfitLossData[]>([]);
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("daily");
  const [hydratedPref, setHydratedPref] = useState(false);
  const [salesTrendsData, setSalesTrendsData] = useState<SalesTrendItem[]>([]);
  const [categoryTrendsData, setCategoryTrendsData] =
    useState<CategoryTrendItem[]>([]);
  const [cashAvailable, setCashAvailable] = useState(0);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [staffError, setStaffError] = useState<string | null>(null);

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<
    { [key: string]: boolean }
  >({});
  const [salesViewType, setSalesViewType] = useState("daily");

  const loadReportsData = useCallback(async () => {
    if (!from || !to) return;

    setLoading(true);
    setError(null);

    try {
      const [
        paymentRes,
        categoriesRes,
        expensesRes,
        summaryRes,
        cashRes,
        profitRes,
        trendsRes,
        categoryTrendsRes,
      ] = await Promise.all([
        secureFetch(`/reports/sales-by-payment-method?from=${from}&to=${to}`),
        secureFetch(`/reports/sales-by-category?from=${from}&to=${to}`),
        secureFetch(`/reports/expenses?from=${from}&to=${to}`),
        secureFetch(`/reports/summary?from=${from}&to=${to}`),
        secureFetch(`/reports/cash-register-snapshot`),
        secureFetch(`/reports/profit-loss?timeframe=${timeframe}`),
        secureFetch(`/reports/sales-trends?type=${salesViewType}`),
        secureFetch(`/reports/category-trends?range=today`),
      ].map((p) => p.catch(() => null)));

      // Handle payment data
      if (Array.isArray(paymentRes)) {
        setPaymentData(paymentRes);
      }

      // Handle product/category data
      if (Array.isArray(categoriesRes)) {
        setProductSalesData(categoriesRes);
      }

      // Handle category details
      if (Array.isArray(categoriesRes)) {
        const details: { [key: string]: CategoryItem[] } = {};
        for (const category of categoriesRes) {
          try {
            const itemsRes = await secureFetch(
              `/reports/category-items/${encodeURIComponent(category.category)}?from=${from}&to=${to}}`
            );
            if (Array.isArray(itemsRes)) {
              details[category.category] = itemsRes;
            }
          } catch (e) {
            console.warn(`Failed to load items for ${category.category}:`, e);
          }
        }
        setCategoryDetails(details);
      }

      // Handle expenses
      if (Array.isArray(expensesRes)) {
        setExpensesData(expensesRes);
      }

      // Handle summary
      if (summaryRes) {
        setSummary(summaryRes);
      }

      // Handle cash
      if (cashRes?.available) {
        setCashAvailable(cashRes.available);
      }

      // Handle profit/loss
      if (Array.isArray(profitRes)) {
        setProfitLossData(profitRes);
      }

      // Handle sales trends
      if (Array.isArray(trendsRes)) {
        setSalesTrendsData(trendsRes);
      }

      // Handle category trends
      if (Array.isArray(categoryTrendsRes)) {
        setCategoryTrendsData(categoryTrendsRes);
      }

      // Staff performance (optional)
      try {
        const staffRes = await secureFetch(`/reports/staff-performance?from=${from}&to=${to}`);
        setStaffData(Array.isArray(staffRes) ? staffRes : []);
        setStaffError(null);
      } catch (e: any) {
        setStaffError(e?.message || "Failed to load staff performance");
        setStaffData([]);
      }
    } catch (err) {
      console.error("❌ Reports data error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load reports data"
      );
    } finally {
      setLoading(false);
    }
  }, [from, to, salesViewType, timeframe]);

  // Hydrate saved timeframe preference first, then load data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await getItem("reports_timeframe");
        if (!cancelled && saved && ["daily","weekly","monthly"].includes(saved)) {
          setTimeframe(saved as any);
        }
      } catch {}
      if (!cancelled) setHydratedPref(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hydratedPref) {
      loadReportsData();
    }
  }, [loadReportsData, hydratedPref]);

  // Persist timeframe changes
  useEffect(() => {
    if (hydratedPref) {
      setItem("reports_timeframe", timeframe).catch(()=>{});
    }
  }, [timeframe, hydratedPref]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadReportsData();
    setIsRefreshing(false);
  }, [loadReportsData]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const dailySales =
      paymentData.reduce(
        (sum, entry) => sum + parseFloat(entry.value || 0),
        0
      ) || 0;
    const grossSales = summary?.gross_sales || 0;
    const netSales = summary?.net_sales || 0;
    const extraExpenses =
      expensesData.reduce(
        (sum, row) => sum + parseFloat(row.amount || 0),
        0
      ) || 0;
    const expensesToday = (summary?.expenses_today || 0) + extraExpenses;
    const profit = netSales - expensesToday;

    return [
      {
        label: "Daily Sales",
        value: dailySales,
        icon: "💰",
        color: isDark ? "#3B82F6" : "#60A5FA",
      },
      {
        label: "Gross Sales",
        value: grossSales,
        icon: "📈",
        color: isDark ? "#8B5CF6" : "#A78BFA",
      },
      {
        label: "Net Sales",
        value: netSales,
        icon: "📊",
        color: isDark ? "#06B6D4" : "#22D3EE",
      },
      {
        label: "Profit",
        value: profit,
        icon: "💹",
        color: isDark ? "#10B981" : "#34D399",
      },
      {
        label: "Expenses",
        value: expensesToday,
        icon: "📉",
        color: isDark ? "#EF4444" : "#F87171",
      },
      {
        label: "Cash Available",
        value: cashAvailable,
        icon: "💳",
        color: isDark ? "#FBBF24" : "#FCD34D",
      },
    ];
  }, [paymentData, summary, expensesData, cashAvailable, isDark]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const dateRangeLabel = useMemo(() => {
    if (dateRange === "today") return "Today";
    if (dateRange === "week") return "This Week";
    if (dateRange === "month") return "This Month";
    if (dateRange === "custom") return `${customFrom} to ${customTo}`;
    return "";
  }, [dateRange, customFrom, customTo]);

  const darkBg = isDark ? "#111827" : "#FFFFFF";
  const darkText = isDark ? "#FFFFFF" : "#000000";
  const darkCardBg = isDark ? "#1F2937" : "#F9FAFB";
  const darkSubText = isDark ? "#9CA3AF" : "#6B7280";
  const errorBg = "#FEE2E2";
  const errorText = "#DC2626";

  // Skeleton helpers
  const SkeletonBar = ({ w, h=14, mb=6 }: { w?: number; h?: number; mb?: number }) => (
    <View style={{ height: h, backgroundColor: isDark?"#1F2937":"#E5E7EB", borderRadius: 6, marginBottom: mb, ...(w!=null?{width:w}:{}) }} />
  );
  const KPIPlaceholder = () => (
    <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
      {[0,1].map(i => (
        <View key={i} style={{ flex:1, padding:14, borderRadius:12, backgroundColor: isDark?"#1F2937":"#F3F4F6" }}>
          <SkeletonBar w={80} />
          <SkeletonBar h={22} w={100} />
        </View>
      ))}
    </View>
  );
  const CardSkeleton = ({ rows=4 }: { rows?: number }) => (
    <View style={[styles.card,{ backgroundColor: darkCardBg }]}> {[...Array(rows)].map((_,i)=>(<SkeletonBar key={i} />))} </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: darkBg,
        },
      ]}
    >
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#3B82F6" : "#1F2937"}
          />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={[
              { fontSize: 28, fontWeight: "700", color: darkText, marginBottom: 8 },
            ]}
          >
            Reports
          </Text>
          <View
            style={[
              styles.dateRangeContainer,
              {
                backgroundColor: darkCardBg,
              },
            ]}
          >
            <Ionicons name="calendar" size={16} color={darkSubText} />
            <Text style={[styles.dateRangeText, { color: darkText, marginLeft: 8 }]}>
              {dateRangeLabel}
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              disabled={isRefreshing}
            >
              <Ionicons
                name="refresh"
                size={18}
                color={isDark ? "#3B82F6" : "#1F2937"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error State */}
        {error && (
          <View
            style={[
              styles.errorContainer,
              {
                backgroundColor: errorBg,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={16} color={errorText} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.errorText]}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRefresh}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* KPI Cards */}
        <View>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: darkText,
              },
            ]}
          >
            Key Metrics
          </Text>
          {loading && kpis.length === 0 && <KPIPlaceholder />}
          {!loading && kpis.map((kpi, idx) => (
            <View key={idx} style={styles.kpiRow}>
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: kpi.color,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: "#FFFFFF" }]}>
                  {kpi.label}
                </Text>
                <Text style={[styles.kpiValue, { color: "#FFFFFF" }]}>
                  {kpi.label.includes("Items") || kpi.label.includes("Orders")
                    ? kpi.value.toLocaleString()
                    : formatCurrency(parseFloat(kpi.value?.toString() || "0") || 0)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Sales by Category */}
        {loading && productSalesData.length === 0 && CardSkeleton({ rows: 6 })}
        {productSalesData.length > 0 && (
          <View>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: darkText,
                },
              ]}
            >
              Sales by Category
            </Text>
            <View style={styles.kpiGrid}>
              {productSalesData.map((category, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: darkCardBg,
                      borderWidth: 1,
                      borderColor: isDark ? "#374151" : "#E5E7EB",
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => toggleCategory(category.category)}
                  >
                    <View style={styles.categoryHeader}>
                      <Text style={[styles.categoryName, { color: darkText }]}>
                        {category.category}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text
                          style={[
                            styles.categoryTotal,
                            {
                              color: isDark ? "#86EFAC" : "#16A34A",
                            },
                          ]}
                        >
                          {formatCurrency(parseFloat(category.total?.toString() || "0") || 0)}
                        </Text>
                        {expandedCategories[category.category] ? (
                          <Ionicons name="chevron-up" size={16} color={darkSubText} />
                        ) : (
                          <Ionicons name="chevron-down" size={16} color={darkSubText} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {expandedCategories[category.category] &&
                    categoryDetails[category.category] && (
                      <View
                        style={[
                          styles.categoryExpanded,
                          {
                            borderTopColor: isDark ? "#374151" : "#E5E7EB",
                          },
                        ]}
                      >
                        {categoryDetails[category.category].map(
                          (item, itemIdx) => (
                            <View
                              key={itemIdx}
                              style={[
                                styles.categoryItem,
                                {
                                  borderBottomColor: isDark
                                    ? "#374151"
                                    : "#E5E7EB",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.categoryItemName,
                                  {
                                    color: darkSubText,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {item.name} x{item.quantity}
                              </Text>
                              <Text
                                style={[
                                  styles.categoryItemPrice,
                                  {
                                    color: darkText,
                                  },
                                ]}
                              >
                                {formatCurrency(parseFloat(item.total?.toString() || "0") || 0)}
                              </Text>
                            </View>
                          )
                        )}
                      </View>
                    )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Expenses Breakdown */}
        {loading && expensesData.length === 0 && CardSkeleton({ rows: 5 })}
        {expensesData.length > 0 && (
          <View>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: darkText,
                },
              ]}
            >
              📉 Expenses Breakdown
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: darkCardBg,
                },
              ]}
            >
              <View style={styles.expensesList}>
                {Object.entries(
                  expensesData.reduce(
                    (acc: { [key: string]: number }, row: any) => {
                      acc[row.type] = (acc[row.type] || 0) + parseFloat(row.amount || 0);
                      return acc;
                    },
                    {}
                  )
                ).map(([type, total], idx) => (
                  <View key={idx} style={[styles.expenseItem, { borderBottomColor: isDark ? "#374151" : "#E5E7EB" }]}>
                    <Text
                      style={[
                        styles.expenseType,
                        {
                          color: darkText,
                        },
                      ]}
                    >
                      {type}
                    </Text>
                    <Text
                      style={[
                        styles.expenseAmount,
                        {
                          color: isDark ? "#FCA5A5" : "#EF4444",
                        },
                      ]}
                    >
                      {formatCurrency(parseFloat(total?.toString() || "0") || 0)}
                    </Text>
                  </View>
                ))}
              </View>
              <View
                style={[
                  styles.totalRow,
                  {
                    borderTopColor: isDark ? "#374151" : "#E5E7EB",
                  },
                ]}
              >
                <Text style={[styles.totalLabel, { color: darkText }]}>
                  Total Expenses
                </Text>
                <Text
                  style={[
                    styles.totalValue,
                    {
                      color: isDark ? "#FCA5A5" : "#DC2626",
                    },
                  ]}
                >
                  {formatCurrency(
                    Math.max(0, parseFloat((expensesData.reduce(
                      (sum, row) => sum + parseFloat(row.amount || 0),
                      0
                    )).toString() || "0")) || 0
                  )}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Method Breakdown */}
        {loading && paymentData.length === 0 && CardSkeleton({ rows: 5 })}
        {paymentData.length > 0 && (
          <View>
            <Text
              style={[
                styles.sectionTitle,
                { color: darkText },
              ]}
            >
              💳 Payment Method Breakdown
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: darkCardBg },
              ]}
            >
              {(() => {
                const total = paymentData.reduce(
                  (sum, p: any) => sum + (parseFloat(p.value || 0) || 0),
                  0
                );
                return paymentData.map((p: any, idx: number) => {
                  const amount = parseFloat(p.value?.toString() || "0") || 0;
                  const pct = total > 0 ? (amount / total) * 100 : 0;
                  return (
                    <View
                      key={`${p.type}-${idx}`}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? "#374151" : "#E5E7EB",
                      }}
                    >
                      <Text style={{ color: darkText, fontSize: 13, fontWeight: "600", flex: 1 }}>
                        {p.type || p.method || "Unknown"}
                      </Text>
                      <Text style={{ color: darkSubText, fontSize: 12, marginRight: 8 }}>
                        {pct.toFixed(1)}%
                      </Text>
                      <Text style={{ color: isDark ? "#A7F3D0" : "#059669", fontSize: 13, fontWeight: "700" }}>
                        {formatCurrency(amount)}
                      </Text>
                    </View>
                  );
                });
              })()}
              <View style={[styles.totalRow, { borderTopColor: isDark ? "#374151" : "#E5E7EB" }]}>
                <Text style={[styles.totalLabel, { color: darkText }]}>Total Payments</Text>
                <Text style={[styles.totalValue, { color: isDark ? "#A7F3D0" : "#059669" }]}>
                  {formatCurrency(
                    paymentData.reduce(
                      (sum, p: any) => sum + (parseFloat(p.value || 0) || 0),
                      0
                    )
                  )}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Profit & Loss */}
        {loading && profitLossData.length === 0 && CardSkeleton({ rows: 6 })}
        {profitLossData.length > 0 && (
          <View>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: darkText,
                },
              ]}
            >
              💹 Profit & Loss
            </Text>
            {/* Timeframe toggle */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {["daily", "weekly", "monthly"].map((tf) => (
                <TouchableOpacity
                  key={tf}
                  onPress={() => setTimeframe(tf as any)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor:
                      timeframe === tf
                        ? (isDark ? "#3B82F6" : "#2563EB")
                        : (isDark ? "#111827" : "#F3F4F6"),
                    borderWidth: 1,
                    borderColor: isDark ? "#374151" : "#E5E7EB",
                  }}
                >
                  <Text style={{ color: timeframe === tf ? "#FFF" : darkText, fontSize: 12, fontWeight: "600" }}>
                    {tf[0].toUpperCase() + tf.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.profitLossGrid}>
              {profitLossData.slice(-7).map((item, idx) => {
                const net = item.profit - item.loss;
                const isProfit = net >= 0;
                const bgColor = isProfit
                  ? isDark
                    ? "#064E3B"
                    : "#DCFCE7"
                  : isDark
                    ? "#7F1D1D"
                    : "#FEE2E2";
                const textColor = isProfit
                  ? isDark
                    ? "#86EFAC"
                    : "#15803D"
                  : isDark
                    ? "#FCA5A5"
                    : "#DC2626";

                return (
                  <View
                    key={idx}
                    style={[
                      styles.profitLossCard,
                      {
                        backgroundColor: bgColor,
                      },
                    ]}
                  >
                    <Text style={[styles.profitLossDate, { color: darkText }]}>
                      {item.date}
                    </Text>
                    <View
                      style={[
                        styles.profitLossRow,
                        { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)", paddingBottom: 6 },
                      ]}
                    >
                      <Text style={[styles.profitLossLabel, { color: darkSubText }]}>
                        Net Sales
                      </Text>
                      <Text style={[styles.profitLossValue, { color: "#3B82F6" }]}>
                        {formatCurrency(parseFloat(item.profit?.toString() || "0") || 0)}
                      </Text>
                    </View>
                    <View style={[styles.profitLossRow, { paddingTop: 6 }]}>
                      <Text style={[styles.profitLossLabel, { color: darkSubText }]}>
                        Expenses
                      </Text>
                      <Text style={[styles.profitLossValue, { color: "#EF4444" }]}>
                        {formatCurrency(parseFloat(item.loss?.toString() || "0") || 0)}
                      </Text>
                    </View>
                    <View style={[styles.profitLossRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)" }]}>
                      <Text style={[styles.profitLossLabel, { color: darkSubText, fontWeight: "700" }]}>
                        Profit
                      </Text>
                      <Text style={[styles.profitLossValue, { color: textColor }]}>
                        {formatCurrency(parseFloat(net?.toString() || "0") || 0)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Empty State */}
        {productSalesData.length === 0 &&
          expensesData.length === 0 &&
          profitLossData.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="trending-up" size={40} color={darkSubText} />
              <Text style={[styles.emptyStateText, { color: darkSubText, marginTop: 12 }]}>
                No report data available for the selected date range.
              </Text>
            </View>
          )}

        {/* Staff Performance */}
        {loading && staffData.length === 0 && CardSkeleton({ rows: 4 })}
        {staffData.length > 0 && (
          <View>
            <Text
              style={[
                styles.sectionTitle,
                { color: darkText },
              ]}
            >
              👤 Staff Performance
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: darkCardBg },
              ]}
            >
              {staffData.map((s: any, idx: number) => (
                <View
                  key={`${s.staff_id || idx}`}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? "#374151" : "#E5E7EB",
                  }}
                >
                  <Text style={{ color: darkText, fontSize: 13, fontWeight: "700" }}>
                    {s.name || s.staff_name || `Staff #${s.staff_id ?? idx}`}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={{ color: darkSubText, fontSize: 12 }}>Orders</Text>
                    <Text style={{ color: darkText, fontSize: 12, fontWeight: "600" }}>
                      {(s.orders_count ?? s.completed_orders ?? 0).toString()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={{ color: darkSubText, fontSize: 12 }}>Total Sales</Text>
                    <Text style={{ color: isDark ? "#A7F3D0" : "#059669", fontSize: 12, fontWeight: "700" }}>
                      {formatCurrency(parseFloat(s.total_sales?.toString() || "0") || 0)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={{ color: darkSubText, fontSize: 12 }}>Avg Order Value</Text>
                    <Text style={{ color: isDark ? "#93C5FD" : "#2563EB", fontSize: 12, fontWeight: "700" }}>
                      {formatCurrency(parseFloat(s.avg_order_value?.toString() || "0") || 0)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 60 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}
