// app/orders/kitchen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "react-i18next";
import SwipeRow from "../../src/components/SwipeRow";
import api from "../../src/api/axiosClient";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";

/* ============================================================
   TYPES
============================================================ */

type KitchenOrderType = "table" | "phone" | "packet" | "takeaway";
type KitchenStatus = "new" | "preparing" | "ready" | "delivered";

interface KitchenOrderItem {
  item_id: number;
  order_id: number;
  order_type: KitchenOrderType;
  table_number?: number | null;
  product_name: string;
  quantity: number;
  note?: string | null;
  kitchen_status: KitchenStatus;
  created_at: string;
  kitchen_started_at?: string | null;
}

interface KitchenOrderGroup {
  type: KitchenOrderType;
  header: KitchenOrderItem;
  items: KitchenOrderItem[];
}

type GroupedKitchenOrders = Record<string, KitchenOrderGroup>;

/* ============================================================
   COMPONENT
============================================================ */

export default function KitchenScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppearance();
  const [orders, setOrders] = useState<KitchenOrderItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("kitchenSelectedIds");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [now, setNow] = useState<number>(Date.now());
  const [showCompileModal, setShowCompileModal] = useState(false);
  const [compiled, setCompiled] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [excludedItems, setExcludedItems] = useState<number[]>([]);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);

  const prevIdsRef = useRef<Set<number>>(new Set());

  /* ---------------- PERSIST SELECTION TO LOCALSTORAGE ---------------- */
  useEffect(() => {
    try {
      localStorage.setItem("kitchenSelectedIds", JSON.stringify(selectedIds));
    } catch (err) {
      // Silent fail
    }
  }, [selectedIds]);

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  /* -------- FETCH KITCHEN SETTINGS ON MOUNT --------
   */
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get("/kitchen/compile-settings");
        setExcludedItems(data.data?.excludedItems || []);
        setExcludedCategories(data.data?.excludedCategories || []);
      } catch (err) {
        setExcludedItems([]);
        setExcludedCategories([]);
      }
    })();
  }, []);

  /* ---------------- FETCH ALL PRODUCTS ON MOUNT ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get("/products");
        setProducts(data.data || []);
      } catch (err) {
        setProducts([]);
      }
    })();
  }, []);

  /* ---------------- LOAD ORDERS ---------------- */
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<KitchenOrderItem[]>("/kitchen-orders");

      const incoming = (res.data || []).filter((o) =>
        ["table", "phone", "packet", "takeaway"].includes(
          o.order_type as string
        )
      );

      // Update orders list (sound notifications are handled by socket via NotificationSoundManager)
      prevIdsRef.current = new Set(incoming.map((o) => o.item_id));
      setOrders(incoming);
    } catch (err) {
      // Kitchen fetch failed silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 8000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  /* ---------------- UPDATE STATUS ---------------- */
  const updateStatus = async (status: KitchenStatus) => {
    if (selectedIds.length === 0) return;
    try {
      await api.put("/order-items/kitchen-status", {
        ids: selectedIds,
        status,
      });

      await loadOrders();
    } catch (err) {
      // Status update failed silently
    }
  };

  /* ---------------- COMPILE TOTALS LOGIC ---------------- */
  const compileTotals = (selectedItemIds: number[]) => {
    const selectedItems = orders.filter((o) =>
      selectedItemIds.includes(o.item_id)
    );
    const totalIngredients: Record<string, number> = {};
    const productsByCategory: Record<string, Record<string, number>> = {};
    const extrasSummary: Record<string, number> = {};
    const notesSummary: string[] = [];

    selectedItems.forEach((item) => {
      const category = item.order_type || "Other";
      if (!productsByCategory[category]) productsByCategory[category] = {};

      // Products
      if (item.product_name) {
        productsByCategory[category][item.product_name] =
          (productsByCategory[category][item.product_name] || 0) +
          (item.quantity || 1);
      }

      // Notes
      if (item.note) {
        notesSummary.push(`• ${item.product_name}: ${item.note}`);
      }
    });

    return {
      ingredients: totalIngredients,
      productsByCategory,
      extrasSummary,
      notesSummary,
    };
  };

  const openCompileModal = () => {
    if (selectedIds.length === 0) return;
    setCompiled(compileTotals(selectedIds));
    setShowCompileModal(true);
  };

  const closeCompileModal = () => setShowCompileModal(false);

  /* ---------------- SAVE SETTINGS TO BACKEND ---------------- */
  const saveSettings = useCallback(
    async (updatedExcludedItems: number[]) => {
      try {
        await api.post("/kitchen/compile-settings", {
          excludedItems: updatedExcludedItems,
          excludedCategories,
          excludedIngredients: [],
        });
      } catch (err) {
        // Settings save failed silently
      }
    },
    [excludedCategories]
  );

  /* ---------------- TOGGLE SELECTION ---------------- */
  const toggleSelection = (itemId: number) => {
    setSelectedIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  /* ---------------- TOGGLE GROUP SELECTION ---------------- */
  const toggleGroupSelection = (group: KitchenOrderGroup) => {
    const groupItemIds = group.items.map((item) => item.item_id);
    const allSelected = groupItemIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      // Deselect all items in group
      setSelectedIds((prev) => prev.filter((id) => !groupItemIds.includes(id)));
    } else {
      // Select all items in group
      setSelectedIds((prev) => [...new Set([...prev, ...groupItemIds])]);
    }
  };

  /* ---------------- GROUP ORDERS ---------------- */
  const grouped: GroupedKitchenOrders = orders.reduce<GroupedKitchenOrders>(
    (acc, item) => {
      const type = item.order_type;
      let key = "";

      if (type === "table") {
        key = `table-${item.table_number ?? "?"}`;
      } else {
        key = `${type}-${item.order_id}`;
      }

      if (!acc[key]) {
        acc[key] = { type, header: item, items: [] };
      }

      acc[key].items.push(item);
      return acc;
    },
    {}
  );

  /* ---------------- TIMER FORMAT ---------------- */
  const formatTimer = (start: string | null | undefined) => {
    if (!start) return "--:--";
    const startMs = new Date(start).getTime();
    const diff = Math.max(0, Math.floor((now - startMs) / 1000));
    const m = Math.floor(diff / 60)
      .toString()
      .padStart(2, "0");
    const s = (diff % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /* ---------------- UI ---------------- */
  if (loading && orders.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  const hasSelected = selectedIds.length > 0;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* HEADER */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerContent}>
          <View>
            <Text
              style={[styles.headerTitle, isDark && styles.headerTitleDark]}
            >
              {t("Kitchen")}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                isDark && styles.headerSubtitleDark,
              ]}
            >
              {t("Live kitchen queue")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ACTION BUTTONS */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: hasSelected ? "#4B5563" : "#A0AEC0" },
          ]}
          onPress={() => hasSelected && updateStatus("preparing")}
          disabled={!hasSelected}
        >
          <Text style={styles.actionText}>{t("Preparing")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.compileBtn,
            { backgroundColor: hasSelected ? "#6366F1" : "#D1D5DB" },
          ]}
          onPress={() => hasSelected && openCompileModal()}
          disabled={!hasSelected}
        >
          <Text style={styles.compileBtnText}>🧮</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: hasSelected ? "#111827" : "#A0AEC0" },
          ]}
          onPress={() => hasSelected && updateStatus("delivered")}
          disabled={!hasSelected}
        >
          <Text style={styles.actionText}>{t("Delivered")}</Text>
        </TouchableOpacity>
      </View>

      {/* ORDER LIST */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {Object.keys(grouped).length === 0 && (
          <Text style={[styles.empty, isDark && styles.emptyDark]}>
            {t("No orders in kitchen")}
          </Text>
        )}

        {Object.entries(grouped).map(([groupKey, group]) => (
          <View
            key={groupKey}
            style={[styles.groupCard, isDark && styles.groupCardDark]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => toggleGroupSelection(group)}
              style={styles.groupHeaderTouchable}
            >
              <View
                style={[styles.groupHeader, isDark && styles.groupHeaderDark]}
              >
                {/* GROUP CHECKBOX */}
                <View style={styles.groupCheckboxContainer}>
                  {(() => {
                    const groupItemIds = group.items.map(
                      (item) => item.item_id
                    );
                    const allSelected = groupItemIds.every((id) =>
                      selectedIds.includes(id)
                    );
                    const someSelected = groupItemIds.some((id) =>
                      selectedIds.includes(id)
                    );

                    return (
                      <View
                        style={[
                          styles.groupCheckbox,
                          (allSelected || someSelected) &&
                            styles.groupCheckboxSelected,
                        ]}
                      >
                        {allSelected && (
                          <Text style={styles.groupCheckboxTick}>✓</Text>
                        )}
                        {someSelected && !allSelected && (
                          <Text style={styles.groupCheckboxTick}>−</Text>
                        )}
                      </View>
                    );
                  })()}
                </View>

                <View style={{ flex: 1 }}>
                  {group.type === "table" && (
                    <View style={styles.tableHeaderContainer}>
                      <Text
                        style={[
                          styles.tableLabel,
                          isDark && styles.tableLabelDark,
                        ]}
                      >
                        {t("Table")}{" "}
                      </Text>
                      <Text
                        style={[
                          styles.tableNumber,
                          isDark && styles.tableNumberDark,
                        ]}
                      >
                        {group.header.table_number ?? "-"}
                      </Text>
                      <Text
                        style={[
                          styles.itemCount,
                          isDark && styles.itemCountDark,
                        ]}
                      >
                        {" · "}
                        {group.items.length}{" "}
                        {group.items.length > 1 ? t("items") : t("item")}
                      </Text>
                    </View>
                  )}
                  {group.type !== "table" && (
                    <Text
                      style={[
                        styles.groupTitle,
                        isDark && styles.groupTitleDark,
                      ]}
                    >
                      {group.type === "phone" && t("Phone Delivery")}
                      {group.type === "packet" && t("Packet Order")}
                      {group.type === "takeaway" && t("Takeaway Order")}
                    </Text>
                  )}

                  {group.type !== "table" && (
                    <Text
                      style={[styles.groupSub, isDark && styles.groupSubDark]}
                    >
                      {group.items.length}{" "}
                      {group.items.length > 1 ? t("items") : t("item")}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {group.items.map((item, index) => {
              const isSelected = selectedIds.includes(item.item_id);
              const isPreparing = item.kitchen_status === "preparing";
              const timer = isPreparing
                ? formatTimer(item.kitchen_started_at || item.created_at)
                : null;
              const accentColor =
                item.kitchen_status === "new"
                  ? "#3B82F6" // blue
                  : item.kitchen_status === "preparing"
                    ? "#F59E0B" // amber
                    : item.kitchen_status === "ready"
                      ? "#10B981" // green
                      : "#6B7280"; // delivered -> gray

              return (
                <View key={item.item_id}>
                  {index > 0 && <View style={styles.itemSeparator} />}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleSelection(item.item_id)}
                  >
                    <View
                      style={[
                        styles.itemCard,
                        { borderLeftWidth: 4, borderLeftColor: accentColor },
                        isSelected && styles.itemSelected,
                        isPreparing && styles.itemPreparing,
                        isDark && styles.itemCardDark,
                      ]}
                    >
                      {/* SELECTION CHECKBOX */}
                      <View style={styles.checkboxContainer}>
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && styles.checkboxSelected,
                          ]}
                        >
                          {isSelected && (
                            <Text style={styles.checkboxTick}>✓</Text>
                          )}
                        </View>
                      </View>

                      {/* LEFT SIDE */}
                      <View style={styles.itemLeft}>
                        <Text
                          style={[
                            styles.itemTitle,
                            isDark && styles.itemTitleDark,
                          ]}
                        >
                          {item.product_name}
                        </Text>
                        <Text
                          style={[
                            styles.itemMeta,
                            isDark && styles.itemMetaDark,
                          ]}
                        >
                          {t("Qty:")} {item.quantity}
                        </Text>

                        {item.note && (
                          <Text
                            style={[
                              styles.itemNote,
                              isDark && styles.itemNoteDark,
                            ]}
                          >
                            {t("Note:")}: {item.note}
                          </Text>
                        )}
                      </View>

                      {/* RIGHT SIDE */}
                      <View style={styles.itemRight}>
                        <Text
                          style={[
                            styles.statusBadge,
                            item.kitchen_status === "new" && styles.badgeNew,
                            item.kitchen_status === "preparing" &&
                              styles.badgePreparing,
                            item.kitchen_status === "ready" &&
                              styles.badgeReady,
                            item.kitchen_status === "delivered" &&
                              styles.badgeDelivered,
                          ]}
                        >
                          {t(item.kitchen_status.toUpperCase())}
                        </Text>

                        {timer && (
                          <Text
                            style={[
                              styles.timerText,
                              isDark && styles.timerTextDark,
                            ]}
                          >
                            {timer}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* COMPILE MODAL */}
      {showCompileModal && compiled && (
        <Modal
          visible={showCompileModal}
          transparent
          animationType="fade"
          onRequestClose={closeCompileModal}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, isDark && styles.modalContentDark]}
            >
              {/* Close Button */}
              <TouchableOpacity
                style={[
                  styles.modalCloseBtn,
                  isDark && styles.modalCloseBtnDark,
                ]}
                onPress={closeCompileModal}
              >
                <Text
                  style={[
                    styles.modalCloseText,
                    isDark && styles.modalCloseTextDark,
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>

              {/* Header */}
              <Text
                style={[styles.modalTitle, isDark && styles.modalTitleDark]}
              >
                {t("🧮 Compiled Control Center")}
              </Text>

              <ScrollView style={styles.modalScroll}>
                {/* Products Section */}
                <View style={styles.modalSection}>
                  <Text
                    style={[
                      styles.modalSectionTitle,
                      isDark && styles.modalSectionTitleDark,
                    ]}
                  >
                    {t("📦 Products")}
                  </Text>
                  {Object.keys(compiled.productsByCategory).length === 0 ? (
                    <Text
                      style={[
                        styles.modalSectionEmpty,
                        isDark && styles.modalSectionEmptyDark,
                      ]}
                    >
                      {t("None")}
                    </Text>
                  ) : (
                    Object.entries(compiled.productsByCategory).map(
                      ([category, products]) => {
                        const displayCategory =
                          category === "table" ? "Tables" : category;
                        return (
                          <View key={category} style={styles.categoryBlock}>
                            <Text
                              style={[
                                styles.categoryName,
                                isDark && styles.categoryNameDark,
                              ]}
                            >
                              {displayCategory}
                            </Text>
                            {Object.entries(
                              products as Record<string, number>
                            ).map(([name, qty]) => (
                              <View key={name} style={styles.itemRow}>
                                <Text
                                  style={[
                                    styles.itemName,
                                    isDark && styles.itemNameDark,
                                  ]}
                                >
                                  {name}
                                </Text>
                                <Text
                                  style={[
                                    styles.itemQty,
                                    isDark && styles.itemQtyDark,
                                  ]}
                                >
                                  {qty}
                                </Text>
                              </View>
                            ))}
                          </View>
                        );
                      }
                    )
                  )}
                </View>

                {/* Extras Section */}
                {Object.keys(compiled.extrasSummary).length > 0 && (
                  <View style={styles.modalSection}>
                    <Text
                      style={[
                        styles.modalSectionTitle,
                        isDark && styles.modalSectionTitleDark,
                      ]}
                    >
                      {t("➕ Extras")}
                    </Text>
                    {Object.entries(compiled.extrasSummary).map(
                      ([name, qty]) => (
                        <View key={name} style={styles.itemRow}>
                          <Text
                            style={[
                              styles.itemName,
                              isDark && styles.itemNameDark,
                            ]}
                          >
                            {name}
                          </Text>
                          <Text
                            style={[
                              styles.itemQty,
                              isDark && styles.itemQtyDark,
                            ]}
                          >
                            x{String(qty)}
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                )}

                {/* Notes Section */}
                {compiled.notesSummary.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text
                      style={[
                        styles.modalSectionTitle,
                        isDark && styles.modalSectionTitleDark,
                      ]}
                    >
                      {t("📝 Notes")}
                    </Text>
                    {compiled.notesSummary.map((note: string, idx: number) => (
                      <Text
                        key={idx}
                        style={[styles.noteItem, isDark && styles.noteItemDark]}
                      >
                        {note}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.modalActionBtn,
                    isDark && styles.modalActionBtnDark,
                  ]}
                  onPress={() => {
                    updateStatus("preparing");
                    closeCompileModal();
                  }}
                >
                  <Text
                    style={[
                      styles.modalActionBtnText,
                      isDark && styles.modalActionBtnTextDark,
                    ]}
                  >
                    {t("Preparing")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalActionBtn,
                    styles.modalActionBtnClose,
                    isDark && styles.modalActionBtnCloseDark,
                  ]}
                  onPress={closeCompileModal}
                >
                  <Text
                    style={[
                      styles.modalActionBtnText,
                      isDark && styles.modalActionBtnTextDark,
                    ]}
                  >
                    {t("Close")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <Modal
          visible={showSettings}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSettings(false)}
        >
          <View
            style={[
              styles.settingsModalOverlay,
              isDark && styles.settingsModalOverlayDark,
            ]}
          >
            <View
              style={[
                styles.settingsModalContent,
                isDark && styles.settingsModalContentDark,
              ]}
            >
              {/* Close Button */}
              <TouchableOpacity
                style={[
                  styles.settingsModalCloseBtn,
                  isDark && styles.settingsModalCloseBtnDark,
                ]}
                onPress={() => setShowSettings(false)}
              >
                <Text
                  style={[
                    styles.settingsModalCloseText,
                    isDark && styles.settingsModalCloseTextDark,
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>

              {/* Header */}
              <Text
                style={[
                  styles.settingsModalTitle,
                  isDark && styles.settingsModalTitleDark,
                ]}
              >
                {t("⚙️ Kitchen Settings")}
              </Text>
              <Text
                style={[
                  styles.settingsModalSubtitle,
                  isDark && styles.settingsModalSubtitleDark,
                ]}
              >
                {t("Select products to exclude from kitchen")}
              </Text>

              <ScrollView style={styles.settingsModalScroll}>
                {/* Exclude Items by Category */}
                {products.length > 0 ? (
                  Array.from(new Set(products.map((p: any) => p.category)))
                    .filter(Boolean)
                    .map((category: any) => {
                      const categoryProducts = products.filter(
                        (p: any) => p.category === category
                      );
                      const allChecked = categoryProducts.every((p: any) =>
                        excludedItems.includes(p.id)
                      );
                      const someChecked = categoryProducts.some((p: any) =>
                        excludedItems.includes(p.id)
                      );

                      return (
                        <View
                          key={category}
                          style={[
                            styles.categorySection,
                            isDark && styles.categorySectionDark,
                          ]}
                        >
                          {/* Category Header with Checkbox */}
                          <TouchableOpacity
                            style={styles.categoryCheckboxRow}
                            onPress={() => {
                              const catProductIds = categoryProducts.map(
                                (p: any) => p.id
                              );
                              let updated: number[];
                              if (allChecked) {
                                // Uncheck all
                                updated = excludedItems.filter(
                                  (id) => !catProductIds.includes(id)
                                );
                              } else {
                                // Check all
                                updated = Array.from(
                                  new Set([...excludedItems, ...catProductIds])
                                );
                              }
                              setExcludedItems(updated);
                              saveSettings(updated);
                            }}
                          >
                            <View
                              style={[
                                styles.categoryCheckbox,
                                (allChecked || someChecked) &&
                                  styles.categoryCheckboxSelected,
                              ]}
                            >
                              {allChecked && (
                                <Text style={styles.categoryCheckboxTick}>
                                  ✓
                                </Text>
                              )}
                              {someChecked && !allChecked && (
                                <Text style={styles.categoryCheckboxTick}>
                                  −
                                </Text>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.categoryLabel,
                                isDark && styles.categoryLabelDark,
                              ]}
                            >
                              {category}
                            </Text>
                          </TouchableOpacity>

                          {/* Individual Products */}
                          <View style={styles.productsGrid}>
                            {categoryProducts.map((product: any) => (
                              <TouchableOpacity
                                key={product.id}
                                style={styles.productCheckboxRow}
                                onPress={() => {
                                  let updated: number[];
                                  if (excludedItems.includes(product.id)) {
                                    updated = excludedItems.filter(
                                      (id) => id !== product.id
                                    );
                                  } else {
                                    updated = [...excludedItems, product.id];
                                  }
                                  setExcludedItems(updated);
                                  saveSettings(updated);
                                }}
                              >
                                <View
                                  style={[
                                    styles.productCheckbox,
                                    excludedItems.includes(product.id) &&
                                      styles.productCheckboxSelected,
                                  ]}
                                >
                                  {excludedItems.includes(product.id) && (
                                    <Text style={styles.productCheckboxTick}>
                                      ✓
                                    </Text>
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.productLabel,
                                    isDark && styles.productLabelDark,
                                  ]}
                                >
                                  {product.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      );
                    })
                ) : (
                  <Text
                    style={[
                      styles.noProductsText,
                      isDark && styles.noProductsTextDark,
                    ]}
                  >
                    {t("Loading products...")}
                  </Text>
                )}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.settingsModalActions}>
                <TouchableOpacity
                  style={[
                    styles.settingsModalBtn,
                    styles.settingsModalBtnClose,
                    isDark && styles.settingsModalBtnCloseDark,
                  ]}
                  onPress={() => setShowSettings(false)}
                >
                  <Text
                    style={[
                      styles.settingsModalBtnText,
                      isDark && styles.settingsModalBtnTextDark,
                    ]}
                  >
                    {t("Close")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <BottomNav />
    </View>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F5F7" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  settingsBtnText: {
    fontSize: 18,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  actionBtn: {
    flex: 0.44,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  compileBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  compileBtnText: {
    fontSize: 32,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },

  empty: {
    marginTop: 60,
    textAlign: "center",
    color: "#9CA3AF",
  },

  groupCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: "#1E3A8A",
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  groupHeaderTouchable: {
    padding: 0,
  },
  groupHeader: {
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    paddingBottom: 8,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  groupCheckboxContainer: {
    marginRight: 12,
  },
  groupCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  groupCheckboxSelected: {
    backgroundColor: "#4B5563",
    borderColor: "#4B5563",
  },
  groupCheckboxTick: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  tableHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  tableLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: "#DC2626",
  },
  tableNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#DC2626",
  },
  itemCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
    marginLeft: 8,
  },
  groupSub: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },

  itemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#1E3A8A",
    marginBottom: 0,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  itemSeparator: {
    height: 1.5,
    backgroundColor: "#F3F4F6",
    marginVertical: 8,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxSelected: {
    backgroundColor: "#4B5563",
    borderColor: "#4B5563",
  },
  checkboxTick: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  itemSelected: {
    borderColor: "#4B5563",
    backgroundColor: "#F3F4F6",
  },
  itemPreparing: {
    borderColor: "#F59E0B",
    backgroundColor: "#FFFAEB",
  },

  itemLeft: { flex: 1, paddingRight: 10 },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  itemMeta: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  itemNote: { fontSize: 12, color: "#DC2626", marginTop: 4 },

  itemRight: { alignItems: "flex-end" },

  statusBadge: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    color: "#FFF",
    fontWeight: "700",
  },
  badgeNew: { backgroundColor: "#3B82F6" },
  badgePreparing: { backgroundColor: "#F97316" },
  badgeReady: { backgroundColor: "#10B981" },
  badgeDelivered: { backgroundColor: "#6B7280" },

  timerText: {
    marginTop: 6,
    fontSize: 12,
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalCloseBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  modalCloseText: {
    fontSize: 20,
    color: "#6B7280",
    fontWeight: "700",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
    marginTop: 8,
  },
  modalScroll: {
    maxHeight: 300,
    marginBottom: 16,
  },
  modalSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  modalSectionEmpty: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  categoryBlock: {
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingLeft: 8,
  },
  itemName: {
    fontSize: 14,
    color: "#1E3A8A",
  },
  itemQty: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  noteItem: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#4B5563",
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionBtnClose: {
    backgroundColor: "#E5E7EB",
  },
  modalActionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* SETTINGS MODAL STYLES */
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  settingsModalContent: {
    width: "100%",
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  settingsModalCloseBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  settingsModalCloseText: {
    fontSize: 20,
    color: "#6B7280",
    fontWeight: "700",
  },
  settingsModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    marginTop: 8,
  },
  settingsModalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  settingsModalScroll: {
    maxHeight: 400,
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 10,
  },
  categoryCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginRight: 10,
  },
  categoryCheckboxSelected: {
    backgroundColor: "#4B5563",
    borderColor: "#4B5563",
  },
  categoryCheckboxTick: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  productsGrid: {
    paddingLeft: 34,
  },
  productCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 6,
  },
  productCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginRight: 10,
  },
  productCheckboxSelected: {
    backgroundColor: "#4B5563",
    borderColor: "#4B5563",
  },
  productCheckboxTick: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  productLabel: {
    fontSize: 14,
    color: "#374151",
  },
  noProductsText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginVertical: 20,
  },
  settingsModalActions: {
    flexDirection: "row",
    gap: 8,
  },
  settingsModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#4B5563",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsModalBtnClose: {
    backgroundColor: "#E5E7EB",
  },
  settingsModalBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* ============= DARK MODE STYLES ============= */

  /* Container & Header */
  containerDark: {
    backgroundColor: "#020617",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },

  /* Content */
  emptyDark: {
    color: "#9CA3AF",
  },

  /* Group Card */
  groupCardDark: {
    backgroundColor: "rgba(30, 58, 138, 0.4)",
    borderColor: "#4F46E5",
  },
  groupHeaderDark: {
    borderColor: "#1F2937",
  },
  groupTitleDark: {
    color: "#F3F4F6",
  },
  tableLabelDark: {
    color: "#FCA5A5",
  },
  tableNumberDark: {
    color: "#FCA5A5",
  },
  itemCountDark: {
    color: "#818CF8",
  },
  groupSubDark: {
    color: "#9CA3AF",
  },

  /* Item Card */
  itemCardDark: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderColor: "#4F46E5",
  },
  itemTitleDark: {
    color: "#F3F4F6",
  },
  itemMetaDark: {
    color: "#9CA3AF",
  },
  itemNoteDark: {
    color: "#FCA5A5",
  },
  timerTextDark: {
    color: "#E5E7EB",
  },

  /* Modal Styles */
  modalContentDark: {
    backgroundColor: "rgba(17, 24, 39, 0.95)",
  },
  modalCloseBtnDark: {
    backgroundColor: "#1F2937",
  },
  modalCloseTextDark: {
    color: "#9CA3AF",
  },
  modalTitleDark: {
    color: "#F9FAFB",
  },
  modalSectionTitleDark: {
    color: "#F3F4F6",
  },
  modalSectionEmptyDark: {
    color: "#9CA3AF",
  },
  categoryNameDark: {
    color: "#E5E7EB",
  },
  itemNameDark: {
    color: "#A7F3D0",
  },
  itemQtyDark: {
    color: "#E5E7EB",
  },
  noteItemDark: {
    color: "#9CA3AF",
  },
  modalActionBtnDark: {
    backgroundColor: "#4B5563",
  },
  modalActionBtnTextDark: {
    color: "#FFFFFF",
  },
  modalActionBtnCloseDark: {
    backgroundColor: "#1F2937",
  },

  /* Settings Modal Styles */
  settingsModalOverlayDark: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  settingsModalContentDark: {
    backgroundColor: "rgba(17, 24, 39, 0.98)",
  },
  settingsModalCloseBtnDark: {
    backgroundColor: "#1F2937",
  },
  settingsModalCloseTextDark: {
    color: "#9CA3AF",
  },
  settingsModalTitleDark: {
    color: "#F9FAFB",
  },
  settingsModalSubtitleDark: {
    color: "#9CA3AF",
  },
  categorySectionDark: {
    borderColor: "#1F2937",
  },
  categoryLabelDark: {
    color: "#F3F4F6",
  },
  productLabelDark: {
    color: "#E5E7EB",
  },
  noProductsTextDark: {
    color: "#9CA3AF",
  },
  settingsModalBtnCloseDark: {
    backgroundColor: "#1F2937",
  },
  settingsModalBtnTextDark: {
    color: "#FFFFFF",
  },
});
