import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState, useEffect } from "react";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useTranslation } from "react-i18next";
import secureFetch from "../../src/api/secureFetch";
import BottomNav from "../../src/components/navigation/BottomNav";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface ShopHours {
  [day: string]: { open: string; close: string };
}

export default function ShopHoursScreen() {
  const { isDark, fontScale } = useAppearance();
  const { t } = useTranslation();
  const [shopHours, setShopHours] = useState<ShopHours>({});
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState<{
    day: string;
    field: "open" | "close";
  } | null>(null);
  const [tempTime, setTempTime] = useState(new Date());

  useEffect(() => {
    loadShopHours();
  }, []);

  const loadShopHours = async () => {
    try {
      setLoading(true);
      const data = await secureFetch("/settings/shop-hours/all");
      const hoursMap: ShopHours = {};
      if (Array.isArray(data)) {
        data.forEach((row: any) => {
          hoursMap[row.day] = {
            open: row.open_time || "",
            close: row.close_time || "",
          };
        });
      }
      setShopHours(hoursMap);
    } catch (err) {
      console.error("❌ Failed to load shop hours:", err);
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to load shop hours"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = async (
    day: string,
    field: "open" | "close",
    date: Date
  ) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const timeString = `${hours}:${minutes}`;
    const updatedHours = {
      ...shopHours,
      [day]: { ...shopHours[day], [field]: timeString },
    };
    setShopHours(updatedHours);
    setPickerVisible(null);

    try {
      setSavingDay(day);
      await secureFetch("/settings/shop-hours/all", {
        method: "POST",
        body: JSON.stringify({ hours: updatedHours }),
      });
      console.log("✅ Time saved for", day);
    } catch (err) {
      console.error("❌ Failed to save time:", err);
      Alert.alert(
        "Save Failed",
        err instanceof Error ? err.message : "Failed to save time"
      );
    } finally {
      setSavingDay(null);
    }
  };

  const showTimePicker = (day: string, field: "open" | "close") => {
    const timeStr = shopHours[day]?.[field] || "09:00";
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    setTempTime(date);
    setPickerVisible({ day, field });
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* ================================================ */}
      {/* HEADER */}
      {/* ================================================ */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerContent}>
          <Text
            style={[
              styles.headerTitle,
              isDark && styles.headerTitleDark,
              { fontSize: 26 * fontScale },
            ]}
          >
            Shop Hours
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              isDark && styles.headerSubtitleDark,
            ]}
          >
            Configure your daily operating schedule
          </Text>
        </View>
        <View
          style={[
            styles.headerIcon,
            isDark && styles.headerIconDark,
          ]}
        >
          <Ionicons
            name="time"
            size={24 * fontScale}
            color={isDark ? "#818CF8" : "#4F46E5"}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text
              style={[
                styles.loadingText,
                isDark && styles.loadingTextDark,
                { fontSize: 14 * fontScale },
              ]}
            >
              Loading shop hours…
            </Text>
          </View>
        ) : (
          <View style={styles.daysGrid}>
            {DAYS.map((day) => (
              <View
                key={day}
                style={[styles.dayCard, isDark && styles.dayCardDark]}
              >
                <Text
                  style={[
                    styles.dayName,
                    isDark && styles.dayNameDark,
                    { fontSize: 16 * fontScale },
                  ]}
                >
                  {t(day)}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.timePickerRow,
                    savingDay === day && styles.savingRow,
                  ]}
                  onPress={() => showTimePicker(day, "open")}
                  disabled={savingDay === day}
                >
                  <View style={styles.timeLabel}>
                    <Ionicons
                      name="time"
                      size={16}
                      color={isDark ? "#A5B4FC" : "#818CF8"}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.timeLabelText,
                        isDark && styles.timeLabelTextDark,
                        { fontSize: 12 * fontScale },
                      ]}
                    >
                      Open
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {savingDay === day && (
                      <ActivityIndicator
                        size="small"
                        color="#4F46E5"
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.timeValue,
                        isDark && styles.timeValueDark,
                        { fontSize: 14 * fontScale },
                      ]}
                    >
                      {shopHours[day]?.open || "—"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.timePickerRow,
                    savingDay === day && styles.savingRow,
                  ]}
                  onPress={() => showTimePicker(day, "close")}
                  disabled={savingDay === day}
                >
                  <View style={styles.timeLabel}>
                    <Ionicons
                      name="time"
                      size={16}
                      color={isDark ? "#A5B4FC" : "#818CF8"}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.timeLabelText,
                        isDark && styles.timeLabelTextDark,
                        { fontSize: 12 * fontScale },
                      ]}
                    >
                      Close
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {savingDay === day && (
                      <ActivityIndicator
                        size="small"
                        color="#4F46E5"
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.timeValue,
                        isDark && styles.timeValueDark,
                        { fontSize: 14 * fontScale },
                      ]}
                    >
                      {shopHours[day]?.close || "—"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {pickerVisible && (
        <View style={styles.pickerOverlay}>
          <View
            style={[
              styles.pickerContainer,
              isDark && styles.pickerContainerDark,
            ]}
          >
            <Text
              style={[
                styles.pickerTitle,
                isDark && styles.pickerTitleDark,
                { fontSize: 16 * fontScale },
              ]}
            >
              Set {pickerVisible.field === "open" ? "Opening" : "Closing"}{" "}
              Time for {pickerVisible.day}
            </Text>
            <View style={{ height: 200, justifyContent: "center" }}>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate)
                    handleTimeChange(
                      pickerVisible.day,
                      pickerVisible.field,
                      selectedDate
                    );
                }}
              />
            </View>
          </View>
        </View>
      )}

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  containerDark: { backgroundColor: "#0F172A" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#1E293B",
    borderBottomColor: "#334155",
  },
  headerContent: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: "400",
    color: "#6B7280",
    marginTop: 4,
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  headerIconDark: {
    backgroundColor: "rgba(129, 140, 248, 0.15)",
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 120,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: { marginTop: 12, color: "#6B7280", fontWeight: "500" },
  loadingTextDark: { color: "#9CA3AF" },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  dayCard: {
    width: "48%",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
  },
  dayCardDark: { backgroundColor: "#1E293B", borderLeftColor: "#818CF8" },
  dayName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
    textAlign: "center",
  },
  dayNameDark: { color: "#E5E7EB" },
  timePickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    marginBottom: 8,
  },
  savingRow: { opacity: 0.7 },
  timeLabel: { flexDirection: "row", alignItems: "center" },
  timeLabelText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4F46E5",
  },
  timeLabelTextDark: { color: "#A5B4FC" },
  timeValue: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  timeValueDark: { color: "#E5E7EB" },
  pickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  pickerContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 30,
  },
  pickerContainerDark: { backgroundColor: "#1E293B" },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
  },
  pickerTitleDark: { color: "#E5E7EB" },
});
