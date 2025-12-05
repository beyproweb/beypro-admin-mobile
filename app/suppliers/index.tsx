import { useEffect, useState, useMemo, useCallback } from "react";
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
  SectionList,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import api from "../../src/api/axiosClient";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import SupplierCartModal from "../../src/components/suppliers/SupplierCartModal";

type Supplier = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_number?: string;
  id_number?: string;
  notes?: string;
  balance?: number;
  total_due?: number;
  total_paid?: number;
  payment_status?: string;
};

type SupplierTransaction = {
  id: number;
  supplier_id: number;
  ingredient: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  delivery_date: string;
  payment_status?: string;
  payment_method?: string;
  expiry_date?: string;
  amount_paid?: number;
  due_after?: number;
  receipt_url?: string;
  items?: any[];
};

type SupplierCart = {
  cart_id: number;
  supplier_id: number;
  scheduled_at?: string;
  repeat_type?: string;
  repeat_days?: number[];
  auto_confirm?: boolean;
  items?: CartItem[];
};

type CartItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
};

export default function SuppliersScreen() {
  const { isDark } = useAppearance();
  const { formatCurrency } = useCurrency();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [cartHistory, setCartHistory] = useState<SupplierCart[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("suppliers");
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedCartSupplierId, setSelectedCartSupplierId] = useState<
    number | null
  >(null);

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  // Supplier modal
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    tax_number: "",
    id_number: "",
    notes: "",
  });

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Transaction entry modal
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionRows, setTransactionRows] = useState<
    Array<{
      ingredient: string;
      quantity: string;
      unit: "kg" | "g" | "lt" | "ml" | "piece";
      total_cost: string;
      expiry_date: string;
    }>
  >([
    {
      ingredient: "",
      quantity: "",
      unit: "kg",
      total_cost: "",
      expiry_date: "",
    },
  ]);
  const [transactionPaymentMethod, setTransactionPaymentMethod] =
    useState("Due");
  const [transactionAmountPaid, setTransactionAmountPaid] = useState("");
  const [transactionSubmitting, setTransactionSubmitting] = useState(false);

  // Date range search for transactions - default to empty (show all)
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<"start" | "end">(
    "start"
  );
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Expiry date picker state
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);
  const [expiryDateRowIndex, setExpiryDateRowIndex] = useState<number | null>(
    null
  );
  const [selectedExpiryDate, setSelectedExpiryDate] = useState(new Date());

  // Unit dropdown state
  const [openUnitDropdown, setOpenUnitDropdown] = useState<number | null>(null);
  const unitOptions = ["kg", "g", "lt", "ml", "piece"] as const;

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date) {
      const dateString = date.toISOString().split("T")[0];
      if (datePickerMode === "start") {
        setStartDate(dateString);
      } else {
        setEndDate(dateString);
      }
    }
  };

  const openDatePicker = (mode: "start" | "end") => {
    const currentDate = mode === "start" ? startDate : endDate;
    if (currentDate) {
      setSelectedDate(new Date(currentDate));
    } else {
      setSelectedDate(new Date());
    }
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };

  // Load suppliers
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Compute total due early so it can be used in useCallback dependencies
  const totalDue = useMemo(() => {
    if (!selectedSupplier) return 0;
    return (
      (selectedSupplier.total_due || 0) - (selectedSupplier.total_paid || 0)
    );
  }, [selectedSupplier]);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get("/suppliers");
      setSuppliers(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      Alert.alert("Error", "Failed to load suppliers");
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllTransactions = useCallback(async () => {
    try {
      // Try the global endpoint first (works if backend exposes it)
      const transRes = await api.get("/suppliers/transactions");
      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
    } catch (err) {
      console.log(
        "Global /suppliers/transactions failed, falling back to per-supplier fetch:",
        err
      );
      try {
        // Ensure we have suppliers list to iterate over
        let suppliersList = suppliers;
        if (!suppliersList || suppliersList.length === 0) {
          const supRes = await api.get("/suppliers");
          suppliersList = Array.isArray(supRes.data) ? supRes.data : [];
          setSuppliers(suppliersList);
        }

        // Fetch transactions per supplier in parallel and aggregate
        const promises = suppliersList.map((s) =>
          api
            .get(`/suppliers/${s.id}/transactions`)
            .then((r) => (Array.isArray(r.data) ? r.data : []))
            .catch((e) => {
              console.log("Error fetching transactions for supplier", s.id, e);
              return [];
            })
        );

        const results = await Promise.all(promises);
        const flattened = results.flat();
        setTransactions(flattened);
      } catch (inner) {
        console.log("Error fetching transactions by supplier fallback:", inner);
        setTransactions([]);
      }
    }
  }, []);

  const fetchSupplierDetails = useCallback(async (supplierId: number) => {
    try {
      const response = await api.get(`/suppliers/${supplierId}`);
      const supplier = response.data;
      setSelectedSupplier(supplier);

      // Fetch transactions for this supplier
      try {
        const transRes = await api.get(`/suppliers/${supplierId}/transactions`);
        setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      } catch (e) {
        setTransactions([]);
      }

      // Fetch cart history
      try {
        const cartRes = await api.get(
          `/supplier-carts?supplier_id=${supplierId}`
        );
        setCartHistory(Array.isArray(cartRes.data) ? cartRes.data : []);
      } catch (e) {
        setCartHistory([]);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to load supplier details");
    }
  }, []);

  const handleCreateSupplier = useCallback(async () => {
    if (!newSupplier.name.trim()) {
      Alert.alert("Error", "Supplier name is required");
      return;
    }

    try {
      const response = await api.post("/suppliers", newSupplier);
      if (response.data) {
        Alert.alert("Success", "Supplier created successfully");
        setNewSupplier({
          name: "",
          phone: "",
          email: "",
          address: "",
          tax_number: "",
          id_number: "",
          notes: "",
        });
        setSupplierModalOpen(false);
        await fetchSuppliers();
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || "Failed to create supplier"
      );
    }
  }, [newSupplier, fetchSuppliers]);

  const handleUpdateSupplier = useCallback(async () => {
    if (!editingSupplier?.id) return;

    try {
      await api.put(`/suppliers/${editingSupplier.id}`, editingSupplier);
      Alert.alert("Success", "Supplier updated successfully");
      setEditModalOpen(false);
      setEditingSupplier(null);
      await fetchSuppliers();
      if (selectedSupplier?.id === editingSupplier.id) {
        await fetchSupplierDetails(editingSupplier.id);
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || "Failed to update supplier"
      );
    }
  }, [
    editingSupplier,
    fetchSuppliers,
    selectedSupplier?.id,
    fetchSupplierDetails,
  ]);

  const handleDeleteSupplier = useCallback(
    async (supplierId: number) => {
      Alert.alert(
        "Confirm Delete",
        "Are you sure you want to delete this supplier?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await api.delete(`/suppliers/${supplierId}`);
                Alert.alert("Success", "Supplier deleted successfully");
                await fetchSuppliers();
                if (selectedSupplier?.id === supplierId) {
                  setSelectedSupplier(null);
                }
              } catch (err: any) {
                Alert.alert("Error", "Failed to delete supplier");
              }
            },
          },
        ]
      );
    },
    [fetchSuppliers, selectedSupplier?.id]
  );

  const handleMakePayment = useCallback(async () => {
    if (
      !selectedSupplier?.id ||
      !paymentAmount ||
      isNaN(Number(paymentAmount))
    ) {
      Alert.alert("Error", "Please enter a valid payment amount");
      return;
    }

    const paymentValue = Number(paymentAmount);

    try {
      await api.put(`/suppliers/${selectedSupplier.id}/pay`, {
        payment: paymentValue,
        payment_method: paymentMethod,
        total_due: totalDue,
      });

      Alert.alert("Success", "Payment recorded successfully");
      setPaymentAmount("");
      setPaymentMethod("Cash");
      setPaymentModalOpen(false);
      await fetchSupplierDetails(selectedSupplier.id);
      await fetchSuppliers();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || "Failed to record payment"
      );
    }
  }, [
    selectedSupplier?.id,
    paymentAmount,
    paymentMethod,
    totalDue,
    fetchSupplierDetails,
    fetchSuppliers,
  ]);

  const handleAddTransaction = useCallback(async () => {
    if (!selectedSupplier?.id) return;

    const validRows = transactionRows.filter((r) => {
      const hasRequiredFields = r.ingredient && r.quantity && r.total_cost;
      const quantity = parseFloat(r.quantity);
      const totalCost = parseFloat(r.total_cost);
      return hasRequiredFields && quantity > 0 && totalCost >= 0;
    });

    if (validRows.length === 0) {
      Alert.alert("Error", "Please enter at least one valid transaction row");
      return;
    }

    // Validate amount_paid is entered when payment method is "Paid"
    if (transactionPaymentMethod === "Paid" && !transactionAmountPaid?.trim()) {
      Alert.alert("Error", "Please enter an amount paid for this transaction");
      return;
    }

    try {
      setTransactionSubmitting(true);

      const normalizedRows = validRows.map((row) => ({
        ingredient: row.ingredient,
        quantity: parseFloat(row.quantity),
        unit: row.unit,
        total_cost: parseFloat(row.total_cost),
        expiry_date: row.expiry_date || null,
      }));

      const formData = new FormData();
      formData.append("supplier_id", String(selectedSupplier.id));
      formData.append("payment_method", transactionPaymentMethod || "Due");

      // Include amount_paid when payment method is "Paid"
      if (transactionPaymentMethod === "Paid" && transactionAmountPaid) {
        formData.append("amount_paid", transactionAmountPaid);
      }

      formData.append("rows", JSON.stringify(normalizedRows));

      await api.post("/suppliers/transactions", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      Alert.alert("Success", "Transaction added successfully");
      setTransactionRows([
        {
          ingredient: "",
          quantity: "",
          unit: "kg",
          total_cost: "",
          expiry_date: "",
        },
      ]);
      setTransactionPaymentMethod("Due");
      setTransactionAmountPaid("");
      setTransactionModalOpen(false);
      await fetchSupplierDetails(selectedSupplier.id);
      await fetchSuppliers();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || "Failed to add transaction"
      );
    } finally {
      setTransactionSubmitting(false);
    }
  }, [
    selectedSupplier?.id,
    transactionRows,
    transactionPaymentMethod,
    transactionAmountPaid,
    fetchSupplierDetails,
    fetchSuppliers,
  ]);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;

    const q = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [suppliers, searchQuery]);

  // Helper to parse date safely
  const parseDate = (dateStr: any) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, SupplierTransaction[]> = {};

    transactions.forEach((t) => {
      const transDate = parseDate(t.delivery_date);
      if (!transDate) return; // Skip if date is invalid

      // Filter by date range if dates are set
      if (startDate || endDate) {
        if (startDate) {
          const start = parseDate(startDate);
          if (start) {
            start.setHours(0, 0, 0, 0);
            if (transDate < start) return;
          }
        }
        if (endDate) {
          const end = parseDate(endDate);
          if (end) {
            end.setHours(23, 59, 59, 999);
            if (transDate > end) return;
          }
        }
      }

      const date = transDate.toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return groups;
  }, [transactions, startDate, endDate]);

  const transactionTotal = useMemo(() => {
    return transactionRows.reduce(
      (sum, row) => sum + (parseFloat(row.total_cost) || 0),
      0
    );
  }, [transactionRows]);

  // Calculate supplier overview stats
  const overviewStats = useMemo(() => {
    const totalDue = suppliers.reduce(
      (sum, s) => sum + (Number(s.total_due) || 0),
      0
    );
    const totalPaid = suppliers.reduce(
      (sum, s) => sum + (Number(s.total_paid) || 0),
      0
    );
    const totalSpent = suppliers.reduce(
      (sum, s) =>
        sum + (Number(s.total_due) || 0) + (Number(s.total_paid) || 0),
      0
    );
    return {
      totalSuppliers: suppliers.length,
      totalDue,
      totalPaid,
      totalSpent,
    };
  }, [suppliers]);

  return (
    <>
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
                👥 Suppliers
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  isDark && styles.headerSubtitleDark,
                ]}
              >
                {filteredSuppliers.length} suppliers
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setNewSupplier({
                name: "",
                phone: "",
                email: "",
                address: "",
                tax_number: "",
                id_number: "",
                notes: "",
              });
              setSupplierModalOpen(true);
            }}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Supplier Overview Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.overviewCardsContainer}
          contentContainerStyle={styles.overviewCardsContent}
        >
          <View style={[styles.overviewCard, { backgroundColor: "#6366F1" }]}>
            <Text style={styles.overviewLabel}>Total Suppliers</Text>
            <Text style={styles.overviewValue}>
              {overviewStats.totalSuppliers}
            </Text>
          </View>
          <View style={[styles.overviewCard, { backgroundColor: "#F59E0B" }]}>
            <Text style={styles.overviewLabel}>Total Outstanding</Text>
            <Text style={styles.overviewValue}>
              {formatCurrency(overviewStats.totalDue)}
            </Text>
          </View>
          <View style={[styles.overviewCard, { backgroundColor: "#10B981" }]}>
            <Text style={styles.overviewLabel}>Total Paid</Text>
            <Text style={styles.overviewValue}>
              {formatCurrency(overviewStats.totalPaid)}
            </Text>
          </View>
          <View style={[styles.overviewCard, { backgroundColor: "#EF4444" }]}>
            <Text style={styles.overviewLabel}>Total Spending</Text>
            <Text style={styles.overviewValue}>
              {formatCurrency(overviewStats.totalSpent)}
            </Text>
          </View>
        </ScrollView>

        {/* Content Wrapper */}
        <View style={styles.contentWrapper}>
          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {["suppliers", "cart", "transactions"].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  activeTab === tab && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setActiveTab(tab);
                  setSelectedSupplier(null);
                  if (tab === "transactions") {
                    fetchAllTransactions();
                  }
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab === "suppliers"
                    ? "🏪 Suppliers"
                    : tab === "cart"
                      ? "🛒 Cart"
                      : "📝 Transactions"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Bar */}
          <View
            style={[
              styles.searchContainer,
              isDark && styles.searchContainerDark,
            ]}
          >
            <Ionicons
              name="search"
              size={18}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
            <TextInput
              style={[styles.searchInput, isDark && styles.searchInputDark]}
              placeholder="Search suppliers..."
              placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
            </View>
          ) : activeTab === "suppliers" ? (
            <ScrollView contentContainerStyle={styles.listContent}>
              {selectedSupplier ? (
                // Supplier Details View
                <View
                  style={[
                    styles.supplierDetailCard,
                    isDark && styles.supplierDetailCardDark,
                  ]}
                >
                  <View style={styles.supplierHeaderRow}>
                    <View>
                      <Text
                        style={[
                          styles.supplierName,
                          isDark && styles.supplierNameDark,
                        ]}
                      >
                        {selectedSupplier.name}
                      </Text>
                      {selectedSupplier.phone && (
                        <Text
                          style={[
                            styles.supplierMeta,
                            isDark && styles.supplierMetaDark,
                          ]}
                        >
                          📞 {selectedSupplier.phone}
                        </Text>
                      )}
                      {selectedSupplier.email && (
                        <Text
                          style={[
                            styles.supplierMeta,
                            isDark && styles.supplierMetaDark,
                          ]}
                        >
                          📧 {selectedSupplier.email}
                        </Text>
                      )}
                    </View>
                    <View style={styles.statusBadge}>
                      <Text
                        style={[
                          styles.statusText,
                          totalDue > 0
                            ? styles.statusTextDue
                            : styles.statusTextPaid,
                        ]}
                      >
                        {totalDue > 0 ? "Due" : "Paid"}
                      </Text>
                    </View>
                  </View>

                  {/* Balance Info */}
                  <View
                    style={[
                      styles.balanceCard,
                      isDark && styles.balanceCardDark,
                    ]}
                  >
                    <View style={styles.balanceRow}>
                      <Text
                        style={[
                          styles.balanceLabel,
                          isDark && styles.balanceLabelDark,
                        ]}
                      >
                        Total Due
                      </Text>
                      <Text
                        style={[
                          styles.balanceAmount,
                          totalDue > 0 && styles.balanceAmountDue,
                        ]}
                      >
                        {formatCurrency(totalDue)}
                      </Text>
                    </View>
                    <View style={styles.balanceRow}>
                      <Text
                        style={[
                          styles.balanceLabel,
                          isDark && styles.balanceLabelDark,
                        ]}
                      >
                        Total Paid
                      </Text>
                      <Text
                        style={[
                          styles.balanceAmount,
                          isDark && styles.balanceAmountDark,
                        ]}
                      >
                        {formatCurrency(selectedSupplier?.total_paid || 0)}
                      </Text>
                    </View>
                  </View>

                  {/* Address and Notes */}
                  {selectedSupplier && selectedSupplier.address && (
                    <View style={styles.infoRow}>
                      <Text
                        style={[
                          styles.infoLabel,
                          isDark && styles.infoLabelDark,
                        ]}
                      >
                        📍 Address
                      </Text>
                      <Text
                        style={[
                          styles.infoValue,
                          isDark && styles.infoValueDark,
                        ]}
                      >
                        {selectedSupplier.address}
                      </Text>
                    </View>
                  )}
                  {selectedSupplier && selectedSupplier.notes && (
                    <View style={styles.infoRow}>
                      <Text
                        style={[
                          styles.infoLabel,
                          isDark && styles.infoLabelDark,
                        ]}
                      >
                        📝 Notes
                      </Text>
                      <Text
                        style={[
                          styles.infoValue,
                          isDark && styles.infoValueDark,
                        ]}
                      >
                        {selectedSupplier.notes}
                      </Text>
                    </View>
                  )}

                  {/* Add Transaction Button Under Address */}
                  <TouchableOpacity
                    style={[
                      styles.addTransactionBtn,
                      isDark && styles.addTransactionBtnDark,
                    ]}
                    onPress={() => setTransactionModalOpen(true)}
                  >
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.addTransactionBtnText}>
                      Add Transaction
                    </Text>
                  </TouchableOpacity>

                  {/* Action Buttons */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.paymentButton]}
                      onPress={() => setPaymentModalOpen(true)}
                    >
                      <Ionicons name="card" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Payment</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: "#10b981" },
                      ]}
                      onPress={() => setShowCartModal(true)}
                    >
                      <Ionicons name="cart" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Cart</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => {
                        setEditingSupplier(selectedSupplier);
                        setEditModalOpen(true);
                      }}
                    >
                      <Ionicons name="pencil" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() =>
                        selectedSupplier &&
                        handleDeleteSupplier(selectedSupplier.id)
                      }
                    >
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Back to list */}
                  <TouchableOpacity
                    style={[styles.backButton, isDark && styles.backButtonDark]}
                    onPress={() => setSelectedSupplier(null)}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={isDark ? "#818CF8" : "#6366F1"}
                    />
                    <Text
                      style={[
                        styles.backButtonText,
                        isDark && styles.backButtonTextDark,
                      ]}
                    >
                      Back to Suppliers
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : filteredSuppliers.length === 0 ? (
                <View style={styles.centerContainer}>
                  <Text
                    style={[styles.emptyText, isDark && styles.emptyTextDark]}
                  >
                    {searchQuery ? "No suppliers found" : "No suppliers yet"}
                  </Text>
                </View>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TouchableOpacity
                    key={supplier.id}
                    style={[
                      styles.supplierCard,
                      isDark && styles.supplierCardDark,
                    ]}
                    onPress={() => fetchSupplierDetails(supplier.id)}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleSection}>
                        <Text
                          style={[
                            styles.cardTitle,
                            isDark && styles.cardTitleDark,
                          ]}
                        >
                          {supplier.name}
                        </Text>
                        {supplier.phone && (
                          <Text
                            style={[
                              styles.cardMeta,
                              isDark && styles.cardMetaDark,
                            ]}
                          >
                            📞 {supplier.phone}
                          </Text>
                        )}
                      </View>
                      {supplier.total_due && supplier.total_due > 0 && (
                        <View style={styles.dueIndicator}>
                          <Text style={styles.dueIndicatorText}>
                            {formatCurrency(supplier.total_due)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {supplier.email && (
                      <Text
                        style={[styles.cardMeta, isDark && styles.cardMetaDark]}
                      >
                        📧 {supplier.email}
                      </Text>
                    )}

                    {supplier.address && (
                      <Text
                        style={[styles.cardMeta, isDark && styles.cardMetaDark]}
                      >
                        📍 {supplier.address}
                      </Text>
                    )}

                    <View style={styles.cardFooter}>
                      <View style={styles.paymentStatusBadge}>
                        <Text
                          style={[
                            styles.paymentStatusText,
                            (supplier.total_due || 0) >
                            (supplier.total_paid || 0)
                              ? styles.statusDue
                              : styles.statusPaid,
                          ]}
                        >
                          {(supplier.total_due || 0) >
                          (supplier.total_paid || 0)
                            ? "❌ Due"
                            : "✅ Paid"}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={isDark ? "#818CF8" : "#6366F1"}
                      />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : activeTab === "cart" ? (
            // Cart Tab: List suppliers with View Cart button
            <ScrollView contentContainerStyle={styles.listContent}>
              {filteredSuppliers.length === 0 ? (
                <View style={styles.centerContainer}>
                  <Text
                    style={[styles.emptyText, isDark && styles.emptyTextDark]}
                  >
                    {searchQuery ? "No suppliers found" : "No suppliers yet"}
                  </Text>
                </View>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <View
                    key={supplier.id}
                    style={[
                      styles.supplierCard,
                      isDark && styles.supplierCardDark,
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      },
                    ]}
                  >
                    <View>
                      <Text
                        style={[
                          styles.cardTitle,
                          isDark && styles.cardTitleDark,
                        ]}
                      >
                        {supplier.name}
                      </Text>
                      {supplier.phone && (
                        <Text
                          style={[
                            styles.cardMeta,
                            isDark && styles.cardMetaDark,
                          ]}
                        >
                          📞 {supplier.phone}
                        </Text>
                      )}
                      {supplier.email && (
                        <Text
                          style={[
                            styles.cardMeta,
                            isDark && styles.cardMetaDark,
                          ]}
                        >
                          📧 {supplier.email}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#4F46E5",
                        padding: 10,
                        borderRadius: 8,
                      }}
                      onPress={() => {
                        setSelectedCartSupplierId(supplier.id);
                        setShowCartModal(true);
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "bold" }}>
                        View Cart
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          ) : (
            // Transactions View - Professional Dashboard
            <ScrollView contentContainerStyle={styles.listContent}>
              {/* Header Stats */}
              <View
                style={[
                  styles.statsContainer,
                  isDark && styles.statsContainerDark,
                ]}
              >
                <View style={styles.statBox}>
                  <Text
                    style={[styles.statLabel, isDark && styles.statLabelDark]}
                  >
                    Total Transactions
                  </Text>
                  <Text
                    style={[styles.statValue, isDark && styles.statValueDark]}
                  >
                    {transactions.length}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text
                    style={[styles.statLabel, isDark && styles.statLabelDark]}
                  >
                    Total Amount
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      styles.statValueAmount,
                      isDark && styles.statValueDark,
                    ]}
                  >
                    {formatCurrency(
                      transactions.reduce(
                        (sum, t) => sum + (t.total_cost || 0),
                        0
                      )
                    )}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text
                    style={[styles.statLabel, isDark && styles.statLabelDark]}
                  >
                    Avg Transaction
                  </Text>
                  <Text
                    style={[styles.statValue, isDark && styles.statValueDark]}
                  >
                    {formatCurrency(
                      transactions.length > 0
                        ? transactions.reduce(
                            (sum, t) => sum + (t.total_cost || 0),
                            0
                          ) / transactions.length
                        : 0
                    )}
                  </Text>
                </View>
              </View>

              {/* Filter Tabs */}
              <View style={styles.filterTabs}>
                <TouchableOpacity
                  style={[styles.filterTab, styles.filterTabActive]}
                >
                  <Text style={styles.filterTabText}>📋 All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterTab}>
                  <Text
                    style={[styles.filterTabText, styles.filterTabInactive]}
                  >
                    ✅ Paid
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterTab}>
                  <Text
                    style={[styles.filterTabText, styles.filterTabInactive]}
                  >
                    ⏳ Due
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Date Range Search */}
              <View
                style={[
                  styles.dateRangeContainer,
                  isDark && styles.dateRangeContainerDark,
                ]}
              >
                <View style={styles.dateRangeHeader}>
                  <Text
                    style={[
                      styles.dateRangeLabel,
                      isDark && styles.dateRangeLabelDark,
                    ]}
                  >
                    📅 Filter by Date
                  </Text>
                  {(startDate || endDate) && (
                    <TouchableOpacity
                      onPress={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                    >
                      <Text style={styles.clearDateLink}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.dateInputsRow}>
                  <View style={styles.dateInputWrapper}>
                    <Text
                      style={[
                        styles.dateInputLabel,
                        isDark && styles.dateInputLabelDark,
                      ]}
                    >
                      From
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.datePickerButton,
                        isDark && styles.datePickerButtonDark,
                      ]}
                      onPress={() => openDatePicker("start")}
                    >
                      <Ionicons
                        name="calendar"
                        size={18}
                        color={isDark ? "#818CF8" : "#6366F1"}
                      />
                      <Text
                        style={[
                          styles.datePickerButtonText,
                          isDark && styles.datePickerButtonTextDark,
                        ]}
                      >
                        {startDate || "Select Date"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.dateInputWrapper}>
                    <Text
                      style={[
                        styles.dateInputLabel,
                        isDark && styles.dateInputLabelDark,
                      ]}
                    >
                      To
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.datePickerButton,
                        isDark && styles.datePickerButtonDark,
                      ]}
                      onPress={() => openDatePicker("end")}
                    >
                      <Ionicons
                        name="calendar"
                        size={18}
                        color={isDark ? "#818CF8" : "#6366F1"}
                      />
                      <Text
                        style={[
                          styles.datePickerButtonText,
                          isDark && styles.datePickerButtonTextDark,
                        ]}
                      >
                        {endDate || "Select Date"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    textColor={isDark ? "#F0F9FF" : "#0F172A"}
                  />
                )}
              </View>

              {Object.entries(groupedTransactions).length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Text style={[styles.emptyStateIcon]}>📦</Text>
                  <Text
                    style={[styles.emptyText, isDark && styles.emptyTextDark]}
                  >
                    No transactions yet
                  </Text>
                  <Text
                    style={[
                      styles.emptyStateSubtext,
                      isDark && styles.emptyStateSubtextDark,
                    ]}
                  >
                    Add your first transaction to get started
                  </Text>
                </View>
              ) : (
                Object.entries(groupedTransactions).map(([date, trans]) => (
                  <View key={date}>
                    <Text
                      style={[
                        styles.dateGroupHeader,
                        isDark && styles.dateGroupHeaderDark,
                      ]}
                    >
                      📅 {date}
                    </Text>

                    {/* Date Summary */}
                    <View
                      style={[
                        styles.dateSummary,
                        isDark && styles.dateSummaryDark,
                      ]}
                    >
                      <View style={styles.dateSummaryItem}>
                        <Text
                          style={[
                            styles.dateSummaryLabel,
                            isDark && styles.dateSummaryLabelDark,
                          ]}
                        >
                          Items
                        </Text>
                        <Text
                          style={[
                            styles.dateSummaryValue,
                            isDark && styles.dateSummaryValueDark,
                          ]}
                        >
                          {trans.length}
                        </Text>
                      </View>
                      <View style={styles.dateSummaryDivider} />
                      <View style={styles.dateSummaryItem}>
                        <Text
                          style={[
                            styles.dateSummaryLabel,
                            isDark && styles.dateSummaryLabelDark,
                          ]}
                        >
                          Total
                        </Text>
                        <Text
                          style={[
                            styles.dateSummaryValue,
                            styles.dateSummaryAmount,
                            isDark && styles.dateSummaryValueDark,
                          ]}
                        >
                          {formatCurrency(
                            trans.reduce(
                              (sum, t) => sum + (t.total_cost || 0),
                              0
                            )
                          )}
                        </Text>
                      </View>
                    </View>

                    {trans.map((transaction) => {
                      // Get supplier name from the transaction (if available)
                      const supplier = suppliers.find(
                        (s) => s.id === transaction.supplier_id
                      );

                      return (
                        <View
                          key={transaction.id}
                          style={[
                            styles.transactionCard,
                            isDark && styles.transactionCardDark,
                          ]}
                        >
                          {/* Transaction Header with Supplier */}
                          <View style={styles.transactionCardHeader}>
                            <View style={styles.transactionCardTitle}>
                              <Text
                                style={[
                                  styles.transactionSupplierName,
                                  isDark && styles.transactionSupplierNameDark,
                                ]}
                              >
                                {supplier?.name || "Unknown Supplier"}
                              </Text>
                              <Text
                                style={[
                                  styles.transactionDateTime,
                                  isDark && styles.transactionDateTimeDark,
                                ]}
                              >
                                {new Date(
                                  transaction.delivery_date
                                ).toLocaleDateString()}{" "}
                                {new Date(
                                  transaction.delivery_date
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.transactionPaymentBadge,
                                transaction.payment_status === "paid"
                                  ? styles.transactionPaymentBadgePaid
                                  : styles.transactionPaymentBadgeDue,
                              ]}
                            >
                              <Text style={styles.transactionPaymentBadgeText}>
                                {transaction.payment_status === "paid"
                                  ? "✅ PAID"
                                  : "⏳ DUE"}
                              </Text>
                            </View>
                          </View>

                          {/* Ingredient & Details */}
                          <View style={styles.transactionDetails}>
                            <View style={styles.ingredientSection}>
                              <View
                                style={[
                                  styles.ingredientBadge,
                                  isDark && styles.ingredientBadgeDark,
                                ]}
                              >
                                <Text style={styles.ingredientBadgeText}>
                                  {transaction.ingredient
                                    .charAt(0)
                                    .toUpperCase()}
                                </Text>
                              </View>
                              <View style={styles.ingredientInfo}>
                                <Text
                                  style={[
                                    styles.ingredientName,
                                    isDark && styles.ingredientNameDark,
                                  ]}
                                >
                                  {transaction.ingredient}
                                </Text>
                                <Text
                                  style={[
                                    styles.ingredientQuantity,
                                    isDark && styles.ingredientQuantityDark,
                                  ]}
                                >
                                  {transaction.quantity} {transaction.unit}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.transactionAmounts}>
                              <View style={styles.amountItem}>
                                <Text
                                  style={[
                                    styles.amountLabel,
                                    isDark && styles.amountLabelDark,
                                  ]}
                                >
                                  Unit Price
                                </Text>
                                <Text
                                  style={[
                                    styles.amountValue,
                                    isDark && styles.amountValueDark,
                                  ]}
                                >
                                  {formatCurrency(transaction.unit_price)}/
                                  {transaction.unit}
                                </Text>
                              </View>
                              <View style={styles.amountDivider} />
                              <View style={styles.amountItem}>
                                <Text
                                  style={[
                                    styles.amountLabel,
                                    isDark && styles.amountLabelDark,
                                  ]}
                                >
                                  Total Cost
                                </Text>
                                <Text
                                  style={[
                                    styles.totalCostValue,
                                    isDark && styles.totalCostValueDark,
                                  ]}
                                >
                                  {formatCurrency(transaction.total_cost)}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Transaction Footer with Method */}
                          <View
                            style={[
                              styles.transactionFooter,
                              isDark && styles.transactionFooterDark,
                            ]}
                          >
                            <Text
                              style={[
                                styles.transactionMethod,
                                isDark && styles.transactionMethodDark,
                              ]}
                            >
                              💳 {transaction.payment_method || "Not Specified"}
                            </Text>
                            {transaction.expiry_date && (
                              <Text
                                style={[
                                  styles.transactionExpiry,
                                  isDark && styles.transactionExpiryDark,
                                ]}
                              >
                                📅 Expires:{" "}
                                {new Date(
                                  transaction.expiry_date
                                ).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}

              {/* Summary Footer */}
              {transactions.length > 0 && (
                <View
                  style={[
                    styles.summaryFooter,
                    isDark && styles.summaryFooterDark,
                  ]}
                >
                  <View style={styles.summaryRow}>
                    <Text
                      style={[
                        styles.summaryLabel,
                        isDark && styles.summaryLabelDark,
                      ]}
                    >
                      Total Transactions:
                    </Text>
                    <Text
                      style={[
                        styles.summaryAmount,
                        isDark && styles.summaryAmountDark,
                      ]}
                    >
                      {transactions.length}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text
                      style={[
                        styles.summaryLabel,
                        isDark && styles.summaryLabelDark,
                      ]}
                    >
                      Total Amount:
                    </Text>
                    <Text
                      style={[
                        styles.summaryAmount,
                        styles.summaryAmountLarge,
                        isDark && styles.summaryAmountDark,
                      ]}
                    >
                      {formatCurrency(
                        transactions.reduce(
                          (sum, t) => sum + (t.total_cost || 0),
                          0
                        )
                      )}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>

        {/* Create Supplier Modal */}
        {supplierModalOpen && (
          <Modal visible={supplierModalOpen} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View
                style={[styles.modalContent, isDark && styles.modalContentDark]}
              >
                <View style={styles.modalHeader}>
                  <Text
                    style={[styles.modalTitle, isDark && styles.modalTitleDark]}
                  >
                    ➕ New Supplier
                  </Text>
                  <TouchableOpacity onPress={() => setSupplierModalOpen(false)}>
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {[
                    {
                      key: "name",
                      label: "Name *",
                      placeholder: "Supplier name",
                    },
                    {
                      key: "phone",
                      label: "Phone",
                      placeholder: "Phone number",
                    },
                    {
                      key: "email",
                      label: "Email",
                      placeholder: "Email address",
                    },
                    {
                      key: "address",
                      label: "Address",
                      placeholder: "Address",
                    },
                    {
                      key: "tax_number",
                      label: "Tax Number",
                      placeholder: "Tax number",
                    },
                    {
                      key: "id_number",
                      label: "ID Number",
                      placeholder: "ID number",
                    },
                  ].map((field) => (
                    <View key={field.key} style={styles.formGroup}>
                      <Text
                        style={[
                          styles.formLabel,
                          isDark && styles.formLabelDark,
                        ]}
                      >
                        {field.label}
                      </Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          isDark && styles.formInputDark,
                        ]}
                        placeholder={field.placeholder}
                        placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                        value={
                          newSupplier[field.key as keyof typeof newSupplier]
                        }
                        onChangeText={(text) =>
                          setNewSupplier((prev) => ({
                            ...prev,
                            [field.key]: text,
                          }))
                        }
                      />
                    </View>
                  ))}

                  <View style={styles.formGroup}>
                    <Text
                      style={[styles.formLabel, isDark && styles.formLabelDark]}
                    >
                      Notes
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        styles.formInputMultiline,
                        isDark && styles.formInputDark,
                      ]}
                      placeholder="Notes"
                      placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                      multiline
                      numberOfLines={3}
                      value={newSupplier.notes}
                      onChangeText={(text) =>
                        setNewSupplier((prev) => ({ ...prev, notes: text }))
                      }
                    />
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setSupplierModalOpen(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleCreateSupplier}
                  >
                    <Text style={styles.saveButtonText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Edit Supplier Modal */}
        {editModalOpen && editingSupplier && (
          <Modal visible={editModalOpen} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View
                style={[styles.modalContent, isDark && styles.modalContentDark]}
              >
                <View style={styles.modalHeader}>
                  <Text
                    style={[styles.modalTitle, isDark && styles.modalTitleDark]}
                  >
                    ✏️ Edit Supplier
                  </Text>
                  <TouchableOpacity onPress={() => setEditModalOpen(false)}>
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {[
                    {
                      key: "name",
                      label: "Name *",
                      placeholder: "Supplier name",
                    },
                    {
                      key: "phone",
                      label: "Phone",
                      placeholder: "Phone number",
                    },
                    {
                      key: "email",
                      label: "Email",
                      placeholder: "Email address",
                    },
                    {
                      key: "address",
                      label: "Address",
                      placeholder: "Address",
                    },
                    {
                      key: "tax_number",
                      label: "Tax Number",
                      placeholder: "Tax number",
                    },
                    {
                      key: "id_number",
                      label: "ID Number",
                      placeholder: "ID number",
                    },
                  ].map((field) => (
                    <View key={field.key} style={styles.formGroup}>
                      <Text
                        style={[
                          styles.formLabel,
                          isDark && styles.formLabelDark,
                        ]}
                      >
                        {field.label}
                      </Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          isDark && styles.formInputDark,
                        ]}
                        placeholder={field.placeholder}
                        placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                        value={
                          editingSupplier[field.key as keyof Supplier] as string
                        }
                        onChangeText={(text) =>
                          setEditingSupplier((prev) =>
                            prev ? { ...prev, [field.key]: text } : null
                          )
                        }
                      />
                    </View>
                  ))}

                  <View style={styles.formGroup}>
                    <Text
                      style={[styles.formLabel, isDark && styles.formLabelDark]}
                    >
                      Notes
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        styles.formInputMultiline,
                        isDark && styles.formInputDark,
                      ]}
                      placeholder="Notes"
                      placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                      multiline
                      numberOfLines={3}
                      value={editingSupplier.notes || ""}
                      onChangeText={(text) =>
                        setEditingSupplier((prev) =>
                          prev ? { ...prev, notes: text } : null
                        )
                      }
                    />
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setEditModalOpen(false);
                      setEditingSupplier(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleUpdateSupplier}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Payment Modal */}
        {paymentModalOpen && selectedSupplier && (
          <Modal visible={paymentModalOpen} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View
                style={[styles.modalContent, isDark && styles.modalContentDark]}
              >
                <View style={styles.modalHeader}>
                  <Text
                    style={[styles.modalTitle, isDark && styles.modalTitleDark]}
                  >
                    💳 Make Payment
                  </Text>
                  <TouchableOpacity onPress={() => setPaymentModalOpen(false)}>
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </TouchableOpacity>
                </View>

                {/* Total Due Card */}
                <View style={[styles.dueCard, isDark && styles.dueCardDark]}>
                  <Text
                    style={[styles.dueLabel, isDark && styles.dueLabelDark]}
                  >
                    Total Due
                  </Text>
                  <Text
                    style={[
                      styles.dueAmount,
                      totalDue > 0 && styles.dueAmountHighlight,
                    ]}
                  >
                    {formatCurrency(totalDue)}
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text
                    style={[styles.formLabel, isDark && styles.formLabelDark]}
                  >
                    Payment Amount *
                  </Text>
                  <TextInput
                    style={[styles.formInput, isDark && styles.formInputDark]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                    keyboardType="decimal-pad"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text
                    style={[styles.formLabel, isDark && styles.formLabelDark]}
                  >
                    Payment Method
                  </Text>
                  <View
                    style={[
                      styles.methodSelector,
                      isDark && styles.methodSelectorDark,
                    ]}
                  >
                    {["Cash", "Card", "Bank Transfer"].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.methodButton,
                          paymentMethod === method && styles.methodButtonActive,
                        ]}
                        onPress={() => setPaymentMethod(method)}
                      >
                        <Text
                          style={[
                            styles.methodButtonText,
                            paymentMethod === method &&
                              styles.methodButtonTextActive,
                          ]}
                        >
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setPaymentModalOpen(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleMakePayment}
                  >
                    <Text style={styles.saveButtonText}>Pay</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Transaction Entry Modal */}
        {transactionModalOpen && selectedSupplier && (
          <Modal
            visible={transactionModalOpen}
            transparent
            animationType="fade"
          >
            <View style={styles.modalOverlay}>
              <View
                style={[styles.modalContent, isDark && styles.modalContentDark]}
              >
                <View style={styles.modalHeader}>
                  <Text
                    style={[styles.modalTitle, isDark && styles.modalTitleDark]}
                  >
                    📦 Add Transaction
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTransactionModalOpen(false)}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {/* Transaction Rows */}
                  {transactionRows.map((row, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.transactionRowContainer,
                        isDark && styles.transactionRowContainerDark,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rowNumber,
                          isDark && styles.rowNumberDark,
                        ]}
                      >
                        Row {idx + 1}
                      </Text>

                      {/* Ingredient */}
                      <View style={styles.formGroup}>
                        <Text
                          style={[
                            styles.formLabel,
                            isDark && styles.formLabelDark,
                          ]}
                        >
                          Ingredient *
                        </Text>
                        <TextInput
                          style={[
                            styles.formInput,
                            isDark && styles.formInputDark,
                          ]}
                          placeholder="e.g., Tomatoes"
                          placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                          value={row.ingredient}
                          onChangeText={(text) => {
                            const updated = [...transactionRows];
                            updated[idx].ingredient = text;
                            setTransactionRows(updated);
                          }}
                        />
                      </View>

                      {/* Quantity */}
                      <View style={styles.formGroup}>
                        <Text
                          style={[
                            styles.formLabel,
                            isDark && styles.formLabelDark,
                          ]}
                        >
                          Quantity *
                        </Text>
                        <TextInput
                          style={[
                            styles.formInput,
                            isDark && styles.formInputDark,
                          ]}
                          placeholder="0.00"
                          placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                          keyboardType="decimal-pad"
                          value={row.quantity}
                          onChangeText={(text) => {
                            const updated = [...transactionRows];
                            updated[idx].quantity = text;
                            setTransactionRows(updated);
                          }}
                        />
                      </View>

                      {/* Unit */}
                      <View style={styles.formGroup}>
                        <Text
                          style={[
                            styles.formLabel,
                            isDark && styles.formLabelDark,
                          ]}
                        >
                          Unit
                        </Text>
                        <View style={styles.dropdownContainer}>
                          <TouchableOpacity
                            style={[
                              styles.dropdownButton,
                              isDark && styles.dropdownButtonDark,
                            ]}
                            onPress={() =>
                              setOpenUnitDropdown(
                                openUnitDropdown === idx ? null : idx
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.dropdownButtonText,
                                isDark && styles.dropdownButtonTextDark,
                              ]}
                            >
                              {row.unit}
                            </Text>
                            <Ionicons
                              name={
                                openUnitDropdown === idx
                                  ? "chevron-up"
                                  : "chevron-down"
                              }
                              size={20}
                              color={isDark ? "#9CA3AF" : "#6B7280"}
                            />
                          </TouchableOpacity>

                          {openUnitDropdown === idx && (
                            <View
                              style={[
                                styles.dropdownMenu,
                                isDark && styles.dropdownMenuDark,
                              ]}
                            >
                              {unitOptions.map((unit) => (
                                <TouchableOpacity
                                  key={unit}
                                  style={[
                                    styles.dropdownItem,
                                    row.unit === unit &&
                                      styles.dropdownItemActive,
                                  ]}
                                  onPress={() => {
                                    const updated = [...transactionRows];
                                    updated[idx].unit = unit;
                                    setTransactionRows(updated);
                                    setOpenUnitDropdown(null);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.dropdownItemText,
                                      row.unit === unit &&
                                        styles.dropdownItemTextActive,
                                    ]}
                                  >
                                    {unit}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Total Cost */}
                      <View style={styles.formGroup}>
                        <Text
                          style={[
                            styles.formLabel,
                            isDark && styles.formLabelDark,
                          ]}
                        >
                          Total Cost *
                        </Text>
                        <TextInput
                          style={[
                            styles.formInput,
                            isDark && styles.formInputDark,
                          ]}
                          placeholder="0.00"
                          placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                          keyboardType="decimal-pad"
                          value={row.total_cost}
                          onChangeText={(text) => {
                            const updated = [...transactionRows];
                            updated[idx].total_cost = text;
                            setTransactionRows(updated);
                          }}
                        />
                      </View>

                      {/* Expiry Date */}
                      <View style={styles.formGroup}>
                        <Text
                          style={[
                            styles.formLabel,
                            isDark && styles.formLabelDark,
                          ]}
                        >
                          Expiry Date
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.formInput,
                            isDark && styles.formInputDark,
                          ]}
                          onPress={() => {
                            setExpiryDateRowIndex(idx);
                            if (row.expiry_date) {
                              try {
                                setSelectedExpiryDate(
                                  new Date(row.expiry_date)
                                );
                              } catch {
                                setSelectedExpiryDate(new Date());
                              }
                            } else {
                              setSelectedExpiryDate(new Date());
                            }
                            setShowExpiryDatePicker(true);
                          }}
                        >
                          <Text
                            style={{
                              color: row.expiry_date
                                ? isDark
                                  ? "#E5E7EB"
                                  : "#1F2937"
                                : isDark
                                  ? "#6B7280"
                                  : "#9CA3AF",
                            }}
                          >
                            {row.expiry_date || "Select expiry date"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Unit Price (computed) */}
                      {row.quantity && row.total_cost && (
                        <View
                          style={[
                            styles.unitPriceCard,
                            isDark && styles.unitPriceCardDark,
                          ]}
                        >
                          <Text
                            style={[
                              styles.unitPriceLabel,
                              isDark && styles.unitPriceLabelDark,
                            ]}
                          >
                            Unit Price
                          </Text>
                          <Text style={styles.unitPriceValue}>
                            {formatCurrency(
                              parseFloat(row.total_cost) /
                                parseFloat(row.quantity)
                            )}
                          </Text>
                        </View>
                      )}

                      {/* Remove Row Button */}
                      {transactionRows.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeRowButton}
                          onPress={() => {
                            const updated = transactionRows.filter(
                              (_, i) => i !== idx
                            );
                            setTransactionRows(updated);
                          }}
                        >
                          <Ionicons name="trash" size={16} color="#FFFFFF" />
                          <Text style={styles.removeRowButtonText}>
                            Remove Row
                          </Text>
                        </TouchableOpacity>
                      )}

                      {idx < transactionRows.length - 1 && (
                        <View style={styles.rowDivider} />
                      )}
                    </View>
                  ))}

                  {/* Add Row Button */}
                  <TouchableOpacity
                    style={styles.addRowButton}
                    onPress={() => {
                      setTransactionRows([
                        ...transactionRows,
                        {
                          ingredient: "",
                          quantity: "",
                          unit: "kg",
                          total_cost: "",
                          expiry_date: "",
                        },
                      ]);
                    }}
                  >
                    <Ionicons name="add-circle" size={20} color="#6366F1" />
                    <Text style={styles.addRowButtonText}>Add Row</Text>
                  </TouchableOpacity>

                  {/* Transaction Total */}
                  {transactionTotal > 0 && (
                    <View
                      style={[
                        styles.transactionTotalCard,
                        isDark && styles.transactionTotalCardDark,
                      ]}
                    >
                      <Text
                        style={[
                          styles.transactionTotalLabel,
                          isDark && styles.transactionTotalLabelDark,
                        ]}
                      >
                        Total Order
                      </Text>
                      <Text style={styles.transactionTotalAmount}>
                        {formatCurrency(transactionTotal)}
                      </Text>
                    </View>
                  )}

                  {/* Payment Status */}
                  <View style={styles.formGroup}>
                    <Text
                      style={[styles.formLabel, isDark && styles.formLabelDark]}
                    >
                      Payment Status
                    </Text>
                    <View
                      style={[
                        styles.methodSelector,
                        isDark && styles.methodSelectorDark,
                      ]}
                    >
                      {["Due", "Paid"].map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.methodButton,
                            transactionPaymentMethod === status &&
                              styles.methodButtonActive,
                          ]}
                          onPress={() => setTransactionPaymentMethod(status)}
                        >
                          <Text
                            style={[
                              styles.methodButtonText,
                              transactionPaymentMethod === status &&
                                styles.methodButtonTextActive,
                            ]}
                          >
                            {status}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Amount Paid - Show when "Paid" is selected */}
                  {transactionPaymentMethod === "Paid" && (
                    <View style={styles.formGroup}>
                      <Text
                        style={[
                          styles.formLabel,
                          isDark && styles.formLabelDark,
                        ]}
                      >
                        Amount Paid *
                      </Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          isDark && styles.formInputDark,
                        ]}
                        placeholder="0.00"
                        placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                        keyboardType="decimal-pad"
                        value={transactionAmountPaid}
                        onChangeText={setTransactionAmountPaid}
                      />
                    </View>
                  )}
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setTransactionModalOpen(false)}
                    disabled={transactionSubmitting}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.saveButton,
                      transactionSubmitting && styles.buttonDisabled,
                    ]}
                    onPress={handleAddTransaction}
                    disabled={transactionSubmitting}
                  >
                    {transactionSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Add Transaction</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Expiry Date Picker - Rendered outside Modal */}
        {showExpiryDatePicker && (
          <DateTimePicker
            value={selectedExpiryDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event: any, date?: Date) => {
              if (Platform.OS === "android") {
                setShowExpiryDatePicker(false);
              }
              if (date && expiryDateRowIndex !== null) {
                const dateString = date.toISOString().split("T")[0];
                const updated = [...transactionRows];
                updated[expiryDateRowIndex].expiry_date = dateString;
                setTransactionRows(updated);
                if (Platform.OS === "ios") {
                  setShowExpiryDatePicker(false);
                }
              }
            }}
            textColor={isDark ? "#F0F9FF" : "#0F172A"}
          />
        )}
      </View>

      {/* Supplier Cart Modal for Cart Tab */}
      {showCartModal && selectedCartSupplierId !== null && (
        <SupplierCartModal
          visible={showCartModal}
          onClose={() => setShowCartModal(false)}
          supplierId={selectedCartSupplierId}
          onCartUpdated={() => {}}
        />
      )}
      <BottomNav />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
    flexDirection: "column",
  },
  containerDark: {
    backgroundColor: "#020617",
  },

  contentWrapper: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },

  overviewCardsContainer: {
    flexGrow: 0,
    marginVertical: 12,
    paddingHorizontal: 16,
  },

  overviewCardsContent: {
    gap: 12,
    paddingRight: 16,
  },

  overviewCard: {
    borderRadius: 12,
    padding: 16,
    minWidth: 140,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  overviewLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    opacity: 0.9,
    marginBottom: 6,
  },

  overviewValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },

  tabButtonActive: {
    backgroundColor: "#6366F1",
  },

  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  tabTextActive: {
    color: "#FFFFFF",
  },

  searchContainer: {
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
  searchContainerDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  searchInputDark: {
    color: "#F3F4F6",
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

  supplierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  supplierCardDark: {
    backgroundColor: "#0B1020",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  cardTitleSection: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  cardTitleDark: {
    color: "#F8FAFC",
  },

  cardMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  cardMetaDark: {
    color: "#9CA3AF",
  },

  dueIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },

  dueIndicatorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  paymentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  paymentStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  statusDue: {
    color: "#DC2626",
  },

  statusPaid: {
    color: "#10B981",
  },

  supplierDetailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  supplierDetailCardDark: {
    backgroundColor: "#0B1020",
  },

  supplierHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  supplierName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  supplierNameDark: {
    color: "#F8FAFC",
  },

  supplierMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  supplierMetaDark: {
    color: "#9CA3AF",
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },

  statusTextDue: {
    color: "#DC2626",
  },

  statusTextPaid: {
    color: "#10B981",
  },

  addTransactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#6366F1",
  },
  addTransactionBtnDark: {
    backgroundColor: "#4F46E5",
  },

  addTransactionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  balanceCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  balanceCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },

  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  balanceLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  balanceLabelDark: {
    color: "#9CA3AF",
  },

  balanceAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  balanceAmountDark: {
    color: "#F3F4F6",
  },

  balanceAmountDue: {
    color: "#DC2626",
  },

  infoRow: {
    marginBottom: 10,
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  infoLabelDark: {
    color: "#9CA3AF",
  },

  infoValue: {
    fontSize: 13,
    color: "#374151",
  },
  infoValueDark: {
    color: "#D1D5DB",
  },

  actionButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },

  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },

  paymentButton: {
    backgroundColor: "#10B981",
  },

  editButton: {
    backgroundColor: "#6366F1",
  },

  deleteButton: {
    backgroundColor: "#EF4444",
  },

  transactionButton: {
    backgroundColor: "#F59E0B",
  },

  actionButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  backButtonDark: {
    backgroundColor: "#1E40AF",
    borderColor: "#3B82F6",
  },

  backButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4F46E5",
  },
  backButtonTextDark: {
    color: "#60A5FA",
  },

  dateGroup: {
    marginBottom: 12,
  },

  dateGroupHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  dateGroupHeaderDark: {
    color: "#9CA3AF",
  },

  transactionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionCardDark: {
    backgroundColor: "#0B1020",
    borderColor: "#374151",
  },

  transactionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  transactionCardHeaderDark: {
    borderBottomColor: "#374151",
  },

  transactionCardTitle: {
    flex: 1,
  },

  transactionSupplierName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  transactionSupplierNameDark: {
    color: "#F9FAFB",
  },

  transactionDateTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  transactionDateTimeDark: {
    color: "#9CA3AF",
  },

  transactionPaymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },

  transactionPaymentBadgePaid: {
    backgroundColor: "#DCFCE7",
  },

  transactionPaymentBadgeDue: {
    backgroundColor: "#FEE2E2",
  },

  transactionPaymentBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F2937",
  },

  transactionDetails: {
    marginBottom: 12,
  },

  ingredientSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  ingredientBadge: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  ingredientBadgeDark: {
    backgroundColor: "#4F46E5",
  },

  ingredientBadgeText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  ingredientInfo: {
    flex: 1,
  },

  ingredientName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  ingredientNameDark: {
    color: "#F9FAFB",
  },

  ingredientQuantity: {
    fontSize: 12,
    color: "#6B7280",
  },
  ingredientQuantityDark: {
    color: "#9CA3AF",
  },

  transactionAmounts: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },

  amountItem: {
    flex: 1,
    alignItems: "center",
  },

  amountLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  amountLabelDark: {
    color: "#9CA3AF",
  },

  amountValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  amountValueDark: {
    color: "#F3F4F6",
  },

  totalCostValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#6366F1",
  },
  totalCostValueDark: {
    color: "#818CF8",
  },

  amountDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },

  transactionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  transactionFooterDark: {
    borderTopColor: "#374151",
  },

  transactionMethod: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  transactionMethodDark: {
    color: "#9CA3AF",
  },

  transactionExpiry: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  transactionExpiryDark: {
    color: "#9CA3AF",
  },

  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  transactionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  transactionTitleDark: {
    color: "#F3F4F6",
  },

  transactionPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6366F1",
  },
  transactionPriceDark: {
    color: "#818CF8",
  },

  transactionDetail: {
    fontSize: 11,
    color: "#6B7280",
  },
  transactionDetailDark: {
    color: "#9CA3AF",
  },

  paymentStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
  },

  paymentStatusPillPaid: {
    backgroundColor: "#DCFCE7",
  },

  paymentStatusPillDue: {
    backgroundColor: "#FEE2E2",
  },

  paymentStatusPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#111827",
  },

  /* Professional Transaction View Styles */
  statsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
  },
  statsContainerDark: {
    backgroundColor: "#111827",
  },

  statBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statBoxDark: {
    backgroundColor: "#0B1020",
    borderColor: "#374151",
  },

  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  statLabelDark: {
    color: "#9CA3AF",
  },

  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  statValueDark: {
    color: "#F3F4F6",
  },

  statValueAmount: {
    color: "#10B981",
    fontSize: 14,
  },

  filterTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },

  filterTabActive: {
    backgroundColor: "#6366F1",
    borderColor: "#4F46E5",
  },

  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  filterTabInactive: {
    color: "#6B7280",
  },

  dateRangeContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dateRangeContainerDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  dateRangeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  dateRangeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  dateRangeLabelDark: {
    color: "#F9FAFB",
  },

  clearDateLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366F1",
  },

  dateInputsRow: {
    flexDirection: "row",
    gap: 12,
  },

  dateInputWrapper: {
    flex: 1,
  },

  dateInputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
  },
  dateInputLabelDark: {
    color: "#9CA3AF",
  },

  dateInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  dateInputDark: {
    borderColor: "#374151",
    backgroundColor: "#1F2937",
    color: "#F9FAFB",
  },

  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 12,
  },

  emptyStateSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
  },
  emptyStateSubtextDark: {
    color: "#6B7280",
  },

  dateSummary: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dateSummaryDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  dateSummaryItem: {
    flex: 1,
    alignItems: "center",
  },

  dateSummaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  dateSummaryLabelDark: {
    color: "#9CA3AF",
  },

  dateSummaryValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  dateSummaryValueDark: {
    color: "#F3F4F6",
  },

  dateSummaryAmount: {
    color: "#10B981",
  },

  dateSummaryDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
  },

  transactionLeftContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  transactionInfo: {
    flex: 1,
  },

  transactionUnit: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  transactionUnitDark: {
    color: "#9CA3AF",
  },

  transactionRightContent: {
    alignItems: "flex-end",
    gap: 6,
  },

  transactionMeta: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  transactionMetaText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  transactionMetaTextDark: {
    color: "#9CA3AF",
  },

  summaryFooter: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderTopWidth: 2,
    borderTopColor: "#E5E7EB",
  },
  summaryFooterDark: {
    backgroundColor: "#111827",
    borderTopColor: "#374151",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  summaryLabelDark: {
    color: "#9CA3AF",
  },

  summaryAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  summaryAmountDark: {
    color: "#F3F4F6",
  },

  summaryAmountLarge: {
    fontSize: 18,
    fontWeight: "800",
    color: "#10B981",
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
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

  modalScroll: {
    maxHeight: "65%",
  },

  formGroup: {
    marginBottom: 12,
  },

  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  formLabelDark: {
    color: "#9CA3AF",
  },

  formInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  formInputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#F3F4F6",
  },

  formInputMultiline: {
    height: 80,
    textAlignVertical: "top",
  },

  dueCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  dueCardDark: {
    backgroundColor: "#312E81",
    borderColor: "#6366F1",
  },

  dueLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  dueLabelDark: {
    color: "#A78BFA",
  },

  dueAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },

  dueAmountHighlight: {
    color: "#DC2626",
  },

  methodSelector: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    padding: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  methodSelectorDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  methodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: "transparent",
  },

  methodButtonActive: {
    backgroundColor: "#6366F1",
  },

  methodButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  methodButtonTextActive: {
    color: "#FFFFFF",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },

  cancelButton: {
    backgroundColor: "#F3F4F6",
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },

  saveButton: {
    backgroundColor: "#6366F1",
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  /* Transaction Modal Styles */
  transactionRowContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  transactionRowContainerDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  rowNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6366F1",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  rowNumberDark: {
    color: "#818CF8",
  },

  unitSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  unitSelectorDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  unitButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: "transparent",
  },

  unitButtonActive: {
    backgroundColor: "#6366F1",
  },

  unitButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },

  unitButtonTextActive: {
    color: "#FFFFFF",
  },

  dropdownContainer: {
    position: "relative",
    zIndex: 10000,
  },

  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  dropdownButtonDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },

  dropdownButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },

  dropdownButtonTextDark: {
    color: "#E5E7EB",
  },

  dropdownMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10000,
    zIndex: 10001,
  },

  dropdownMenuDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },

  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  dropdownItemActive: {
    backgroundColor: "#E0E7FF",
  },

  dropdownItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },

  dropdownItemTextActive: {
    color: "#6366F1",
    fontWeight: "600",
  },

  unitPriceCard: {
    backgroundColor: "#F0F9FF",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },

  unitPriceCardDark: {
    backgroundColor: "#1E3A8A",
  },

  unitPriceLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },

  unitPriceLabelDark: {
    color: "#9CA3AF",
  },

  unitPriceValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6366F1",
  },

  removeRowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    marginTop: 8,
  },

  removeRowButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },

  rowDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },

  addRowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
  },

  addRowButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366F1",
  },

  transactionTotalCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },

  transactionTotalCardDark: {
    backgroundColor: "#312E81",
    borderColor: "#6366F1",
  },

  transactionTotalLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  transactionTotalLabelDark: {
    color: "#A78BFA",
  },

  transactionTotalAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F59E0B",
  },

  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  datePickerButtonDark: {
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  datePickerButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0F172A",
  },
  datePickerButtonTextDark: {
    color: "#F0F9FF",
  },
});
