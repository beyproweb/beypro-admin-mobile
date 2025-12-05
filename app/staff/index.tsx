import { useEffect, useState, useCallback, useMemo } from "react";
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
  Image,
  FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import secureFetch from "../../src/api/secureFetch";

type Staff = {
  id: number | string;
  name: string;
  email?: string;
  role?: string;
  avatar?: string;
};

type PaymentRecord = {
  id?: string;
  amount: number;
  payment_date?: string;
  scheduled_date?: string;
  payment_method?: string;
  note?: string;
  auto?: boolean;
  dueAfter?: number;
};

type StaffHistory = {
  salaryPaid?: number;
  salaryDue?: number;
  totalSalaryDue?: number;
  weeklyHours?: number;
  totalCheckins?: number;
  weeklyActualMinutes?: number;
  autoPayment?: {
    active?: boolean;
    amount?: number;
    repeat_type?: string;
    repeat_time?: string;
    payment_method?: string;
    scheduled_date?: string;
    last_payment_date?: string;
    note?: string;
  };
};

const DEFAULT_AVATAR =
  "https://www.pngkey.com/png/full/115-1150152_default-profile-picture-avatar-png-green.png";

const getAvatar = (url?: string) => {
  if (!url) return DEFAULT_AVATAR;
  if (url.startsWith("http://localhost") || url.startsWith("/uploads/"))
    return DEFAULT_AVATAR;
  if (url.startsWith("http")) return url;
  return DEFAULT_AVATAR;
};

const formatMinutes = (mins: number) => {
  const numeric = Number(mins) || 0;
  if (numeric === 0) return "0min";
  const sign = numeric < 0 ? "-" : "";
  const abs = Math.abs(Math.round(numeric));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours > 0) {
    return `${sign}${hours}h ${minutes}min`;
  }
  return `${sign}${minutes}min`;
};

