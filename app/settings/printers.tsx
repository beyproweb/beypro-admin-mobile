import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
import secureFetch from "../../src/utils/secureFetch";

export default function PrintersSettingsMobile() {
  const { t } = useTranslation();
  const [printers, setPrinters] = useState<any>({
    usb: [],
    serial: [],
    tips: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [testPrinting, setTestPrinting] = useState(false);
  const [lanScanResults, setLanScanResults] = useState<any[]>([]);
  const [lanScanning, setLanScanning] = useState(false);
  const [lanConfig, setLanConfig] = useState({
    base: "192.168.1",
    from: 10,
    to: 40,
    hosts: "",
  });

  useEffect(() => {
    let mounted = true;
    secureFetch("/printer-settings/printers")
      .then((data) => {
        if (mounted && data?.printers) setPrinters(data.printers);
      })
      .catch(() =>
        setPrinters({
          usb: [],
          serial: [],
          tips: [t("Failed to load printers")],
        })
      )
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, [t]);

  const handleTestPrint = async (printer: any) => {
    setTestPrinting(true);
    try {
      await secureFetch("/printer-settings/print", {
        method: "POST",
        body: JSON.stringify({
          ...printer,
          content: t("Test print from Beypro POS!"),
        }),
      });
      Alert.alert(t("Test print sent!"));
    } catch (err) {
      Alert.alert(t("Failed to print"));
    } finally {
      setTestPrinting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await secureFetch("/settings/printer", {
        method: "POST",
        body: JSON.stringify({ defaultPrinter: selected }),
      });
      Alert.alert(t("Printer settings saved!"));
    } catch (err) {
      Alert.alert(t("Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const runLanScan = async () => {
    const payload: any = {};
    const trimmedBase = lanConfig.base?.trim();
    if (trimmedBase) {
      payload.base = trimmedBase;
      payload.from = Number(lanConfig.from) || 1;
      payload.to = Number(lanConfig.to) || payload.from;
    }
    if (lanConfig.hosts?.trim()) {
      payload.hosts = lanConfig.hosts
        .split(/[\,\s]+/)
        .map((ip) => ip.trim())
        .filter(Boolean);
    }
    if (!payload.base && !(payload.hosts && payload.hosts.length)) {
      Alert.alert(t("Enter a base subnet or custom hosts to scan."));
      return;
    }
    setLanScanning(true);
    try {
      const data = await secureFetch("/printer-settings/lan-scan", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setLanScanResults(Array.isArray(data?.printers) ? data.printers : []);
    } catch (err) {
      setLanScanResults([]);
      Alert.alert(t("LAN scan failed"));
    } finally {
      setLanScanning(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 16 }}>{t("Loading printers")}…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("Settings")}</Text>
        <Text style={styles.headerSubtitle}>{t("Printer Settings")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🖨️ {t("Printers")}</Text>
        {printers.tips?.length > 0 && (
          <View style={styles.tipsBox}>
            {printers.tips.map((tip: string, i: number) => (
              <Text key={i} style={styles.tipText}>
                {tip}
              </Text>
            ))}
          </View>
        )}
        {[...(printers.usb || []), ...(printers.serial || [])].length === 0 && (
          <Text style={styles.subLabel}>{t("No printers found.")}</Text>
        )}
        {[...(printers.usb || []), ...(printers.serial || [])].map(
          (printer: any) => (
            <View key={printer.id} style={styles.printerRow}>
              <TouchableOpacity
                style={[
                  styles.printerBtn,
                  selected === printer.id && styles.printerBtnActive,
                ]}
                onPress={() => setSelected(printer.id)}
              >
                <Text style={styles.printerLabel}>
                  {printer.type?.toUpperCase()} {printer.id}
                </Text>
                <Text style={styles.printerSub}>
                  {printer.path || printer.vendorId || printer.host || ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={() => handleTestPrint(printer)}
                disabled={testPrinting}
              >
                <Text style={styles.testBtnText}>
                  {testPrinting ? t("Printing...") : t("Test Print")}
                </Text>
              </TouchableOpacity>
            </View>
          )
        )}
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveBtn}
          disabled={saving || !selected}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t("Saving...") : `💾 ${t("Save Settings")}`}
          </Text>
        </TouchableOpacity>

        {/* LAN Scanner UI */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("LAN Scanner")}</Text>
          <View style={styles.row2}>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>{t("Subnet Base")}</Text>
              <TextInput
                style={styles.input}
                value={lanConfig.base}
                onChangeText={(v) =>
                  setLanConfig((prev) => ({ ...prev, base: v }))
                }
                placeholder="192.168.1"
              />
            </View>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>{t("From")}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(lanConfig.from)}
                onChangeText={(v) =>
                  setLanConfig((prev) => ({ ...prev, from: v }))
                }
                placeholder="10"
              />
            </View>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>{t("To")}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(lanConfig.to)}
                onChangeText={(v) =>
                  setLanConfig((prev) => ({ ...prev, to: v }))
                }
                placeholder="40"
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("Custom IPs (comma separated)")}
            </Text>
            <TextInput
              style={styles.input}
              value={lanConfig.hosts}
              onChangeText={(v) =>
                setLanConfig((prev) => ({ ...prev, hosts: v }))
              }
              placeholder="192.168.1.201, 192.168.1.210"
            />
          </View>
          <TouchableOpacity
            onPress={runLanScan}
            style={styles.testBtn}
            disabled={lanScanning}
          >
            <Text style={styles.testBtnText}>
              {lanScanning ? t("Scanning...") : t("Scan")}
            </Text>
          </TouchableOpacity>
          <View style={styles.lanScanBox}>
            {lanScanResults.length === 0 ? (
              <Text style={styles.subLabel}>
                {t("Scan results will appear here.")}
              </Text>
            ) : (
              lanScanResults.map((result, idx) => (
                <View key={idx} style={styles.lanScanRow}>
                  <View>
                    <Text style={styles.printerLabel}>
                      {result.host}:{result.port}
                    </Text>
                    <Text style={styles.printerSub}>
                      {result.ok
                        ? t(`Responded in ${result.latency}ms`)
                        : result.error || "unreachable"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: result.ok ? "#10B981" : "#F59E42",
                      fontSize: 18,
                    }}
                  >
                    {result.ok ? "🟢" : "⚪️"}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
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
  tipsBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  tipText: { color: "#6B7280", fontSize: 14 },
  printerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  printerBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#4F46E5",
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
  },
  printerBtnActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  printerLabel: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  printerSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  testBtn: {
    backgroundColor: "#6366F1",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  testBtnText: { color: "#fff", fontWeight: "bold" },
  subLabel: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  saveBtn: {
    marginTop: 30,
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
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
  lanScanBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  lanScanRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
});
