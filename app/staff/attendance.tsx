import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import secureFetch from "../../src/api/secureFetch";

const DEVICE_ID_KEY = "beypro_device_id";

const ensureDeviceIdAsync = async () => {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;
    const random = Math.random().toString(36).slice(2, 10);
    const generated = `mobile-${Platform.OS}-${Date.now()}-${random}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
    return generated;
  } catch (err) {
    console.warn("⚠️ Unable to persist device id", err);
    return `mobile-${Platform.OS}-${Date.now()}`;
  }
};

type Staff = {
  id: number;
  name: string;
  role?: string;
};

type AttendanceRow = {
  id: number;
  staff_id: number;
  staff_name: string;
  role?: string | null;
  check_in_time: string;
  check_out_time: string | null;
  duration_minutes?: number | null;
  device_id?: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

const formatDuration = (minutes?: number | null) => {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  const hrs = Math.floor(numeric / 60);
  const mins = Math.round(numeric % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
};

export default function StaffAttendanceScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppearance();
  const { user } = useAuth();

  const [deviceId, setDeviceId] = useState<string>("");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(
    typeof user?.staff_id === "number"
      ? user.staff_id
      : typeof user?.id === "number"
        ? user.id
        : null
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await ensureDeviceIdAsync();
      setDeviceId(id);
    })();
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIpLoading(true);
        const ipAddress = await Network.getIpAddressAsync();
        if (isMounted && ipAddress) {
          setClientIp(ipAddress);
        }
      } catch (err) {
        console.warn("⚠️ Unable to resolve client IP", err);
        if (isMounted) {
          setClientIp(null);
        }
      } finally {
        if (isMounted) {
          setIpLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchData = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) {
        setLoading(true);
      }

      try {
        const headerOptions = clientIp
          ? { headers: { "x-forwarded-for": clientIp } }
          : {};

        const [staffRes, attendanceRes] = await Promise.all([
          secureFetch("/staff", headerOptions),
          secureFetch("/staff/attendance", headerOptions),
        ]);

        const normalizedStaff: Staff[] = Array.isArray(staffRes)
          ? staffRes
              .map((item: any) => ({
                id: Number(item.id),
                name: item.name,
                role: item.role,
              }))
              .filter((item) => Number.isFinite(item.id))
          : [];
        setStaffList(normalizedStaff);

        setSelectedStaffId((prev) => {
          if (
            typeof prev === "number" &&
            Number.isFinite(prev) &&
            normalizedStaff.some((staff) => staff.id === prev)
          ) {
            return prev;
          }
          return normalizedStaff.length > 0 ? normalizedStaff[0].id : null;
        });

        const normalizedAttendance: AttendanceRow[] = Array.isArray(
          attendanceRes
        )
          ? attendanceRes.map((row: any) => ({
              id: Number(row.id),
              staff_id: Number(row.staff_id),
              staff_name: row.staff_name,
              role: row.role,
              check_in_time: row.check_in_time,
              check_out_time: row.check_out_time,
              duration_minutes: row.duration_minutes,
              device_id: row.device_id,
            }))
          : [];
        setAttendance(normalizedAttendance);
      } catch (err) {
        console.error("❌ Failed to load attendance", err);
        if (!opts.silent) {
          Alert.alert(
            t("Error"),
            t("Failed to load attendance data. Please try again.")
          );
        }
      } finally {
        if (!opts.silent) {
          setLoading(false);
        }
      }
    },
    [clientIp, t]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData({ silent: true });
    }, [fetchData])
  );

  const handleSelectStaff = useCallback((value: number | string) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      setSelectedStaffId(numeric);
    } else {
      setSelectedStaffId(null);
    }
  }, []);

  const selectedStaff = useMemo(
    () => staffList.find((item) => item.id === selectedStaffId) || null,
    [staffList, selectedStaffId]
  );

  const staffAttendance = useMemo(() => {
    if (!selectedStaffId) return [];
    return attendance
      .filter((row) => row.staff_id === selectedStaffId)
      .sort((a, b) =>
        String(b.check_in_time || "").localeCompare(
          String(a.check_in_time || "")
        )
      );
  }, [attendance, selectedStaffId]);

  const activeSession = staffAttendance.find((row) => !row.check_out_time);
  const isCheckedIn = Boolean(activeSession);
  const lastEntry = staffAttendance[0];

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData({ silent: true });
    setRefreshing(false);
  };

  const handleAction = async () => {
    if (!selectedStaffId) {
      Alert.alert(t("Select staff"), t("Please choose a staff member first."));
      return;
    }

    if (!deviceId) {
      Alert.alert(
        t("Device not ready"),
        t("We are still preparing the device identifier. Please retry.")
      );
      return;
    }

    if (!clientIp) {
      Alert.alert(
        t("Connection not ready"),
        t(
          "We could not determine your Wi-Fi IP yet. Please ensure you are connected and try again."
        )
      );
      return;
    }

    setActionLoading(true);
    try {
      const action = isCheckedIn ? "checkout" : "checkin";
      await secureFetch("/staff/checkin", {
        method: "POST",
        headers: { "x-forwarded-for": clientIp },
        body: JSON.stringify({
          staffId: Number(selectedStaffId),
          deviceId,
          action,
        }),
      });

      await fetchData({ silent: true });
      Alert.alert(
        t("Success"),
        isCheckedIn
          ? t("Checked out successfully.")
          : t("Checked in successfully.")
      );
    } catch (err: any) {
      console.error("❌ Check-in/out failed", err);
      const message =
        err?.message ||
        (isCheckedIn
          ? t("Unable to check out. Please try again.")
          : t("Unable to check in. Please try again."));
      Alert.alert(t("Error"), message);
    } finally {
      setActionLoading(false);
    }
  };

  const renderTimeline = () => {
    if (staffAttendance.length === 0) {
      return (
        <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
          {t("No attendance history yet")}
        </Text>
      );
    }

    return staffAttendance.slice(0, 12).map((row) => (
      <View
        key={`${row.id}-${row.check_in_time}`}
        style={[styles.timelineItem, isDark && styles.timelineItemDark]}
      >
        <View style={styles.timelineHeader}>
          <Text
            style={[styles.timelineName, isDark && styles.timelineNameDark]}
          >
            {row.staff_name || selectedStaff?.name || t("Unknown")}
          </Text>
          <Text
            style={[
              styles.timelineStatus,
              row.check_out_time
                ? styles.timelineStatusOut
                : styles.timelineStatusIn,
            ]}
          >
            {row.check_out_time ? t("Checked out") : t("Checked in")}
          </Text>
        </View>
        <Text
          style={[styles.timelineLabel, isDark && styles.timelineLabelDark]}
        >
          {t("Check in")}: {formatDateTime(row.check_in_time)}
        </Text>
        <Text
          style={[styles.timelineLabel, isDark && styles.timelineLabelDark]}
        >
          {t("Check out")}: {formatDateTime(row.check_out_time)}
        </Text>
        <Text
          style={[
            styles.timelineDuration,
            isDark && styles.timelineDurationDark,
          ]}
        >
          {t("Duration")}: {formatDuration(row.duration_minutes)}
        </Text>
      </View>
    ));
  };

  if (loading) {
    return (
      <View
        style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
          {t("Loading attendance...")}
        </Text>
      </View>
    );
  }

  const actionDisabled = actionLoading || !selectedStaffId || ipLoading;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={[styles.pageTitle, isDark && styles.pageTitleDark]}>
          ⏱️ {t("Staff Check-In")}
        </Text>
        <Text style={[styles.pageSubtitle, isDark && styles.pageSubtitleDark]}>
          {t(
            "Empower your team to check in and out securely from their phone."
          )}
        </Text>

        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardLabel, isDark && styles.cardLabelDark]}>
            {t("Staff Member")}
          </Text>
          <View
            style={[
              styles.pickerContainer,
              isDark && styles.pickerContainerDark,
            ]}
          >
            <Picker
              selectedValue={selectedStaffId ?? undefined}
              onValueChange={handleSelectStaff}
              dropdownIconColor={isDark ? "#F9FAFB" : "#1F2937"}
              style={styles.picker}
            >
              {staffList.length === 0 ? (
                <Picker.Item
                  label={t("No staff available")}
                  value={0}
                  enabled={false}
                />
              ) : (
                staffList.map((staff) => (
                  <Picker.Item
                    key={staff.id}
                    label={`${staff.name}${staff.role ? ` • ${staff.role}` : ""}`}
                    value={staff.id}
                  />
                ))
              )}
            </Picker>
          </View>
        </View>

        <View style={[styles.statusCard, isDark && styles.statusCardDark]}>
          <Text style={[styles.statusLabel, isDark && styles.statusLabelDark]}>
            {t("Current status")}
          </Text>
          <Text
            style={[
              styles.statusValue,
              isCheckedIn ? styles.statusValueIn : styles.statusValueOut,
            ]}
          >
            {isCheckedIn ? t("Checked in") : t("Not checked in")}
          </Text>
          <Text style={[styles.statusMeta, isDark && styles.statusMetaDark]}>
            {t("Last check-in")}: {formatDateTime(lastEntry?.check_in_time)}
          </Text>
          <Text style={[styles.statusMeta, isDark && styles.statusMetaDark]}>
            {t("Last check-out")}: {formatDateTime(lastEntry?.check_out_time)}
          </Text>

          <TouchableOpacity
            style={[
              styles.actionButton,
              isCheckedIn ? styles.actionButtonOut : styles.actionButtonIn,
              actionDisabled && styles.actionButtonDisabled,
            ]}
            onPress={handleAction}
            disabled={actionDisabled}
            activeOpacity={0.85}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={isCheckedIn ? "log-out" : "log-in"}
                  size={18}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.actionButtonText}>
                  {isCheckedIn ? t("Check out") : t("Check in")}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[styles.statusHint, isDark && styles.statusHintDark]}>
            {t("Device ID")}: {deviceId || t("Preparing...")}
          </Text>
          <Text style={[styles.statusHint, isDark && styles.statusHintDark]}>
            {t("Wi-Fi IP")}: {clientIp || t("Detecting...")}
          </Text>
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardLabel, isDark && styles.cardLabelDark]}>
            {t("Timeline")}
          </Text>
          {renderTimeline()}
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  containerDark: { backgroundColor: "#0F172A" },
  scrollContent: { paddingBottom: 96, paddingHorizontal: 20, paddingTop: 36 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingContainerDark: { backgroundColor: "#0F172A" },
  loadingText: { marginTop: 16, color: "#4B5563", fontSize: 15 },
  loadingTextDark: { color: "#E5E7EB" },
  pageTitle: { fontSize: 28, fontWeight: "700", color: "#111827" },
  pageTitleDark: { color: "#F9FAFB" },
  pageSubtitle: {
    marginTop: 6,
    marginBottom: 24,
    color: "#6B7280",
    fontSize: 14,
  },
  pageSubtitleDark: { color: "#CBD5F5" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  cardDark: { backgroundColor: "#111827", shadowColor: "transparent" },
  cardLabel: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  cardLabelDark: { color: "#E5E7EB" },
  pickerContainer: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  pickerContainerDark: { borderColor: "#1F2937", backgroundColor: "#1F2937" },
  picker: { color: "#111827" },
  statusCard: {
    backgroundColor: "#0F172A",
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
  },
  statusCardDark: { backgroundColor: "#1E293B" },
  statusLabel: {
    color: "#E5E7EB",
    opacity: 0.85,
    fontSize: 14,
    marginBottom: 6,
  },
  statusLabelDark: { color: "#CBD5F5" },
  statusValue: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  statusValueIn: { color: "#34D399" },
  statusValueOut: { color: "#FCA5A5" },
  statusMeta: { color: "#F9FAFB", opacity: 0.8, marginVertical: 2 },
  statusMetaDark: { color: "#CBD5F5" },
  actionButton: {
    marginTop: 18,
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonIn: { backgroundColor: "#22C55E" },
  actionButtonOut: { backgroundColor: "#EF4444" },
  actionButtonDisabled: { opacity: 0.7 },
  actionButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  statusHint: { marginTop: 12, color: "#CBD5F5", fontSize: 12 },
  statusHintDark: { color: "#94A3B8" },
  timelineItem: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 12,
  },
  timelineItemDark: { borderColor: "#1F2937", backgroundColor: "#0F172A" },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between" },
  timelineName: { fontWeight: "600", color: "#111827" },
  timelineNameDark: { color: "#F9FAFB" },
  timelineStatus: { fontSize: 12, fontWeight: "600" },
  timelineStatusIn: { color: "#34D399" },
  timelineStatusOut: { color: "#F87171" },
  timelineLabel: { marginTop: 6, color: "#4B5563", fontSize: 13 },
  timelineLabelDark: { color: "#E5E7EB" },
  timelineDuration: { marginTop: 6, color: "#2563EB", fontWeight: "600" },
  timelineDurationDark: { color: "#60A5FA" },
  emptyText: { textAlign: "center", color: "#6B7280", marginTop: 12 },
  emptyTextDark: { color: "#94A3B8" },
});
