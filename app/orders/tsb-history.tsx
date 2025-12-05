// app/orders/tsb-history.tsx
import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import api from "../../src/api/axiosClient";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useCurrency } from "../../src/context/CurrencyContext";

type OrderItem = {
  id: number;
  product_name: string;
  price: number;
  quantity: number;
  paid_at?: string | null;
  paid?: boolean;
  payment_method?: string | null;
  extras?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
};

type PaymentRecord = {
  id: number;
  payment_method: string;
  amount: number;
  timestamp?: string;
  created_at?: string;
  previous_payment_method?: string;
};

type TSBOrder = {
  id: number;
  table_number?: number | null;
  customer_name?: string | null;
  total: number;
  status: string;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
  payments?: PaymentRecord[];
  payment_method?: string | null;
  receipt_id?: number;
};

type PaymentMethodItem = {
  id: number;
  label: string;
};

// Helper function to format date as YYYY-MM-DD
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function TSBOrderHistoryScreen() {
  const { isDark } = useAppearance();
  const { formatCurrency } = useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<TSBOrder[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);

  const today = new Date();

  // Filters
  const [fromDate, setFromDate] = useState(formatDateToString(today));
  const [toDate, setToDate] = useState(formatDateToString(today));
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [showCancellationsOnly, setShowCancellationsOnly] = useState(false);

  // Payment editing
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    null
  );
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);

  // Date picker state
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  // Load payment methods
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const res = await api.get("/settings/payments");
        const normalized = normalizePaymentMethods(res.data);
        setPaymentMethods(normalized);
      } catch (err) {
        setPaymentMethods(getDefaultPaymentMethods());
      }
    };
    loadPaymentMethods();
  }, []);

  const getDefaultPaymentMethods = (): PaymentMethodItem[] => [
    { id: 1, label: "Cash" },
    { id: 2, label: "Credit Card" },
    { id: 3, label: "Debit Card" },
    { id: 4, label: "Online Transfer" },
  ];

  const normalizePaymentMethods = (raw: any): PaymentMethodItem[] => {
    const seen = new Set<string>();
    const normalized: PaymentMethodItem[] = [];

    let inputMethods: any[] = [];
    if (Array.isArray(raw)) {
      inputMethods = raw;
    } else if (typeof raw === "object" && raw !== null) {
      if (Array.isArray(raw.methods)) {
        inputMethods = raw.methods;
      } else if (typeof raw.enabledMethods === "object") {
        inputMethods = Object.entries(raw.enabledMethods).map(
          ([key, enabled]) => ({
            id: key,
            label: key,
            enabled,
          })
        );
      }
    }

    inputMethods.forEach((method: any) => {
      if (!method || !method.label) return;
      if (method.enabled === false) return;

      const label = String(method.label).toLowerCase().trim();
      if (!seen.has(label)) {
        seen.add(label);
        normalized.push({
          id: method.id || Math.random(),
          label: method.label,
        });
      }
    });

    return normalized;
  };

  // Calculate grand total including extras
  const calculateGrandTotal = (items: OrderItem[] = []): number => {
    let total = 0;
    for (const item of items) {
      const qty = parseInt(item.quantity?.toString() || "1");
      const itemTotal = parseFloat(item.price?.toString() || "0") * qty;
      const extrasTotal = (item.extras || []).reduce((sum, ex) => {
        const extraQty = parseInt(ex.quantity?.toString() || "1");
        return sum + qty * extraQty * parseFloat(ex.price?.toString() || "0");
      }, 0);
      total += itemTotal + extrasTotal;
    }
    return total;
  };

  // Load closed orders (TSB tables)
  const loadOrderHistory = async (from: string, to: string) => {
    try {
      setLoading(true);

      const historyRes = await api.get<TSBOrder[]>(`/reports/history`, {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });

      const historyOrders = Array.isArray(historyRes.data)
        ? historyRes.data
        : [];

      if (historyOrders.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Enrich with items and payments
      const enriched = await Promise.all(
        historyOrders
          .filter((o) => o.table_number) // Only TSB (table) orders
          .map(async (order) => {
            try {
              const itemsRes = await api.get<OrderItem[]>(
                `/orders/${order.id}/items`
              );
              const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];

              let payments: PaymentRecord[] = [];
              try {
                const paymentsRes = await api.get<PaymentRecord[]>(
                  `/orders/${order.id}/payments`
                );
                payments = Array.isArray(paymentsRes.data)
                  ? paymentsRes.data
                  : [];
              } catch (e) {
                payments = [];
              }

              return { ...order, items, payments };
            } catch (e) {
              return { ...order, items: [], payments: [] };
            }
          })
      );

      setOrders(enriched);

      // Extract payment methods from orders
      try {
        const extractedSet = new Set<string>();
        enriched.forEach((order) => {
          if (
            order.payment_method &&
            typeof order.payment_method === "string"
          ) {
            extractedSet.add(order.payment_method.trim());
          }
          if (Array.isArray(order.payments)) {
            order.payments.forEach((p) => {
              if (
                p &&
                typeof p.payment_method === "string" &&
                p.payment_method.trim()
              ) {
                extractedSet.add(p.payment_method.trim());
              }
            });
          }
        });

        const extractedArray: PaymentMethodItem[] = Array.from(
          extractedSet
        ).map((label, idx) => ({
          id: idx + 1000,
          label,
        }));

        const defaults = getDefaultPaymentMethods();
        const finalMethods: PaymentMethodItem[] = [
          ...defaults,
          ...extractedArray.filter(
            (m) =>
              !defaults.some(
                (d) => d.label.toLowerCase() === m.label.toLowerCase()
              )
          ),
        ];

        if (extractedArray.length > 0) {
          setPaymentMethods(finalMethods);
        }
      } catch (extractionErr) {
        // Ignore extraction errors
      }
    } catch (err: any) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderHistory(fromDate, toDate);
  }, [fromDate, toDate]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (showCancellationsOnly) {
      result = result.filter((o) => o.status === "cancelled");
    }

    if (paymentFilter !== "All" && paymentMethods.length > 0) {
      result = result.filter((o) => {
        const paymentLabel =
          o.payment_method || o.payments?.[0]?.payment_method || "";
        return paymentLabel.toLowerCase() === paymentFilter.toLowerCase();
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((o) => {
        const customerMatch = String(o.customer_name || "")
          .toLowerCase()
          .includes(q);
        const tableMatch = String(o.table_number || "").includes(q);
        const orderIdMatch = String(o.id).includes(q);
        return customerMatch || tableMatch || orderIdMatch;
      });
    }

    return result;
  }, [
    orders,
    showCancellationsOnly,
    paymentFilter,
    searchQuery,
    paymentMethods,
  ]);

  // Group by date
  const groupedOrders = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        const dateKey = order.created_at
          ? new Date(order.created_at).toLocaleDateString()
          : "Unknown";
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(order);
        return acc;
      },
      {} as Record<string, TSBOrder[]>
    );
  }, [filteredOrders]);

  // Quick date range helpers
  const handleQuickDate = (days: number) => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    setFromDate(formatDateToString(from));
    setToDate(formatDateToString(now));
  };

  // Date picker handlers
  const handleFromDateChange = (event: any, selectedDate: any) => {
    setShowFromDatePicker(false);
    if (selectedDate) {
      setFromDate(formatDateToString(selectedDate));
    }
  };

  const handleToDateChange = (event: any, selectedDate: any) => {
    setShowToDatePicker(false);
    if (selectedDate) {
      setToDate(formatDateToString(selectedDate));
    }
  };

  const handleUpdatePaymentMethod = async (
    orderId: number,
    paymentMethodId: string
  ) => {
    try {
      const selectedMethod = paymentMethods.find(
        (m) => String(m.id) === paymentMethodId
      );
      const paymentLabel = selectedMethod?.label || paymentMethodId;

      const orderToUpdate = orders.find((o) => o.id === orderId);
      const oldPaymentMethod =
        orderToUpdate?.payment_method ||
        orderToUpdate?.payments?.[0]?.payment_method ||
        "Unknown";

      await api.put(`/orders/${orderId}`, {
        payment_method: paymentLabel,
      });

      setOrders((prevOrders) =>
        prevOrders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                payment_method: paymentLabel,
                payments:
                  o.payments && o.payments.length > 0
                    ? o.payments.map((p, idx) => ({
                        ...p,
                        payment_method:
                          idx === 0 ? paymentLabel : p.payment_method,
                        previous_payment_method:
                          idx === 0
                            ? oldPaymentMethod
                            : p.previous_payment_method,
                      }))
                    : o.payments,
              }
            : o
        )
      );

      Alert.alert("Success", "Payment method updated");
      setEditingOrderId(null);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error || err?.message || "Failed to update";
      Alert.alert("Error", errorMsg);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "closed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      case "confirmed":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons
              name="chevron-back"
              size={28}
              color={isDark ? "#818CF8" : "#6366F1"}
            />
          </TouchableOpacity>
          <View>
            <Text
              style={[styles.headerTitle, isDark && styles.headerTitleDark]}
            >
              📘 Table History
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                isDark && styles.headerSubtitleDark,
              ]}
            >
              {filteredOrders.length} orders
            </Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.filterInput, isDark && styles.filterInputDark]}>
        <Ionicons
          name="search"
          size={18}
          color={isDark ? "#9CA3AF" : "#6B7280"}
        />
        <TextInput
          style={[styles.filterTextInput, isDark && styles.filterTextInputDark]}
          placeholder="Search table, customer, order ID..."
          placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            showCancellationsOnly && styles.filterButtonActive,
          ]}
          onPress={() => setShowCancellationsOnly(!showCancellationsOnly)}
        >
          <Text
            style={[
              styles.filterButtonText,
              showCancellationsOnly && styles.filterButtonTextActive,
            ]}
          >
            {showCancellationsOnly ? "✓ Cancelled" : "All Orders"}
          </Text>
        </TouchableOpacity>

        {/* Payment Filter */}
        <View style={[styles.filterButton, styles.filterButtonPayment]}>
          <Text style={styles.filterButtonText}>Payment:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginLeft: 8 }}
          >
            {["All", ...paymentMethods.map((p) => p.label)].map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentFilterChip,
                  paymentFilter === method && styles.paymentFilterChipActive,
                ]}
                onPress={() => setPaymentFilter(method)}
              >
                <Text
                  style={[
                    styles.paymentFilterChipText,
                    paymentFilter === method &&
                      styles.paymentFilterChipTextActive,
                  ]}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Date Filters */}
      <View style={styles.dateFiltersRow}>
        <View style={styles.dateFilterGroup}>
          <Text style={[styles.dateLabel, isDark && styles.dateLabelDark]}>
            From
          </Text>
          <TouchableOpacity
            style={[styles.dateInput, isDark && styles.dateInputDark]}
            onPress={() => setShowFromDatePicker(true)}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
            <Text
              style={[styles.dateInputText, isDark && styles.dateInputTextDark]}
            >
              {fromDate}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dateFilterGroup}>
          <Text style={[styles.dateLabel, isDark && styles.dateLabelDark]}>
            To
          </Text>
          <TouchableOpacity
            style={[styles.dateInput, isDark && styles.dateInputDark]}
            onPress={() => setShowToDatePicker(true)}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
            <Text
              style={[styles.dateInputText, isDark && styles.dateInputTextDark]}
            >
              {toDate}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Date Range Buttons */}
      <View style={styles.quickDateRow}>
        <TouchableOpacity
          style={[styles.quickDateBtn, isDark && styles.quickDateBtnDark]}
          onPress={() => handleQuickDate(0)}
        >
          <Text
            style={[
              styles.quickDateBtnText,
              isDark && styles.quickDateBtnTextDark,
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickDateBtn, isDark && styles.quickDateBtnDark]}
          onPress={() => handleQuickDate(7)}
        >
          <Text
            style={[
              styles.quickDateBtnText,
              isDark && styles.quickDateBtnTextDark,
            ]}
          >
            7 days
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickDateBtn, isDark && styles.quickDateBtnDark]}
          onPress={() => handleQuickDate(30)}
        >
          <Text
            style={[
              styles.quickDateBtnText,
              isDark && styles.quickDateBtnTextDark,
            ]}
          >
            30 days
          </Text>
        </TouchableOpacity>
      </View>

      {/* Order List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
            Loading...
          </Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
            No orders found
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {Object.entries(groupedOrders).map(([dateKey, ordersForDate]) => (
            <View key={dateKey} style={styles.dateGroupContainer}>
              <Text
                style={[
                  styles.dateGroupHeader,
                  isDark && styles.dateGroupHeaderDark,
                ]}
              >
                {dateKey}
              </Text>
              {ordersForDate.map((order) => (
                <View
                  key={order.id}
                  style={[
                    styles.orderCardModern,
                    isDark && styles.orderCardModernDark,
                  ]}
                >
                  {/* Header */}
                  <View style={styles.modernCardHeader}>
                    <View style={styles.modernHeaderLeft}>
                      <Text
                        style={[
                          styles.orderNumberModern,
                          isDark && styles.orderNumberModernDark,
                        ]}
                      >
                        🍽️ Table {order.table_number}
                      </Text>
                      <Text
                        style={[
                          styles.orderMetaModern,
                          isDark && styles.orderMetaModernDark,
                        ]}
                      >
                        Order #{order.id}
                        {order.customer_name ? ` • ${order.customer_name}` : ""}
                      </Text>
                    </View>

                    <View style={styles.modernHeaderRight}>
                      <View
                        style={[
                          styles.statusChip,
                          { backgroundColor: getStatusColor(order.status) },
                        ]}
                      >
                        <Text style={styles.statusChipText}>
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.totalAmountModern,
                          isDark && styles.totalAmountModernDark,
                        ]}
                      >
                        {formatCurrency(Number(order.total) || 0)}
                      </Text>
                    </View>
                  </View>

                  {/* Body - Items */}
                  <View style={styles.modernCardBody}>
                    <View style={styles.itemsListContainer}>
                      {(order.items || []).map((it) => (
                        <View
                          key={`${order.id}-${it.id}`}
                          style={[
                            styles.itemRowWithEdit,
                            isDark && styles.itemRowWithEditDark,
                          ]}
                        >
                          <View style={styles.itemInfoSection}>
                            <Text style={styles.itemPillText}>
                              {it.product_name} ×{it.quantity}
                            </Text>
                            <Text
                              style={[
                                styles.itemPriceSmall,
                                isDark && styles.itemPriceSmallDark,
                              ]}
                            >
                              {formatCurrency(
                                Number(it.price) * (it.quantity || 1) || 0
                              )}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Payments */}
                    {order.payments && order.payments.length > 0 && (
                      <View style={styles.paymentsRow}>
                        {order.payments.map((p, i) => (
                          <View key={i}>
                            <View style={styles.paymentBadge}>
                              <Text style={styles.paymentBadgeText}>
                                {p.payment_method} •{" "}
                                {formatCurrency(Number(p.amount) || 0)}
                              </Text>
                            </View>
                            {p.previous_payment_method && p.created_at && (
                              <View
                                style={[
                                  styles.paymentChangeLogContainer,
                                  isDark &&
                                    styles.paymentChangeLogContainerDark,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.paymentChangeLog,
                                    isDark && styles.paymentChangeLogDark,
                                  ]}
                                >
                                  🔄 {p.previous_payment_method} →{" "}
                                  {p.payment_method}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                    {(!order.payments || order.payments.length === 0) &&
                      order.payment_method && (
                        <View style={styles.paymentsRow}>
                          <View style={styles.paymentBadge}>
                            <Text style={styles.paymentBadgeText}>
                              {order.payment_method}
                            </Text>
                          </View>
                        </View>
                      )}
                  </View>

                  {/* Footer */}
                  <View style={styles.modernCardFooter}>
                    <Text
                      style={[
                        styles.orderTimeText,
                        isDark && styles.orderTimeTextDark,
                      ]}
                    >
                      {new Date(order.created_at).toLocaleTimeString()}
                    </Text>
                    <TouchableOpacity
                      style={styles.editPaymentBtn}
                      onPress={() => {
                        setEditingOrderId(order.id);
                        setSelectedPaymentId(null);
                      }}
                    >
                      <Ionicons name="pencil" size={16} color="#6366F1" />
                      <Text style={styles.editPaymentBtnText}>
                        Edit Payment
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Edit Payment Method Modal */}
      {editingOrderId !== null && (
        <Modal
          visible={editingOrderId !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingOrderId(null)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, isDark && styles.modalContentDark]}
            >
              <View style={styles.modalHeader}>
                <Text
                  style={[styles.modalTitle, isDark && styles.modalTitleDark]}
                >
                  Change Payment Method
                </Text>
                <TouchableOpacity onPress={() => setEditingOrderId(null)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                  />
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.modalSubtitle,
                  isDark && styles.modalSubtitleDark,
                ]}
              >
                Order #{editingOrderId}
              </Text>

              {paymentMethods.length === 0 ? (
                <View style={styles.loadingPaymentMethods}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text
                    style={[
                      styles.loadingText,
                      isDark && styles.loadingTextDark,
                    ]}
                  >
                    Loading payment methods...
                  </Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodButton,
                      isDark && styles.paymentMethodButtonDark,
                    ]}
                    onPress={() => setPaymentDropdownOpen(!paymentDropdownOpen)}
                  >
                    <Text
                      style={[
                        styles.paymentMethodButtonText,
                        isDark && styles.paymentMethodButtonTextDark,
                      ]}
                    >
                      {selectedPaymentId
                        ? (() => {
                            const method = paymentMethods.find(
                              (m) => String(m.id) === selectedPaymentId
                            );
                            const label = method?.label
                              ? typeof method.label === "string"
                                ? method.label
                                : String(method.label)
                              : "Select method...";
                            return label;
                          })()
                        : "Select method..."}
                    </Text>
                    <Ionicons
                      name={paymentDropdownOpen ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </TouchableOpacity>

                  {paymentDropdownOpen && (
                    <ScrollView
                      style={[
                        styles.paymentDropdownList,
                        isDark && styles.paymentDropdownListDark,
                      ]}
                    >
                      {paymentMethods.map((method) => {
                        const label =
                          typeof method.label === "string"
                            ? method.label
                            : String(method.label || "Unknown");
                        return (
                          <TouchableOpacity
                            key={method.id}
                            style={[
                              styles.paymentDropdownItem,
                              isDark && styles.paymentDropdownItemDark,
                              String(method.id) === selectedPaymentId &&
                                styles.paymentDropdownItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedPaymentId(String(method.id));
                              setPaymentDropdownOpen(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.paymentDropdownItemText,
                                isDark && styles.paymentDropdownItemTextDark,
                                String(method.id) === selectedPaymentId &&
                                  styles.paymentDropdownItemTextSelected,
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[
                        styles.modalCancelBtn,
                        isDark && styles.modalCancelBtnDark,
                      ]}
                      onPress={() => setEditingOrderId(null)}
                    >
                      <Text
                        style={[
                          styles.modalCancelBtnText,
                          isDark && styles.modalCancelBtnTextDark,
                        ]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalSaveBtn,
                        isDark && styles.modalSaveBtnDark,
                        !selectedPaymentId && styles.modalSaveBtnDisabled,
                      ]}
                      disabled={!selectedPaymentId}
                      onPress={() => {
                        if (selectedPaymentId && editingOrderId) {
                          handleUpdatePaymentMethod(
                            editingOrderId,
                            selectedPaymentId
                          );
                        }
                      }}
                    >
                      <Text style={styles.modalSaveBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Date Pickers */}
      {showFromDatePicker && (
        <DateTimePicker
          value={new Date(fromDate)}
          mode="date"
          display="spinner"
          onChange={handleFromDateChange}
        />
      )}

      {showToDatePicker && (
        <DateTimePicker
          value={new Date(toDate)}
          mode="date"
          display="spinner"
          onChange={handleToDateChange}
        />
      )}

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },
  containerDark: {
    backgroundColor: "#020617",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderBottomColor: "#1F2937",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },

  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },

  filterInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterInputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  filterTextInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  filterTextInputDark: {
    color: "#F3F4F6",
  },

  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },

  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },

  filterButtonActive: {
    backgroundColor: "#EF4444",
    borderColor: "#DC2626",
  },

  filterButtonPayment: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },

  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  filterButtonTextActive: {
    color: "#FFFFFF",
  },

  paymentFilterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    marginRight: 6,
  },

  paymentFilterChipActive: {
    backgroundColor: "#6366F1",
  },

  paymentFilterChipText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },

  paymentFilterChipTextActive: {
    color: "#FFFFFF",
  },

  dateFiltersRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  dateFilterGroup: {
    flex: 1,
  },

  dateLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 3,
  },
  dateLabelDark: {
    color: "#9CA3AF",
  },

  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dateInputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  dateInputText: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "500",
  },
  dateInputTextDark: {
    color: "#F3F4F6",
  },

  quickDateRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
  },

  quickDateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#6366F1",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#4F46E5",
  },
  quickDateBtnDark: {
    backgroundColor: "#4F46E5",
    borderColor: "#6366F1",
  },

  quickDateBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  quickDateBtnTextDark: {
    color: "#F9FAFB",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyText: {
    fontSize: 16,
    color: "#6B7280",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 160,
  },

  dateGroupContainer: {
    marginBottom: 16,
  },

  dateGroupHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateGroupHeaderDark: {
    color: "#9CA3AF",
  },

  orderCardModern: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 0,
  },
  orderCardModernDark: {
    backgroundColor: "#0B1020",
  },

  modernCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modernHeaderLeft: {
    flex: 1,
  },
  orderNumberModern: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  orderNumberModernDark: {
    color: "#F8FAFC",
  },
  orderMetaModern: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  orderMetaModernDark: {
    color: "#9CA3AF",
  },
  modernHeaderRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 6,
  },
  statusChipText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 11,
  },

  totalAmountModern: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  totalAmountModernDark: {
    color: "#F3F4F6",
  },

  modernCardBody: {
    marginTop: 2,
    marginBottom: 8,
  },
  itemsListContainer: {
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  itemRowWithEdit: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginBottom: 6,
  },
  itemRowWithEditDark: {
    backgroundColor: "#1F2937",
  },
  itemInfoSection: {
    flex: 1,
    flexDirection: "column",
  },
  itemPriceSmall: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  itemPriceSmallDark: {
    color: "#9CA3AF",
  },
  itemPillText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },

  paymentsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  paymentBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 6,
  },
  paymentBadgeText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "700",
  },
  paymentChangeLogContainer: {
    backgroundColor: "#DDD6FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 2,
    marginLeft: 0,
    borderLeftWidth: 3,
    borderLeftColor: "#6366F1",
  },
  paymentChangeLogContainerDark: {
    backgroundColor: "#312E81",
    borderLeftColor: "#818CF8",
  },
  paymentChangeLog: {
    fontSize: 11,
    color: "#4C1D95",
    fontWeight: "600",
  },
  paymentChangeLogDark: {
    color: "#A78BFA",
  },

  modernCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  orderTimeText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  orderTimeTextDark: {
    color: "#6B7280",
  },
  editPaymentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#EEF2FF",
    borderRadius: 6,
  },
  editPaymentBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4F46E5",
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    width: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalContentDark: {
    backgroundColor: "#0B1020",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalTitleDark: {
    color: "#F9FAFB",
  },

  modalSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
  },
  modalSubtitleDark: {
    color: "#9CA3AF",
  },

  paymentMethodButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  paymentMethodButtonDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  paymentMethodButtonText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  paymentMethodButtonTextDark: {
    color: "#F3F4F6",
  },

  paymentDropdownList: {
    maxHeight: 200,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    overflow: "hidden",
  },
  paymentDropdownListDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },

  paymentDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  paymentDropdownItemDark: {
    borderBottomColor: "#374151",
  },

  paymentDropdownItemSelected: {
    backgroundColor: "#EEF2FF",
  },

  paymentDropdownItemText: {
    fontSize: 14,
    color: "#374151",
  },
  paymentDropdownItemTextDark: {
    color: "#D1D5DB",
  },

  paymentDropdownItemTextSelected: {
    color: "#6366F1",
    fontWeight: "700",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
  },

  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    alignItems: "center",
  },
  modalCancelBtnDark: {
    backgroundColor: "#374151",
  },

  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },
  modalCancelBtnTextDark: {
    color: "#D1D5DB",
  },

  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#6366F1",
    borderRadius: 10,
    alignItems: "center",
  },
  modalSaveBtnDark: {
    backgroundColor: "#4F46E5",
  },

  modalSaveBtnDisabled: {
    backgroundColor: "#D1D5DB",
    opacity: 0.5,
  },

  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  loadingPaymentMethods: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  loadingTextDark: {
    color: "#9CA3AF",
  },
});
