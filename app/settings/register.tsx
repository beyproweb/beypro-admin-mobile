import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import secureFetch from "../../src/utils/secureFetch";

const DEFAULT_REGISTER = {
  openingCash: "500.00",
  requirePin: true,
  autoClose: false,
  sendSummaryEmail: true,
  cashDrawerPrinter: {
    interface: "network",
    host: "",
    port: 9100,
    vendorId: "",
    productId: "",
    path: "",
    baudRate: 9600,
    pin: 2,
    address: "",
  },
};

export default function RegisterSettingsMobile() {
  const { t } = useTranslation();
  const [register, setRegister] = useState({ ...DEFAULT_REGISTER });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    secureFetch("/settings/register")
      .then((data) => {
        if (mounted && data) setRegister({ ...DEFAULT_REGISTER, ...data });
      })
      .catch(() => setRegister(DEFAULT_REGISTER))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handlePrinterChange = (field, value) => {
    setRegister((prev) => ({
      ...prev,
      cashDrawerPrinter: {
        ...prev.cashDrawerPrinter,
        [field]: value,
      },
    }));
  };

  const handleToggle = (key) => {
    setRegister((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await secureFetch("/settings/register", {
        method: "POST",
        body: JSON.stringify(register),
      });
      Alert.alert(t("Register settings saved!"));
    } catch (err) {
      Alert.alert(t("Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const printer = register.cashDrawerPrinter || {};

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>{t("Loading register settings")}…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("Settings")}</Text>
        <Text style={styles.headerSubtitle}>{t("Cash Register Settings")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🧾 {t("Cash Register Settings")}</Text>

        {/* Opening Cash */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("Suggested Opening Cash (₺)")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={register.openingCash}
            onChangeText={(v) =>
              setRegister((prev) => ({ ...prev, openingCash: v }))
            }
            placeholder="500.00"
          />
        </View>

        {/* Cash Drawer Printer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🖨️ {t("Cash Drawer Printer")}</Text>
          <Text style={styles.subLabel}>
            {t(
              "Define how the drawer pulse will be sent when cash payments are confirmed."
            )}
          </Text>
          {/* Interface Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("Interface")}</Text>
            <View style={styles.pickerRow}>
              {["network", "usb", "serial", "bluetooth"].map((iface) => (
                <TouchableOpacity
                  key={iface}
                  style={[
                    styles.pickerBtn,
                    printer.interface === iface && styles.pickerBtnActive,
                  ]}
                  onPress={() => handlePrinterChange("interface", iface)}
                >
                  <Text
                    style={{
                      color: printer.interface === iface ? "#fff" : "#4F46E5",
                      fontWeight:
                        printer.interface === iface ? "bold" : "normal",
                    }}
                  >
                    {t(iface.charAt(0).toUpperCase() + iface.slice(1))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Interface-specific fields */}
          {printer.interface === "network" && (
            <View style={styles.row2}>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>{t("Printer IP")}</Text>
                <TextInput
                  style={styles.input}
                  value={printer.host}
                  onChangeText={(v) => handlePrinterChange("host", v)}
                  placeholder="192.168.1.50"
                />
              </View>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>{t("Port")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(printer.port)}
                  onChangeText={(v) => handlePrinterChange("port", Number(v))}
                  placeholder="9100"
                />
              </View>
            </View>
          )}
          {printer.interface === "usb" && (
            <View style={styles.row2}>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>{t("Vendor ID")}</Text>
                <TextInput
                  style={styles.input}
                  value={printer.vendorId}
                  onChangeText={(v) => handlePrinterChange("vendorId", v)}
                  placeholder="0x04b8"
                />
              </View>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>{t("Product ID")}</Text>
                <TextInput
                  style={styles.input}
                  value={printer.productId}
                  onChangeText={(v) => handlePrinterChange("productId", v)}
                  placeholder="0x0e15"
                />
              </View>
            </View>
          )}
          {printer.interface === "serial" && (
            <View style={styles.row2}>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>{t("Port Path")}</Text>
                <TextInput
                  style={styles.input}
                  value={printer.path}
                  onChangeText={(v) => handlePrinterChange("path", v)}
                  placeholder="/dev/ttyUSB0"
                />
              </View>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>{t("Baud Rate")}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(printer.baudRate)}
                  onChangeText={(v) =>
                    handlePrinterChange("baudRate", Number(v))
                  }
                  placeholder="9600"
                />
              </View>
            </View>
          )}
          {printer.interface === "bluetooth" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("Bluetooth Address")}</Text>
              <TextInput
                style={styles.input}
                value={printer.address}
                onChangeText={(v) => handlePrinterChange("address", v)}
                placeholder="01:23:45:67:89:ab"
              />
            </View>
          )}
          {/* Drawer Pin */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("Drawer Pin")}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(printer.pin)}
              onChangeText={(v) => handlePrinterChange("pin", Number(v))}
              placeholder="2"
            />
            <Text style={styles.subLabel}>
              {t(
                "Most ESC/POS drawers use pin 2. Change only if your printer requires otherwise."
              )}
            </Text>
          </View>
        </View>

        {/* Toggles */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <Text style={styles.label}>{t("Require PIN to open/close")}</Text>
            <Switch
              value={!!register.requirePin}
              onValueChange={() => handleToggle("requirePin")}
              trackColor={{ false: "#d1d5db", true: "#6366F1" }}
              thumbColor={register.requirePin ? "#4F46E5" : "#f4f3f4"}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.label}>{t("Auto-close at midnight")}</Text>
            <Switch
              value={!!register.autoClose}
              onValueChange={() => handleToggle("autoClose")}
              trackColor={{ false: "#d1d5db", true: "#6366F1" }}
              thumbColor={register.autoClose ? "#4F46E5" : "#f4f3f4"}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.label}>{t("Send daily summary email")}</Text>
            <Switch
              value={!!register.sendSummaryEmail}
              onValueChange={() => handleToggle("sendSummaryEmail")}
              trackColor={{ false: "#d1d5db", true: "#6366F1" }}
              thumbColor={register.sendSummaryEmail ? "#4F46E5" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* Save Button */}
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
  section: { marginTop: 28, marginBottom: 10 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4F46E5",
    marginBottom: 8,
  },
  inputGroup: { marginBottom: 18 },
  inputGroupHalf: { flex: 1, marginRight: 8 },
  row2: { flexDirection: "row", gap: 8, marginBottom: 8 },
  label: { fontSize: 16, color: "#1F2937", flex: 1, marginRight: 10 },
  subLabel: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
    color: "#111827",
    marginTop: 4,
  },
  pickerRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  pickerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4F46E5",
    backgroundColor: "#fff",
    marginRight: 8,
  },
  pickerBtnActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  saveBtn: {
    marginTop: 30,
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
