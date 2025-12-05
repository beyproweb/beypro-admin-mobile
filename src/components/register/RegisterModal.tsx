import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import secureFetch from "../../api/secureFetch";
import { useCurrency } from "../../context/CurrencyContext";
import { useAppearance } from "../../context/AppearanceContext";

export type RegisterModalProps = {
  visible: boolean;
  onClose: () => void;
  onStateChange?: () => void;
};

type RegisterStatusResponse = {
  status: string;
  opening_cash?: number | null;
  last_open_at?: string | null;
  yesterday_close?: number | null;
};

type RegisterEvent = {
  type: string;
  amount?: number | string;
  note?: string | null;
  created_at?: string;
};

const formatTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString();
};

export default function RegisterModal({
  visible,
  onClose,
  onStateChange,
}: RegisterModalProps) {
  const { formatCurrency } = useCurrency();
  const { isDark, fontScale } = useAppearance();

  const [registerState, setRegisterState] = useState<string>("loading");
  const [openingCash, setOpeningCash] = useState<string>("");
  const [actualCash, setActualCash] = useState<string>("");
  const [expectedCash, setExpectedCash] = useState<number>(0);
  const [dailyCashExpense, setDailyCashExpense] = useState<number>(0);
  const [yesterdayCloseCash, setYesterdayCloseCash] = useState<number | null>(
    null,
  );
  const [lastOpenAt, setLastOpenAt] = useState<string | null>(null);
  const [cashDataLoaded, setCashDataLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [registerEntries, setRegisterEntries] = useState(0);
  const [todayRegisterEvents, setTodayRegisterEvents] = useState<
    RegisterEvent[]
  >([]);
  const [todayExpenses, setTodayExpenses] = useState<any[]>([]);
  const [supplierCashPayments, setSupplierCashPayments] = useState<RegisterEvent[]>([]);
  const [staffCashPayments, setStaffCashPayments] = useState<RegisterEvent[]>([]);

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryAmount, setEntryAmount] = useState("");
  const [entryReason, setEntryReason] = useState("");
  const [showRegisterLog, setShowRegisterLog] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeAmount, setChangeAmount] = useState("");

  const fetchRegisterStatus = useCallback(
    () => secureFetch("/reports/cash-register-status") as Promise<RegisterStatusResponse>,
    [],
  );

  const fetchRegisterEntriesForToday = useCallback(async (today: string) => {
    try {
      const data = await secureFetch(
        `/reports/cash-register-history?from=${today}&to=${today}`,
      );
      const todayRow = Array.isArray(data)
        ? data.find((row: any) => row.date === today)
        : null;
      setRegisterEntries(
        todayRow?.register_entries ? Number(todayRow.register_entries) : 0,
      );
    } catch (err) {
      console.warn("Failed to fetch register entries", err);
      setRegisterEntries(0);
    }
  }, []);

  const fetchRegisterLogsForToday = useCallback(async (today: string) => {
    const [eventsRes, expensesRes] = await Promise.allSettled([
      secureFetch(`/reports/cash-register-events?from=${today}&to=${today}`),
      secureFetch(`/reports/expenses?from=${today}&to=${today}`),
    ]);

    if (eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value)) {
      setTodayRegisterEvents(eventsRes.value as RegisterEvent[]);
    } else {
      setTodayRegisterEvents([]);
    }

    if (expensesRes.status === "fulfilled" && Array.isArray(expensesRes.value)) {
      setTodayExpenses(expensesRes.value);
    } else {
      setTodayExpenses([]);
    }
  }, []);

  const fetchRegisterPaymentsForToday = useCallback(async (today: string) => {
    const [supplierRes, staffRes] = await Promise.allSettled([
      secureFetch(`/reports/supplier-cash-payments?from=${today}&to=${today}`),
      secureFetch(`/reports/staff-cash-payments?from=${today}&to=${today}`),
    ]);

    if (supplierRes.status === "fulfilled" && Array.isArray(supplierRes.value)) {
      setSupplierCashPayments(supplierRes.value as RegisterEvent[]);
    } else {
      setSupplierCashPayments([]);
    }

    if (staffRes.status === "fulfilled" && Array.isArray(staffRes.value)) {
      setStaffCashPayments(staffRes.value as RegisterEvent[]);
    } else {
      setStaffCashPayments([]);
    }
  }, []);

  const initializeRegisterSummary = useCallback(async () => {
    try {
      const statusData = await fetchRegisterStatus();
      const nextState = statusData?.status ?? "unopened";
      setRegisterState(nextState);
      setYesterdayCloseCash(statusData?.yesterday_close ?? null);
      setLastOpenAt(statusData?.last_open_at || null);

      const openingValue =
        statusData?.opening_cash !== undefined &&
        statusData?.opening_cash !== null
          ? String(statusData.opening_cash)
          : "";
      setOpeningCash(openingValue);
      setActualCash("");

      if (!statusData?.last_open_at) {
        setExpectedCash(0);
        setDailyCashExpense(0);
        setCashDataLoaded(true);
        return;
      }

      const openTime = encodeURIComponent(statusData.last_open_at);
      const cashTotals = await secureFetch(
        `/reports/daily-cash-total?openTime=${openTime}`,
      );
      let cashSales = Number(cashTotals?.cash_total || 0);

      if (!Number.isFinite(cashSales) || cashSales <= 0) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const history = await secureFetch(
            `/reports/cash-register-history?from=${today}&to=${today}`,
          );
          const row = Array.isArray(history)
            ? history.find((item: any) => item.date === today)
            : null;
          if (row?.cash_sales != null) {
            cashSales = Number(row.cash_sales) || 0;
          }
        } catch (fallbackErr) {
          console.warn("Cash sales fallback failed", fallbackErr);
        }
      }

      setExpectedCash(Number.isFinite(cashSales) ? cashSales : 0);

      const expenseRes = await secureFetch(
        `/reports/daily-cash-expenses?openTime=${openTime}`,
      ).catch(() => []);
      const logExpense = parseFloat(expenseRes?.[0]?.total_expense || 0);

      const today = new Date().toISOString().slice(0, 10);
      const dailyExpenses = await secureFetch(
        `/expenses?from=${today}&to=${today}`,
      )
        .then((rows: any[]) =>
          Array.isArray(rows)
            ? rows.reduce(
                (sum, row) => sum + (parseFloat(row.amount || 0) || 0),
                0,
              )
            : 0,
        )
        .catch(() => 0);

      const combinedExpense = (isNaN(logExpense) ? 0 : logExpense) + dailyExpenses;
      setDailyCashExpense(combinedExpense);
      setCashDataLoaded(true);
    } catch (err) {
      console.error("Failed to initialize register modal", err);
      setLoadingError(
        err instanceof Error ? err.message : "Unable to load register data",
      );
      setCashDataLoaded(true);
    }
  }, [fetchRegisterStatus]);

  const loadRegisterData = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    setLoading(true);
    setLoadingError(null);
    setCashDataLoaded(false);

    await Promise.all([
      fetchRegisterLogsForToday(today),
      fetchRegisterPaymentsForToday(today),
      fetchRegisterEntriesForToday(today),
      initializeRegisterSummary(),
    ]).catch((err) => {
      console.error("Failed to load register modal data", err);
      setLoadingError(
        err instanceof Error ? err.message : "Failed to load register data",
      );
    });

    setLoading(false);
  }, [
    fetchRegisterEntriesForToday,
    fetchRegisterLogsForToday,
    fetchRegisterPaymentsForToday,
    initializeRegisterSummary,
  ]);

  useEffect(() => {
    if (visible) {
      loadRegisterData();
    }
  }, [visible, loadRegisterData]);

  const combinedEvents = useMemo(() => {
    const safeEvents = Array.isArray(todayRegisterEvents)
      ? todayRegisterEvents
      : [];
    const expenseEvents = (todayExpenses || [])
      .filter(
        (expense) =>
          String(expense.payment_method || "").toLowerCase() !== "cash",
      )
      .map((expense) => ({
        type: "expense",
        amount: expense.amount,
        note: expense.note || expense.type || null,
        created_at: expense.created_at,
      }));

    const supplierEvents = Array.isArray(supplierCashPayments)
      ? supplierCashPayments
      : [];
    const staffEvents = Array.isArray(staffCashPayments)
      ? staffCashPayments
      : [];

    return [...safeEvents, ...expenseEvents, ...supplierEvents, ...staffEvents].sort(
      (a, b) =>
        new Date(a.created_at || 0).getTime() -
        new Date(b.created_at || 0).getTime(),
    );
  }, [
    staffCashPayments,
    supplierCashPayments,
    todayExpenses,
    todayRegisterEvents,
  ]);

  const entryTotal = useMemo(
    () =>
      combinedEvents
        .filter((event) => event.type === "entry")
        .reduce(
          (sum, event) =>
            sum + (parseFloat(String(event.amount)) || 0),
          0,
        ),
    [combinedEvents],
  );

  const openingValue = parseFloat(openingCash || "0") || 0;
  const netCash = openingValue + expectedCash + entryTotal - dailyCashExpense;
  const actualCashNumber = parseFloat(actualCash || "0") || 0;
  const actualMatches =
    registerState === "open" && actualCash
      ? Math.abs(actualCashNumber - netCash) < 0.01
      : false;

  const handleSubmitEntry = useCallback(async () => {
    if (!entryAmount || Number(entryAmount) <= 0) {
      return Alert.alert("Invalid amount", "Enter a valid cash amount.");
    }
    try {
      await secureFetch("/reports/cash-register-log", {
        method: "POST",
        body: JSON.stringify({
          type: "entry",
          amount: Number(entryAmount),
          note: entryReason || undefined,
        }),
      });
      Alert.alert("Success", "Cash entry recorded.");
      setEntryAmount("");
      setEntryReason("");
      setShowEntryForm(false);
      await loadRegisterData();
      onStateChange?.();
    } catch (err) {
      Alert.alert(
        "Entry failed",
        err instanceof Error ? err.message : "Failed to add cash entry.",
      );
    }
  }, [entryAmount, entryReason, loadRegisterData, onStateChange]);

  const handleSubmitChange = useCallback(async () => {
    if (!changeAmount || Number(changeAmount) <= 0) {
      return Alert.alert("Invalid amount", "Enter a valid change amount.");
    }
    try {
      await secureFetch("/reports/cash-register-log", {
        method: "POST",
        body: JSON.stringify({
          type: "change",
          amount: Number(changeAmount),
          note: "Change given to customer",
        }),
      });
      Alert.alert("Success", "Change logged.");
      setChangeAmount("");
      setShowChangeForm(false);
      await loadRegisterData();
      onStateChange?.();
    } catch (err) {
      Alert.alert(
        "Change failed",
        err instanceof Error ? err.message : "Failed to log change.",
      );
    }
  }, [changeAmount, loadRegisterData, onStateChange]);

  const handleToggleRegister = useCallback(async () => {
    const action =
      registerState === "unopened" || registerState === "closed"
        ? "open"
        : "close";

    const amountValue =
      action === "open"
        ? parseFloat(openingCash || "0")
        : parseFloat(actualCash || "0");

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return Alert.alert(
        "Missing amount",
        action === "open"
          ? "Enter opening cash before opening the register."
          : "Enter counted cash before closing the register.",
      );
    }

    try {
      await secureFetch("/reports/cash-register-log", {
        method: "POST",
        body: JSON.stringify({
          type: action,
          amount: amountValue,
        }),
      });
      Alert.alert(
        "Success",
        action === "open"
          ? "Register opened successfully."
          : "Register closed successfully.",
      );
      await loadRegisterData();
      onStateChange?.();
      if (action === "close") {
        setShowEntryForm(false);
        setShowRegisterLog(false);
        setShowChangeForm(false);
      }
    } catch (err) {
      Alert.alert(
        "Action failed",
        err instanceof Error
          ? err.message
          : `Unable to ${action} the register.`,
      );
    }
  }, [
    actualCash,
    loadRegisterData,
    onStateChange,
    openingCash,
    registerState,
  ]);

  const modalTitle =
    registerState === "unopened" || registerState === "closed"
      ? "Open Register"
      : "Register Summary";

  const hasError = Boolean(loadingError);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modal,
            isDark && styles.modalDark,
            { maxHeight: 640 },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.titleWrapper}>
              <Text
                style={[
                  styles.modalIcon,
                  { fontSize: 24 * fontScale },
                ]}
              >
                💵
              </Text>
              <View>
                <Text
                  style={[
                    styles.modalTitle,
                    isDark && styles.modalTitleDark,
                    { fontSize: 20 * fontScale },
                  ]}
                >
                  {modalTitle}
                </Text>
                {lastOpenAt && (
                  <Text
                    style={[
                      styles.modalSubtitle,
                      isDark && styles.modalSubtitleDark,
                      { fontSize: 12 * fontScale },
                    ]}
                  >
                    Last open: {formatDate(lastOpenAt)} {formatTime(lastOpenAt)}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {hasError && (
            <View style={styles.errorBox}>
              <Text style={[styles.errorText, { fontSize: 12 * fontScale }]}>
                {loadingError}
              </Text>
            </View>
          )}

          {loading || !cashDataLoaded ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Loading register data…</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              {(registerState === "unopened" || registerState === "closed") && (
                <View style={styles.card}>
                  <Text style={[styles.cardLabel, { fontSize: 14 * fontScale }]}>
                    Opening Cash
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={openingCash}
                    onChangeText={setOpeningCash}
                    placeholder="0.00"
                    style={[styles.input, isDark && styles.inputDark]}
                  />
                  {yesterdayCloseCash !== null && (
                    <Text style={styles.helperText}>
                      Last closing: {formatCurrency(yesterdayCloseCash)}
                    </Text>
                  )}
                </View>
              )}

              {registerState === "open" && (
                <View style={styles.card}>
                  <Text style={[styles.cardLabel, { fontSize: 14 * fontScale }]}>
                    Summary
                  </Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Opening</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(openingValue)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Cash Sales</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(expectedCash)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Cash Expenses</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(dailyCashExpense)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Cash Entries</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(entryTotal)}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, styles.summaryLabelStrong]}>
                      Net Expected Cash
                    </Text>
                    <Text style={[styles.summaryValue, styles.summaryValueStrong]}>
                      {formatCurrency(netCash)}
                    </Text>
                  </View>
                </View>
              )}

              {registerState === "open" && (
                <View style={styles.card}>
                  <Text style={[styles.cardLabel, { fontSize: 14 * fontScale }]}>
                    Actual Counted Cash
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={actualCash}
                    onChangeText={setActualCash}
                    placeholder="0.00"
                    style={[
                      styles.input,
                      actualCash
                        ? actualMatches
                          ? styles.inputMatch
                          : styles.inputMismatch
                        : null,
                    ]}
                  />
                  {actualCash ? (
                    actualMatches ? (
                      <Text style={styles.successText}>Cash matches perfectly.</Text>
                    ) : (
                      <Text style={styles.errorText}>
                        Difference: {formatCurrency(Math.abs(actualCashNumber - netCash))}
                      </Text>
                    )
                  ) : null}
                </View>
              )}

              {registerState === "open" && (
                <View style={styles.card}>
                  <TouchableOpacity
                    onPress={() => setShowEntryForm((prev) => !prev)}
                    style={styles.toggleButton}
                  >
                    <Text style={styles.toggleButtonText}>
                      {showEntryForm ? "Hide Cash Entry" : "Add Cash Entry"}
                    </Text>
                    <Text style={styles.toggleButtonText}>{showEntryForm ? "▲" : "▼"}</Text>
                  </TouchableOpacity>
                  {showEntryForm && (
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Amount</Text>
                      <TextInput
                        keyboardType="numeric"
                        value={entryAmount}
                        onChangeText={setEntryAmount}
                        placeholder="0.00"
                        style={[styles.input, isDark && styles.inputDark]}
                      />
                      <Text style={styles.formLabel}>Reason / Note</Text>
                      <TextInput
                        value={entryReason}
                        onChangeText={setEntryReason}
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder="Optional"
                        maxLength={60}
                      />
                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleSubmitEntry}
                      >
                        <Text style={styles.primaryButtonText}>Save Entry</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {combinedEvents.length > 0 && (
                <View style={styles.card}>
                  <TouchableOpacity
                    onPress={() => setShowRegisterLog((prev) => !prev)}
                    style={styles.toggleButton}
                  >
                    <Text style={styles.toggleButtonText}>
                      {showRegisterLog ? "Hide Register Log" : "Show Register Log"}
                    </Text>
                    <Text style={styles.toggleButtonText}>{showRegisterLog ? "▲" : "▼"}</Text>
                  </TouchableOpacity>
                  {showRegisterLog && (
                    <View style={{ marginTop: 12 }}>
                      {combinedEvents.map((event, index) => (
                        <View key={`${event.type}-${index}-${event.created_at}`} style={styles.logRow}>
                          <Text style={styles.logIcon}>
                            {event.type === "open" && "🔓"}
                            {event.type === "close" && "🔒"}
                            {event.type === "expense" && "📉"}
                            {event.type === "entry" && "➕"}
                            {event.type === "sale" && "🧾"}
                            {event.type === "supplier" && "🚚"}
                            {event.type === "payroll" && "👤"}
                            {event.type === "change" && "💵"}
                            {![
                              "open",
                              "close",
                              "expense",
                              "entry",
                              "sale",
                              "supplier",
                              "payroll",
                              "change",
                            ].includes(event.type) && "📝"}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.logType}>{event.type}</Text>
                            {event.note ? (
                              <Text style={styles.logNote}>{event.note}</Text>
                            ) : null}
                          </View>
                          <View style={styles.logAmountWrapper}>
                            {event.amount != null && (
                              <Text style={styles.logAmount}>
                                {formatCurrency(parseFloat(String(event.amount)) || 0)}
                              </Text>
                            )}
                            <Text style={styles.logTime}>{formatTime(event.created_at)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.card}>
                <TouchableOpacity
                  onPress={() => setShowChangeForm((prev) => !prev)}
                  style={styles.toggleButton}
                >
                  <Text style={styles.toggleButtonText}>
                    {showChangeForm ? "Hide Change Log" : "Log Change"}
                  </Text>
                  <Text style={styles.toggleButtonText}>{showChangeForm ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                {showChangeForm && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Amount</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={changeAmount}
                      onChangeText={setChangeAmount}
                      placeholder="0.00"
                      style={[styles.input, isDark && styles.inputDark]}
                    />
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={handleSubmitChange}
                    >
                      <Text style={styles.primaryButtonText}>Save Change</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={[styles.helperText, { marginTop: 4 }]}>
                Register entries today: {registerEntries}
              </Text>

              <TouchableOpacity
                onPress={handleToggleRegister}
                style={[styles.primaryButton, styles.modalActionButton]}
              >
                <Text style={styles.primaryButtonText}>
                  {registerState === "unopened" || registerState === "closed"
                    ? "Open Register"
                    : "Close Register"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
  },
  modalDark: {
    backgroundColor: "#0F172A",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalIcon: {
    backgroundColor: "#EEF2FF",
    padding: 8,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  modalTitleDark: {
    color: "#F8FAFC",
  },
  modalSubtitle: {
    color: "#6B7280",
    marginTop: 2,
  },
  modalSubtitleDark: {
    color: "#CBD5F5",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
  },
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: {
    fontWeight: "600",
    marginBottom: 8,
    color: "#0F172A",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    fontWeight: "600",
  },
  inputDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    color: "#F1F5F9",
  },
  inputMatch: {
    borderColor: "#22C55E",
  },
  inputMismatch: {
    borderColor: "#EF4444",
  },
  helperText: {
    color: "#6B7280",
    marginTop: 6,
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  summaryLabel: {
    color: "#475569",
  },
  summaryLabelStrong: {
    fontWeight: "700",
    color: "#111827",
  },
  summaryValue: {
    fontWeight: "600",
    color: "#111827",
  },
  summaryValueStrong: {
    fontSize: 18,
    color: "#2563EB",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginVertical: 8,
  },
  toggleButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  toggleButtonText: {
    fontWeight: "600",
    color: "#2563EB",
  },
  formGroup: {
    marginTop: 12,
    gap: 8,
  },
  formLabel: {
    fontWeight: "600",
    color: "#1F2937",
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  modalActionButton: {
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  successText: {
    color: "#16A34A",
    marginTop: 6,
    fontWeight: "600",
  },
  errorText: {
    color: "#DC2626",
    marginTop: 6,
    fontWeight: "600",
  },
  logRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  logIcon: {
    width: 28,
    textAlign: "center",
    fontSize: 18,
  },
  logType: {
    fontWeight: "600",
    textTransform: "capitalize",
    color: "#0F172A",
  },
  logNote: {
    color: "#475569",
    fontSize: 12,
  },
  logAmountWrapper: {
    alignItems: "flex-end",
  },
  logAmount: {
    fontWeight: "700",
    color: "#0F172A",
  },
  logTime: {
    fontSize: 12,
    color: "#94A3B8",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
});
