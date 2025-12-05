import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCurrency } from "../../context/CurrencyContext";
import { StockItem } from "../../context/StockContext";

interface StockItemCardProps {
  item: StockItem;
  index: number;
  onCriticalChange: (index: number, value: number) => Promise<void>;
  onReorderChange: (index: number, value: number) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function StockItemCard({
  item,
  index,
  onCriticalChange,
  onReorderChange,
  onDelete,
}: StockItemCardProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [criticalValue, setCriticalValue] = useState(String(item.critical_quantity || ""));
  const [reorderValue, setReorderValue] = useState(String(item.reorder_quantity || ""));

  // Calculate expiry status
  const expiryMeta = useMemo(() => {
    if (!item.expiry_date) {
      return { label: t("No expiry"), severity: "info" as const, icon: "calendar" };
    }

    const parsed = new Date(item.expiry_date);
    if (isNaN(parsed.getTime())) {
      return { label: t("No expiry"), severity: "info" as const, icon: "calendar" };
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = parsed.getTime() - Date.now();
    const daysLeft = Math.ceil(diffMs / msPerDay);

    if (daysLeft <= 0) {
      return {
        label: `${t("Expired")}`,
        severity: "danger" as const,
        icon: "alert-circle",
      };
    }

    if (daysLeft <= 3) {
      return {
        label: `${t("Expires in")} ${daysLeft}d`,
        severity: "warning" as const,
        icon: "alert",
      };
    }

    return {
      label: `${t("Fresh")} (${daysLeft}d)`,
      severity: "ok" as const,
      icon: "check-circle",
    };
  }, [item.expiry_date, t]);

  // Check if low stock
  const isLowStock = useMemo(() => {
    if (item.critical_quantity === null || item.critical_quantity === undefined) {
      return false;
    }
    return Number(item.quantity ?? 0) <= Number(item.critical_quantity ?? 0);
  }, [item]);

  const pricePerUnit = Number(item.price_per_unit) || 0;
  const itemValue = (Number(item.quantity) || 0) * pricePerUnit;

  // Color schemes
  const expiryColorMap = {
    danger: "#ef4444",
    warning: "#f59e0b",
    ok: "#10b981",
    info: "#6b7280",
  };

  const expiryBgColorMap = {
    danger: "#fee2e2",
    warning: "#fef3c7",
    ok: "#dbeafe",
    info: "#f3f4f6",
  };

  const handleSaveCritical = async () => {
    const value = parseFloat(criticalValue) || 0;
    await onCriticalChange(index, value);
    setEditing(false);
  };

  const handleSaveReorder = async () => {
    const value = parseFloat(reorderValue) || 0;
    await onReorderChange(index, value);
    setEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      t("Delete Stock Item"),
      `${t("Are you sure you want to delete")} "${item.name}"?`,
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: onDelete,
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.card,
        isLowStock ? styles.cardLowStock : styles.cardNormal,
      ]}
    >
      {/* Collapsible Header - Always Visible */}
      <TouchableOpacity 
        style={styles.cardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        {/* Top Row: Supplier + Low Status */}
        <View style={styles.topBadgesRow}>
          {item.supplier_name && (
            <View style={styles.supplierBadge}>
              <Text style={styles.supplierBadgeText}>
                {item.supplier_name}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {isLowStock && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockBadgeText}>
                {t("Low")}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerRowMain}>
          {/* Left: Item Name */}
          <View style={styles.headerLeftSection}>
            <Text style={styles.itemName}>{item.name}</Text>
          </View>

          {/* Center: Quantity + Unit */}
          <View style={styles.quantitySection}>
            <View style={styles.quantityRow}>
              <Text style={styles.quantityText}>
                {(Number(item.quantity) || 0).toLocaleString()}
              </Text>
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>
                  {item.unit || "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* Right: Expand Toggle */}
          <View style={styles.expandToggle}>
            <MaterialCommunityIcons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={24}
              color="#9ca3af"
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Expandable Content */}
      {expanded && (
        <>
          {/* Body */}
          <View style={styles.cardBody}>
            {/* Pricing Grid */}
            <View style={styles.pricingGrid}>
              <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>{t("Price/Unit")}</Text>
                <Text style={styles.priceValue}>
                  {pricePerUnit ? formatCurrency(pricePerUnit) : "—"}
                </Text>
              </View>
              <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>{t("Total Value")}</Text>
                <Text style={styles.priceValue}>
                  {itemValue ? formatCurrency(itemValue) : "—"}
                </Text>
              </View>
            </View>

            {/* Expiry Status */}
            <View
              style={[
                styles.expiryStatus,
                { backgroundColor: expiryBgColorMap[expiryMeta.severity] },
              ]}
            >
              <MaterialCommunityIcons
                name={expiryMeta.icon as any}
                size={16}
                color={expiryColorMap[expiryMeta.severity]}
              />
              <Text
                style={[
                  styles.expiryText,
                  { color: expiryColorMap[expiryMeta.severity] },
                ]}
              >
                {expiryMeta.label}
              </Text>
            </View>

            {/* Thresholds Edit Mode */}
            {editing ? (
              <View style={styles.editContainer}>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>{t("Critical Threshold")}</Text>
                  <TextInput
                    value={criticalValue}
                    onChangeText={setCriticalValue}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    style={styles.editInput}
                  />
                </View>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>{t("Reorder Quantity")}</Text>
                  <TextInput
                    value={reorderValue}
                    onChangeText={setReorderValue}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    style={styles.editInput}
                  />
                </View>
                <View style={styles.editButtonsRow}>
                  <TouchableOpacity
                    onPress={() => setEditing(false)}
                    style={styles.editCancelButton}
                  >
                    <Text style={styles.editCancelButtonText}>
                      {t("Cancel")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      await handleSaveCritical();
                      await handleSaveReorder();
                    }}
                    style={styles.editSaveButton}
                  >
                    <Text style={styles.editSaveButtonText}>
                      {t("Save")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.thresholdsRow}>
                <View style={styles.thresholdCard}>
                  <Text style={styles.thresholdLabel}>{t("Critical")}</Text>
                  <Text style={styles.thresholdValue}>
                    {item.critical_quantity || "—"}
                  </Text>
                </View>
                <View style={styles.thresholdCard}>
                  <Text style={styles.thresholdLabel}>{t("Reorder")}</Text>
                  <Text style={styles.thresholdValue}>
                    {item.reorder_quantity || "—"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => setEditing(!editing)}
              style={styles.editButton}
            >
              <MaterialCommunityIcons name="pencil" size={16} color="#2563eb" />
              <Text style={styles.editButtonText}>
                {editing ? t("Done") : t("Edit")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.deleteButton}
            >
              <MaterialCommunityIcons name="trash-can" size={16} color="#dc2626" />
              <Text style={styles.deleteButtonText}>{t("Delete")}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Card Container
  card: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardNormal: {
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  cardLowStock: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },

  // Header
  cardHeader: {
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerRowMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeftSection: {
    flex: 1,
  },
  quantitySection: {
    alignItems: "center",
    gap: 4,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expandToggle: {
    padding: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  expandIcon: {
    marginTop: 4,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  topBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  badgesRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  unitBadge: {
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  supplierBadge: {
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  supplierBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0c4a6e",
  },

  // Quantity
  quantityContainer: {
    alignItems: "flex-end",
  },
  quantityText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  lowStockBadge: {
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lowStockBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Body
  cardBody: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Pricing Grid
  pricingGrid: {
    flexDirection: "row",
    gap: 8,
  },
  priceCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#9ca3af",
  },
  priceValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  // Expiry Status
  expiryStatus: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  expiryText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },

  // Edit Container
  editContainer: {
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  editField: {
    gap: 6,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#4b5563",
  },
  editInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: "#111827",
  },
  editButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  editCancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    alignItems: "center",
  },
  editCancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  editSaveButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    paddingVertical: 8,
    alignItems: "center",
  },
  editSaveButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },

  // Thresholds
  thresholdsRow: {
    flexDirection: "row",
    gap: 8,
  },
  thresholdCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  thresholdLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
  thresholdValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  // Actions
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#dbeafe",
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
    paddingVertical: 8,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dc2626",
  },
});

