import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import secureFetch from "../../src/api/secureFetch";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  note?: string;
  payment_method: string;
  created_at: string;
  created_by?: string;
  status?: string;
};

export default function TransactionDetail() {
  const { isDark, fontScale } = useAppearance();
  const { formatCurrency } = useCurrency();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactionDetail();
  }, [id]);

  const fetchTransactionDetail = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const data = await secureFetch(`/expenses/${id}`);
      setTransaction(data);
    } catch (err) {
      console.error("❌ Failed to fetch transaction:", err);
      setError("Failed to load transaction details");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          isDark && styles.containerDark,
          styles.centerContent,
        ]}
      >
        <ActivityIndicator
          size="large"
          color={isDark ? "#818CF8" : "#4F46E5"}
        />
      </View>
    );
  }

  if (error || !transaction) {
    return (
      <View
        style={[
          styles.container,
          isDark && styles.containerDark,
          styles.centerContent,
        ]}
      >
        <Ionicons
          name="alert-circle"
          size={48}
          color={isDark ? "#EF4444" : "#DC2626"}
        />
        <Text
          style={[
            styles.errorText,
            isDark && styles.errorTextDark,
            { fontSize: 16 * fontScale },
          ]}
        >
          {error || "Transaction not found"}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { fontSize: 14 * fontScale }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="chevron-back"
            size={28}
            color={isDark ? "#F9FAFB" : "#111827"}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            isDark && styles.headerTitleDark,
            { fontSize: 20 * fontScale },
          ]}
        >
          Transaction Details
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View style={[styles.mainCard, isDark && styles.mainCardDark]}>
          <Text
            style={[
              styles.amountLabel,
              isDark && styles.amountLabelDark,
              { fontSize: 12 * fontScale },
            ]}
          >
            Amount
          </Text>
          <Text style={[styles.amountText, { fontSize: 32 * fontScale }]}>
            {formatCurrency(Number(transaction.amount))}
          </Text>
          {transaction.status && (
            <View
              style={[
                styles.statusBadge,
                transaction.status === "paid" && styles.statusBadgePaid,
                transaction.status === "pending" && styles.statusBadgePending,
              ]}
            >
              <Text
                style={[styles.statusBadgeText, { fontSize: 12 * fontScale }]}
              >
                {transaction.status.charAt(0).toUpperCase() +
                  transaction.status.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Details Section */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text
            style={[
              styles.sectionTitle,
              isDark && styles.sectionTitleDark,
              { fontSize: 16 * fontScale },
            ]}
          >
            Details
          </Text>

          {/* Type */}
          <View style={styles.detailItem}>
            <Text
              style={[
                styles.detailLabel,
                isDark && styles.detailLabelDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              Type
            </Text>
            <Text
              style={[
                styles.detailValue,
                isDark && styles.detailValueDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              {transaction.type}
            </Text>
          </View>

          {/* Payment Method */}
          <View style={styles.detailItem}>
            <Text
              style={[
                styles.detailLabel,
                isDark && styles.detailLabelDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              Payment Method
            </Text>
            <Text
              style={[
                styles.detailValue,
                isDark && styles.detailValueDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              {transaction.payment_method}
            </Text>
          </View>

          {/* Date */}
          <View style={styles.detailItem}>
            <Text
              style={[
                styles.detailLabel,
                isDark && styles.detailLabelDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              Date & Time
            </Text>
            <Text
              style={[
                styles.detailValue,
                isDark && styles.detailValueDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              {formatDate(transaction.created_at)}
            </Text>
          </View>

          {/* Created By */}
          {transaction.created_by && (
            <View style={styles.detailItem}>
              <Text
                style={[
                  styles.detailLabel,
                  isDark && styles.detailLabelDark,
                  { fontSize: 14 * fontScale },
                ]}
              >
                Created By
              </Text>
              <Text
                style={[
                  styles.detailValue,
                  isDark && styles.detailValueDark,
                  { fontSize: 14 * fontScale },
                ]}
              >
                {transaction.created_by}
              </Text>
            </View>
          )}

          {/* Note */}
          {transaction.note && (
            <View style={styles.detailItem}>
              <Text
                style={[
                  styles.detailLabel,
                  isDark && styles.detailLabelDark,
                  { fontSize: 14 * fontScale },
                ]}
              >
                Note
              </Text>
              <Text
                style={[
                  styles.detailValue,
                  isDark && styles.detailValueDark,
                  { fontSize: 14 * fontScale },
                ]}
              >
                {transaction.note}
              </Text>
            </View>
          )}

          {/* Transaction ID */}
          <View style={styles.detailItem}>
            <Text
              style={[
                styles.detailLabel,
                isDark && styles.detailLabelDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              ID
            </Text>
            <Text
              style={[
                styles.detailValue,
                isDark && styles.detailValueDark,
                { fontSize: 12 * fontScale },
              ]}
            >
              {transaction.id}
            </Text>
          </View>
        </View>
      </ScrollView>
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
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 16,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },

  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },

  mainCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  mainCardDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  amountLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
    fontWeight: "600",
  },
  amountLabelDark: {
    color: "#9CA3AF",
  },

  amountText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#4F46E5",
    marginBottom: 12,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  statusBadgePaid: {
    backgroundColor: "#D1FAE5",
  },
  statusBadgePending: {
    backgroundColor: "#FEF3C7",
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },

  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: "#F9FAFB",
  },

  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    flex: 1,
  },
  detailLabelDark: {
    color: "#9CA3AF",
  },

  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    flex: 1,
    textAlign: "right",
  },
  detailValueDark: {
    color: "#F9FAFB",
  },

  errorText: {
    fontSize: 16,
    color: "#DC2626",
    marginVertical: 16,
    textAlign: "center",
  },
  errorTextDark: {
    color: "#EF4444",
  },

  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#4F46E5",
    borderRadius: 8,
  },
  backButtonText: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
});
