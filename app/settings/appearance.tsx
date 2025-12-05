import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useTranslation } from "react-i18next";
import BottomNav from "../../src/components/navigation/BottomNav";
import {
  useAppearance,
  ThemeKey,
  FontSizeKey,
  AccentKey,
} from "../../src/context/AppearanceContext";

export default function AppearanceSettingsScreen() {
  const { t } = useTranslation();
  
  const THEMES: { key: ThemeKey; label: string; icon: string }[] = [
    { key: "light", label: t("Light"), icon: "🌞" },
    { key: "dark", label: t("Dark"), icon: "🌚" },
    { key: "system", label: t("Auto"), icon: "🌓" },
  ];

  const ACCENT_COLORS: { key: AccentKey; name: string; color: string }[] = [
    { key: "default", name: t("Indigo"), color: "#4f46e5" },
    { key: "emerald-500", name: t("Emerald"), color: "#10b981" },
    { key: "rose-500", name: t("Rose"), color: "#f43f5e" },
    { key: "amber-500", name: t("Amber"), color: "#f59e0b" },
    { key: "cyan-500", name: t("Cyan"), color: "#06b6d4" },
    { key: "violet-500", name: t("Violet"), color: "#8b5cf6" },
    { key: "lime-500", name: t("Lime"), color: "#84cc16" },
    { key: "sky-500", name: t("Sky"), color: "#0ea5e9" },
  ];
  
  const {
    appearance,
    setAppearance,
    loading,
    saving,
    saveAppearance,
    accentColor,
    fontScale,
    isDark,
  } = useAppearance();
  const highContrast = appearance.highContrast;

  const handleSave = async () => {
    await saveAppearance();
  };

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        highContrast && styles.containerHighContrast,
      ]}
    >
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text
          style={[
            styles.headerTitle,
            { fontSize: 26 * fontScale, color: accentColor },
          ]}
        >
          {t("Appearance")}
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            isDark && styles.headerSubtitleDark,
            { fontSize: 14 * fontScale },
          ]}
        >
          {t("Customize theme, font size and accent colors.")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        )}

        {!loading && (
          <>
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { fontSize: 16 * fontScale, color: accentColor },
                  styles.sectionTitleTight,
                ]}
              >
                {t("Theme")}
              </Text>

              <View style={styles.themeRow}>
                {THEMES.map((theme) => {
                  const active = appearance.theme === theme.key;
                  return (
                    <TouchableOpacity
                      key={theme.key}
                      style={[
                        styles.themeCard,
                        isDark && styles.themeCardDark,
                        active && styles.themeCardActive,
                      ]}
                      onPress={() =>
                        setAppearance((prev) => ({
                          ...prev,
                          theme: theme.key,
                        }))
                      }
                    >
                      <Text style={styles.themeIcon}>{theme.icon}</Text>
                      <Text
                        style={[
                          styles.themeLabel,
                          isDark && styles.themeLabelDark,
                          active && {
                            fontWeight: "600",
                            color: isDark ? accentColor : "#111827",
                          },
                        ]}
                      >
                        {theme.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { fontSize: 16 * fontScale, color: accentColor },
                  styles.sectionTitleTight,
                ]}
              >
                {t("Font size")}
              </Text>

              <View style={styles.fontRow}>
                {(["small", "medium", "large"] as FontSizeKey[]).map((size) => {
                  const active = appearance.fontSize === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.fontPill,
                        isDark && styles.fontPillDark,
                        active && [
                          styles.fontPillActive,
                          { backgroundColor: accentColor },
                        ],
                      ]}
                      onPress={() =>
                        setAppearance((prev) => ({
                          ...prev,
                          fontSize: size,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.fontPillLabel,
                          active && styles.fontPillLabelActive,
                          isDark && styles.fontPillLabelDark,
                          { fontSize: 13 * fontScale },
                        ]}
                      >
                        {size === "small" && t("Small")}
                        {size === "medium" && t("Medium")}
                        {size === "large" && t("Large")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { fontSize: 16 * fontScale, color: accentColor },
                ]}
              >
                {t("Accent color")}
              </Text>

              <View style={styles.accentGrid}>
                {ACCENT_COLORS.map((item) => {
                  const active = appearance.accent === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={styles.accentItem}
                      onPress={() =>
                        setAppearance((prev) => ({
                          ...prev,
                          accent: item.key,
                        }))
                      }
                    >
                      <View
                        style={[
                          styles.accentCircle,
                          { backgroundColor: item.color },
                          active && styles.accentCircleActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.accentLabel,
                          isDark && styles.accentLabelDark,
                          { fontSize: 11 * fontScale },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      styles.sectionTitleTight,
                      { fontSize: 16 * fontScale },
                    ]}
                  >
                    {t("High contrast")}
                  </Text>
                  <Text
                    style={[
                      styles.helperText,
                      isDark && styles.helperTextDark,
                      { fontSize: 12 * fontScale },
                    ]}
                  >
                    {t("Increases contrast for better legibility.")}
                  </Text>
                </View>

                <Switch
                  value={appearance.highContrast}
                  onValueChange={(value) =>
                    setAppearance((prev) => ({
                      ...prev,
                      highContrast: value,
                    }))
                  }
                  thumbColor={appearance.highContrast ? "#4f46e5" : "#f4f3f4"}
                  trackColor={{ false: "#d1d5db", true: "#c7d2fe" }}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                saving && styles.saveButtonDisabled,
                { backgroundColor: accentColor },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  { fontSize: 15 * fontScale },
                ]}
              >
                {saving ? t("Saving...") : t("Save changes")}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

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
  containerHighContrast: {
    backgroundColor: "#000000",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 22,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
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
    padding: 24,
    paddingBottom: 160,
  },
  loading: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#111827",
  },
  sectionTitleTight: {
    marginBottom: 6,
  },
  helperText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  helperTextDark: {
    color: "#9CA3AF",
  },
  themeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  themeCard: {
    flex: 1,
    paddingVertical: 14,
    marginHorizontal: 4,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  themeCardDark: {
    backgroundColor: "#020617",
    borderColor: "#374151",
  },
  themeCardActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#4F46E5",
  },
  themeIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  themeLabel: {
    fontSize: 13,
    color: "#374151",
  },
  themeLabelDark: {
    color: "#E5E7EB",
  },
  fontRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fontPill: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  fontPillDark: {
    backgroundColor: "#4B5563",
  },
  fontPillActive: {
    backgroundColor: "#4F46E5",
  },
  fontPillLabel: {
    fontSize: 13,
    color: "#374151",
  },
  fontPillLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  fontPillLabelDark: {
    color: "#E5E7EB",
  },
  accentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  accentItem: {
    width: "23%",
    alignItems: "center",
    marginBottom: 16,
  },
  accentCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 2,
  },
  accentCircleActive: {
    borderColor: "#4F46E5",
  },
  accentLabel: {
    marginTop: 6,
    fontSize: 11,
    color: "#374151",
    textAlign: "center",
  },
  accentLabelDark: {
    color: "#E5E7EB",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saveButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#4F46E5",
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
