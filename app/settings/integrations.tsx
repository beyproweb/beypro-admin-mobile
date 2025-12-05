import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import secureFetch from "../../src/utils/secureFetch";
import { Ionicons } from "@expo/vector-icons";

const DEFAULT_INTEGRATIONS = {
  whatsapp: true,
  getir: false,
  trendyol: false,
  yemeksepeti: false,
  qr_menu: true,
  auto_confirm_orders: false,
};

const integrationList = [
  { key: "whatsapp", name: "WhatsApp Auto Order Message" },
  { key: "getir", name: "Getir Restaurant Sync" },
  { key: "trendyol", name: "Trendyol Go Integration" },
  { key: "yemeksepeti", name: "Yemeksepeti Menu Sync" },
  { key: "qr_menu", name: "Digital QR Menu Link" },
];

export default function IntegrationsMobile() {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState(DEFAULT_INTEGRATIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    secureFetch("/settings/integrations")
      .then((data) => {
        if (mounted && data)
          setIntegrations({ ...DEFAULT_INTEGRATIONS, ...data });
      })
      .catch(() => setIntegrations(DEFAULT_INTEGRATIONS))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggle = (key: string) => {
    setIntegrations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await secureFetch("/settings/integrations", {
        method: "POST",
        body: JSON.stringify(integrations),
      });
      Alert.alert(t("Integrations saved!"));
    } catch (err) {
      Alert.alert(t("Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>{t("Loading integrations")}…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("Settings")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("Manage integrations and connected services")}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🔌 {t("Integrations")}</Text>
        {integrationList.map(({ key, name }) => (
          <View key={key} style={styles.row}>
            <Text style={styles.label}>{t(name)}</Text>
            <Switch
              value={!!integrations[key]}
              onValueChange={() => handleToggle(key)}
              trackColor={{ false: "#d1d5db", true: "#6366F1" }}
              thumbColor={integrations[key] ? "#4F46E5" : "#f4f3f4"}
            />
          </View>
        ))}
        {/* Auto Confirm Orders toggle */}
        <View
          style={[
            styles.row,
            {
              borderTopWidth: 1,
              borderTopColor: "#E5E7EB",
              marginTop: 24,
              paddingTop: 18,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.label, { fontWeight: "bold", color: "#4F46E5" }]}
            >
              ✅ {t("Auto Confirm Incoming Orders")}
            </Text>
            <Text style={styles.subLabel}>
              {t(
                "When enabled, online orders from integrations (like Yemeksepeti or Getir) will be confirmed automatically."
              )}
            </Text>
          </View>
          <Switch
            value={!!integrations.auto_confirm_orders}
            onValueChange={() => handleToggle("auto_confirm_orders")}
            trackColor={{ false: "#d1d5db", true: "#10B981" }}
            thumbColor={
              integrations.auto_confirm_orders ? "#10B981" : "#f4f3f4"
            }
          />
        </View>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveBtn}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t("Saving...") : `💾 ${t("Save Settings")}`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      {/* Bottom Navigation */}
      {/* @ts-ignore - If BottomNav is not typed, ignore for now */}
      {require("../../src/components/navigation/BottomNav").default
        ? React.createElement(
            require("../../src/components/navigation/BottomNav").default
          )
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 18,
    color: "#4F46E5",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  label: { fontSize: 16, color: "#1F2937", flex: 1, marginRight: 10 },
  subLabel: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  saveBtn: {
    marginTop: 30,
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
