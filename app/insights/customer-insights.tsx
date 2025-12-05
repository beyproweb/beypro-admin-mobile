import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import { useTranslation } from "react-i18next";
import { usePermissions } from "../../src/context/PermissionsContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import secureFetch from "../../src/utils/secureFetch";
import BottomNav from "../../src/components/navigation/BottomNav";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  birthday?: string;
  visit_count: number;
  lifetime_value: number;
  debt: number;
  last_visit?: string;
}

interface DebtOrder {
  id: string;
  total: number;
  debt_recorded_total: number;
  items: any[];
  remaining?: number;
}

interface Stats {
  total: number;
  repeat: number;
  birthdays: number;
  top: Customer[];
}

const { width } = Dimensions.get("window");

const CustomerInsights: React.FC = () => {
  const { appearance, isDark, fontScale } = useAppearance();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const { formatCurrency } = useCurrency();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [birthdayCustomers, setBirthdayCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    repeat: 0,
    birthdays: 0,
    top: [],
  });
  const [editModal, setEditModal] = useState({
    open: false,
    data: null as Customer | null,
  });
  const [debtModal, setDebtModal] = useState({
    open: false,
    loading: false,
    customer: null as Customer | null,
    orders: [] as DebtOrder[],
    order: null as DebtOrder | null,
    items: [],
    paymentMethod: "Cash",
    amount: "",
    error: "",
  });
  const [isDebtPaying, setIsDebtPaying] = useState(false);

  const colors = isDark
    ? {
        bg: "#09090b",
        card: "#18181b",
        text: "#fafafa",
        textSecondary: "#a1a1aa",
        border: "#3f3f46",
      }
    : {
        bg: "#ffffff",
        card: "#f5f5f5",
        text: "#000000",
        textSecondary: "#666666",
        border: "#e5e5e5",
      };

  // Check permission
  const canAccess = hasPermission("customer");

  // Helper: Check if birthday is this week
  const isThisWeekBirthday = (birthday: string | undefined) => {
    if (!birthday) return false;
    const today = new Date();
    const bday = new Date(birthday);
    const thisYear = today.getFullYear();
    bday.setFullYear(thisYear);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return bday >= weekStart && bday <= weekEnd;
  };

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await secureFetch(`/customers${query}`);
      const customerList = Array.isArray(res) ? res : res.data || [];

      setCustomers(customerList);
      setStats((s) => ({
        ...s,
        total: customerList.length,
        repeat: customerList.filter(
          (c: Customer) => c.visit_count && c.visit_count > 1
        ).length,
        birthdays: customerList.filter((c: Customer) =>
          isThisWeekBirthday(c.birthday)
        ).length,
        top: [...customerList]
          .sort(
            (a: Customer, b: Customer) =>
              (b.visit_count || 0) - (a.visit_count || 0)
          )
          .slice(0, 3),
      }));
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      setCustomers([]);
    }
  }, [search]);

  // Fetch birthday customers
  const fetchBirthdayCustomers = useCallback(async () => {
    try {
      const res = await secureFetch("/customers/birthdays");
      setBirthdayCustomers(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error("Failed to fetch birthday customers:", err);
    }
  }, []);

  // Load data on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchBirthdayCustomers()]);
    setLoading(false);
  }, [fetchCustomers, fetchBirthdayCustomers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchCustomers();
      fetchBirthdayCustomers();
    }, [fetchCustomers, fetchBirthdayCustomers])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCustomers(), fetchBirthdayCustomers()]);
    setRefreshing(false);
  };

  // Close debt modal
  const closeDebtModal = useCallback(() => {
    setDebtModal({
      open: false,
      loading: false,
      customer: null,
      orders: [],
      order: null,
      items: [],
      paymentMethod: "Cash",
      amount: "",
      error: "",
    });
    setIsDebtPaying(false);
  }, []);

  // Fetch debt order items
  const fetchDebtOrderItems = useCallback(async (orderId: string) => {
    try {
      const items = await secureFetch(`/orders/${orderId}/items`);
      return Array.isArray(items) ? items : [];
    } catch (err) {
      console.error("Failed to fetch order items:", err);
      return [];
    }
  }, []);

  // Save customer
  const handleSaveCustomer = useCallback(async (updated: Customer) => {
    try {
      const res = await secureFetch(`/customers/${updated.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: updated.name,
          phone: updated.phone,
          address: updated.address || "",
          birthday: updated.birthday || null,
          email: updated.email || null,
        }),
      });
      setCustomers((cs) => cs.map((c) => (c.id === updated.id ? res : c)));
      setEditModal({ open: false, data: null });
      Alert.alert("Success", "✅ Customer updated successfully!");
    } catch (err) {
      Alert.alert("Error", "Failed to update customer");
    }
  }, []);

  // Delete customer
  const handleDeleteCustomer = useCallback(async (id: string) => {
    Alert.alert("Delete Customer?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await secureFetch(`/customers/${id}`, { method: "DELETE" });
            setCustomers((cs) => cs.filter((c) => c.id !== id));
            setEditModal({ open: false, data: null });
            Alert.alert("Success", "🗑️ Customer deleted successfully!");
          } catch (err) {
            Alert.alert("Error", "Failed to delete customer");
          }
        },
      },
    ]);
  }, []);

  // Open debt payment modal
  const handleOpenDebtPayment = useCallback(
    async (customer: Customer) => {
      if (!customer?.phone) {
        Alert.alert("Error", "Customer phone is required to pay debt");
        return;
      }

      setIsDebtPaying(false);
      setDebtModal({
        open: true,
        loading: true,
        customer,
        orders: [],
        order: null,
        items: [],
        paymentMethod: "Cash",
        amount: "",
        error: "",
      });

      try {
        const data = await secureFetch(
          `/orders/debt/find?phone=${encodeURIComponent(customer.phone)}`
        );
        const ordersList = Array.isArray(data?.orders)
          ? data.orders
          : data?.id
            ? [data]
            : [];

        if (!ordersList.length) {
          throw new Error("No unpaid debt order found for this customer");
        }

        const ordersWithItems = [];
        for (const order of ordersList) {
          const items = await fetchDebtOrderItems(order.id);
          ordersWithItems.push({
            ...order,
            items,
            remaining: Math.max(
              0,
              order.debt_recorded_total || order.total || 0
            ),
          });
        }

        const targetOrder =
          ordersWithItems.find(
            (o) => Array.isArray(o.items) && o.items.length > 0
          ) || ordersWithItems[0];
        const due = targetOrder?.remaining ?? 0;

        setDebtModal({
          open: true,
          loading: false,
          customer,
          orders: ordersWithItems,
          order: targetOrder,
          items: targetOrder?.items || [],
          paymentMethod: "Cash",
          amount: due.toFixed(2),
          error: "",
        });
      } catch (err) {
        setDebtModal((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error ? err.message : "Failed to load debt order",
        }));
      }
    },
    [fetchDebtOrderItems]
  );

  // Select debt order
  const handleSelectDebtOrder = useCallback(
    async (orderId: string) => {
      if (!orderId || debtModal.order?.id === orderId) return;
      const targetOrder = debtModal.orders.find((o) => o.id === orderId);
      if (!targetOrder) return;

      if (targetOrder.items && targetOrder.items.length) {
        setDebtModal((prev) => ({
          ...prev,
          order: targetOrder,
          items: targetOrder.items,
          amount: (
            targetOrder.remaining ??
            Math.max(
              0,
              targetOrder.debt_recorded_total || targetOrder.total || 0
            )
          ).toFixed(2),
          error: "",
        }));
        return;
      }

      setDebtModal((prev) => ({
        ...prev,
        loading: true,
        error: "",
      }));

      try {
        const items = await fetchDebtOrderItems(orderId);
        const due = Math.max(
          0,
          targetOrder.debt_recorded_total || targetOrder.total || 0
        );
        const updatedOrders = debtModal.orders.map((order) =>
          order.id === orderId ? { ...order, items, remaining: due } : order
        );

        setDebtModal((prev) => ({
          ...prev,
          loading: false,
          orders: updatedOrders,
          order: { ...targetOrder, items, remaining: due },
          items,
          amount: due.toFixed(2),
        }));
      } catch (err) {
        setDebtModal((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to load order items",
        }));
      }
    },
    [debtModal.order, debtModal.orders, fetchDebtOrderItems]
  );

  // Confirm debt payment
  const handleConfirmDebtPayment = useCallback(async () => {
    if (!debtModal.order || isDebtPaying) return;

    const amountDue = Math.max(
      0,
      Number(debtModal.order.debt_recorded_total || debtModal.order.total || 0)
    );

    if (amountDue <= 0) {
      setDebtModal((prev) => ({
        ...prev,
        error: "No unpaid debt remains for this order",
      }));
      return;
    }

    const desiredAmount = Math.max(0, Number(debtModal.amount || 0));
    if (desiredAmount <= 0) {
      setDebtModal((prev) => ({ ...prev, error: "Enter an amount to pay" }));
      return;
    }

    const amountToPay = Math.min(amountDue, desiredAmount);

    try {
      setIsDebtPaying(true);
      await secureFetch(`/orders/${debtModal.order.id}/pay`, {
        method: "PUT",
        body: JSON.stringify({
          payment_method: debtModal.paymentMethod,
          amount: amountToPay,
          total: debtModal.order.total,
        }),
      });

      Alert.alert("Success", "Debt payment recorded successfully");
      closeDebtModal();
      fetchCustomers();
    } catch (err) {
      setDebtModal((prev) => ({
        ...prev,
        error: "Failed to record debt payment",
      }));
    } finally {
      setIsDebtPaying(false);
    }
  }, [
    debtModal.order,
    debtModal.amount,
    debtModal.paymentMethod,
    isDebtPaying,
    closeDebtModal,
    fetchCustomers,
  ]);

  // Early return for permission check (after all hooks are called)
  if (!canAccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          <Ionicons name="lock-closed" size={48} color="#dc2626" />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Access Denied
          </Text>
          <Text style={[styles.errorSubText, { color: colors.textSecondary }]}>
            You don't have permission to view Customer Insights
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Dashboard-style Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text
              style={[
                styles.headerTitle,
                isDark && styles.headerTitleDark,
                { fontSize: 26 * (fontScale || 1) },
              ]}
            >
              {t ? t("Customer Insights") : "Customer Insights"}
            </Text>
          </View>
          <View style={styles.headerBrand}>
            <View>
              <Text
                style={[
                  styles.logoText,
                  isDark && styles.logoTextDark,
                  { fontSize: 18 * (fontScale || 1) },
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

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <StatCard
            icon="person"
            label="Total"
            value={stats.total.toString()}
            color="#3b82f6"
          />
          <StatCard
            icon="repeat"
            label="Repeat"
            value={stats.repeat.toString()}
            color="#10b981"
          />
          <StatCard
            icon="gift"
            label="Birthdays"
            value={stats.birthdays.toString()}
            color="#ec4899"
          />
        </View>

        {/* Search */}
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchBox,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Ionicons name="search" size={18} color="#3b82f6" />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by name or phone…"
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          {search && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearch("")}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Top Customers */}
        {stats.top.length > 0 && (
          <View style={styles.topCustomersSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={20} color="#fbbf24" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Top Customers
              </Text>
            </View>
            <FlatList
              data={stats.top}
              keyExtractor={(c) => c.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item: c }) => (
                <View
                  style={[
                    styles.topCustomerCard,
                    { backgroundColor: "#fef3c7" },
                  ]}
                >
                  <Text style={styles.topCustomerName}>{c.name}</Text>
                  <Text style={styles.topCustomerPhone}>📱 {c.phone}</Text>
                  <Text style={styles.topCustomerValue}>
                    {formatCurrency(c.lifetime_value)}
                  </Text>
                  <Text style={styles.topCustomerVisits}>
                    Visits: {c.visit_count || 1}
                  </Text>
                </View>
              )}
              scrollEnabled
              contentContainerStyle={{ paddingRight: 16 }}
            />
          </View>
        )}

        {/* Birthday Customers */}
        {birthdayCustomers.length > 0 && (
          <View style={styles.birthdaySection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cake" size={20} color="#ec4899" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                🎂 Birthday Customers
              </Text>
            </View>
            <FlatList
              data={birthdayCustomers}
              keyExtractor={(c) => c.id}
              scrollEnabled={false}
              renderItem={({ item: c }) => (
                <View
                  style={[
                    styles.birthdayRow,
                    {
                      backgroundColor: colors.card,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.birthdayInfo}>
                    <Text style={[styles.birthdayName, { color: colors.text }]}>
                      {c.name}
                    </Text>
                    <Text
                      style={[
                        styles.birthdayPhone,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {c.phone}
                    </Text>
                  </View>
                  <View style={styles.birthdayStats}>
                    <Text style={[styles.statBadge, { color: colors.text }]}>
                      📅{" "}
                      {c.birthday
                        ? new Date(c.birthday).toLocaleDateString()
                        : "Unknown"}
                    </Text>
                    <Text style={[styles.statBadge, { color: colors.text }]}>
                      💰 {formatCurrency(c.lifetime_value)}
                    </Text>
                  </View>
                </View>
              )}
            />
          </View>
        )}

        {/* Customer List */}
        <View
          style={[styles.customerListSection, { backgroundColor: colors.card }]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text, marginBottom: 12 },
            ]}
          >
            All Customers
          </Text>
          {customers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color={colors.textSecondary} />
              <Text
                style={[styles.emptyStateText, { color: colors.textSecondary }]}
              >
                No customers found
              </Text>
            </View>
          ) : (
            <FlatList
              data={customers}
              keyExtractor={(c) => c.id}
              scrollEnabled={false}
              renderItem={({ item: c }) => {
                const debtValue = Number.isFinite(Number(c.debt))
                  ? Number(c.debt)
                  : 0;
                const debtPositive = debtValue > 0;
                const lastVisitText = c.last_visit
                  ? new Date(c.last_visit).toLocaleDateString()
                  : "Not yet";

                return (
                  <View
                    style={[
                      styles.customerCard,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.customerHeader}>
                      <View style={styles.customerInfo}>
                        <Text
                          style={[styles.customerName, { color: colors.text }]}
                        >
                          {c.name || "Guest"}
                        </Text>
                        <Text
                          style={[
                            styles.customerPhone,
                            { color: colors.textSecondary },
                          ]}
                        >
                          📱 {c.phone || "No phone"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.debtBadge,
                          {
                            backgroundColor: debtPositive
                              ? "#fee2e2"
                              : "#ecfdf5",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.debtText,
                            {
                              color: debtPositive ? "#991b1b" : "#065f46",
                            },
                          ]}
                        >
                          {debtPositive ? `₺${debtValue.toFixed(2)}` : "Clear"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metricsRow}>
                      <MetricChip label="Visits" value={c.visit_count || 1} />
                      <MetricChip
                        label="Spent"
                        value={formatCurrency(c.lifetime_value)}
                      />
                      <MetricChip label="Last" value={lastVisitText} />
                    </View>

                    <View style={styles.detailsRow}>
                      <DetailRow
                        icon="location"
                        label="Address"
                        value={c.address || "No address"}
                      />
                      <DetailRow
                        icon="mail"
                        label="Email"
                        value={c.email || "No email"}
                      />
                      <DetailRow
                        icon="calendar"
                        label="Birthday"
                        value={
                          c.birthday
                            ? new Date(c.birthday).toLocaleDateString()
                            : "Unknown"
                        }
                      />
                    </View>

                    <View style={styles.actionRow}>
                      {debtPositive && (
                        <TouchableOpacity
                          style={styles.debtButton}
                          onPress={() => handleOpenDebtPayment(c)}
                        >
                          <Ionicons name="wallet" size={16} color="white" />
                          <Text style={styles.debtButtonText}>Pay Debt</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setEditModal({ open: true, data: c })}
                      >
                        <Ionicons name="pencil" size={16} color="#4f46e5" />
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Edit Modal */}
        <Modal
          visible={editModal.open}
          transparent
          animationType="slide"
          onRequestClose={() => setEditModal({ open: false, data: null })}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Edit Customer
                </Text>
                <TouchableOpacity
                  onPress={() => setEditModal({ open: false, data: null })}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {editModal.data && (
                <ScrollView style={styles.modalBody}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Name"
                    value={editModal.data.name || ""}
                    onChangeText={(text) =>
                      setEditModal((m) => ({
                        ...m,
                        data: { ...m.data!, name: text },
                      }))
                    }
                  />
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Phone"
                    value={editModal.data.phone || ""}
                    onChangeText={(text) =>
                      setEditModal((m) => ({
                        ...m,
                        data: { ...m.data!, phone: text },
                      }))
                    }
                  />
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Address"
                    value={editModal.data.address || ""}
                    onChangeText={(text) =>
                      setEditModal((m) => ({
                        ...m,
                        data: { ...m.data!, address: text },
                      }))
                    }
                  />
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Email"
                    value={editModal.data.email || ""}
                    onChangeText={(text) =>
                      setEditModal((m) => ({
                        ...m,
                        data: { ...m.data!, email: text },
                      }))
                    }
                    keyboardType="email-address"
                  />
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Birthday (YYYY-MM-DD)"
                    value={
                      editModal.data.birthday
                        ? new Date(editModal.data.birthday)
                            .toISOString()
                            .slice(0, 10)
                        : ""
                    }
                    onChangeText={(text) =>
                      setEditModal((m) => ({
                        ...m,
                        data: { ...m.data!, birthday: text },
                      }))
                    }
                  />

                  <View style={styles.modalButtonRow}>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleSaveCustomer(editModal.data!)}
                    >
                      <Ionicons name="checkmark" size={18} color="white" />
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteCustomer(editModal.data!.id)}
                    >
                      <Ionicons name="trash" size={18} color="white" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Debt Payment Modal */}
        <Modal
          visible={debtModal.open}
          transparent
          animationType="slide"
          onRequestClose={closeDebtModal}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Pay Customer Debt
                  </Text>
                  <Text
                    style={[
                      styles.modalSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {debtModal.customer?.name} • {debtModal.customer?.phone}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeDebtModal}
                  disabled={isDebtPaying}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {debtModal.loading && !debtModal.order ? (
                <View style={styles.centerContent}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text
                    style={[
                      styles.loadingText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Loading order items…
                  </Text>
                </View>
              ) : !debtModal.order ? (
                <View style={[styles.errorBox, { backgroundColor: "#fee2e2" }]}>
                  <Text style={styles.errorBoxText}>
                    {debtModal.error || "No unpaid debt order found"}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.modalBody}>
                  {/* Order Selector */}
                  {debtModal.orders.length > 1 && (
                    <View style={styles.orderSelector}>
                      <FlatList
                        data={debtModal.orders}
                        keyExtractor={(o) => o.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item: order }) => {
                          const selected = debtModal.order?.id === order.id;
                          const due = Math.max(
                            0,
                            Number(
                              order.debt_recorded_total || order.total || 0
                            )
                          ).toFixed(2);
                          return (
                            <TouchableOpacity
                              style={[
                                styles.orderButton,
                                {
                                  backgroundColor: selected
                                    ? "#e0e7ff"
                                    : colors.bg,
                                  borderColor: selected
                                    ? "#4f46e5"
                                    : colors.border,
                                },
                              ]}
                              onPress={() => handleSelectDebtOrder(order.id)}
                              disabled={isDebtPaying || debtModal.loading}
                            >
                              <Text
                                style={[
                                  styles.orderButtonText,
                                  {
                                    color: selected
                                      ? "#4f46e5"
                                      : colors.textSecondary,
                                  },
                                ]}
                              >
                                #{order.id}
                              </Text>
                              <Text
                                style={[
                                  styles.orderButtonAmount,
                                  { color: colors.text },
                                ]}
                              >
                                ₺{due}
                              </Text>
                            </TouchableOpacity>
                          );
                        }}
                      />
                    </View>
                  )}

                  {/* Items List */}
                  <View
                    style={[
                      styles.itemsContainer,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.itemsTitle, { color: colors.text }]}>
                      Order Items
                    </Text>
                    {debtModal.order?.items &&
                    debtModal.order.items.length > 0 ? (
                      debtModal.order.items.map((item, idx) => (
                        <View
                          key={item.id || item.unique_id || idx}
                          style={[
                            styles.itemRow,
                            { borderBottomColor: colors.border },
                          ]}
                        >
                          <Text
                            style={[styles.itemName, { color: colors.text }]}
                          >
                            {item.name ||
                              item.order_item_name ||
                              item.product_name ||
                              "Item"}
                          </Text>
                          <Text
                            style={[styles.itemPrice, { color: colors.text }]}
                          >
                            ₺
                            {(
                              Number(item.price) * Number(item.quantity || 1)
                            ).toFixed(2)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text
                        style={[
                          styles.noItemsText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        No items found
                      </Text>
                    )}
                  </View>

                  {/* Total Due */}
                  <View
                    style={[
                      styles.totalDue,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.totalLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Total Due
                    </Text>
                    <Text style={[styles.totalAmount, { color: colors.text }]}>
                      ₺
                      {Math.max(
                        0,
                        Number(
                          debtModal.order?.remaining ??
                            debtModal.order?.debt_recorded_total ??
                            debtModal.order?.total ??
                            0
                        )
                      ).toFixed(2)}
                    </Text>
                  </View>

                  {/* Payment Amount */}
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    Amount To Pay
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={debtModal.amount}
                    onChangeText={(text) =>
                      setDebtModal((prev) => ({ ...prev, amount: text }))
                    }
                    editable={!isDebtPaying}
                  />

                  {/* Payment Method */}
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    Payment Method
                  </Text>
                  <View
                    style={[
                      styles.methodSelector,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {["Cash", "Credit Card", "Sodexo", "Multinet"].map(
                      (method) => (
                        <TouchableOpacity
                          key={method}
                          style={[
                            styles.methodButton,
                            {
                              backgroundColor:
                                debtModal.paymentMethod === method
                                  ? "#e0e7ff"
                                  : "transparent",
                              borderColor:
                                debtModal.paymentMethod === method
                                  ? "#4f46e5"
                                  : colors.border,
                            },
                          ]}
                          onPress={() =>
                            setDebtModal((prev) => ({
                              ...prev,
                              paymentMethod: method,
                            }))
                          }
                          disabled={isDebtPaying}
                        >
                          <Text
                            style={[
                              styles.methodButtonText,
                              {
                                color:
                                  debtModal.paymentMethod === method
                                    ? "#4f46e5"
                                    : colors.text,
                              },
                            ]}
                          >
                            {method}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>

                  {/* Error */}
                  {debtModal.error && (
                    <View
                      style={[styles.errorBox, { backgroundColor: "#fee2e2" }]}
                    >
                      <Text style={styles.errorBoxText}>{debtModal.error}</Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.modalButtonRow}>
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        { opacity: isDebtPaying ? 0.6 : 1 },
                      ]}
                      onPress={handleConfirmDebtPayment}
                      disabled={isDebtPaying || debtModal.loading}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="white"
                      />
                      <Text style={styles.confirmButtonText}>
                        {isDebtPaying ? "Processing…" : "Confirm Payment"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={closeDebtModal}
                      disabled={isDebtPaying}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
      <BottomNav />
    </View>
  );
};

// Components
interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <Ionicons name={icon as any} size={20} color="white" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

interface MetricChipProps {
  label: string;
  value: string | number;
}

const MetricChip: React.FC<MetricChipProps> = ({ label, value }) => {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricLabel}>{label}:</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
};

interface DetailRowProps {
  icon: string;
  label: string;
  value: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ icon, label, value }) => {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={14} color="#9ca3af" />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 24,
  },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
  },
  stickyHeaderTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  stickyHeaderSubtitle: {
    fontSize: 13,
    fontWeight: "400",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerDark: {
    backgroundColor: "#020617",
    borderBottomColor: "transparent",
  },
  headerBrand: {
    alignItems: "flex-end",
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
  headerTitleDark: {
    color: "#F9FAFB",
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 12,
  },
  errorSubText: {
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "white",
    marginTop: 2,
  },
  searchSection: {
    marginBottom: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  clearButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  topCustomersSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  topCustomerCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    minWidth: 160,
  },
  topCustomerName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400e",
  },
  topCustomerPhone: {
    fontSize: 11,
    color: "#78350f",
    marginTop: 2,
  },
  topCustomerValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
    marginTop: 4,
  },
  topCustomerVisits: {
    fontSize: 10,
    color: "#78350f",
    marginTop: 2,
  },
  birthdaySection: {
    marginBottom: 16,
  },
  birthdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  birthdayInfo: {
    flex: 1,
  },
  birthdayName: {
    fontSize: 13,
    fontWeight: "600",
  },
  birthdayPhone: {
    fontSize: 11,
    marginTop: 2,
  },
  birthdayStats: {
    flexDirection: "column",
    gap: 2,
  },
  statBadge: {
    fontSize: 11,
    fontWeight: "500",
  },
  customerListSection: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    marginTop: 8,
  },
  customerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  customerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "600",
  },
  customerPhone: {
    fontSize: 11,
    marginTop: 2,
  },
  debtBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  debtText: {
    fontSize: 11,
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: "#666666",
  },
  metricValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#000000",
  },
  detailsRow: {
    gap: 6,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  detailLabel: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 11,
    color: "#4b5563",
  },
  actionRow: {
    flexDirection: "row",
    gap: 6,
  },
  debtButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f59e0b",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  debtButtonText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  editButtonText: {
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalBody: {
    maxHeight: "70%",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 8,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  saveButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  deleteButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  errorBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorBoxText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#991b1b",
  },
  orderSelector: {
    marginBottom: 12,
  },
  orderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    alignItems: "center",
  },
  orderButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  orderButtonAmount: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  itemsContainer: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    maxHeight: 200,
  },
  itemsTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: "600",
  },
  noItemsText: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
  },
  totalDue: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  methodSelector: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  methodButton: {
    flex: 1,
    minWidth: "48%",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  methodButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  confirmButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666666",
  },
});

export default CustomerInsights;