export default function PayrollScreen() {
  const { isDark } = useAppearance();
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [staffHistory, setStaffHistory] = useState<StaffHistory>({});
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Date filtering (current week)
  const getMonday = useCallback(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(now);
    monday.setDate(diff);
    return monday.toISOString().split("T")[0];
  }, []);

  const getSunday = useCallback(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(now);
    monday.setDate(diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday.toISOString().split("T")[0];
  }, []);

  const [startDate] = useState(getMonday());
  const [endDate] = useState(getSunday());

  // Fetch staff on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await secureFetch("/staff");
        setStaffList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Failed to load staff:", err);
        Alert.alert(t("Error"), t("Failed to load staff"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  // Fetch staff payroll data
  const fetchStaffHistory = useCallback(
    async (staff: Staff) => {
      try {
        const [payments, autoSchedule, payroll] = await Promise.all([
          secureFetch(`/staff/${staff.id}/payments`),
          secureFetch(`/staff/${staff.id}/payments/auto`),
          secureFetch(
            `/staff/${staff.id}/payroll?startDate=${startDate}&endDate=${endDate}`
          ),
        ]);

        const normalizedPayments = Array.isArray(payments)
          ? payments.map((p: any) => ({
              ...p,
              amount: Number(p.amount || 0),
            }))
          : [];

        setPaymentHistory(normalizedPayments);
        setStaffHistory({
          ...payroll?.payroll,
          autoPayment: autoSchedule,
        });
      } catch (err) {
        console.error("❌ Failed to fetch payroll:", err);
        Alert.alert(t("Error"), t("Failed to load payroll data"));
      }
    },
    [startDate, endDate, t]
  );

  const handleSelectStaff = (staff: Staff) => {
    setSelectedStaff(staff);
    fetchStaffHistory(staff);
  };

  const handlePayment = async () => {
    if (!selectedStaff) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      Alert.alert(t("Error"), t("Please enter a valid amount"));
      return;
    }

    try {
      setSubmitting(true);
      await secureFetch(`/staff/${selectedStaff.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          date: new Date().toISOString().slice(0, 10),
          note: note,
          payment_method: paymentMethod,
        }),
      });

      Alert.alert(t("Success"), t("Payment saved successfully"));
      setPaymentAmount("");
      setNote("");
      setPaymentMethod("cash");
      setPaymentModalOpen(false);
      await fetchStaffHistory(selectedStaff);
    } catch (err) {
      console.error("❌ Payment error:", err);
      Alert.alert(t("Error"), t("Failed to process payment"));
    } finally {
      setSubmitting(false);
    }
  };

  // Filter staff by search
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staffList;
    return staffList.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staffList, searchQuery]);

  // Calculate salary progress
  const salaryPaid = Number(staffHistory.salaryPaid || 0);
  const salaryDue = Number(staffHistory.salaryDue || 0);
  const totalSalary = Number(staffHistory.totalSalaryDue || 0);
  const paymentProgress =
    totalSalary > 0 ? (salaryPaid / totalSalary) * 100 : 0;

  // Calculate due after history
  const calcDueHistory = (payments: PaymentRecord[]) => {
    let due = totalSalary;
    return payments
      .slice()
      .reverse()
      .map((p) => {
        const prevDue = due;
        due -= p.amount;
        return { ...p, dueAfter: prevDue };
      })
      .reverse();
  };

  const paymentRows = calcDueHistory(paymentHistory);

  if (loading && staffList.length === 0) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            {t("Loading staff...")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            👥 {t("Payroll")}
          </Text>
        </View>

        {/* Search Bar */}
        <View
          style={[styles.searchContainer, isDark && styles.searchContainerDark]}
        >
          <Ionicons
            name="search"
            size={20}
            color={isDark ? "#9CA3AF" : "#6B7280"}
          />
          <TextInput
            style={[styles.searchInput, isDark && styles.searchInputDark]}
            placeholder={t("Search staff...")}
            placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Staff List */}
        {filteredStaff.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              {t("No staff found")}
            </Text>
          </View>
        ) : (
          <View style={styles.staffGrid}>
            {filteredStaff.map((staff) => (
              <TouchableOpacity
                key={staff.id}
                style={[
                  styles.staffCard,
                  isDark && styles.staffCardDark,
                  selectedStaff?.id === staff.id && styles.staffCardActive,
                ]}
                onPress={() => handleSelectStaff(staff)}
              >
                <Image
                  source={{ uri: getAvatar(staff.avatar) }}
                  style={styles.staffAvatar}
                />
                <Text
                  style={[styles.staffName, isDark && styles.staffNameDark]}
                  numberOfLines={1}
                >
                  {staff.name}
                </Text>
                {staff.role && (
                  <Text
                    style={[styles.staffRole, isDark && styles.staffRoleDark]}
                    numberOfLines={1}
                  >
                    {staff.role}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected Staff Details */}
        {selectedStaff && (
          <View style={styles.detailsSection}>
            {/* Header Info */}
            <View style={[styles.detailCard, isDark && styles.detailCardDark]}>
              <View style={styles.staffHeader}>
                <View>
                  <Text
                    style={[styles.detailName, isDark && styles.detailNameDark]}
                  >
                    {selectedStaff.name}
                  </Text>
                  {selectedStaff.role && (
                    <Text
                      style={[styles.roleTag, isDark && styles.roleTagDark]}
                    >
                      {selectedStaff.role}
                    </Text>
                  )}
                </View>
              </View>

              {/* Salary Progress */}
              <View style={styles.progressSection}>
                <Text
                  style={[
                    styles.progressLabel,
                    isDark && styles.progressLabelDark,
                  ]}
                >
                  {t("Salary Progress")}
                </Text>
                <View style={styles.progressStats}>
                  <View style={styles.statBadge}>
                    <Text
                      style={[styles.statLabel, isDark && styles.statLabelDark]}
                    >
                      {t("Paid")}
                    </Text>
                    <Text style={styles.statValue}>
                      {formatCurrency(salaryPaid)}
                    </Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Text
                      style={[styles.statLabel, isDark && styles.statLabelDark]}
                    >
                      {t("Due")}
                    </Text>
                    <Text style={styles.statValue}>
                      {formatCurrency(salaryDue)}
                    </Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Text
                      style={[styles.statLabel, isDark && styles.statLabelDark]}
                    >
                      {t("Total")}
                    </Text>
                    <Text style={styles.statValue}>
                      {formatCurrency(totalSalary)}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View
                  style={[styles.progressBar, isDark && styles.progressBarDark]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(paymentProgress, 100)}%` },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.progressPercent,
                    isDark && styles.progressPercentDark,
                  ]}
                >
                  {paymentProgress.toFixed(0)}% {t("paid")}
                </Text>
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={styles.payButton}
                onPress={() => setPaymentModalOpen(true)}
              >
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.payButtonText}>{t("Add Payment")}</Text>
              </TouchableOpacity>
            </View>

            {/* Auto Payment Info */}
            {staffHistory.autoPayment?.active && (
              <View
                style={[
                  styles.detailCard,
                  styles.autoPaymentCard,
                  isDark && styles.detailCardDark,
                ]}
              >
                <Text
                  style={[
                    styles.autoPaymentTitle,
                    isDark && styles.autoPaymentTitleDark,
                  ]}
                >
                  ⚙️ {t("Auto Payroll")}
                </Text>
                <View style={styles.autoPaymentDetails}>
                  <View style={styles.autoPaymentRow}>
                    <Text
                      style={[
                        styles.autoPaymentLabel,
                        isDark && styles.autoPaymentLabelDark,
                      ]}
                    >
                      {t("Amount")}:
                    </Text>
                    <Text style={styles.autoPaymentValue}>
                      {formatCurrency(staffHistory.autoPayment.amount || 0)}
                    </Text>
                  </View>
                  <View style={styles.autoPaymentRow}>
                    <Text
                      style={[
                        styles.autoPaymentLabel,
                        isDark && styles.autoPaymentLabelDark,
                      ]}
                    >
                      {t("Frequency")}:
                    </Text>
                    <Text style={styles.autoPaymentValue}>
                      {staffHistory.autoPayment.repeat_type || t("None")}
                    </Text>
                  </View>
                  <View style={styles.autoPaymentRow}>
                    <Text
                      style={[
                        styles.autoPaymentLabel,
                        isDark && styles.autoPaymentLabelDark,
                      ]}
                    >
                      {t("Time")}:
                    </Text>
                    <Text style={styles.autoPaymentValue}>
                      {staffHistory.autoPayment.repeat_time || "--:--"}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Payment History */}
            {paymentRows.length > 0 && (
              <View
                style={[styles.detailCard, isDark && styles.detailCardDark]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    isDark && styles.sectionTitleDark,
                  ]}
                >
                  💳 {t("Payment History")}
                </Text>
                {paymentRows.map((payment, idx) => (
                  <View key={idx} style={styles.paymentRow}>
                    <View style={styles.paymentInfo}>
                      <Text
                        style={[
                          styles.paymentDate,
                          isDark && styles.paymentDateDark,
                        ]}
                      >
                        {payment.payment_date
                          ? new Date(payment.payment_date).toLocaleDateString()
                          : payment.scheduled_date
                            ? new Date(
                                payment.scheduled_date
                              ).toLocaleDateString()
                            : "-"}
                      </Text>
                      <Text
                        style={[
                          styles.paymentMethod,
                          isDark && styles.paymentMethodDark,
                        ]}
                      >
                        {payment.payment_method || "-"}
                      </Text>
                    </View>
                    <View style={styles.paymentAmount}>
                      <Text style={styles.paymentAmountValue}>
                        {formatCurrency(payment.amount)}
                      </Text>
                      <Text
                        style={[
                          styles.paymentDue,
                          isDark && styles.paymentDueDark,
                        ]}
                      >
                        {t("Due")}: {formatCurrency(payment.dueAfter || 0)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {paymentRows.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text
                  style={[styles.emptyText, isDark && styles.emptyTextDark]}
                >
                  {t("No payment history")}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={paymentModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalOpen(false)}
      >
        <View
          style={[styles.modalContainer, isDark && styles.modalContainerDark]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              {t("Add Payment")}
            </Text>
            <TouchableOpacity onPress={() => setPaymentModalOpen(false)}>
              <Ionicons
                name="close"
                size={24}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Amount */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Amount")} *
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />
            </View>

            {/* Payment Method */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Payment Method")}
              </Text>
              <View style={styles.methodButtons}>
                {["cash", "card", "transfer"].map((method) => (
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
                      {t(method)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Note */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Note")}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputMultiline,
                  isDark && styles.inputDark,
                ]}
                placeholder={t("Optional note...")}
                multiline
                numberOfLines={3}
                value={note}
                onChangeText={setNote}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handlePayment}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>{t("Save Payment")}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchContainerDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: "#1F2937",
  },
  searchInputDark: {
    color: "#F3F4F6",
  },
  staffGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  staffCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  staffCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  staffCardActive: {
    borderColor: "#8B5CF6",
    backgroundColor: "#F3E8FF",
  },
  staffAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  staffName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  staffNameDark: {
    color: "#F3F4F6",
  },
  staffRole: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  staffRoleDark: {
    color: "#9CA3AF",
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
  detailsSection: {
    gap: 16,
  },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  staffHeader: {
    marginBottom: 16,
  },
  detailName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  detailNameDark: {
    color: "#F3F4F6",
  },
  roleTag: {
    fontSize: 12,
    color: "#FFFFFF",
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  roleTagDark: {
    backgroundColor: "#7C3AED",
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  progressLabelDark: {
    color: "#D1D5DB",
  },
  progressStats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statBadge: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
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
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarDark: {
    backgroundColor: "#374151",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "right",
  },
  progressPercentDark: {
    color: "#9CA3AF",
  },
  payButton: {
    flexDirection: "row",
    backgroundColor: "#8B5CF6",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  autoPaymentCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#8B5CF6",
  },
  autoPaymentTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  autoPaymentTitleDark: {
    color: "#F3F4F6",
  },
  autoPaymentDetails: {
    gap: 8,
  },
  autoPaymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  autoPaymentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  autoPaymentLabelDark: {
    color: "#9CA3AF",
  },
  autoPaymentValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: "#F3F4F6",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  paymentDateDark: {
    color: "#F3F4F6",
  },
  paymentMethod: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  paymentMethodDark: {
    color: "#9CA3AF",
  },
  paymentAmount: {
    alignItems: "flex-end",
  },
  paymentAmountValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10B981",
  },
  paymentDue: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },
  paymentDueDark: {
    color: "#9CA3AF",
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
    paddingBottom: 16,
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  labelDark: {
    color: "#D1D5DB",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
  },
  inputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#F3F4F6",
  },
  inputMultiline: {
    height: 80,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  methodButtons: {
    flexDirection: "row",
    gap: 8,
  },
  methodButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  methodButtonActive: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  methodButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  methodButtonTextActive: {
    color: "#FFFFFF",
  },
  saveButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
