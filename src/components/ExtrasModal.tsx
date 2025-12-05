import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

type Extra = {
  id?: number | string;
  name: string;
  price: number;
  quantity?: number;
  amount?: number;
  unit?: string;
  ingredient_name?: string;
  extraPrice?: number;
};

type ExtrasGroup = {
  id: number | string;
  groupName?: string;
  group_name?: string;
  items: Extra[];
};

type SelectedProduct = {
  id: number;
  name: string;
  price: number;
  quantity?: number;
  description?: string;
  selectedExtrasGroup?: (number | string)[];
  extrasGroupRefs?: { ids?: (number | string)[]; names?: string[] };
  selectedExtrasGroupNames?: string[];
  modalExtrasGroups?: ExtrasGroup[];
  extras?: Extra[];
};

type ExtrasModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedProduct: SelectedProduct | null;
  extrasGroups: ExtrasGroup[];
  isDark: boolean;
  onConfirm: (params: {
    product: SelectedProduct;
    quantity: number;
    extras: Extra[];
    note: string;
  }) => void;
};

export default function ExtrasModal({
  visible,
  onClose,
  selectedProduct,
  extrasGroups,
  isDark,
  onConfirm,
}: ExtrasModalProps) {
  const { t } = useTranslation();
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([]);
  const [note, setNote] = useState("");
  const [productQty, setProductQty] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && selectedProduct) {
      setActiveGroupIdx(0);
      setSelectedExtras([]); // ✅ Always start with empty selection, don't pre-fill
      setNote("");
      setProductQty(selectedProduct.quantity || 1);
    }
  }, [visible, selectedProduct?.id]);

  if (!visible || !selectedProduct) return null;

  // Normalize group key for comparison
  const normalizeGroupKey = (value: any): string => {
    if (value === null || value === undefined) return "";
    return String(value).trim().toLowerCase().replace(/\s+/g, " ");
  };

  // Determine which extras groups are assigned to this product
  const selectedGroupIds = new Set(
    [
      ...(selectedProduct?.selectedExtrasGroup || []),
      ...(selectedProduct?.extrasGroupRefs?.ids || []),
    ]
      .map((id) => Number(id))
      .filter(Number.isFinite)
  );

  const selectedGroupNames = new Set(
    (
      selectedProduct?.selectedExtrasGroupNames ||
      selectedProduct?.extrasGroupRefs?.names ||
      []
    )
      .map(normalizeGroupKey)
      .filter(Boolean)
  );

  const hasGroupRefs = selectedGroupIds.size > 0 || selectedGroupNames.size > 0;

  const hasModalGroups =
    Array.isArray(selectedProduct?.modalExtrasGroups) &&
    selectedProduct.modalExtrasGroups.length > 0;

  const sourceGroups =
    Array.isArray(selectedProduct?.modalExtrasGroups) &&
    selectedProduct.modalExtrasGroups.length > 0
      ? selectedProduct.modalExtrasGroups
      : hasGroupRefs
        ? extrasGroups
        : [];

  const groups: ExtrasGroup[] = Array.isArray(sourceGroups)
    ? sourceGroups.map((g) => ({
        id: g.id,
        groupName: g.group_name ?? g.groupName ?? "",
        items: Array.isArray(g.items)
          ? g.items.map((it) => ({
              id: it.id,
              name: it.name ?? it.ingredient_name ?? "",
              price: Number(it.extraPrice ?? it.price ?? 0),
              amount:
                it.amount !== undefined && it.amount !== null
                  ? Number(it.amount)
                  : 1,
              unit: it.unit || "",
            }))
          : [],
      }))
    : [];

  let allowedGroups = groups.filter((g) => {
    const groupId = Number(g.id);
    const groupNameKey = normalizeGroupKey(g.groupName);
    return (
      selectedGroupIds.has(groupId) ||
      (groupNameKey && selectedGroupNames.has(groupNameKey))
    );
  });

  if (hasModalGroups) {
    allowedGroups = groups;
  }

  if (hasGroupRefs && allowedGroups.length === 0 && groups.length > 0) {
    allowedGroups = groups;
  }

  // Fallback to manual extras if available
  if (
    allowedGroups.length === 0 &&
    Array.isArray(selectedProduct?.extras) &&
    selectedProduct.extras.length > 0
  ) {
    allowedGroups = [
      {
        id: "manual",
        groupName: "Extras",
        items: selectedProduct.extras.map((ex, idx) => ({
          id: idx,
          name: ex.name,
          price: Number(ex.extraPrice || ex.price || 0),
          unit: ex.unit || "",
          amount:
            ex.amount !== undefined && ex.amount !== null
              ? Number(ex.amount)
              : 1,
        })),
      },
    ];
  }

  const safeIdx =
    allowedGroups.length === 0
      ? 0
      : Math.min(activeGroupIdx, allowedGroups.length - 1);
  const activeGroup = allowedGroups[safeIdx];

  const handleToggleExtra = (item: Extra) => {
    setSelectedExtras((prev) => {
      const found = prev.find((e) => e.name === item.name);
      if (!found) {
        return [...prev, { ...item, quantity: 1 }];
      }
      if (found.quantity === 1) {
        return prev.filter((e) => e.name !== item.name);
      }
      return prev.map((e) =>
        e.name === item.name ? { ...e, quantity: (e.quantity || 1) - 1 } : e
      );
    });
  };

  const handleIncrement = (item: Extra) => {
    setSelectedExtras((prev) => {
      const found = prev.find((e) => e.name === item.name);
      if (!found) {
        return [...prev, { ...item, quantity: 1 }];
      }
      return prev.map((e) =>
        e.name === item.name ? { ...e, quantity: (e.quantity || 1) + 1 } : e
      );
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      onConfirm({
        product: selectedProduct,
        quantity: productQty,
        extras: selectedExtras,
        note: note.trim(),
      });
      setNote("");
      setSelectedExtras([]);
      onClose();
    } catch (err) {
      console.error("❌ Error confirming extras:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTotalPrice = (): number => {
    const productPrice = (selectedProduct.price || 0) * productQty;
    const extrasPrice =
      selectedExtras.reduce(
        (sum, e) => sum + (e.price || 0) * (e.quantity || 1),
        0
      ) * productQty; // multiply extras total by product quantity
    return productPrice + extrasPrice;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        {/* Header */}
        <View style={[styles.header, isDark && styles.headerDark]}>
          <View style={styles.headerContent}>
            <Text
              style={[styles.headerTitle, isDark && styles.headerTitleDark]}
            >
              {t("✨ Select Extras")}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                isDark && styles.headerSubtitleDark,
              ]}
            >
              {t("Add-ons for")}{" "}
              <Text style={styles.productName}>{selectedProduct.name}</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons
              name="close"
              size={28}
              color={isDark ? "#E5E7EB" : "#111827"}
            />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        {allowedGroups.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.tabsContainer, isDark && styles.tabsContainerDark]}
            contentContainerStyle={styles.tabsContent}
          >
            {allowedGroups.map((group, idx) => (
              <TouchableOpacity
                key={`${group.id}-${idx}`}
                style={[
                  styles.tab,
                  safeIdx === idx ? styles.tabActive : styles.tabInactive,
                  isDark && safeIdx === idx
                    ? styles.tabActiveDark
                    : isDark
                      ? styles.tabInactiveDark
                      : null,
                  safeIdx === idx ? styles.tabShadow : null,
                ]}
                onPress={() => setActiveGroupIdx(idx)}
              >
                <Text
                  style={[
                    styles.tabText,
                    safeIdx === idx && styles.tabTextActive,
                    isDark &&
                      (safeIdx === idx
                        ? styles.tabTextActiveDark
                        : styles.tabTextInactiveDark),
                  ]}
                >
                  {group.groupName || `Group ${idx + 1}`}
                </Text>
                {/* small badge with item count */}
                <View style={styles.tabBadge}>
                  <Text
                    style={[
                      styles.tabBadgeText,
                      isDark && styles.tabBadgeTextDark,
                    ]}
                  >
                    {group.items.length}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Items Grid */}
        <ScrollView
          contentContainerStyle={styles.itemsContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Product Description Frame */}
          {selectedProduct.description && (
            <View
              style={[
                styles.descriptionFrame,
                isDark && styles.descriptionFrameDark,
              ]}
            >
              <Text
                style={[
                  styles.descriptionFrameText,
                  isDark && styles.descriptionFrameTextDark,
                ]}
              >
                {selectedProduct.description}
              </Text>
            </View>
          )}

          {allowedGroups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                {t("No extras available for this product")}
              </Text>
            </View>
          ) : (
            <View style={styles.itemsGrid}>
              {activeGroup?.items.map((item) => {
                const found = selectedExtras.find(
                  (e) => e.name === item.name
                ) || { quantity: 0 };
                const isSelected = (found.quantity ?? 0) > 0;

                return (
                  <TouchableOpacity
                    key={item.id ?? item.name}
                    style={[
                      styles.itemCard,
                      isSelected ? styles.itemCardSelected : styles.itemCard,
                      isDark && styles.itemCardDark,
                      isSelected && isDark && styles.itemCardSelectedDark,
                    ]}
                    onPress={() => handleIncrement(item)}
                  >
                    <View style={styles.itemHeader}>
                      <Text
                        style={[styles.itemName, isDark && styles.itemNameDark]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.itemPrice,
                          isDark && styles.itemPriceDark,
                        ]}
                      >
                        ₺{item.price.toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.itemControls}>
                      <TouchableOpacity
                        style={[
                          styles.qtyButton,
                          isDark && styles.qtyButtonDark,
                        ]}
                        onPress={() => {
                          if ((found?.quantity ?? 0) > 0) {
                            setSelectedExtras((prev) =>
                              prev
                                .map((e) =>
                                  e.name === item.name
                                    ? { ...e, quantity: (e.quantity || 1) - 1 }
                                    : e
                                )
                                .filter((e) => (e.quantity || 0) > 0)
                            );
                          }
                        }}
                      >
                        <Text style={styles.qtyButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text
                        style={[styles.qtyValue, isDark && styles.qtyValueDark]}
                      >
                        {found?.quantity ?? 0}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.qtyButton,
                          styles.qtyButtonPlus,
                          isDark && styles.qtyButtonPlusDark,
                        ]}
                        onPress={() => handleIncrement(item)}
                      >
                        <Text style={styles.qtyButtonPlusText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <Text style={[styles.notesTitle, isDark && styles.notesTitleDark]}>
              {t("📝 Notes")}
            </Text>
            <TextInput
              style={[styles.notesInput, isDark && styles.notesInputDark]}
              placeholder={t("Add special instructions...")}
              placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        {/* Footer with Total and Actions */}
        <View style={[styles.footer, isDark && styles.footerDark]}>
          {/* Quantity Control */}
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={[
                styles.qtyButtonLarge,
                isDark && styles.qtyButtonLargeDark,
              ]}
              onPress={() => setProductQty(Math.max(productQty - 1, 1))}
            >
              <Ionicons name="remove" size={20} color="#111827" />
            </TouchableOpacity>
            <Text
              style={[styles.quantityText, isDark && styles.quantityTextDark]}
            >
              {productQty}
            </Text>
            <TouchableOpacity
              style={[
                styles.qtyButtonLarge,
                styles.qtyButtonLargePlus,
                isDark && styles.qtyButtonLargePlusDark,
              ]}
              onPress={() => setProductQty(productQty + 1)}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Total Price */}
          <View style={styles.totalContainer}>
            <Text style={[styles.totalLabel, isDark && styles.totalLabelDark]}>
              {t("Total:")}
            </Text>
            <Text style={[styles.totalPrice, isDark && styles.totalPriceDark]}>
              ₺{getTotalPrice().toFixed(2)}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, isDark && styles.cancelButtonDark]}
              onPress={onClose}
              disabled={loading}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  isDark && styles.cancelButtonTextDark,
                ]}
              >
                {t("Cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                loading && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>{t("Add to Cart")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  containerDark: {
    backgroundColor: "#020617",
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 2,
    borderBottomColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderBottomColor: "#1F2937",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },
  productName: {
    fontWeight: "700",
    color: "#4F46E5",
  },
  closeButton: {
    padding: 8,
    marginLeft: 12,
  },

  productDescription: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
    maxWidth: "92%",
  },
  productDescriptionDark: {
    color: "#9CA3AF",
  },

  descriptionFrame: {
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F0F4FF",
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
  },
  descriptionFrameDark: {
    backgroundColor: "#1E3A8A",
    borderColor: "#3730A3",
  },
  descriptionFrameText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#1E293B",
    fontWeight: "500",
  },
  descriptionFrameTextDark: {
    color: "#E0E7FF",
  },

  /* TABS */
  tabsContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabsContainerDark: {
    backgroundColor: "#020617",
    borderBottomColor: "#1F2937",
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  tabInactive: {
    backgroundColor: "#FFFFFF",
  },
  tabActiveDark: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  tabInactiveDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  tabTextActiveDark: {
    color: "#FFFFFF",
  },
  tabTextInactiveDark: {
    color: "#9CA3AF",
  },

  tabShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  tabBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "700",
  },
  tabBadgeTextDark: {
    color: "#F9FAFB",
  },

  /* ITEMS GRID */
  itemsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 280,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  itemCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    justifyContent: "space-between",
  },
  itemCardSelected: {
    borderColor: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  itemCardDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  itemCardSelectedDark: {
    backgroundColor: "#1E40AF",
    borderColor: "#4F46E5",
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  itemNameDark: {
    color: "#E5E7EB",
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4F46E5",
  },
  itemPriceDark: {
    color: "#60A5FA",
  },
  itemControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  qtyButtonDark: {
    backgroundColor: "#374151",
    borderColor: "#4B5563",
  },
  qtyButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4B5563",
  },
  qtyButtonPlus: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  qtyButtonPlusDark: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  qtyButtonPlusText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  qtyValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  qtyValueDark: {
    color: "#E5E7EB",
  },

  /* NOTES SECTION */
  notesSection: {
    marginTop: 16,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  notesTitleDark: {
    color: "#E5E7EB",
  },
  notesInput: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
  },
  notesInputDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    color: "#E5E7EB",
  },

  /* FOOTER */
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: "#E5E7EB",
    gap: 12,
  },
  footerDark: {
    backgroundColor: "#020617",
    borderTopColor: "#1F2937",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  qtyButtonLarge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  qtyButtonLargeDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  qtyButtonLargePlus: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  qtyButtonLargePlusDark: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  quantityText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    minWidth: 40,
    textAlign: "center",
  },
  quantityTextDark: {
    color: "#E5E7EB",
  },
  totalContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "transparent",
    borderRadius: 10,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  totalLabelDark: {
    color: "#9CA3AF",
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: -0.5,
  },
  totalPriceDark: {
    color: "#60A5FA",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  cancelButtonDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  cancelButtonTextDark: {
    color: "#E5E7EB",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
