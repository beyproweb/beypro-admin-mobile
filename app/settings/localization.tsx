import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import secureFetch from "../../src/api/secureFetch";
import BottomNav from "../../src/components/navigation/BottomNav";

const LANGUAGE_OPTIONS = [
  { label: "English", code: "en" },
  { label: "Turkish", code: "tr" },
  { label: "German", code: "de" },
  { label: "French", code: "fr" },
];

const CURRENCY_KEYS = ["₺ TRY", "€ EUR", "$ USD", "£ GBP", "₨ MUR"];

export default function LocalizationScreen() {
  const { t, i18n } = useTranslation();
  const { isDark, fontScale } = useAppearance();
  const { currency: contextCurrency, setCurrency: setContextCurrency } = useCurrency();

  const [language, setLanguage] = useState("English");
  const [currency, setCurrency] = useState(contextCurrency || "₺ TRY");
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load current localization settings
  useEffect(() => {
    loadLocalizationSettings();
  }, []);

  const loadLocalizationSettings = async () => {
    setLoading(true);
    try {
      const data = await secureFetch("/settings/localization");
      if (data?.language) {
        const langLabel =
          LANGUAGE_OPTIONS.find((opt) => opt.code === data.language)?.label ||
          "English";
        setLanguage(langLabel);
        if (i18n && typeof i18n.changeLanguage === "function") {
          i18n.changeLanguage(data.language);
        }
      }
      if (data?.currency) {
        setCurrency(data.currency);
      }
    } catch (err) {
      console.warn("⚠️ Failed to load localization:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (selectedLabel: string) => {
    setLanguage(selectedLabel);
    const selectedLang =
      LANGUAGE_OPTIONS.find((opt) => opt.label === selectedLabel)?.code || "en";
    if (i18n && typeof i18n.changeLanguage === "function") {
      i18n.changeLanguage(selectedLang);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selectedLang =
        LANGUAGE_OPTIONS.find((opt) => opt.label === language)?.code || "en";

      await secureFetch("/settings/localization", {
        method: "POST",
        body: JSON.stringify({ language: selectedLang, currency }),
      });

      setContextCurrency(currency);
      Alert.alert(t("Success") as string, t("✅ Localization saved successfully!") as string);
    } catch (err) {
      console.error("❌ Failed to save localization:", err);
      Alert.alert(t("Error") as string, t("Failed to save localization") as string);
    } finally {
      setIsSaving(false);
    }
  };

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
          {t("Localization")}
        </Text>
        <Text
          style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}
        >
          {t("Language & Currency Settings")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Language Selector */}
        <View
          style={[styles.sectionCard, isDark && styles.sectionCardDark]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons
              name="language"
              size={24}
              color={isDark ? "#818CF8" : "#4F46E5"}
            />
            <Text
              style={[
                styles.sectionTitle,
                isDark && styles.sectionTitleDark,
                { fontSize: 16 * fontScale },
              ]}
            >
              {t("Preferred Language")}
            </Text>
          </View>
          <Text
            style={[
              styles.sectionDesc,
              isDark && styles.sectionDescDark,
              { fontSize: 13 * fontScale },
            ]}
          >
            {t("Choose your preferred language")}
          </Text>

          <View
            style={[
              styles.pickerContainer,
              isDark && styles.pickerContainerDark,
            ]}
          >
            <Picker
              selectedValue={language}
              onValueChange={(value: string) => handleLanguageChange(value)}
              style={[
              styles.picker,
              { color: isDark ? "#F9FAFB" : "#111827" },
              ]}
            >
              {LANGUAGE_OPTIONS.map((opt: { label: string; code: string }) => (
              <Picker.Item key={opt.code} label={t(opt.label) as string} value={opt.label} />
              ))}
            </Picker>
          </View>

          <View style={styles.languageInfo}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const isSelected = language === opt.label;
              if (!isSelected) return null;
              return (
                <View key={opt.code} style={styles.langBadge}>
                  <Text style={[styles.langBadgeText, { fontSize: 12 * fontScale }]}>
                    {t("Code")}: {opt.code}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Currency Selector */}
        <View
          style={[styles.sectionCard, isDark && styles.sectionCardDark]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons
              name="cash"
              size={24}
              color={isDark ? "#818CF8" : "#4F46E5"}
            />
            <Text
              style={[
                styles.sectionTitle,
                isDark && styles.sectionTitleDark,
                { fontSize: 16 * fontScale },
              ]}
            >
              {t("Currency")}
            </Text>
          </View>
          <Text
            style={[
              styles.sectionDesc,
              isDark && styles.sectionDescDark,
              { fontSize: 13 * fontScale },
            ]}
          >
            {t("Select your preferred currency")}
          </Text>

          <View
            style={[
              styles.pickerContainer,
              isDark && styles.pickerContainerDark,
            ]}
          >
            <Picker
              selectedValue={currency}
              onValueChange={(value: string) => setCurrency(value)}
              style={[
                styles.picker,
                { color: isDark ? "#F9FAFB" : "#111827" },
              ]}
            >
              {CURRENCY_KEYS.map((cur) => (
                <Picker.Item key={cur} label={cur} value={cur} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
          <Ionicons
            name="information-circle"
            size={20}
            color={isDark ? "#818CF8" : "#4F46E5"}
          />
          <Text
            style={[
              styles.infoText,
              isDark && styles.infoTextDark,
              { fontSize: 12 * fontScale },
            ]}
          >
            {t("Changes will be saved to your account and synced across all devices.")}
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Ionicons
            name="checkmark-done"
            size={20}
            color="white"
          />
          <Text
            style={[
              styles.saveButtonText,
              { fontSize: 16 * fontScale },
            ]}
          >
            {isSaving ? t("Saving...") : t("Save All")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

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

  sectionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionCardDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  sectionTitleDark: {
    color: "#F9FAFB",
  },

  sectionDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  sectionDescDark: {
    color: "#9CA3AF",
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "white",
    overflow: "hidden",
    marginBottom: 12,
  },
  pickerContainerDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },

  picker: {
    height: 50,
  },

  languageInfo: {
    marginTop: 8,
  },

  langBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#4F46E5",
  },

  langBadgeText: {
    color: "#4F46E5",
    fontWeight: "600",
  },

  infoCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoCardDark: {
    backgroundColor: "#1F2937",
    borderLeftColor: "#818CF8",
  },

  infoText: {
    fontSize: 12,
    color: "#4F46E5",
    flex: 1,
    lineHeight: 18,
  },
  infoTextDark: {
    color: "#818CF8",
  },

  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 14,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "white",
    fontWeight: "700",
  },
});
