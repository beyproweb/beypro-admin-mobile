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
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import { useTranslation } from "react-i18next";
import secureFetch from "../../src/utils/secureFetch";
import BottomNav from "../../src/components/navigation/BottomNav";

interface Campaign {
  _id?: string;
  date: string;
  type: "Email" | "WhatsApp";
  subject: string;
  message: string;
  openRate: number;
  clickRate: number;
}

interface Customer {
  name: string;
  phone: string;
}

interface Stats {
  totalCustomers: number;
  lastOpen: number;
  lastClick: number;
}

interface CampaignRow {
  date: string;
  type: "Email" | "WhatsApp";
  subject: string;
  message: string;
  openRate: number;
  clickRate: number;
  _id?: string;
}

const { width } = Dimensions.get("window");

const MarketingCampaigns: React.FC = () => {
  const { appearance, isDark, fontScale } = useAppearance();
  const { user } = useAuth();
  const { t } = useTranslation();

  // States
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [history, setHistory] = useState<CampaignRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    lastOpen: 0,
    lastClick: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [whatsAppQR, setWhatsAppQR] = useState("");
  const [qrStatus, setQrStatus] = useState<
    "idle" | "waiting" | "connected" | "error"
  >("idle");
  const [showWhatsAppSelector, setShowWhatsAppSelector] = useState(false);

  const colors = isDark
    ? {
        bg: "#09090b",
        card: "#18181b",
        text: "#fafafa",
        textSecondary: "#a1a1aa",
      }
    : {
        bg: "#ffffff",
        card: "#f5f5f5",
        text: "#000000",
        textSecondary: "#666666",
      };

  // 🔹 Fetch WhatsApp QR
  const fetchWhatsAppQR = useCallback(async () => {
    try {
      setQrStatus("waiting");
      const data = await secureFetch("/campaigns/whatsapp/qr");
      if (data?.qr) {
        setWhatsAppQR(data.qr);
        setQrStatus("connected");
      } else {
        setQrStatus("error");
      }
    } catch (err) {
      console.error("❌ Failed to fetch WhatsApp QR:", err);
      setQrStatus("error");
    }
  }, []);

  // 🔹 Fetch Customer Count
  const fetchCustomerCount = useCallback(async () => {
    try {
      const res = await secureFetch("/customers");
      const data = Array.isArray(res) ? res : res.data || [];
      return data.length || 0;
    } catch (err) {
      console.error("❌ Failed to fetch customer count:", err);
      return 0;
    }
  }, []);

  // 🔹 Fetch Customers
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await secureFetch("/customers");
      const list = Array.isArray(res) ? res : res.data || [];

      const phoneMap = new Map();
      list.forEach((c: any) => {
        if (c.phone && !phoneMap.has(c.phone)) {
          phoneMap.set(c.phone, { name: c.name, phone: c.phone });
        }
      });

      const uniquePhoneCustomers = Array.from(phoneMap.values()) as Customer[];
      setCustomers(uniquePhoneCustomers);
      setSelectedPhones(uniquePhoneCustomers.map((c) => c.phone));
    } catch (err) {
      console.error("❌ Failed to fetch customers:", err);
    }
  }, []);

  // 🔹 Helper: Sticky Merge History
  const stickyMergeHistory = (
    prev: CampaignRow[],
    incoming: CampaignRow[]
  ): CampaignRow[] => {
    const keyOf = (row: CampaignRow) => `${row.date}-${row.type}`;
    const truthyStr = (v: any) => (typeof v === "string" && v.trim() ? v : "");
    const map = new Map<string, CampaignRow>();

    for (const row of prev) {
      map.set(keyOf(row), row);
    }

    for (const row of incoming) {
      const k = keyOf(row);
      const old = map.get(k);

      if (!old) {
        map.set(k, row);
        continue;
      }

      const subject = truthyStr(row.subject) || old.subject || "";
      const message = truthyStr(row.message) || old.message || "";
      const openRate = Number.isFinite(row.openRate)
        ? row.openRate
        : old.openRate;
      const clickRate = Number.isFinite(row.clickRate)
        ? row.clickRate
        : old.clickRate;
      const date = row.date || old.date;

      map.set(k, {
        ...old,
        ...row,
        date,
        subject,
        message,
        openRate,
        clickRate,
        _id: old._id || row._id,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return db - da;
    });
  };

  // 🔹 Load Initial Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch customer count
      const count = await fetchCustomerCount();
      setStats((s) => ({ ...s, totalCustomers: count }));

      // Fetch last campaign stats
      try {
        const data = await secureFetch("/campaigns/stats/last");
        setStats((s) => ({
          ...s,
          lastOpen: data.openRate ?? s.lastOpen,
          lastClick: data.clickRate ?? s.lastClick,
        }));
      } catch (err) {
        console.warn("⚠️ Failed to fetch last campaign stats:", err);
      }

      // Fetch customers
      await fetchCustomers();

      // Fetch campaign list
      try {
        const res = await secureFetch("/campaigns/list");
        if (res.ok && Array.isArray(res.campaigns)) {
          const rows = res.campaigns
            .filter((c: any) => c && c.id)
            .map((c: any) => ({
              date: c.sent_at ? String(c.sent_at).slice(0, 10) : "",
              type: c.channel || (c.text && !c.html ? "WhatsApp" : "Email"),
              subject: c.subject || "",
              message: c.message || "",
              openRate: Number.isFinite(c.openRate) ? c.openRate : 0,
              clickRate: Number.isFinite(c.clickRate) ? c.clickRate : 0,
              _id: String(c.id),
            }));

          setHistory((prev) => stickyMergeHistory(prev, rows));

          const latest = rows[0];
          if (latest) {
            setStats((s) => ({
              ...s,
              lastOpen: Number.isFinite(latest.openRate) ? latest.openRate : 0,
              lastClick: Number.isFinite(latest.clickRate)
                ? latest.clickRate
                : 0,
            }));
          }
        }
      } catch (err) {
        console.warn("⚠️ Failed to fetch campaign list:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchCustomers, fetchCustomerCount]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 🔹 Send Email Campaign
  const sendCampaign = async () => {
    if (!message || !subject) return;
    setSending(true);

    try {
      if (primaryUrl && !/^https?:\/\//i.test(primaryUrl)) {
        Alert.alert(
          "Invalid URL",
          "Tracked link must start with http:// or https://"
        );
        setSending(false);
        return;
      }

      const data = await secureFetch("/campaigns/email", {
        method: "POST",
        body: JSON.stringify({
          subject,
          body: message,
          primary_url: primaryUrl || undefined,
        }),
      });

      // Optimistic update
      setHistory((prev) => [
        {
          date: new Date().toISOString().slice(0, 10),
          type: "Email",
          subject,
          message,
          openRate: 0,
          clickRate: 0,
          _id: data?.campaignId || undefined,
        },
        ...prev,
      ]);

      // Refresh campaign list after 3 seconds
      setTimeout(() => {
        loadData();
      }, 3000);

      // Reset inputs
      setMessage("");
      setSubject("");
      setPrimaryUrl("");

      Alert.alert("Success", "✅ Email campaign sent!");
    } catch (e) {
      console.error("❌ Campaign send failed:", e);
      Alert.alert("Error", "Failed to send campaign!");
    }

    setSending(false);
  };

  // 🔹 Send WhatsApp Campaign
  const sendWhatsAppCampaign = async () => {
    if (!message || selectedPhones.length === 0) return;
    setSending(true);

    try {
      const result = await secureFetch("/campaigns/whatsapp", {
        method: "POST",
        body: JSON.stringify({
          body: message,
          phones: selectedPhones,
          subject: subject || undefined,
          primary_url: primaryUrl || undefined,
        }),
      });

      if (result.failed > 0) {
        Alert.alert(
          "Sent with errors",
          `WhatsApp campaign sent with ${result.failed} failures.`
        );
      } else {
        Alert.alert("Success", "✅ WhatsApp campaign sent!");
      }

      setHistory((prev) => [
        {
          date: new Date().toISOString().slice(0, 10),
          type: "WhatsApp",
          subject: subject || "WhatsApp Campaign",
          message,
          openRate: 0,
          clickRate: 0,
        },
        ...prev,
      ]);

      setMessage("");
      setShowWhatsAppSelector(false);

      // Refresh campaign list
      setTimeout(() => {
        loadData();
      }, 3000);
    } catch (e) {
      console.error("❌ WhatsApp campaign send failed:", e);
      Alert.alert("Error", "Failed to send WhatsApp campaign!");
    }

    setSending(false);
  };

  // 🔹 Handle Select All
  const handleSelectAll = () => {
    if (selectedPhones.length === customers.length) {
      setSelectedPhones([]);
    } else {
      setSelectedPhones(customers.map((c) => c.phone));
    }
  };

  // 🔹 Handle Select One
  const handleSelectOne = (phone: string) => {
    setSelectedPhones((phones) =>
      phones.includes(phone)
        ? phones.filter((p) => p !== phone)
        : [...phones, phone]
    );
  };

  // 🔹 Clear All Campaigns
  const clearAllCampaigns = async () => {
    Alert.alert(
      "Clear All?",
      "Are you sure you want to delete all campaigns from database? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await secureFetch("/campaigns/clear-all", {
                method: "DELETE",
              });
              if (res.ok) {
                Alert.alert("Success", `✅ ${res.deleted} campaigns cleared!`);
                setHistory([]);
              } else {
                Alert.alert("Error", "❌ Failed to clear campaigns");
              }
            } catch (err) {
              console.error("❌ Clear campaigns failed:", err);
              Alert.alert("Error", "Error clearing campaigns");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#f97316" />
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
              {t ? t("Marketing") : "Marketing"}
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
        <View style={styles.statsContainer}>
          <StatCard
            icon="people"
            label="Total Customers"
            value={stats.totalCustomers.toString()}
            color="#3b82f6"
          />
          <StatCard
            icon="percent"
            label="Last Open %"
            value={Number.isFinite(stats.lastOpen) ? `${stats.lastOpen}%` : "—"}
            color="#10b981"
          />
          <StatCard
            icon="bar-chart"
            label="Last Click %"
            value={
              Number.isFinite(stats.lastClick) ? `${stats.lastClick}%` : "—"
            }
            color="#f59e0b"
          />
        </View>

        {/* Campaign Form Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="mail" size={20} color="#2563eb" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              New Campaign
            </Text>
          </View>

          {/* Subject */}
          <TextInput
            style={[
              styles.input,
              {
                borderColor: isDark ? "#52525b" : "#feca5a",
                backgroundColor: colors.bg,
                color: colors.text,
              },
            ]}
            placeholder="Email Subject"
            placeholderTextColor={colors.textSecondary}
            value={subject}
            onChangeText={setSubject}
            editable={!sending}
            maxLength={80}
          />

          {/* Primary URL */}
          <TextInput
            style={[
              styles.input,
              {
                borderColor: isDark ? "#52525b" : "#feca5a",
                backgroundColor: colors.bg,
                color: colors.text,
              },
            ]}
            placeholder="Tracked link (e.g. https://www.beypro.com/)"
            placeholderTextColor={colors.textSecondary}
            value={primaryUrl}
            onChangeText={setPrimaryUrl}
            editable={!sending}
            keyboardType="url"
          />

          {/* Message */}
          <TextInput
            style={[
              styles.messageInput,
              {
                borderColor: isDark ? "#52525b" : "#feca5a",
                backgroundColor: colors.bg,
                color: colors.text,
              },
            ]}
            placeholder="Type your campaign message…"
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            editable={!sending}
            maxLength={400}
            multiline
            numberOfLines={3}
          />

          {/* Send Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.emailButton,
                { opacity: sending || !message || !subject ? 0.6 : 1 },
              ]}
              onPress={sendCampaign}
              disabled={sending || !message || !subject}
            >
              <Ionicons name="send" size={18} color="white" />
              <Text style={styles.buttonText}>
                {sending ? "Sending…" : "Send Email"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.whatsappButton,
                { opacity: sending || !message ? 0.6 : 1 },
              ]}
              onPress={() => setShowWhatsAppSelector(true)}
              disabled={sending || !message}
            >
              <Ionicons name="logo-whatsapp" size={18} color="white" />
              <Text style={styles.buttonText}>
                {sending ? "Sending…" : "WhatsApp"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WhatsApp QR Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="phone-portrait" size={20} color="#0891b2" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              WhatsApp Connection
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={fetchWhatsAppQR}
            >
              <Ionicons name="refresh" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {qrStatus === "connected" && (
            <Text style={styles.statusText}>✅ WhatsApp Connected!</Text>
          )}
          {qrStatus === "waiting" && (
            <Text style={styles.statusWaitingText}>
              ⏳ Waiting for QR code...
            </Text>
          )}
          {qrStatus === "error" && (
            <Text style={styles.statusErrorText}>❌ Failed to fetch QR</Text>
          )}

          {whatsAppQR && (
            <Image
              source={{
                uri: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                  whatsAppQR
                )}&size=200x200`,
              }}
              style={styles.qrImage}
            />
          )}
        </View>

        {/* Campaign History */}
        <View style={styles.historyHeader}>
          <Text style={[styles.historyTitle, { color: colors.text }]}>
            Recent Campaigns
          </Text>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearAllCampaigns}
          >
            <Ionicons name="trash-bin" size={14} color="white" />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {history.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Text
              style={[styles.emptyStateText, { color: colors.textSecondary }]}
            >
              Send your first email or WhatsApp blast to see it appear here.
            </Text>
          </View>
        ) : (
          <View style={[styles.historyTable, { backgroundColor: colors.card }]}>
            {history.slice(0, 12).map((row, idx) => {
              const key = row._id || `${row.date}-${idx}`;
              const summary =
                row.subject?.trim() ||
                row.message?.trim() ||
                (row.type === "Email" ? "Email campaign" : "WhatsApp blast");

              return (
                <View
                  key={key}
                  style={[
                    styles.historyRow,
                    {
                      borderBottomColor: isDark ? "#3f3f46" : "#f0f0f0",
                    },
                  ]}
                >
                  <View style={styles.rowContent}>
                    <View style={styles.rowHeader}>
                      <Text
                        style={[
                          styles.rowDate,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {row.date || "—"}
                      </Text>
                      <View
                        style={[
                          styles.typeBadge,
                          {
                            backgroundColor:
                              row.type === "Email"
                                ? isDark
                                  ? "#1e3a8a"
                                  : "#dbeafe"
                                : isDark
                                  ? "#064e3b"
                                  : "#dcfce7",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeText,
                            {
                              color:
                                row.type === "Email"
                                  ? isDark
                                    ? "#93c5fd"
                                    : "#1e40af"
                                  : isDark
                                    ? "#86efac"
                                    : "#15803d",
                            },
                          ]}
                        >
                          {row.type}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.rowMessage, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {summary}
                    </Text>
                  </View>
                  <View style={styles.rowStats}>
                    <View style={styles.statItem}>
                      <Text
                        style={[
                          styles.statLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Open
                      </Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {Number.isFinite(row.openRate)
                          ? `${row.openRate}%`
                          : "—"}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text
                        style={[
                          styles.statLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Click
                      </Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {Number.isFinite(row.clickRate)
                          ? `${row.clickRate}%`
                          : "—"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* WhatsApp Selector Modal */}
        <Modal
          visible={showWhatsAppSelector}
          transparent
          animationType="slide"
          onRequestClose={() => setShowWhatsAppSelector(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Customers
                </Text>
                <TouchableOpacity
                  onPress={() => setShowWhatsAppSelector(false)}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.selectAllSection}>
                <TouchableOpacity
                  style={[
                    styles.selectAllButton,
                    {
                      backgroundColor: isDark ? "#1e3a8a" : "#dbeafe",
                    },
                  ]}
                  onPress={handleSelectAll}
                >
                  <Text
                    style={[
                      styles.selectAllText,
                      { color: isDark ? "#93c5fd" : "#1e40af" },
                    ]}
                  >
                    {selectedPhones.length === customers.length
                      ? "Unselect All"
                      : "Select All"}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={[
                    styles.selectCountText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {selectedPhones.length} / {customers.length} selected
                </Text>
              </View>

              <FlatList
                data={customers}
                keyExtractor={(c) => c.phone}
                renderItem={({ item: customer }) => (
                  <TouchableOpacity
                    style={styles.customerCheckbox}
                    onPress={() => handleSelectOne(customer.phone)}
                  >
                    <Ionicons
                      name={
                        selectedPhones.includes(customer.phone)
                          ? "checkbox"
                          : "checkbox-outline"
                      }
                      size={20}
                      color="#2563eb"
                    />
                    <View style={styles.customerInfo}>
                      <Text
                        style={[styles.customerName, { color: colors.text }]}
                      >
                        {customer.name}
                      </Text>
                      <Text
                        style={[
                          styles.customerPhone,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {customer.phone}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowWhatsAppSelector(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    { opacity: selectedPhones.length === 0 ? 0.6 : 1 },
                  ]}
                  onPress={sendWhatsAppCampaign}
                  disabled={selectedPhones.length === 0 || sending}
                >
                  <Ionicons name="send" size={18} color="white" />
                  <Text style={styles.confirmButtonText}>
                    {sending ? "Sending…" : "Send WhatsApp"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
      <BottomNav />
    </View>
  );
};

// 🔹 StatCard Component
interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <Ionicons name={icon as any} size={24} color="white" />
      <Text style={styles.statCardValue}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
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
    backgroundColor: "#f97316",
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
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
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
  statCardValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
    marginTop: 4,
  },
  statCardLabel: {
    fontSize: 11,
    color: "white",
    marginTop: 2,
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#feca5a",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "600",
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  emailButton: {
    backgroundColor: "#ea580c",
  },
  whatsappButton: {
    backgroundColor: "#16a34a",
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  refreshButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#3b82f6",
    borderRadius: 6,
  },
  statusText: {
    color: "#16a34a",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  statusWaitingText: {
    color: "#eab308",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  statusErrorText: {
    color: "#dc2626",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  qrImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
    alignSelf: "center",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dc2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  clearButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 24,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: "center",
  },
  historyTable: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  rowDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  rowMessage: {
    fontSize: 13,
    fontWeight: "500",
  },
  rowStats: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    height: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  selectAllSection: {
    marginBottom: 12,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: "center",
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
  selectCountText: {
    fontSize: 12,
  },
  customerCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "600",
  },
  customerPhone: {
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cccccc",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
});

export default MarketingCampaigns;
