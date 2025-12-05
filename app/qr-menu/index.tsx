import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  Switch,
  FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import { usePermissions } from "../../src/context/PermissionsContext";
import secureFetch from "../../src/api/secureFetch";
import { PermissionGate } from "../../src/components/PermissionGate";

type Product = {
  id: string | number;
  name: string;
  description?: string;
  price?: number;
  image?: string;
  visible?: boolean;
};

type Table = {
  id: string | number;
  number: number;
  name?: string;
  qr_token?: string;
};

type QRMenuSettings = {
  title?: string;
  subtitle?: string;
  tagline?: string;
  phone?: string;
  primary_color?: string;
  delivery_enabled?: boolean;
  theme?: "auto" | "light" | "dark";
  hero_slides?: Array<{ title: string; image: string }>;
  show_popular?: boolean;
  loyalty_stamps?: number;
  story_title?: string;
  story_text?: string;
  story_image?: string;
  reviews?: Array<{ name: string; rating: number; text: string }>;
  social_links?: {
    instagram?: string;
    tiktok?: string;
    website?: string;
  };
};

export default function QRMenuScreen() {
  const { isDark } = useAppearance();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [qrSettings, setQRSettings] = useState<QRMenuSettings>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "qr" | "products" | "settings" | "tables"
  >("qr");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [tableQRModalOpen, setTableQRModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [mainQRCode, setMainQRCode] = useState("");

  const [settingsForm, setSettingsForm] = useState<QRMenuSettings>({
    title: "",
    subtitle: "",
    tagline: "",
    phone: "",
    primary_color: "#06B6D4",
    delivery_enabled: false,
    theme: "auto",
    show_popular: true,
    loyalty_stamps: 10,
    story_title: "",
    story_text: "",
    social_links: {
      instagram: "",
      tiktok: "",
      website: "",
    },
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsData, tablesData, settingsData] = await Promise.all([
        secureFetch("/products").catch(() => []),
        secureFetch("/tables").catch(() => []),
        secureFetch("/settings/qr-menu-customization").catch(() => ({})),
      ]);

      setProducts(Array.isArray(productsData) ? productsData : []);
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setQRSettings(settingsData || {});
      setSettingsForm(settingsData || settingsForm);

      // Generate main QR code link
      const linkData = await secureFetch("/settings/qr-link").catch(() => ({}));
      setMainQRCode(linkData?.url || "https://beypro.app/menu");
    } catch (err) {
      console.error("❌ Failed to load QR Menu data:", err);
      Alert.alert(t("Error"), t("Failed to load QR Menu data"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save settings
  const handleSaveSettings = async () => {
    try {
      await secureFetch("/settings/qr-menu-customization", {
        method: "PUT",
        body: JSON.stringify(settingsForm),
      });
      setQRSettings(settingsForm);
      setSettingsModalOpen(false);
      Alert.alert(t("Success"), t("Settings saved"));
    } catch (err) {
      console.error("❌ Failed:", err);
      Alert.alert(t("Error"), t("Failed to save settings"));
    }
  };

  // Toggle product visibility
  const handleToggleProduct = async (id: string | number) => {
    try {
      const product = products.find((p) => p.id === id);
      if (!product) return;

      const updated = await secureFetch(`/products/${id}`, {
        method: "PUT",
        body: JSON.stringify({ visible: !product.visible }),
      });

      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      Alert.alert(
        t("Success"),
        product.visible ? t("Product hidden") : t("Product shown")
      );
    } catch (err) {
      console.error("❌ Failed:", err);
      Alert.alert(t("Error"), t("Failed to update product"));
    }
  };

  // Generate table QR code
  const handleGenerateTableQR = async (tableId: string | number) => {
    try {
      const qrData = await secureFetch(`/tables/${tableId}/qr-token`, {
        method: "POST",
      });
      setSelectedTable({ ...selectedTable!, qr_token: qrData.token });
      Alert.alert(t("Success"), t("QR code generated"));
    } catch (err) {
      console.error("❌ Failed:", err);
      Alert.alert(t("Error"), t("Failed to generate QR code"));
    }
  };

  // Copy to clipboard
  const handleCopyToClipboard = (text: string) => {
    // In React Native, use react-native-clipboard or expo-clipboard
    Alert.alert(t("Copied"), t("Link copied to clipboard"));
  };

  // Filter products
  const filteredProducts = products.filter(
    (p) =>
      !searchTerm.trim() ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            {t("Loading QR Menu...")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <PermissionGate permission="orders">
      <View style={[styles.container, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? "light" : "dark"} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[styles.headerTitle, isDark && styles.headerTitleDark]}
            >
              📱 {t("QR Menu")}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                isDark && styles.headerSubtitleDark,
              ]}
            >
              {t("Digital ordering setup")}
            </Text>
          </View>

          {/* Tab Navigation */}
          <View style={[styles.tabNav, isDark && styles.tabNavDark]}>
            {(["qr", "products", "settings", "tables"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && styles.tabActive,
                  activeTab === tab && isDark && styles.tabActiveDark,
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab === "qr" && "🔗"}
                  {tab === "products" && "🛍️"}
                  {tab === "settings" && "⚙️"}
                  {tab === "tables" && "🪑"}
                  {" " + t(tab)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* QR Code Tab */}
          {activeTab === "qr" && (
            <View>
              <View style={[styles.card, isDark && styles.cardDark]}>
                <Text
                  style={[styles.cardTitle, isDark && styles.cardTitleDark]}
                >
                  {t("Main QR Code")}
                </Text>

                {/* QR Code Display */}
                <View style={styles.qrCodeContainer}>
                  <View style={styles.qrCodePlaceholder}>
                    <Ionicons name="qr-code" size={64} color="#EC4899" />
                  </View>
                  <Text
                    style={[styles.qrCodeText, isDark && styles.qrCodeTextDark]}
                    numberOfLines={2}
                  >
                    {mainQRCode || "https://beypro.app/menu"}
                  </Text>
                </View>

                {/* QR Code Actions */}
                <View style={styles.qrActions}>
                  <TouchableOpacity
                    style={styles.qrActionButton}
                    onPress={() => handleCopyToClipboard(mainQRCode)}
                  >
                    <Ionicons name="copy" size={16} color="#FFFFFF" />
                    <Text style={styles.qrActionButtonText}>{t("Copy")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.qrActionButton}>
                    <Ionicons name="download" size={16} color="#FFFFFF" />
                    <Text style={styles.qrActionButtonText}>
                      {t("Download")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.qrActionButton}>
                    <Ionicons name="print" size={16} color="#FFFFFF" />
                    <Text style={styles.qrActionButtonText}>{t("Print")}</Text>
                  </TouchableOpacity>
                </View>

                {/* Statistics */}
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t("Products")}</Text>
                    <Text style={styles.statValue}>{products.length}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t("Tables")}</Text>
                    <Text style={styles.statValue}>{tables.length}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t("Visible")}</Text>
                    <Text style={styles.statValue}>
                      {products.filter((p) => p.visible).length}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
            <View>
              <View style={[styles.card, isDark && styles.cardDark]}>
                <TextInput
                  style={[styles.searchInput, isDark && styles.searchInputDark]}
                  placeholder={t("Search products...")}
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
              </View>

              {filteredProducts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text
                    style={[styles.emptyText, isDark && styles.emptyTextDark]}
                  >
                    {t("No products found")}
                  </Text>
                </View>
              ) : (
                <View style={styles.productList}>
                  {filteredProducts.map((product) => (
                    <View
                      key={product.id}
                      style={[
                        styles.productCard,
                        isDark && styles.productCardDark,
                      ]}
                    >
                      {product.image && (
                        <Image
                          source={{ uri: product.image }}
                          style={styles.productImage}
                        />
                      )}

                      <View style={styles.productInfo}>
                        <Text
                          style={[
                            styles.productName,
                            isDark && styles.productNameDark,
                          ]}
                        >
                          {product.name}
                        </Text>

                        {product.description && (
                          <Text
                            style={[
                              styles.productDescription,
                              isDark && styles.productDescriptionDark,
                            ]}
                            numberOfLines={1}
                          >
                            {product.description}
                          </Text>
                        )}

                        {product.price && (
                          <Text
                            style={[
                              styles.productPrice,
                              isDark && styles.productPriceDark,
                            ]}
                          >
                            💰 ${Number(product.price).toFixed(2)}
                          </Text>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.toggleButton}
                        onPress={() => handleToggleProduct(product.id)}
                      >
                        <View
                          style={[
                            styles.toggleSwitch,
                            product.visible && styles.toggleSwitchActive,
                          ]}
                        >
                          <View
                            style={[
                              styles.toggleIndicator,
                              product.visible && styles.toggleIndicatorActive,
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.toggleText,
                            product.visible && styles.toggleTextActive,
                          ]}
                        >
                          {product.visible ? t("Show") : t("Hide")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <View>
              <TouchableOpacity
                style={[
                  styles.settingsButton,
                  isDark && styles.settingsButtonDark,
                ]}
                onPress={() => setSettingsModalOpen(true)}
              >
                <Ionicons name="settings" size={18} color="#EC4899" />
                <Text
                  style={[
                    styles.settingsButtonText,
                    isDark && styles.settingsButtonTextDark,
                  ]}
                >
                  {t("Customize Menu")}
                </Text>
              </TouchableOpacity>

              {/* Settings Preview */}
              <View style={[styles.card, isDark && styles.cardDark]}>
                <Text
                  style={[styles.cardTitle, isDark && styles.cardTitleDark]}
                >
                  {t("Current Settings")}
                </Text>

                <View style={styles.settingItem}>
                  <Text
                    style={[
                      styles.settingLabel,
                      isDark && styles.settingLabelDark,
                    ]}
                  >
                    {t("Title")}
                  </Text>
                  <Text
                    style={[
                      styles.settingValue,
                      isDark && styles.settingValueDark,
                    ]}
                  >
                    {qrSettings.title || "Menu"}
                  </Text>
                </View>

                <View style={styles.settingItem}>
                  <Text
                    style={[
                      styles.settingLabel,
                      isDark && styles.settingLabelDark,
                    ]}
                  >
                    {t("Phone")}
                  </Text>
                  <Text
                    style={[
                      styles.settingValue,
                      isDark && styles.settingValueDark,
                    ]}
                  >
                    {qrSettings.phone || "Not set"}
                  </Text>
                </View>

                <View style={styles.settingItem}>
                  <Text
                    style={[
                      styles.settingLabel,
                      isDark && styles.settingLabelDark,
                    ]}
                  >
                    {t("Delivery")}
                  </Text>
                  <Text
                    style={[
                      styles.settingValue,
                      isDark && styles.settingValueDark,
                      qrSettings.delivery_enabled && styles.settingValueActive,
                    ]}
                  >
                    {qrSettings.delivery_enabled ? "✅ Enabled" : "❌ Disabled"}
                  </Text>
                </View>

                <View style={styles.settingItem}>
                  <Text
                    style={[
                      styles.settingLabel,
                      isDark && styles.settingLabelDark,
                    ]}
                  >
                    {t("Theme")}
                  </Text>
                  <Text
                    style={[
                      styles.settingValue,
                      isDark && styles.settingValueDark,
                    ]}
                  >
                    {qrSettings.theme || "Auto"}
                  </Text>
                </View>

                <View style={styles.settingItem}>
                  <Text
                    style={[
                      styles.settingLabel,
                      isDark && styles.settingLabelDark,
                    ]}
                  >
                    {t("Loyalty Stamps")}
                  </Text>
                  <Text
                    style={[
                      styles.settingValue,
                      isDark && styles.settingValueDark,
                    ]}
                  >
                    {qrSettings.loyalty_stamps || 10} stamps
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Tables Tab */}
          {activeTab === "tables" && (
            <View>
              {tables.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text
                    style={[styles.emptyText, isDark && styles.emptyTextDark]}
                  >
                    {t("No tables configured")}
                  </Text>
                </View>
              ) : (
                <View style={styles.tableGrid}>
                  {tables.map((table) => (
                    <TouchableOpacity
                      key={table.id}
                      style={[styles.tableCard, isDark && styles.tableCardDark]}
                      onPress={() => {
                        setSelectedTable(table);
                        setTableQRModalOpen(true);
                      }}
                    >
                      <Text style={styles.tableNumber}>{table.number}</Text>
                      <Text
                        style={[
                          styles.tableName,
                          isDark && styles.tableNameDark,
                        ]}
                      >
                        {table.name || `Table ${table.number}`}
                      </Text>
                      <Ionicons name="qr-code" size={24} color="#EC4899" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Settings Modal */}
        <Modal
          visible={settingsModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setSettingsModalOpen(false)}
        >
          <View
            style={[styles.modalContainer, isDark && styles.modalContainerDark]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, isDark && styles.modalTitleDark]}
              >
                {t("Menu Settings")}
              </Text>
              <TouchableOpacity onPress={() => setSettingsModalOpen(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Menu Title")}
                value={settingsForm.title}
                onChangeText={(v) =>
                  setSettingsForm({ ...settingsForm, title: v })
                }
              />

              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Subtitle")}
                value={settingsForm.subtitle}
                onChangeText={(v) =>
                  setSettingsForm({ ...settingsForm, subtitle: v })
                }
              />

              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Tagline")}
                value={settingsForm.tagline}
                onChangeText={(v) =>
                  setSettingsForm({ ...settingsForm, tagline: v })
                }
              />

              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder={t("Phone Number")}
                value={settingsForm.phone}
                onChangeText={(v) =>
                  setSettingsForm({ ...settingsForm, phone: v })
                }
              />

              <View style={styles.toggleItemSetting}>
                <Text
                  style={[styles.toggleLabel, isDark && styles.toggleLabelDark]}
                >
                  {t("Enable Delivery")}
                </Text>
                <Switch
                  value={settingsForm.delivery_enabled || false}
                  onValueChange={(v) =>
                    setSettingsForm({ ...settingsForm, delivery_enabled: v })
                  }
                  trackColor={{ false: "#D1D5DB", true: "#EC4899" }}
                  thumbColor={
                    settingsForm.delivery_enabled ? "#EC4899" : "#9CA3AF"
                  }
                />
              </View>

              <View style={styles.toggleItemSetting}>
                <Text
                  style={[styles.toggleLabel, isDark && styles.toggleLabelDark]}
                >
                  {t("Show Popular Products")}
                </Text>
                <Switch
                  value={settingsForm.show_popular || true}
                  onValueChange={(v) =>
                    setSettingsForm({ ...settingsForm, show_popular: v })
                  }
                  trackColor={{ false: "#D1D5DB", true: "#EC4899" }}
                  thumbColor={settingsForm.show_popular ? "#EC4899" : "#9CA3AF"}
                />
              </View>

              <Text style={[styles.label, isDark && styles.labelDark]}>
                {t("Theme")}
              </Text>
              <View style={styles.themeOptions}>
                {(["auto", "light", "dark"] as const).map((theme) => (
                  <TouchableOpacity
                    key={theme}
                    style={[
                      styles.themeOption,
                      settingsForm.theme === theme &&
                        styles.themeOptionSelected,
                    ]}
                    onPress={() => setSettingsForm({ ...settingsForm, theme })}
                  >
                    <Text
                      style={[
                        styles.themeOptionText,
                        settingsForm.theme === theme &&
                          styles.themeOptionTextSelected,
                      ]}
                    >
                      {t(theme)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveSettings}
              >
                <Ionicons name="save" size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>{t("Save Settings")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Table QR Modal */}
        <Modal
          visible={tableQRModalOpen && selectedTable !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setTableQRModalOpen(false)}
        >
          <View
            style={[styles.modalContainer, isDark && styles.modalContainerDark]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, isDark && styles.modalTitleDark]}
              >
                {t("Table")} {selectedTable?.number}
              </Text>
              <TouchableOpacity onPress={() => setTableQRModalOpen(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.qrCodeContainer}>
                <View style={styles.qrCodePlaceholder}>
                  <Ionicons name="qr-code" size={80} color="#EC4899" />
                </View>
              </View>

              <View style={styles.qrActions}>
                <TouchableOpacity
                  style={styles.qrActionButton}
                  onPress={() =>
                    handleCopyToClipboard(selectedTable?.qr_token || "")
                  }
                >
                  <Ionicons name="copy" size={16} color="#FFFFFF" />
                  <Text style={styles.qrActionButtonText}>{t("Copy")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.qrActionButton}
                  onPress={() => handleGenerateTableQR(selectedTable?.id || "")}
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.qrActionButtonText}>{t("Refresh")}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.qrActionButton}>
                  <Ionicons name="print" size={16} color="#FFFFFF" />
                  <Text style={styles.qrActionButtonText}>{t("Print")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <BottomNav />
      </View>
    </PermissionGate>
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
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  loadingTextDark: {
    color: "#9CA3AF",
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerTitleDark: {
    color: "#F3F4F6",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },
  tabNav: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabNavDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#EC4899",
  },
  tabActiveDark: {
    backgroundColor: "#BE185D",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  cardTitleDark: {
    color: "#F3F4F6",
  },
  qrCodeContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  qrCodePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  qrCodeText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  qrCodeTextDark: {
    color: "#9CA3AF",
  },
  qrActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  qrActionButton: {
    flex: 1,
    backgroundColor: "#EC4899",
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  qrActionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EC4899",
  },
  searchInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#1F2937",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
  },
  searchInputDark: {
    color: "#F3F4F6",
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
  productList: {
    gap: 12,
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  productNameDark: {
    color: "#F3F4F6",
  },
  productDescription: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  productDescriptionDark: {
    color: "#9CA3AF",
  },
  productPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EC4899",
    marginTop: 4,
  },
  productPriceDark: {
    color: "#F472B6",
  },
  toggleButton: {
    alignItems: "center",
  },
  toggleSwitch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  toggleSwitchActive: {
    backgroundColor: "#EC4899",
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
  },
  toggleIndicatorActive: {
    alignSelf: "flex-end",
  },
  toggleText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  toggleTextActive: {
    color: "#EC4899",
  },
  settingsButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  settingsButtonDark: {
    backgroundColor: "#7F1D1D",
  },
  settingsButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
  },
  settingsButtonTextDark: {
    color: "#FECACA",
  },
  settingItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  settingLabelDark: {
    color: "#9CA3AF",
  },
  settingValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 4,
  },
  settingValueDark: {
    color: "#F3F4F6",
  },
  settingValueActive: {
    color: "#10B981",
  },
  tableGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tableCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tableCardDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  tableNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#EC4899",
    marginBottom: 4,
  },
  tableName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  tableNameDark: {
    color: "#9CA3AF",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 20,
  },
  modalContainerDark: {
    backgroundColor: "#1F2937",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalTitleDark: {
    color: "#F3F4F6",
  },
  modalContent: {
    padding: 16,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#1F2937",
    marginBottom: 12,
  },
  inputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#F3F4F6",
  },
  toggleItemSetting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  toggleLabelDark: {
    color: "#D1D5DB",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 8,
  },
  labelDark: {
    color: "#D1D5DB",
  },
  themeOptions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  themeOptionSelected: {
    backgroundColor: "#EC4899",
    borderColor: "#EC4899",
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  themeOptionTextSelected: {
    color: "#FFFFFF",
  },
  saveButton: {
    backgroundColor: "#EC4899",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
