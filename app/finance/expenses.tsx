import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import secureFetch from "../../src/api/secureFetch";

type Expense = {
  id: string;
  type: string;
  amount: number;
  note?: string;
  payment_method: string;
  created_at: string;
  created_by?: string;
};

type ExpenseType = string;

const PAYMENT_METHODS = ["Cash", "Credit Card", "Bank Transfer", "Not Paid"];
const DATE_RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "custom", label: "Custom" },
];

export default function ExpensesScreen() {
  const { isDark, fontScale } = useAppearance();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [dateRange, setDateRange] = useState("monthly");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [visibleDetails, setVisibleDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: "",
    amount: "",
    note: "",
    payment_method: "",
  });
  const [newType, setNewType] = useState("");

  // Fetch expense types
  const fetchExpenseTypes = useCallback(async () => {
    try {
      const data = await secureFetch("/expenses/types");
      setExpenseTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to fetch expense types:", err);
      setExpenseTypes([]);
    }
  }, []);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const today = new Date();

      if (dateRange === "today") {
        const todayStr = today.toISOString().slice(0, 10);
        params.set("from", todayStr);
        params.set("to", todayStr);
      } else if (dateRange === "week") {
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        params.set("from", start.toISOString().slice(0, 10));
        params.set("to", today.toISOString().slice(0, 10));
      } else if (dateRange === "monthly") {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        params.set("from", firstDay.toISOString().slice(0, 10));
        params.set("to", lastDay.toISOString().slice(0, 10));
      } else if (dateRange === "custom" && customRange.from && customRange.to) {
        params.set("from", customRange.from);
        params.set("to", customRange.to);
      }

      const data = await secureFetch(`/expenses?${params.toString()}`);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to fetch expenses:", err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, customRange]);

  // Save expense
  const handleSaveExpense = async () => {
    const selectedType = form.type || newType;

    if (!selectedType || isNaN(parseFloat(form.amount))) {
      Alert.alert("Error", "Please fill in expense type and amount");
      return;
    }

    try {
      const payload = {
        type: selectedType.trim(),
        amount: parseFloat(form.amount),
        note: form.note?.trim() || null,
        payment_method: form.payment_method || "Not Paid",
        created_by: user?.id,
      };

      await secureFetch("/expenses", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      Alert.alert("Success", "Expense saved successfully");
      setForm({ type: "", amount: "", note: "", payment_method: "" });
      setNewType("");
      setShowModal(false);
      fetchExpenses();
    } catch (err) {
      console.error("❌ Failed to save expense:", err);
      Alert.alert("Error", "Failed to save expense");
    }
  };

  // Load initial data
  useEffect(() => {
    fetchExpenseTypes();
  }, [fetchExpenseTypes]);

  // Reload when date range changes
  useEffect(() => {
    fetchExpenses();
  }, [dateRange, customRange, fetchExpenses]);

  // Calculate totals
  const totalExpenses = expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );
  const expensesByType = expenseTypes.map((type) => ({
    type,
    total: expenses
      .filter((e) => e.type === type)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    dueTotal: expenses
      .filter((e) => e.type === type && e.payment_method === "Not Paid")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
  }));

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text
          style={[
            styles.headerTitle,
            isDark && styles.headerTitleDark,
            { fontSize: 26 * fontScale },
          ]}
        >
          Expenses
        </Text>
        <Text
          style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}
        >
          Track and manage costs
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range Selector */}
        <View style={styles.dateRangeContainer}>
          {DATE_RANGES.map((range) => (
            <TouchableOpacity
              key={range.key}
              style={[
                styles.rangeButton,
                dateRange === range.key && styles.rangeButtonActive,
                dateRange === range.key &&
                  isDark &&
                  styles.rangeButtonActiveDark,
              ]}
              onPress={() => setDateRange(range.key)}
            >
              <Text
                style={[
                  styles.rangeButtonText,
                  dateRange === range.key && styles.rangeButtonTextActive,
                  { fontSize: 12 * fontScale },
                ]}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total Summary */}
        <View style={[styles.summaryCard, isDark && styles.summaryCardDark]}>
          <Text
            style={[
              styles.summaryLabel,
              isDark && styles.summaryLabelDark,
              { fontSize: 14 * fontScale },
            ]}
          >
            Total Expenses
          </Text>
          <Text
            style={[
              styles.summaryValue,
              isDark && styles.summaryValueDark,
              { fontSize: 28 * fontScale },
            ]}
          >
            {formatCurrency(totalExpenses)}
          </Text>
        </View>

        {/* Add Expense Button */}
        <TouchableOpacity
          style={[styles.addButton]}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={[styles.addButtonText, { fontSize: 16 * fontScale }]}>
            Add Expense
          </Text>
        </TouchableOpacity>

        {/* Expense Types Cards */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              isDark && styles.sectionTitleDark,
              { fontSize: 16 * fontScale },
            ]}
          >
            Expense Breakdown
          </Text>

          {expensesByType.length === 0 ? (
            <Text
              style={[
                styles.emptyText,
                isDark && styles.emptyTextDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              No expense types available
            </Text>
          ) : (
            expensesByType.map((item) => (
              <View
                key={item.type}
                style={[styles.typeCard, isDark && styles.typeCardDark]}
              >
                <View style={styles.typeCardHeader}>
                  <View>
                    <Text
                      style={[
                        styles.typeTitle,
                        isDark && styles.typeTitleDark,
                        { fontSize: 16 * fontScale },
                      ]}
                    >
                      {item.type}
                    </Text>
                    <Text
                      style={[
                        styles.typeAmount,
                        isDark && styles.typeAmountDark,
                        { fontSize: 14 * fontScale },
                      ]}
                    >
                      {formatCurrency(item.total)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setVisibleDetails(
                        visibleDetails === item.type ? null : item.type
                      )
                    }
                  >
                    <Ionicons
                      name={
                        visibleDetails === item.type
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={24}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </TouchableOpacity>
                </View>

                {item.dueTotal > 0 && (
                  <Text style={[styles.dueText, { fontSize: 12 * fontScale }]}>
                    Due: {formatCurrency(item.dueTotal)}
                  </Text>
                )}

                {/* Details */}
                {visibleDetails === item.type && (
                  <View style={styles.detailsContainer}>
                    {expenses
                      .filter((e) => e.type === item.type)
                      .map((expense) => (
                        <View key={expense.id} style={styles.detailRow}>
                          <View style={styles.detailLeft}>
                            <Text
                              style={[
                                styles.detailMethod,
                                { fontSize: 12 * fontScale },
                              ]}
                            >
                              {expense.payment_method}
                            </Text>
                            {expense.note && (
                              <Text
                                style={[
                                  styles.detailNote,
                                  { fontSize: 11 * fontScale },
                                ]}
                              >
                                {expense.note}
                              </Text>
                            )}
                            <Text
                              style={[
                                styles.detailDate,
                                { fontSize: 10 * fontScale },
                              ]}
                            >
                              {new Date(expense.created_at).toLocaleString()}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.detailAmount,
                              { fontSize: 14 * fontScale },
                            ]}
                          >
                            {formatCurrency(expense.amount)}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal
        visible={showModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, isDark && styles.modalContentDark]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  isDark && styles.modalTitleDark,
                  { fontSize: 18 * fontScale },
                ]}
              >
                Add Expense
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Type Selector */}
              <View style={styles.formGroup}>
                <Text
                  style={[
                    styles.formLabel,
                    isDark && styles.formLabelDark,
                    { fontSize: 14 * fontScale },
                  ]}
                >
                  Type *
                </Text>
                <View
                  style={[
                    styles.pickerContainer,
                    isDark && styles.pickerContainerDark,
                  ]}
                >
                  <Picker
                    selectedValue={form.type}
                    onValueChange={(value) => setForm({ ...form, type: value })}
                    style={[
                      styles.picker,
                      { color: isDark ? "#F9FAFB" : "#111827" },
                    ]}
                  >
                    <Picker.Item label="-- Select Type --" value="" />
                    {expenseTypes.map((type) => (
                      <Picker.Item key={type} label={type} value={type} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* New Type Input */}
              <View style={styles.formGroup}>
                <Text
                  style={[
                    styles.formLabel,
                    isDark && styles.formLabelDark,
                    { fontSize: 14 * fontScale },
                  ]}
                >
                  Or create new type
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    isDark && styles.inputDark,
                    { fontSize: 14 * fontScale },
                  ]}
                  placeholder="New expense type"
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                  value={newType}
                  onChangeText={setNewType}
                />
              </View>

              {/* Amount */}
              <View style={styles.formGroup}>
                <Text
                  style={[
                    styles.formLabel,
                    isDark && styles.formLabelDark,
                    { fontSize: 14 * fontScale },
                  ]}
                >
                  Amount *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    isDark && styles.inputDark,
                    { fontSize: 14 * fontScale },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                  keyboardType="decimal-pad"
                  value={form.amount}
                  onChangeText={(val) => setForm({ ...form, amount: val })}
                />
              </View>

              {/* Payment Method */}
              <View style={styles.formGroup}>
                <Text
                  style={[
                    styles.formLabel,
                    isDark && styles.formLabelDark,
                    { fontSize: 14 * fontScale },
                  ]}
                >
                  Payment Method
                </Text>
                <View
                  style={[
                    styles.pickerContainer,
                    isDark && styles.pickerContainerDark,
                  ]}
                >
                  <Picker
                    selectedValue={form.payment_method}
                    onValueChange={(value) =>
                      setForm({ ...form, payment_method: value })
                    }
                    style={[
                      styles.picker,
                      { color: isDark ? "#F9FAFB" : "#111827" },
                    ]}
                  >
                    <Picker.Item label="-- Select Method --" value="" />
                    {PAYMENT_METHODS.map((method) => (
                      <Picker.Item key={method} label={method} value={method} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Note */}
              <View style={styles.formGroup}>
                <Text
                  style={[
                    styles.formLabel,
                    isDark && styles.formLabelDark,
                    { fontSize: 14 * fontScale },
                  ]}
                >
                  Note (optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputMultiline,
                    isDark && styles.inputDark,
                    { fontSize: 14 * fontScale },
                  ]}
                  placeholder="Add a note..."
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                  multiline
                  numberOfLines={3}
                  value={form.note}
                  onChangeText={(val) => setForm({ ...form, note: val })}
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { fontSize: 14 * fontScale },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton]}
                onPress={handleSaveExpense}
              >
                <Text
                  style={[styles.saveButtonText, { fontSize: 14 * fontScale }]}
                >
                  Save Expense
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
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

  header: {
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderBottomColor: "#111827",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },

  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 120,
  },

  dateRangeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
    gap: 8,
  },
  rangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rangeButtonActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  rangeButtonActiveDark: {
    backgroundColor: "#4338CA",
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  rangeButtonTextActive: {
    color: "white",
    fontWeight: "700",
  },

  summaryCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryCardDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  summaryLabelDark: {
    color: "#9CA3AF",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  summaryValueDark: {
    color: "#F9FAFB",
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 20,
  },
  addButtonText: {
    color: "white",
    fontWeight: "600",
  },

  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#111827",
  },
  sectionTitleDark: {
    color: "#F9FAFB",
  },

  emptyText: {
    color: "#6B7280",
    textAlign: "center",
    paddingVertical: 20,
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },

  typeCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  typeCardDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  typeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  typeTitleDark: {
    color: "#F9FAFB",
  },
  typeAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4F46E5",
    marginTop: 4,
  },
  typeAmountDark: {
    color: "#818CF8",
  },

  dueText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
    marginTop: 6,
  },

  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailLeft: {
    flex: 1,
  },
  detailMethod: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  detailNote: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  detailDate: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  detailAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 8,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: "90%",
  },
  modalContentDark: {
    backgroundColor: "#111827",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
    maxHeight: "70%",
    marginVertical: 16,
  },

  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  formLabelDark: {
    color: "#F9FAFB",
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "white",
    overflow: "hidden",
  },
  pickerContainerDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  picker: {
    height: 50,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "white",
    color: "#111827",
  },
  inputDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
    color: "#F9FAFB",
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: "top",
  },

  modalActions: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 16,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },
});
