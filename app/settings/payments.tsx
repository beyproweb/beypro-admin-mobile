import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import secureFetch from "../../src/utils/secureFetch";
import { Ionicons } from "@expo/vector-icons";

// Placeholder for payment methods utils (normalize, serialize, etc.)
const DEFAULT_PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: "💵", enabled: true, builtIn: true },
  { id: "card", label: "Card", icon: "💳", enabled: true, builtIn: true },
];

interface PaymentMethod {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  builtIn: boolean;
}

interface PaymentSettings {
  methods: PaymentMethod[];
  defaultCard?: Record<string, unknown>;
}

function normalizePaymentSettings(data: unknown): PaymentSettings {
  if (!data || !Array.isArray((data as PaymentSettings).methods))
    return { methods: DEFAULT_PAYMENT_METHODS, defaultCard: {} };
  return {
    ...data,
    methods: (data as PaymentSettings).methods.map((m) => ({
      ...m,
      enabled: m.enabled !== false,
    })),
  };
}

function serializePaymentSettings(data: PaymentSettings): PaymentSettings {
  return data;
}

function slugifyPaymentId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function formatPaymentLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getPaymentMethodIcon(methods: PaymentMethod[], id: string): string {
  return methods.find((m) => m.id === id)?.icon || "💳";
}

export default function PaymentMethodsMobile() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState(() =>
    normalizePaymentSettings({ methods: DEFAULT_PAYMENT_METHODS })
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMethodLabel, setNewMethodLabel] = useState("");
  const [newMethodIcon, setNewMethodIcon] = useState("💳");

  useEffect(() => {
    let mounted = true;
    secureFetch("/settings/payments")
      .then((data) => {
        if (!mounted) return;
        setPayments(normalizePaymentSettings(data));
      })
      .catch(() => {
        if (mounted) {
          setPayments(
            normalizePaymentSettings({ methods: DEFAULT_PAYMENT_METHODS })
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const methodFields = useMemo(
    () => payments.methods || [],
    [payments.methods]
  );

  const handleToggleMethod = (id: string): void => {
    setPayments(
      (prev: PaymentSettings): PaymentSettings => ({
        ...prev,
        methods: (prev.methods || []).map(
          (method: PaymentMethod): PaymentMethod =>
            method.id === id
              ? { ...method, enabled: !(method.enabled !== false) }
              : method
        ),
      })
    );
  };

  const handleLabelChange = (id: string, value: string): void => {
    setPayments(
      (prev: PaymentSettings): PaymentSettings => ({
        ...prev,
        methods: (prev.methods || []).map(
          (method: PaymentMethod): PaymentMethod =>
            method.id === id ? { ...method, label: value } : method
        ),
      })
    );
  };

  const handleIconChange = (id: string, value: string): void => {
    setPayments(
      (prev: PaymentSettings): PaymentSettings => ({
        ...prev,
        methods: (prev.methods || []).map(
          (method: PaymentMethod): PaymentMethod =>
            method.id === id ? { ...method, icon: value.slice(0, 3) } : method
        ),
      })
    );
  };

  const handleDeleteMethod = (id: string): void => {
    setPayments(
      (prev: PaymentSettings): PaymentSettings => ({
        ...prev,
        methods: (prev.methods || []).filter(
          (method: PaymentMethod): boolean => method.id !== id
        ),
      })
    );
  };

  const handleAddMethod = () => {
    const cleanLabel = newMethodLabel.trim();
    if (!cleanLabel) return;
    const idBase = slugifyPaymentId(cleanLabel);
    setPayments((prev) => {
      const exists = prev.methods?.some((method) => method.id === idBase);
      const uniqueId = exists ? `${idBase}_${Date.now().toString(36)}` : idBase;
      const nextMethods = [
        ...(prev.methods || []),
        {
          id: uniqueId,
          label: formatPaymentLabel(cleanLabel),
          icon: newMethodIcon || "💳",
          enabled: true,
          builtIn: false,
        },
      ];
      return { ...prev, methods: nextMethods };
    });
    setNewMethodLabel("");
    setNewMethodIcon("💳");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = serializePaymentSettings(payments);
      await secureFetch("/settings/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      Alert.alert(t("Payment methods saved!"));
    } catch (err) {
      Alert.alert(t("Failed to save settings"));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text>{t("Loading payment settings")}…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("Settings")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("Manage payment methods and options")}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>💰 {t("Payment Methods")}</Text>
        {methodFields.map((method) => (
          <View key={method.id} style={styles.methodRow}>
            <TextInput
              style={styles.iconInput}
              maxLength={3}
              value={
                method.icon || getPaymentMethodIcon(methodFields, method.id)
              }
              onChangeText={(v) => handleIconChange(method.id, v)}
              placeholder="💳"
            />
            <TextInput
              style={styles.labelInput}
              value={method.label}
              onChangeText={(v) => handleLabelChange(method.id, v)}
              placeholder={t("Payment name")}
            />
            <TouchableOpacity onPress={() => handleToggleMethod(method.id)}>
              <Ionicons
                name={
                  method.enabled !== false ? "checkmark-circle" : "close-circle"
                }
                size={24}
                color={method.enabled !== false ? "#10B981" : "#EF4444"}
              />
            </TouchableOpacity>
            {!method.builtIn && (
              <TouchableOpacity onPress={() => handleDeleteMethod(method.id)}>
                <Ionicons name="trash" size={22} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={styles.iconInput}
            value={newMethodIcon}
            maxLength={3}
            onChangeText={setNewMethodIcon}
            placeholder="💳"
          />
          <TextInput
            style={styles.labelInput}
            value={newMethodLabel}
            onChangeText={setNewMethodLabel}
            placeholder={t("Add new payment method (e.g. Papara)")}
          />
          <TouchableOpacity onPress={handleAddMethod} style={styles.addBtn}>
            <Text style={{ color: "#fff" }}>➕ {t("Add")}</Text>
          </TouchableOpacity>
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
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  iconInput: {
    width: 40,
    fontSize: 22,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#f9fafb",
  },
  labelInput: {
    flex: 1,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#f9fafb",
  },
  addRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 8 },
  addBtn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveBtn: {
    marginTop: 30,
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  // Footer styles removed
});
