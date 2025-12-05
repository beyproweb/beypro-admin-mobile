import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import secureFetch from "../../src/utils/secureFetch";
import { Ionicons } from "@expo/vector-icons";

const plans = [
  {
    key: "basic",
    name: "Basic",
    price: { monthly: "₺600", yearly: "₺6.000" },
    features: [
      "Unlimited Orders",
      "1 Register",
      "Basic Staff Management",
      "Kitchen Ticket Printing",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: { monthly: "₺1.200", yearly: "₺12.000" },
    features: [
      "Everything in Basic",
      "Multiple Registers",
      "Payroll Automation",
      "Stock & Supplier Refill",
      "Email Reports",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: { monthly: "₺2.200", yearly: "₺22.000" },
    features: [
      "Everything in Pro",
      "Driver App",
      "Multi-Location",
      "API Access",
      "Dedicated Support",
    ],
  },
];

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  businessName: "",
  billingCycle: "monthly",
  activePlan: "basic",
};

export default function SubscriptionMobile() {
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    secureFetch("/me")
      .then((res) => {
        if (!mounted) return;
        const u = res?.user || res;
        setForm((prev) => ({
          ...prev,
          fullName: u.full_name || u.fullName || u.name || "",
          email: u.email || "",
          phone: u.phone || "",
          businessName:
            u.business_name || u.businessName || u.restaurant_name || "",
          billingCycle: u.billing_cycle || u.billingCycle || "monthly",
          activePlan: u.active_plan || u.plan || u.subscription_plan || "basic",
        }));
      })
      .catch(() => setForm(initialForm))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        businessName: form.businessName,
        billingCycle: form.billingCycle,
        activePlan: form.activePlan,
        phone: form.phone,
      };
      await secureFetch("/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      Alert.alert(t("Profile updated successfully"));
    } catch (err) {
      Alert.alert(t("Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text>{t("Loading subscription info")}…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("Settings")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("Manage your subscription and business info")}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>💳 {t("Subscription & Account")}</Text>
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(v) => handleChange("fullName", v)}
          placeholder={t("Full Name")}
        />
        <TextInput
          style={styles.input}
          value={form.email}
          placeholder={t("Email")}
          editable={false}
        />
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(v) => handleChange("phone", v)}
          placeholder={t("Phone Number")}
        />
        <TextInput
          style={styles.input}
          value={form.businessName}
          onChangeText={(v) => handleChange("businessName", v)}
          placeholder={t("Business Name")}
        />
        {/* Plan selection */}
        <Text style={styles.sectionTitle}>{t("Select Plan")}</Text>
        <View style={styles.planRow}>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.key}
              style={[
                styles.planCard,
                form.activePlan === plan.key && styles.planCardActive,
              ]}
              onPress={() => handleChange("activePlan", plan.key)}
            >
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>
                {plan.price[form.billingCycle]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Billing cycle toggle */}
        <View style={styles.billingRow}>
          <TouchableOpacity
            style={[
              styles.billingBtn,
              form.billingCycle === "monthly" && styles.billingBtnActive,
            ]}
            onPress={() => handleChange("billingCycle", "monthly")}
          >
            <Text style={styles.billingBtnText}>{t("Monthly")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingBtn,
              form.billingCycle === "yearly" && styles.billingBtnActive,
            ]}
            onPress={() => handleChange("billingCycle", "yearly")}
          >
            <Text style={styles.billingBtnText}>{t("Yearly")}</Text>
          </TouchableOpacity>
        </View>
        {/* Save button */}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 8,
    color: "#4F46E5",
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: "#f9fafb",
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  planCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  planCardActive: { borderColor: "#4F46E5", backgroundColor: "#e0e7ff" },
  planName: { fontWeight: "bold", fontSize: 16, color: "#4F46E5" },
  planPrice: { fontSize: 15, color: "#111827", marginTop: 4 },
  billingRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
    gap: 8,
  },
  billingBtn: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    backgroundColor: "#f3f4f6",
  },
  billingBtnActive: { borderColor: "#4F46E5", backgroundColor: "#e0e7ff" },
  billingBtnText: { fontWeight: "bold", color: "#4F46E5" },
  saveBtn: {
    marginTop: 30,
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
