import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import secureFetch from "../../utils/secureFetch";
import DateTimePicker from "@react-native-community/datetimepicker";

interface CartItem {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
  unit?: string;
}

interface PendingOrder {
  id: number;
  scheduled_at: string;
  repeat_type: string;
  repeat_days: number[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  supplierId: number;
  onCartUpdated?: () => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SupplierCartModal({
  visible,
  onClose,
  supplierId,
  onCartUpdated,
}: Props) {
  const { t } = useTranslation();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [loading, setLoading] = useState(false);

  // Scheduling state
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [repeatType, setRepeatType] = useState("none");
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [autoOrder, setAutoOrder] = useState(false);

  // Load cart items and pending orders
  useEffect(() => {
    if (!visible || !supplierId) return;
    loadCartData();
  }, [visible, supplierId]);

  const loadCartData = async () => {
    try {
      setLoading(true);
      // Fetch cart items
      const cartRes = await secureFetch(
        `/supplier-carts/items?supplier_id=${supplierId}`
      );
      setCartItems(cartRes.items || []);

      // Fetch pending orders
      const pendingRes = await secureFetch(
        `/supplier-carts/pending?supplier_id=${supplierId}`
      );
      setPendingOrders(pendingRes.pending || []);

      // Fetch scheduling info
      const scheduledRes = await secureFetch(
        `/supplier-carts/scheduled?supplier_id=${supplierId}`
      );
      if (scheduledRes) {
        if (scheduledRes.scheduled_at) {
          setScheduledAt(new Date(scheduledRes.scheduled_at));
        }
        if (scheduledRes.repeat_type) {
          setRepeatType(scheduledRes.repeat_type);
        }
        if (Array.isArray(scheduledRes.repeat_days)) {
          setRepeatDays(scheduledRes.repeat_days.map((d: number) => DAYS[d]));
        }
        if (typeof scheduledRes.auto_confirm === "boolean") {
          setAutoOrder(scheduledRes.auto_confirm);
        }
      }
    } catch (err) {
      console.error("Failed to load cart data:", err);
      Alert.alert(t("Error"), t("Failed to load cart data"));
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      const newDate = new Date(scheduledAt);
      newDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      setScheduledAt(newDate);
    }
    setShowDatePicker(false);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      const newDate = new Date(scheduledAt);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setScheduledAt(newDate);
    }
    setShowTimePicker(false);
  };

  const handleRepeatToggle = (day: string) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleCancelOrder = async (orderId: number) => {
    Alert.alert(
      t("Cancel Order"),
      t("Are you sure you want to cancel this scheduled order?"),
      [
        { text: t("No"), style: "cancel" },
        {
          text: t("Yes"),
          onPress: async () => {
            try {
              await secureFetch(`/supplier-carts/${orderId}/cancel`, {
                method: "PUT",
              });
              setPendingOrders((prev) => prev.filter((p) => p.id !== orderId));
              Alert.alert(t("Success"), t("Order cancelled"));
            } catch (err) {
              Alert.alert(t("Error"), t("Failed to cancel order"));
            }
          },
        },
      ]
    );
  };

  const handleSendOrder = async () => {
    if (cartItems.length === 0) {
      Alert.alert(t("Error"), t("Cart is empty"));
      return;
    }

    Alert.alert(t("Send Order"), t("Send this order to the supplier?"), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Send"),
        onPress: async () => {
          try {
            setLoading(true);
            await secureFetch(`/supplier-carts`, {
              method: "POST",
              body: JSON.stringify({
                supplier_id: supplierId,
                scheduled_at:
                  repeatType !== "none" ? scheduledAt.toISOString() : null,
                repeat_type: repeatType,
                repeat_days: repeatDays.map((day) => DAYS.indexOf(day)),
                auto_confirm: autoOrder,
              }),
            });
            Alert.alert(t("Success"), t("Order sent successfully"));
            onCartUpdated?.();
            onClose();
            loadCartData();
          } catch (err) {
            Alert.alert(t("Error"), t("Failed to send order"));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const groupedItems = cartItems.reduce(
    (acc, item) => {
      const key = `${item.product_name}_${item.unit || ""}`;
      if (!acc[key]) {
        acc[key] = { ...item, quantity: 0 };
      }
      acc[key].quantity += item.quantity;
      return acc;
    },
    {} as Record<string, CartItem>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🛒 {t("Supplier Cart")}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {/* Schedule Date/Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                🗓️ {t("Schedule Date & Time")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButton}
              >
                <Text style={styles.dateButtonText}>
                  📅 {scheduledAt.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowTimePicker(true)}
                style={styles.dateButton}
              >
                <Text style={styles.dateButtonText}>
                  🕐{" "}
                  {scheduledAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="date"
                  onChange={handleDateChange}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="time"
                  onChange={handleTimeChange}
                />
              )}
            </View>

            {/* Repeat Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔁 {t("Repeat")}</Text>
              <View style={styles.selectContainer}>
                {["none", "weekly", "biweekly", "monthly"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setRepeatType(type)}
                    style={[
                      styles.selectOption,
                      repeatType === type && styles.selectOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        repeatType === type && styles.selectOptionTextActive,
                      ]}
                    >
                      {t(
                        type === "none"
                          ? "Don't repeat"
                          : type === "weekly"
                            ? "Every week"
                            : type === "biweekly"
                              ? "Every 2 weeks"
                              : "Once a month"
                      )}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Auto Order Checkbox */}
              <TouchableOpacity
                onPress={() => setAutoOrder(!autoOrder)}
                style={styles.checkbox}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    autoOrder && styles.checkboxBoxChecked,
                  ]}
                >
                  {autoOrder && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  📅 {t("Auto-send this order by schedule")}
                </Text>
              </TouchableOpacity>

              {/* Day Selector */}
              {(repeatType === "weekly" || repeatType === "biweekly") && (
                <View style={styles.daysContainer}>
                  {DAYS.map((day) => (
                    <TouchableOpacity
                      key={day}
                      onPress={() => handleRepeatToggle(day)}
                      style={[
                        styles.dayButton,
                        repeatDays.includes(day) && styles.dayButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          repeatDays.includes(day) &&
                            styles.dayButtonTextActive,
                        ]}
                      >
                        {t(day)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Cart Items */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                📦 {t("Cart Items")} ({Object.keys(groupedItems).length})
              </Text>
              {Object.values(groupedItems).length > 0 ? (
                Object.values(groupedItems).map((item, idx) => (
                  <View key={idx} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>
                        {item.product_name}
                      </Text>
                      <Text style={styles.cartItemUnit}>({item.unit})</Text>
                    </View>
                    <Text style={styles.cartItemQty}>{item.quantity}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noItems}>{t("No items in cart yet.")}</Text>
              )}
            </View>

            {/* Pending Orders */}
            <View style={styles.section}>
              <TouchableOpacity
                onPress={() => setShowPending(!showPending)}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleButtonText}>
                  {showPending ? "▲" : "▼"} {t("Pending Scheduled Orders")} (
                  {pendingOrders.length})
                </Text>
              </TouchableOpacity>

              {showPending &&
                (pendingOrders.length > 0 ? (
                  pendingOrders.map((order) => (
                    <View key={order.id} style={styles.pendingOrder}>
                      <View style={styles.pendingOrderInfo}>
                        <Text style={styles.pendingOrderTime}>
                          {new Date(order.scheduled_at).toLocaleString()}
                        </Text>
                        <Text style={styles.pendingOrderRepeat}>
                          {t("Repeat")}: {order.repeat_type}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleCancelOrder(order.id)}
                        style={styles.cancelBtn}
                      >
                        <Text style={styles.cancelBtnText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noPending}>
                    {t("No pending scheduled orders.")}
                  </Text>
                ))}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.button, styles.buttonSecondary]}
          >
            <Text style={styles.buttonText}>{t("Close")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSendOrder}
            disabled={loading || cartItems.length === 0}
            style={[styles.button, styles.buttonPrimary]}
          >
            <Text style={styles.buttonPrimaryText}>
              {loading ? "..." : t("Send Order")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  } as any,
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  } as any,
  title: {
    fontSize: 20,
    fontWeight: "700",
  } as any,
  closeBtn: {
    padding: 8,
  } as any,
  closeBtnText: {
    fontSize: 24,
    fontWeight: "600",
  } as any,
  content: {
    flex: 1,
    padding: 16,
  } as any,
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  } as any,
  section: {
    marginBottom: 24,
  } as any,
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  } as any,
  dateButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8,
  } as any,
  dateButtonText: {
    fontSize: 14,
    color: "#000",
  } as any,
  selectContainer: {
    gap: 8,
  } as any,
  selectOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  } as any,
  selectOptionActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  } as any,
  selectOptionText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  } as any,
  selectOptionTextActive: {
    color: "#fff",
  } as any,
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  } as any,
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  } as any,
  checkboxBoxChecked: {
    backgroundColor: "#6366f1",
  } as any,
  checkboxCheck: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  } as any,
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "500",
  } as any,
  daysContainer: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    flexWrap: "wrap",
  } as any,
  dayButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  } as any,
  dayButtonActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  } as any,
  dayButtonText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  } as any,
  dayButtonTextActive: {
    color: "#fff",
  } as any,
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  } as any,
  cartItemInfo: {
    flex: 1,
  } as any,
  cartItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  } as any,
  cartItemUnit: {
    fontSize: 12,
    color: "#999",
  } as any,
  cartItemQty: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  } as any,
  noItems: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    paddingVertical: 12,
  } as any,
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  } as any,
  toggleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  } as any,
  pendingOrder: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginTop: 8,
  } as any,
  pendingOrderInfo: {
    flex: 1,
  } as any,
  pendingOrderTime: {
    fontSize: 13,
    fontWeight: "600",
  } as any,
  pendingOrderRepeat: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  } as any,
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fee2e2",
    borderRadius: 6,
  } as any,
  cancelBtnText: {
    fontSize: 16,
  } as any,
  noPending: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    paddingVertical: 12,
  } as any,
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  } as any,
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  } as any,
  buttonSecondary: {
    backgroundColor: "#f0f0f0",
  } as any,
  buttonPrimary: {
    backgroundColor: "#6366f1",
  } as any,
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  } as any,
  buttonPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  } as any,
};
