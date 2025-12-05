// app/orders/table/[tableNumber].tsx
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
  ToastAndroid,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import api from "../../../src/api/axiosClient";
import BottomNav from "../../../src/components/navigation/BottomNav";
import ExtrasModal from "../../../src/components/ExtrasModal";
import { useAppearance } from "../../../src/context/AppearanceContext";
import { useAuth } from "../../../src/context/AuthContext";

type Product = {
  id: number;
  name: string;
  price: number;
  category?: string | null;
  description?: string | null;
  image?: string | null;
};

type OrderHeader = {
  id: number;
  status: string;
  total: number;
  is_paid?: boolean;
  table_number?: number | null;
  kitchen_delivered_at?: string | null;
};

type OrderItem = {
  id?: number | null;
  product_id: number | null;
  quantity: number;
  price: number;
  order_item_name?: string | null;
  product_name?: string | null;
  unique_id?: string;
  paid_at?: string | null;
  payment_method?: string | null;
};

type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  extras?: any[];
  note?: string;
  // When this CartItem comes from an existing order, store the order_items.id
  orderItemId?: number | null;
  // Payment method used when this item was paid
  paymentMethod?: string | null;
};

type PaymentMethod = {
  id: string;
  label: string;
  icon?: string;
  enabled?: boolean;
};

export default function TableOrderScreen() {
  const { t } = useTranslation();
  const {
    tableNumber,
    orderContext,
    customerId,
    customerPhone,
    customerName,
    paymentMethod,
    customerAddress,
    openCart,
  } = useLocalSearchParams<{
    tableNumber?: string;
    orderContext?: string;
    customerId?: string;
    customerPhone?: string;
    customerName?: string;
    paymentMethod?: string;
    customerAddress?: string;
    openCart?: string;
  }>();
  const parsedTableNumber = useMemo(
    () => (tableNumber ? parseInt(String(tableNumber), 10) : NaN),
    [tableNumber]
  );
  const isPhoneContext = orderContext === "phone" || tableNumber === "phone";
  const phoneCustomerId = customerId
    ? Number.parseInt(customerId, 10)
    : undefined;
  const hasPhoneCustomerId =
    typeof phoneCustomerId === "number" && Number.isFinite(phoneCustomerId);

  const router = useRouter();
  const { appearance, isDark, fontScale } = useAppearance();
  const { user } = useAuth();
  const highContrast = appearance.highContrast;

  // Get restaurant identifier from user
  const restaurantIdentifier = user?.restaurant_id || user?.id || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);

  const [activeOrder, setActiveOrder] = useState<OrderHeader | null>(null);
  const [existingItems, setExistingItems] = useState<CartItem[]>([]);
  const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
  const [selectedItemsForPayment, setSelectedItemsForPayment] = useState<
    string[]
  >([]);
  const [paidItemKeys, setPaidItemKeys] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    null
  );

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundMethodId, setRefundMethodId] = useState<string | null>(null);

  // Print state
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setSelectedPaymentId("select");
  }, [cartModalVisible]);

  // Set default refund method when payment methods load
  useEffect(() => {
    if (paymentMethods.length > 0 && !refundMethodId) {
      setRefundMethodId(String(paymentMethods[0].id));
    }
  }, [paymentMethods, refundMethodId]);

  // Extras Modal State
  const [extrasModalVisible, setExtrasModalVisible] = useState(false);
  const [selectedProductForExtras, setSelectedProductForExtras] =
    useState<any>(null);
  const [extrasGroups, setExtrasGroups] = useState<any[]>([]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (!categoryFilter) return products;
    return products.filter((p) => p.category === categoryFilter);
  }, [products, categoryFilter]);

  const totalExisting = useMemo(
    () =>
      existingItems.reduce((sum, item) => {
        // Base item price
        const basePrice =
          (Number(item.price) || 0) * (Number(item.quantity) || 1);
        // Extras price per single item - ALWAYS include if extras array exists
        const extrasPricePerUnit = Array.isArray(item.extras)
          ? item.extras.reduce((eSum, e) => {
              const unitPrice = Number(e?.price ?? e?.extraPrice ?? 0) || 0;
              const qty = Number(e?.quantity ?? 1) || 1; // quantity of this extra per product unit
              return eSum + unitPrice * qty;
            }, 0)
          : 0;
        // Multiply extras by the number of product units in the cart item
        const totalExtras = extrasPricePerUnit * (Number(item.quantity) || 1);
        return sum + basePrice + totalExtras;
      }, 0),
    [existingItems]
  );

  const totalPending = useMemo(
    () =>
      pendingItems.reduce((sum, item) => {
        // Base item price
        const basePrice =
          (Number(item.price) || 0) * (Number(item.quantity) || 1);
        // Extras price per single item - ALWAYS include if extras array exists
        const extrasPricePerUnit = Array.isArray(item.extras)
          ? item.extras.reduce((eSum, e) => {
              const unitPrice = Number(e?.price ?? e?.extraPrice ?? 0) || 0;
              const qty = Number(e?.quantity ?? 1) || 1; // quantity of this extra per product unit
              return eSum + unitPrice * qty;
            }, 0)
          : 0;
        // Multiply extras by the number of product units in the cart item
        const totalExtras = extrasPricePerUnit * (Number(item.quantity) || 1);
        return sum + basePrice + totalExtras;
      }, 0),
    [pendingItems]
  );

  const combinedTotal = totalExisting + totalPending;

  const addToCart = async (product: Product) => {
    try {
      setError(null);

      const productRes = await api.get(`/products/${product.id}`);
      const fullProduct = productRes.data;

      // Check if product should open extras modal
      const shouldShowModal = fullProduct?.show_add_to_cart_modal === true;

      if (shouldShowModal) {
        // Fetch extras groups with restaurant identifier
        try {
          // Try with identifier from user's restaurant_id
          let url = "/extras-groups";
          if (restaurantIdentifier) {
            url = `/extras-groups?identifier=${restaurantIdentifier}`;
          }

          console.log("📡 Fetching extras from:", url);
          console.log("🔐 Restaurant ID/Slug:", restaurantIdentifier);
          console.log("👤 User data:", {
            id: user?.id,
            restaurant_id: user?.restaurant_id,
          });

          const groupsRes = await api.get(url);
          console.log("✅ Extras groups fetched successfully:", groupsRes.data);
          setExtrasGroups(groupsRes.data || []);
        } catch (err) {
          console.error("❌ Failed to fetch extras groups:", err);
          console.error("Error details:", {
            message: err instanceof Error ? err.message : String(err),
            status: (err as any).response?.status,
            data: (err as any).response?.data,
          });
          // Still set empty array so modal can open
          setExtrasGroups([]);
        }

        // Parse selected_extras_group from product (could be JSON string or array)
        let selectedExtrasGroup = [];
        if (fullProduct.selected_extras_group) {
          if (typeof fullProduct.selected_extras_group === "string") {
            try {
              selectedExtrasGroup = JSON.parse(
                fullProduct.selected_extras_group
              );
            } catch {
              selectedExtrasGroup = [];
            }
          } else if (Array.isArray(fullProduct.selected_extras_group)) {
            selectedExtrasGroup = fullProduct.selected_extras_group;
          }
        }

        // Parse extras from product (could be JSON string or array)
        let extras = [];
        if (fullProduct.extras) {
          if (typeof fullProduct.extras === "string") {
            try {
              extras = JSON.parse(fullProduct.extras);
            } catch {
              extras = [];
            }
          } else if (Array.isArray(fullProduct.extras)) {
            extras = fullProduct.extras;
          }
        }

        // Set product for modal and open it
        const productData = {
          id: fullProduct.id,
          name: fullProduct.name,
          price: fullProduct.price,
          description:
            fullProduct.description || fullProduct.product_description || "",
          quantity: 1,
          selectedExtrasGroup: selectedExtrasGroup,
          extrasGroupRefs: { ids: selectedExtrasGroup || [] },
          selectedExtrasGroupNames: fullProduct.selectedExtrasGroupNames || [],
          modalExtrasGroups: fullProduct.modalExtrasGroups || [],
          extras: extras,
        };

        console.log("✅ Product data prepared for extras modal:", productData);
        setSelectedProductForExtras(productData);
        setExtrasModalVisible(true);
      } else {
        // No modal needed, add directly to cart
        addDirectToCart(product);
      }
    } catch (err) {
      console.error("❌ Error in addToCart:", err);
      setError("Error loading product. Try again.");
      addDirectToCart(product);
    }
  };

  const addDirectToCart = (
    product: Product,
    extras: any[] = [],
    note: string = ""
  ) => {
    setPendingItems((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          extras: extras.length > 0 ? extras : undefined,
          note: note || undefined,
        } as any,
      ];
    });
    setCartModalVisible(true);
  };

  const incrementItem = (productId: number) => {
    setPendingItems((prev) =>
      prev.map((c) =>
        c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c
      )
    );
  };

  const decrementItem = (productId: number) => {
    setPendingItems((prev) =>
      prev
        .map((c) =>
          c.productId === productId
            ? { ...c, quantity: Math.max(0, c.quantity - 1) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const clearPending = () => {
    // Get pending item keys that are selected
    const selectedPendingKeys = selectedItemsForPayment.filter((key) =>
      key.startsWith("pending-")
    );

    if (selectedPendingKeys.length > 0) {
      // If items are selected, show options
      Alert.alert("Clear Items", "What would you like to clear?", [
        {
          text: "Cancel",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "Clear Selected",
          onPress: () => {
            // Remove only selected pending items
            const selectedProductIds = new Set<number>();
            selectedPendingKeys.forEach((key) => {
              const parts = key.split("-");
              const productId = Number(parts[1]);
              selectedProductIds.add(productId);
            });

            setPendingItems((prev) =>
              prev.filter((item) => !selectedProductIds.has(item.productId))
            );
            setSelectedItemsForPayment([]);
          },
          style: "default",
        },
        {
          text: "Clear All",
          onPress: () => {
            setPendingItems([]);
            setSelectedItemsForPayment([]);
          },
          style: "destructive",
        },
      ]);
    } else {
      // No items selected, just clear all
      setPendingItems([]);
    }
  };

  const loadInitial = async () => {
    if (!isPhoneContext && !Number.isFinite(parsedTableNumber)) {
      setError("Invalid table number");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [productsRes, paymentsRes] = await Promise.all([
        api.get<Product[]>("/products"),
        api.get("/settings/payments"),
      ]);

      setProducts(productsRes.data || []);

      // Normalize payment methods from settings
      const rawPayments: any = paymentsRes.data || {};
      let methods: PaymentMethod[] = [];

      if (Array.isArray(rawPayments.methods)) {
        methods = rawPayments.methods;
      } else if (
        rawPayments &&
        rawPayments.enabledMethods &&
        typeof rawPayments.enabledMethods === "object"
      ) {
        methods = Object.entries(rawPayments.enabledMethods).map(
          ([id, enabled]) => ({
            id,
            label: String(id)
              .replace(/[_-]+/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            enabled: Boolean(enabled),
          })
        );
      }

      if (!methods.length) {
        methods = [
          { id: "cash", label: "Cash", icon: "💵", enabled: true },
          { id: "card", label: "Card", icon: "💳", enabled: true },
        ];
      }

      const enabledMethods = methods.filter((m) => m.enabled !== false);
      setPaymentMethods(enabledMethods);
      const resolvedMethod =
        paymentMethod &&
        enabledMethods.find((method) => method.id === paymentMethod);
      if (!selectedPaymentId && enabledMethods.length) {
        setSelectedPaymentId(
          resolvedMethod ? resolvedMethod.id : enabledMethods[0].id
        );
      }

      if (!isPhoneContext) {
        const ordersRes = await api.get<OrderHeader[]>(
          `/orders?table_number=${parsedTableNumber}&type=table`
        );
        const openOrder =
          (ordersRes.data || []).find(
            (o) =>
              o &&
              o.table_number === parsedTableNumber &&
              o.status !== "closed" &&
              o.status !== "cancelled"
          ) || null;
        setActiveOrder(openOrder);

        if (openOrder) {
          const itemsRes = await api.get<OrderItem[]>(
            `/orders/${openOrder.id}/items`
          );

          // ✅ Create a map of existing items by orderItemId to preserve paymentMethod
          // Only for items that we had paid (have paymentMethod set)
          const existingItemMap = new Map<number | null, CartItem>();
          existingItems.forEach((item) => {
            if (item.orderItemId !== null && item.orderItemId !== undefined) {
              existingItemMap.set(item.orderItemId, item);
            }
          });

          const mapped: CartItem[] = (itemsRes.data || []).map((it) => {
            // ✅ Try to match by orderItemId for items we've seen before
            const existingItem =
              it.id !== null && it.id !== undefined
                ? existingItemMap.get(it.id)
                : undefined;

            return {
              productId: it.product_id ?? 0,
              orderItemId: it.id ?? null,
              // Priority: backend payment_method > existing item's payment_method > null
              paymentMethod:
                it.payment_method || existingItem?.paymentMethod || null,
              name: it.order_item_name || it.product_name || "Item",
              price: it.price,
              quantity: it.quantity,
            };
          });

          setExistingItems(mapped);

          // Sync paid items from backend - use order_items.id so we only mark
          // the exact row(s) that were paid instead of matching by product_id
          const paidKeys = new Set<string>(paidItemKeys); // ✅ Keep existing paid items
          (itemsRes.data || []).forEach((item: any) => {
            if (item.paid_at) {
              if (item.id) paidKeys.add(`existing-${item.id}`);
            }
          });
          setPaidItemKeys(paidKeys);
        } else {
          setExistingItems([]);
        }
      } else {
        setActiveOrder(null);
        setExistingItems([]);
      }
    } catch (e: any) {
      console.log("❌ Table order load failed:", e);
      setError("Failed to load table data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, [parsedTableNumber]);

  // If opened from tables list with ?openCart=1 and an active order exists,
  // open the cart modal once the active order has been loaded.
  useEffect(() => {
    if (!openCart) return;
    // Only open when we have an active order (so cart contents are available)
    if (activeOrder) {
      setCartModalVisible(true);
    }
  }, [openCart, activeOrder]);

  const submitOrder = async () => {
    if (!pendingItems.length) {
      setSuccess(null);
      setError("Add items to cart first");
      return;
    }
    if (!isPhoneContext && !Number.isFinite(parsedTableNumber)) {
      setError("Invalid table number");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const itemsPayload = pendingItems.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
        name: item.name,
        extras: item.extras && item.extras.length > 0 ? item.extras : undefined,
        note: item.note || undefined,
      }));

      if (activeOrder && !isPhoneContext) {
        await api.post("/orders/order-items", {
          order_id: activeOrder.id,
          items: itemsPayload,
        });
      } else {
        const total = itemsPayload.reduce(
          (sum, i) => sum + i.price * i.quantity,
          0
        );
        const payload: any = {
          order_type: isPhoneContext ? "phone" : "table",
          items: itemsPayload,
          total,
        };
        if (!isPhoneContext) {
          payload.table_number = parsedTableNumber;
        } else if (hasPhoneCustomerId) {
          payload.customer_id = phoneCustomerId;
        }
        if (customerPhone) {
          payload.customer_phone = customerPhone;
        }
        if (customerName) {
          payload.customer_name = customerName;
        }
        if (customerAddress) {
          payload.customer_address = customerAddress;
        }
        if (paymentMethod) {
          payload.payment_method = paymentMethod;
        }

        const { data } = await api.post<OrderHeader>("/orders", payload);
        setActiveOrder(data);
      }

      setPendingItems([]);
      setSuccess("Order sent to kitchen");
      await loadInitial();
      if (isPhoneContext) {
        router.push("/orders/packet");
      }
    } catch (e: any) {
      console.log("❌ Submit table order failed:", e);
      setError("Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total for selected payment items
  const calculateSelectedItemsTotal = () => {
    let total = 0;

    // Add selected existing items
    existingItems.forEach((item) => {
      // ✅ Use orderItemId as unique key for existing items
      const itemKey = item.orderItemId ? `existing-${item.orderItemId}` : null;
      if (itemKey && selectedItemsForPayment.includes(itemKey as any)) {
        const extrasPrice = (item.extras || []).reduce((sum, e) => {
          const unit = parseFloat(String(e?.price ?? e?.extraPrice ?? 0)) || 0;
          const qty = Number(e?.quantity ?? 1) || 1;
          return sum + unit * qty;
        }, 0);
        const itemTotal =
          (Number(item.price) || 0) * (Number(item.quantity) || 1) +
          extrasPrice;
        total += itemTotal;
      }
    });

    // Add selected pending items
    pendingItems.forEach((item, idx) => {
      const itemKey = `pending-${item.productId}-${idx}`;
      if (selectedItemsForPayment.includes(itemKey as any)) {
        const extrasPrice = (item.extras || []).reduce((sum, e) => {
          const unit = parseFloat(String(e?.price ?? e?.extraPrice ?? 0)) || 0;
          const qty = Number(e?.quantity ?? 1) || 1;
          return sum + unit * qty;
        }, 0);
        const itemTotal =
          (Number(item.price) || 0) * (Number(item.quantity) || 1) +
          extrasPrice;
        total += itemTotal;
      }
    });

    return total;
  };

  const payOrder = async (methodId: string) => {
    if (!activeOrder) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // If items are selected for payment, use only those; otherwise use full total
      let total = 0;
      let paidItemIds: number[] = [];

      if (selectedItemsForPayment.length > 0) {
        total = calculateSelectedItemsTotal();
        // Collect order_item ids for existing items (backend expects item_ids)
        selectedItemsForPayment.forEach((itemKey) => {
          if (itemKey.startsWith("existing-")) {
            const parts = itemKey.split("-");
            const orderItemId = Number(parts[1]);
            if (
              !paidItemIds.includes(orderItemId) &&
              Number.isFinite(orderItemId)
            ) {
              paidItemIds.push(orderItemId);
            }
          } else if (itemKey.startsWith("pending-")) {
            // Pending items are not yet order_items in backend (no id) - skip adding
            // They should normally be submitted with the order first before paying.
          }
        });
      } else {
        total = combinedTotal > 0 ? combinedTotal : activeOrder.total || 0;
        // When doing full payment, send order_item ids for existing items
        // ✅ Only use orderItemId for unique identification
        existingItems.forEach((item) => {
          if (item.orderItemId && !paidItemIds.includes(item.orderItemId)) {
            paidItemIds.push(item.orderItemId);
          }
        });
        // Pending items can't be referenced by order_item id here; backend's full-payment
        // branch will mark all unpaid items for the order anyway when item_ids is omitted.
      }

      // Build payload: include item_ids when we have specific order_item ids to mark
      const payload: any = {
        payment_method: methodId,
        amount: total,
        total,
      };
      if (paidItemIds.length > 0) payload.item_ids = paidItemIds;

      await api.put(`/orders/${activeOrder.id}/pay`, payload);

      // Get the payment method label for display
      const paymentLabel =
        paymentMethods.find((m) => m.id === methodId)?.label || methodId;

      // Update local paid items state immediately with selected items
      if (selectedItemsForPayment.length > 0) {
        const updatedPaidKeys = new Set([
          ...paidItemKeys,
          ...selectedItemsForPayment,
        ]);
        setPaidItemKeys(updatedPaidKeys);

        // Update payment method for selected items
        // ✅ Use orderItemId to match each specific item, not productId
        const updatedExistingItems = existingItems.map((item) => {
          // Only update if this specific orderItemId was selected
          const itemKey = `existing-${item.orderItemId}`;
          if (item.orderItemId && selectedItemsForPayment.includes(itemKey)) {
            return { ...item, paymentMethod: paymentLabel };
          }
          return item;
        });
        setExistingItems(updatedExistingItems);
        setSelectedItemsForPayment([]);
      } else {
        // Mark all unpaid items as paid
        const allKeys = new Set<string>();
        existingItems.forEach((item) => {
          const itemKey = `existing-${item.orderItemId}`;
          // ✅ Only add unpaid items
          if (item.orderItemId && !paidItemKeys.has(itemKey)) {
            allKeys.add(itemKey);
          }
        });
        pendingItems.forEach((item, idx) =>
          allKeys.add(`pending-${item.productId}-${idx}`)
        );
        setPaidItemKeys((prev) => new Set([...prev, ...allKeys]));

        // Update payment method only for newly paid items (not already paid)
        const updatedExistingItems = existingItems.map((item) => {
          const itemKey = `existing-${item.orderItemId}`;
          // ✅ Only update if this item was NOT already paid
          if (item.orderItemId && !paidItemKeys.has(itemKey)) {
            return { ...item, paymentMethod: paymentLabel };
          }
          return item;
        });
        setExistingItems(updatedExistingItems);
      }

      setSuccess(`Marked as paid (${paymentLabel})`);

      // Reset payment method selector to default for next payment
      setSelectedPaymentId("select");
      setPaymentDropdownOpen(false);
    } catch (e: any) {
      console.log("❌ Pay order failed:", e);
      console.log("Error response:", e.response?.data);
      setError("Failed to mark as paid");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddItemsClick = () => {
    // Close cart modal and go back to products
    setCartModalVisible(false);
  };

  const handlePrintOrder = async () => {
    if (!activeOrder) {
      setError("No active order to print");
      return;
    }

    try {
      setPrinting(true);
      setError(null);

      // Prepare order data for printing
      const orderData = {
        id: activeOrder.id,
        table_number: parsedTableNumber || null,
        total: activeOrder.total,
        items: [...existingItems, ...pendingItems],
      };

      // Send print request to backend
      // Backend will forward to Electron app -> Printer
      await api.post(`/orders/${activeOrder.id}/print`, orderData);

      setSuccess("Print request sent to kitchen printer");
    } catch (e: any) {
      console.error("❌ Print failed:", e);
      setError(
        e?.response?.data?.error ||
          "Failed to send print request. Check if Electron app is running."
      );
    } finally {
      setPrinting(false);
    }
  };

  const cancelOrder = () => {
    if (!activeOrder) return;
    setCancelReason("");
    setRefundMethodId(
      paymentMethods.length > 0 ? String(paymentMethods[0].id) : null
    );
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) {
      setError("Please enter a cancellation reason");
      return;
    }
    if (!activeOrder) {
      setError("No active order to cancel");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const payload: any = {
        reason: cancelReason.trim(),
      };

      // Add refund method if there are paid items and refund method is selected
      const hasPaidItems = paidItemKeys.size > 0;
      if (hasPaidItems && refundMethodId) {
        payload.refund_method = refundMethodId;
      }

      await api.patch(`/orders/${activeOrder.id}/cancel`, payload);

      setActiveOrder(null);
      setExistingItems([]);
      setPendingItems([]);
      setSuccess("Order cancelled successfully");
      setShowCancelModal(false);
      setCancelReason("");

      // Navigate back after a short delay
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to cancel order");
    } finally {
      setSubmitting(false);
    }
  };

  const closeTable = async () => {
    if (!activeOrder) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // Fetch excluded items from kitchen settings
      let excludedItems: number[] = [];
      try {
        const settingsRes = await api.get("/kitchen/compile-settings");
        excludedItems = settingsRes.data?.excludedItems || [];
      } catch (err) {
        excludedItems = [];
      }

      // Refresh order data to get latest kitchen_delivered_at status
      const freshOrderRes = await api.get<OrderHeader>(
        `/orders/${activeOrder.id}`
      );
      const freshOrder = freshOrderRes.data;

      // If backend provides kitchen_delivered_at, trust it. Otherwise
      // double-check item-level kitchen_status to determine readiness.
      let kitchenDelivered = Boolean(freshOrder?.kitchen_delivered_at);

      if (!kitchenDelivered) {
        try {
          const itemsRes = await api.get(`/orders/${activeOrder.id}/items`);
          const items: any[] = Array.isArray(itemsRes.data)
            ? itemsRes.data
            : [];

          // If there are NO items, consider order ready
          if (items.length === 0) {
            kitchenDelivered = true;
          } else {
            // SEPARATE items into two groups:
            // 1. Items that require kitchen (NOT in excludedItems)
            // 2. Items that bypass kitchen (IN excludedItems)
            const kitchenRequiredItems = items.filter(
              (i) => !excludedItems.includes(i.product_id)
            );
            const kitchenExcludedItems = items.filter((i) =>
              excludedItems.includes(i.product_id)
            );

            kitchenRequiredItems.forEach((i) => {
              // Item requires kitchen
            });
            kitchenExcludedItems.forEach((i) => {
              // Item bypasses kitchen
            });

            // Only kitchen-required items need to be delivered/ready
            if (kitchenRequiredItems.length === 0) {
              // No items require kitchen - all items bypass kitchen, so ready to close
              kitchenDelivered = true;
            } else {
              // Check if ALL kitchen-required items are 'delivered' or 'ready'
              const allKitchenItemsReady = kitchenRequiredItems.every((i) => {
                const s = (i?.kitchen_status || "").toString().toLowerCase();
                const ready = s === "delivered" || s === "ready";
                return ready;
              });

              if (allKitchenItemsReady) {
                kitchenDelivered = true;
              }
            }
          }
        } catch (err) {
          // If item fetch fails, fall back to backend flag only
        }
      }

      // BLOCK CLOSE if kitchen items haven't been delivered
      if (!kitchenDelivered) {
        setSubmitting(false);
        Alert.alert(
          "Order Still Preparing",
          "The kitchen hasn't delivered this order yet. Please wait until all kitchen items are ready.",
          [
            {
              text: "OK",
              onPress: () => router.push("/orders/tables"),
            },
          ]
        );
        return;
      }

      // Call backend close endpoint
      await api.post(`/orders/${activeOrder.id}/close`);

      setActiveOrder(null);
      setExistingItems([]);
      setPendingItems([]);
      setSelectedPaymentId(null);
      setPaymentDropdownOpen(false);
      setCartModalVisible(false);
      setSuccess("Table closed successfully");

      // Show toast notification
      if (Platform.OS === "android") {
        ToastAndroid.show("Order preparing", ToastAndroid.LONG);
      }

      // Navigate back to tables screen with a small delay to ensure toast displays
      setTimeout(() => {
        router.push("/orders/tables");
      }, 500);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to close table");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isPhoneContext && !Number.isFinite(parsedTableNumber)) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{t("Invalid table")}</Text>
      </View>
    );
  }

  const headerTitleText = isPhoneContext
    ? t("Phone Orders")
    : `${t("Table")} ${parsedTableNumber}`;
  const headerSubtitleText = isPhoneContext
    ? t("Phone cart & payments")
    : t("Dine-in cart & payments");

  // Calculate total for selected payment items only
  const selectedItemsPaymentTotal =
    selectedItemsForPayment.length > 0 ? calculateSelectedItemsTotal() : 0;

  // Calculate amount left to be paid
  const calculateAmountLeftToBePaid = () => {
    let paidTotal = 0;
    // Add paid existing items
    existingItems.forEach((item) => {
      const itemKey = `existing-${item.orderItemId ?? item.productId}`;
      if (paidItemKeys.has(itemKey)) {
        const extrasPrice = (item.extras || []).reduce((sum, e) => {
          const unit = parseFloat(String(e?.price ?? e?.extraPrice ?? 0)) || 0;
          const qty = Number(e?.quantity ?? 1) || 1;
          return sum + unit * qty;
        }, 0);
        const itemTotal =
          (Number(item.price) || 0) * (Number(item.quantity) || 1) +
          extrasPrice;
        paidTotal += itemTotal;
      }
    });
    // Add paid pending items
    pendingItems.forEach((item, idx) => {
      const itemKey = `pending-${item.productId}-${idx}`;
      if (paidItemKeys.has(itemKey)) {
        const extrasPrice = (item.extras || []).reduce((sum, e) => {
          const unit = parseFloat(String(e?.price ?? e?.extraPrice ?? 0)) || 0;
          const qty = Number(e?.quantity ?? 1) || 1;
          return sum + unit * qty;
        }, 0);
        const itemTotal =
          (Number(item.price) || 0) * (Number(item.quantity) || 1) +
          extrasPrice;
        paidTotal += itemTotal;
      }
    });
    return combinedTotal - paidTotal;
  };

  const amountLeftToBePaid = calculateAmountLeftToBePaid();

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        highContrast && styles.containerHighContrast,
      ]}
    >
      {/* HEADER */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={isDark ? "#E5E7EB" : "#111827"}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.headerTitle,
              isDark && styles.headerTitleDark,
              { fontSize: 24 * fontScale },
            ]}
          >
            {headerTitleText}
          </Text>
          <Text
            style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}
          >
            {headerSubtitleText}
          </Text>
        </View>

        {/* Cart Indicator Badge */}
        {(existingItems.length > 0 || pendingItems.length > 0) && (
          <TouchableOpacity
            style={styles.headerCartBadgeContainer}
            onPress={() => setCartModalVisible(true)}
          >
            <View
              style={[
                styles.headerCartBadge,
                isDark && styles.headerCartBadgeDark,
              ]}
            >
              <Ionicons name="bag" size={16} color="#FFFFFF" />
              <Text style={styles.headerCartBadgeText}>
                {existingItems.reduce((sum, item) => sum + item.quantity, 0) +
                  pendingItems.reduce((sum, item) => sum + item.quantity, 0)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* STICKY CATEGORIES BAR */}
      {categories.length > 0 && (
        <View
          style={[
            styles.stickyCategories,
            isDark && styles.stickyCategoriesDark,
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                !categoryFilter && styles.categoryChipActive,
              ]}
              onPress={() => setCategoryFilter(null)}
            >
              <Text
                style={[
                  styles.categoryText,
                  !categoryFilter && styles.categoryTextActive,
                ]}
              >
                {t("All")}
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  categoryFilter === cat && styles.categoryChipActive,
                ]}
                onPress={() => setCategoryFilter(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    categoryFilter === cat && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* STATUS / MESSAGES */}
      {(error || success || loading || submitting) && (
        <View style={styles.statusBar}>
          {loading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#4F46E5" />
              <Text style={styles.statusText}>{t("Loading...")}</Text>
            </View>
          ) : submitting ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#4F46E5" />
              <Text style={styles.statusText}>{t("Processing...")}</Text>
            </View>
          ) : null}

          {error && !loading && !submitting && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          {success && !loading && !submitting && (
            <Text style={styles.successText}>{success}</Text>
          )}
        </View>
      )}

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* PRODUCTS */}
        <View style={styles.section}>
          <View style={styles.productGrid}>
            {visibleProducts.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.productCard, isDark && styles.productCardDark]}
                onPress={() => addToCart(p)}
              >
                {p.image ? (
                  <Image
                    source={{ uri: p.image }}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                ) : null}
                <Text
                  style={[styles.productName, isDark && styles.productNameDark]}
                >
                  {p.name}
                </Text>
                {p.description ? (
                  <Text numberOfLines={2} style={styles.productDescription}>
                    {p.description}
                  </Text>
                ) : null}
                <Text
                  style={[
                    styles.productPrice,
                    isDark && styles.productPriceDark,
                  ]}
                >
                  ₺{p.price}
                </Text>
              </TouchableOpacity>
            ))}

            {!loading && visibleProducts.length === 0 && (
              <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                {t("No products found")}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* FLOATING CONTENT WRAPPER - Contains cart bar and bottom nav */}
      <View style={styles.floatingFooter}>
        {/* FIXED CART BAR */}
        {(existingItems.length > 0 || pendingItems.length > 0) && (
          <TouchableOpacity
            style={[styles.fixedCartBar, isDark && styles.fixedCartBarDark]}
            onPress={() => setCartModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartBarContent}>
                <Ionicons name="bag" size={22} color="#FFFFFF" />
                <View style={styles.cartBarBadge}>
                  <Text style={styles.cartBarBadgeText}>
                    {pendingItems.length + existingItems.length}
                  </Text>
                </View>
              </View>
              <View style={styles.cartBarInfo}>
                <Text style={styles.cartBarLabel}>{t("Cart")}</Text>
                <Text style={styles.cartBarTotal}>
                  ₺{amountLeftToBePaid.toFixed(2)}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        {/* BOTTOM NAV - show with floating cart */}
        <BottomNav />
      </View>

      {/* CART MODAL */}
      <Modal
        visible={cartModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContent}
          >
            {/* Modal Header */}
            <View
              style={[styles.modalHeader, isDark && styles.modalHeaderDark]}
            >
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderInfo}>
                  <Text
                    style={[
                      styles.modalHeaderSubtitle,
                      isDark && styles.modalHeaderSubtitleDark,
                    ]}
                  >
                    {t("Table")}
                  </Text>
                  <Text
                    style={[
                      styles.modalTableNumber,
                      isDark && styles.modalTableNumberDark,
                    ]}
                  >
                    #{tableNumber}
                  </Text>
                </View>
                <View
                  style={[
                    styles.modalHeaderDivider,
                    isDark && styles.modalHeaderDividerDark,
                  ]}
                />
                <View style={styles.modalHeaderInfo}>
                  <Text
                    style={[
                      styles.modalHeaderSubtitle,
                      isDark && styles.modalHeaderSubtitleDark,
                    ]}
                  >
                    {selectedItemsForPayment.length > 0
                      ? t("Selected")
                      : t("Total")}
                  </Text>
                  <Text
                    style={[
                      styles.modalHeaderTotal,
                      isDark && styles.modalHeaderTotalDark,
                    ]}
                  >
                    ₺
                    {(selectedItemsForPayment.length > 0
                      ? calculateSelectedItemsTotal()
                      : amountLeftToBePaid
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                {/* Print Button - Only show if there's an active order */}
                {activeOrder && (
                  <TouchableOpacity
                    style={[
                      styles.modalHeaderButton,
                      isDark && styles.modalHeaderButtonDark,
                      printing && styles.modalHeaderButtonDisabled,
                    ]}
                    onPress={handlePrintOrder}
                    disabled={printing}
                  >
                    <Ionicons
                      name="print"
                      size={20}
                      color={printing ? "#9CA3AF" : "#FFFFFF"}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setCartModalVisible(false);
                    router.push("/orders/tables");
                  }}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Scroll Content */}
            <ScrollView
              style={[styles.modalScroll, isDark && styles.modalScrollDark]}
              showsVerticalScrollIndicator={false}
            >
              {/* Cart Items List */}
              {(existingItems.length > 0 || pendingItems.length > 0) && (
                <View style={styles.footerCartList}>
                  {/* Existing Items */}
                  {existingItems.length > 0 && (
                    <View style={styles.cartItemsGroup}>
                      <Text
                        style={[
                          styles.cartItemsGroupLabel,
                          isDark && styles.cartItemsGroupLabelDark,
                        ]}
                      >
                        {t("Current")}
                      </Text>
                      {existingItems.map((item, idx) => {
                        // Extras price per single product unit
                        const extrasPricePerUnit = (item.extras || []).reduce(
                          (sum, e) => {
                            const unit =
                              parseFloat(
                                String(e?.price ?? e?.extraPrice ?? 0)
                              ) || 0;
                            const qty = Number(e?.quantity ?? 1) || 1;
                            return sum + unit * qty;
                          },
                          0
                        );
                        // Multiply extras by the number of product units for total
                        const extrasPrice =
                          extrasPricePerUnit * (Number(item.quantity) || 1);
                        // Base price total (without extras) shown on the item row
                        const baseTotal =
                          (Number(item.price) || 0) *
                          (Number(item.quantity) || 1);
                        // Full item total (kept for reference / calculations)
                        const itemTotal = baseTotal + extrasPrice;
                        // ✅ Use orderItemId as the unique key (don't fall back to productId)
                        // This ensures each item instance is tracked separately
                        const itemKey = item.orderItemId
                          ? `existing-${item.orderItemId}`
                          : null;
                        // Skip rendering items without orderItemId (shouldn't happen for existing items)
                        if (!itemKey) return null;
                        const isSelected = selectedItemsForPayment.includes(
                          itemKey as any
                        );
                        const isPaid = paidItemKeys.has(itemKey);

                        return (
                          <TouchableOpacity
                            key={itemKey}
                            activeOpacity={isPaid ? 1 : 0.7}
                            disabled={isPaid}
                            onPress={() => {
                              if (!isPaid) {
                                setSelectedItemsForPayment((prev) =>
                                  prev.includes(itemKey as any)
                                    ? prev.filter((id) => id !== itemKey)
                                    : [...prev, itemKey as any]
                                );
                              }
                            }}
                            style={[
                              styles.footerCartItem,
                              isDark && styles.footerCartItemDark,
                              isSelected &&
                                (isDark
                                  ? styles.cartItemPaymentSelectedDark
                                  : styles.cartItemPaymentSelected),
                              isPaid &&
                                (isDark
                                  ? styles.cartItemPaidDark
                                  : styles.cartItemPaid),
                            ]}
                          >
                            {/* Main Item Row */}
                            <View style={styles.footerCartItemMainRow}>
                              <View style={styles.footerCartItemLeft}>
                                <View style={styles.itemNameQuantityRow}>
                                  <Text
                                    style={[
                                      styles.footerCartItemName,
                                      isDark && styles.footerCartItemNameDark,
                                      isPaid &&
                                        (isDark
                                          ? styles.footerCartItemNamePaidDark
                                          : styles.footerCartItemNamePaid),
                                    ]}
                                  >
                                    {item.name}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.footerCartItemMeta,
                                      isDark && styles.footerCartItemMetaDark,
                                      isPaid &&
                                        (isDark
                                          ? styles.footerCartItemMetaPaidDark
                                          : styles.footerCartItemMetaPaid),
                                    ]}
                                  >
                                    {isPaid ? t("✓ Paid") : `x${item.quantity}`}
                                  </Text>
                                </View>
                                {isPaid && item.paymentMethod && (
                                  <Text
                                    style={[
                                      styles.footerCartItemPaymentMethod,
                                      isDark &&
                                        styles.footerCartItemPaymentMethodDark,
                                    ]}
                                  >
                                    💳 {item.paymentMethod}
                                  </Text>
                                )}
                              </View>

                              {/* Checkbox before price - Locked for paid items */}
                              <View style={styles.cartItemCheckbox}>
                                {isPaid ? (
                                  <View
                                    style={[
                                      styles.checkbox,
                                      styles.checkboxPaid,
                                    ]}
                                  >
                                    <Ionicons
                                      name="lock-closed"
                                      size={12}
                                      color="#FFF"
                                    />
                                  </View>
                                ) : (
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
                                )}
                              </View>

                              <Text
                                style={[
                                  styles.footerCartItemPrice,
                                  isDark && styles.footerCartItemPriceDark,
                                  isPaid &&
                                    (isDark
                                      ? styles.footerCartItemPricePaidDark
                                      : styles.footerCartItemPricePaid),
                                ]}
                              >
                                {isPaid ? "🔒" : "₺"}
                                {baseTotal.toFixed(2)}
                              </Text>
                            </View>

                            {/* Extras List */}
                            {item.extras && item.extras.length > 0 && (
                              <View style={styles.extrasContainer}>
                                {item.extras.map((extra, eIdx) => {
                                  const unitPrice =
                                    parseFloat(
                                      String(
                                        extra?.price ?? extra?.extraPrice ?? 0
                                      )
                                    ) || 0;
                                  const extraQtyPerUnit =
                                    Number(extra?.quantity ?? 1) || 1; // how many of this extra per product unit
                                  const perItemExtra =
                                    unitPrice * extraQtyPerUnit; // cost of this extra for a single product unit
                                  const totalExtraForItem =
                                    perItemExtra * (Number(item.quantity) || 1); // aggregated for item's quantity
                                  return (
                                    <View key={eIdx} style={styles.extraRow}>
                                      <Text
                                        style={[
                                          styles.extraName,
                                          isDark && styles.extraNameDark,
                                        ]}
                                      >
                                        + {extra.name}{" "}
                                        {extraQtyPerUnit > 1
                                          ? `×${extraQtyPerUnit}`
                                          : ""}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.extraPrice,
                                          isDark && styles.extraPriceDark,
                                        ]}
                                      >
                                        {Number(item.quantity) &&
                                        Number(item.quantity) > 1
                                          ? `₺${perItemExtra.toFixed(2)} ×${Number(item.quantity)} = ₺${totalExtraForItem.toFixed(2)}`
                                          : `₺${perItemExtra.toFixed(2)}`}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            )}

                            {/* Notes */}
                            {item.note && (
                              <View style={styles.noteContainer}>
                                <Text
                                  style={[
                                    styles.noteText,
                                    isDark && styles.noteTextDark,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.noteLabel,
                                      isDark && styles.noteLabelDark,
                                    ]}
                                  >
                                    📝 Note:{" "}
                                  </Text>
                                  {item.note}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Pending Items */}
                  {pendingItems.length > 0 && (
                    <View style={styles.cartItemsGroup}>
                      <View style={styles.cartItemsGroupHeader}>
                        <Text
                          style={[
                            styles.cartItemsGroupLabel,
                            isDark && styles.cartItemsGroupLabelDark,
                          ]}
                        >
                          {t("New")}
                        </Text>
                        {pendingItems.length > 0 && (
                          <TouchableOpacity onPress={clearPending}>
                            <Text
                              style={[
                                styles.clearCartText,
                                isDark && styles.clearCartTextDark,
                              ]}
                            >
                              {t("Clear")}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {pendingItems.map((item, idx) => {
                        const itemKey = `pending-${item.productId}-${idx}`;
                        const isSelected = selectedItemsForPayment.includes(
                          itemKey as any
                        );
                        const isPaid = paidItemKeys.has(itemKey);
                        // Extras price per single product unit
                        const extrasPricePerUnit = (item.extras || []).reduce(
                          (sum, e) => {
                            const unit =
                              parseFloat(
                                String(e?.price ?? e?.extraPrice ?? 0)
                              ) || 0;
                            const qty = Number(e?.quantity ?? 1) || 1;
                            return sum + unit * qty;
                          },
                          0
                        );
                        // Multiply extras by the number of product units for total
                        const extrasPrice =
                          extrasPricePerUnit * (Number(item.quantity) || 1);
                        // Base price total (without extras) shown on the item row
                        const baseTotal =
                          (Number(item.price) || 0) *
                          (Number(item.quantity) || 1);
                        // Full item total (kept for reference / calculations)
                        const itemTotal = baseTotal + extrasPrice;
                        return (
                          <TouchableOpacity
                            key={itemKey}
                            activeOpacity={isPaid ? 1 : 0.7}
                            disabled={isPaid}
                            onPress={() => {
                              if (!isPaid) {
                                setSelectedItemsForPayment((prev) =>
                                  prev.includes(itemKey as any)
                                    ? prev.filter((id) => id !== itemKey)
                                    : [...prev, itemKey as any]
                                );
                              }
                            }}
                            style={[
                              styles.footerCartItem,
                              isDark && styles.footerCartItemDark,
                              isSelected &&
                                (isDark
                                  ? styles.cartItemPaymentSelectedDark
                                  : styles.cartItemPaymentSelected),
                              isPaid &&
                                (isDark
                                  ? styles.cartItemPaidDark
                                  : styles.cartItemPaid),
                            ]}
                          >
                            {/* Main Item Row */}
                            <View style={styles.footerCartItemMainRow}>
                              <View style={styles.footerCartItemLeft}>
                                <View style={styles.itemNameQuantityRow}>
                                  <Text
                                    style={[
                                      styles.footerCartItemName,
                                      isDark && styles.footerCartItemNameDark,
                                      isPaid &&
                                        (isDark
                                          ? styles.footerCartItemNamePaidDark
                                          : styles.footerCartItemNamePaid),
                                    ]}
                                  >
                                    {item.name}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.footerCartItemMeta,
                                      isDark && styles.footerCartItemMetaDark,
                                      isPaid &&
                                        (isDark
                                          ? styles.footerCartItemMetaPaidDark
                                          : styles.footerCartItemMetaPaid),
                                    ]}
                                  >
                                    {isPaid ? t("✓ Paid") : `x${item.quantity}`}
                                  </Text>
                                </View>
                              </View>

                              {/* Quantity Controls - Hidden for paid items */}
                              {!isPaid && (
                                <View style={styles.footerCartQtyControl}>
                                  <TouchableOpacity
                                    style={styles.footerQtyButton}
                                    onPress={() =>
                                      decrementItem(item.productId)
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.footerQtyText,
                                        isDark && styles.footerQtyTextDark,
                                      ]}
                                    >
                                      −
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.footerQtyButton}
                                    onPress={() =>
                                      incrementItem(item.productId)
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.footerQtyText,
                                        isDark && styles.footerQtyTextDark,
                                      ]}
                                    >
                                      +
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              )}

                              {/* Checkbox before price - Locked for paid items */}
                              <View style={styles.cartItemCheckbox}>
                                {isPaid ? (
                                  <View
                                    style={[
                                      styles.checkbox,
                                      styles.checkboxPaid,
                                    ]}
                                  >
                                    <Ionicons
                                      name="lock-closed"
                                      size={12}
                                      color="#FFF"
                                    />
                                  </View>
                                ) : (
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
                                )}
                              </View>

                              <Text
                                style={[
                                  styles.footerCartItemPrice,
                                  isDark && styles.footerCartItemPriceDark,
                                  isPaid &&
                                    (isDark
                                      ? styles.footerCartItemPricePaidDark
                                      : styles.footerCartItemPricePaid),
                                ]}
                              >
                                {isPaid ? "🔒" : "₺"}
                                {baseTotal.toFixed(2)}
                              </Text>
                            </View>

                            {/* Extras List */}
                            {item.extras && item.extras.length > 0 && (
                              <View style={styles.extrasContainer}>
                                {item.extras.map((extra, eIdx) => {
                                  const unitPrice =
                                    parseFloat(
                                      String(
                                        extra?.price ?? extra?.extraPrice ?? 0
                                      )
                                    ) || 0;
                                  const extraQtyPerUnit =
                                    Number(extra?.quantity ?? 1) || 1;
                                  const perItemExtra =
                                    unitPrice * extraQtyPerUnit;
                                  const totalExtraForItem =
                                    perItemExtra * (Number(item.quantity) || 1);
                                  return (
                                    <View key={eIdx} style={styles.extraRow}>
                                      <Text
                                        style={[
                                          styles.extraName,
                                          isDark && styles.extraNameDark,
                                        ]}
                                      >
                                        + {extra.name}{" "}
                                        {extraQtyPerUnit > 1
                                          ? `×${extraQtyPerUnit}`
                                          : ""}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.extraPrice,
                                          isDark && styles.extraPriceDark,
                                        ]}
                                      >
                                        {Number(item.quantity) &&
                                        Number(item.quantity) > 1
                                          ? `₺${perItemExtra.toFixed(2)} ×${Number(item.quantity)} = ₺${totalExtraForItem.toFixed(2)}`
                                          : `₺${perItemExtra.toFixed(2)}`}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            )}

                            {/* Notes */}
                            {item.note && (
                              <View style={styles.noteContainer}>
                                <Text
                                  style={[
                                    styles.noteText,
                                    isDark && styles.noteTextDark,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.noteLabel,
                                      isDark && styles.noteLabelDark,
                                    ]}
                                  >
                                    📝 Note:{" "}
                                  </Text>
                                  {item.note}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View
              style={[styles.modalActions, isDark && styles.modalActionsDark]}
            >
              {/* Send Order Button - For new pending items */}
              {pendingItems.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.modernButton,
                    styles.sendOrderButton,
                    submitting && styles.modernButtonDisabled,
                    isDark && styles.sendOrderButtonDark,
                  ]}
                  disabled={submitting}
                  onPress={submitOrder}
                >
                  {submitting ? (
                    <>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.modernButtonText}>
                        {t("Sending...")}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#FFFFFF" />
                      <Text style={styles.modernButtonText}>
                        {t("Send Order")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* 1. Payment Method Selector - First Priority - Only show if no pending items */}
              {activeOrder &&
                paymentMethods.length > 0 &&
                pendingItems.length === 0 &&
                paidItemKeys.size < existingItems.length && (
                  <View style={styles.paymentSelectorDropdown}>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodButton,
                        isDark && styles.paymentMethodButtonDark,
                      ]}
                      onPress={() =>
                        setPaymentDropdownOpen(!paymentDropdownOpen)
                      }
                      disabled={
                        paidItemKeys.size >=
                        existingItems.length + pendingItems.length
                      }
                    >
                      <Ionicons
                        name="card"
                        size={18}
                        color={isDark ? "#60A5FA" : "#4F46E5"}
                      />
                      <Text
                        style={[
                          styles.paymentMethodButtonText,
                          isDark && styles.paymentMethodButtonTextDark,
                        ]}
                      >
                        {paymentMethods.find((m) => m.id === selectedPaymentId)
                          ?.label || t("SELECT PAYMENT")}
                      </Text>
                      <Ionicons
                        name={
                          paymentDropdownOpen ? "chevron-up" : "chevron-down"
                        }
                        size={18}
                        color={isDark ? "#60A5FA" : "#4F46E5"}
                      />
                    </TouchableOpacity>

                    {/* Payment Methods Dropdown - Only shown when open */}
                    {paymentDropdownOpen && (
                      <View
                        style={[
                          styles.paymentDropdownMenu,
                          isDark && styles.paymentDropdownMenuDark,
                        ]}
                      >
                        {/* Default "SELECT PAYMENT" option */}
                        <TouchableOpacity
                          style={[
                            styles.paymentDropdownOption,
                            (!selectedPaymentId ||
                              selectedPaymentId === "select") &&
                              styles.paymentDropdownOptionActive,
                            isDark && styles.paymentDropdownOptionDark,
                            (!selectedPaymentId ||
                              selectedPaymentId === "select") &&
                              isDark &&
                              styles.paymentDropdownOptionActiveDark,
                          ]}
                          onPress={() => {
                            setSelectedPaymentId("select");
                            setPaymentDropdownOpen(false);
                          }}
                          disabled={submitting}
                        >
                          <Ionicons
                            name={
                              !selectedPaymentId ||
                              selectedPaymentId === "select"
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={18}
                            color={
                              !selectedPaymentId ||
                              selectedPaymentId === "select"
                                ? isDark
                                  ? "#60A5FA"
                                  : "#4F46E5"
                                : isDark
                                  ? "#6B7280"
                                  : "#9CA3AF"
                            }
                          />
                          <Text
                            style={[
                              styles.paymentDropdownOptionText,
                              (!selectedPaymentId ||
                                selectedPaymentId === "select") &&
                                styles.paymentDropdownOptionTextActive,
                              isDark && styles.paymentDropdownOptionTextDark,
                              (!selectedPaymentId ||
                                selectedPaymentId === "select") &&
                                isDark &&
                                styles.paymentDropdownOptionTextActiveDark,
                            ]}
                          >
                            {t("SELECT PAYMENT")}
                          </Text>
                        </TouchableOpacity>

                        {paymentMethods.map((method) => (
                          <TouchableOpacity
                            key={method.id}
                            style={[
                              styles.paymentDropdownOption,
                              selectedPaymentId === method.id &&
                                styles.paymentDropdownOptionActive,
                              isDark && styles.paymentDropdownOptionDark,
                              selectedPaymentId === method.id &&
                                isDark &&
                                styles.paymentDropdownOptionActiveDark,
                            ]}
                            onPress={() => {
                              setSelectedPaymentId(method.id);
                              setPaymentDropdownOpen(false);
                            }}
                            disabled={submitting}
                          >
                            <Ionicons
                              name={
                                selectedPaymentId === method.id
                                  ? "radio-button-on"
                                  : "radio-button-off"
                              }
                              size={18}
                              color={
                                selectedPaymentId === method.id
                                  ? isDark
                                    ? "#60A5FA"
                                    : "#4F46E5"
                                  : isDark
                                    ? "#6B7280"
                                    : "#9CA3AF"
                              }
                            />
                            <Text
                              style={[
                                styles.paymentDropdownOptionText,
                                selectedPaymentId === method.id &&
                                  styles.paymentDropdownOptionTextActive,
                                isDark && styles.paymentDropdownOptionTextDark,
                                selectedPaymentId === method.id &&
                                  isDark &&
                                  styles.paymentDropdownOptionTextActiveDark,
                              ]}
                            >
                              {method.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

              {/* Action Buttons Row - Reordered */}
              <View style={styles.footerActionRow}>
                {/* 2. Pay Button - Second Priority (with validation) - Only show if no pending items */}
                {activeOrder &&
                  pendingItems.length === 0 &&
                  paidItemKeys.size < existingItems.length && (
                    <TouchableOpacity
                      style={[
                        styles.modernButton,
                        styles.payButton,
                        submitting && styles.modernButtonDisabled,
                        isDark && styles.payButtonDark,
                      ]}
                      disabled={submitting}
                      onPress={() => {
                        if (
                          !selectedPaymentId ||
                          selectedPaymentId === "select"
                        ) {
                          Alert.alert(
                            t("Payment Method Required"),
                            t("Please select a payment method before paying."),
                            [{ text: t("OK"), style: "default" }]
                          );
                          return;
                        }
                        payOrder(selectedPaymentId);
                      }}
                    >
                      {submitting ? (
                        <>
                          <ActivityIndicator color="#FFFFFF" size="small" />
                          <View
                            style={{
                              flex: 1,
                              justifyContent: "center",
                              alignItems: "flex-start",
                              marginLeft: 8,
                            }}
                          >
                            <Text
                              allowFontScaling={false}
                              style={{
                                color: "#FFFFFF",
                                fontSize: 13,
                                fontWeight: "700",
                              }}
                            >
                              Processing...
                            </Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="wallet" size={24} color="#FFFFFF" />
                          <View
                            style={{
                              flex: 1,
                              justifyContent: "center",
                              alignItems: "flex-start",
                              marginLeft: 8,
                            }}
                          >
                            <Text
                              allowFontScaling={false}
                              style={{
                                color: "#FFFFFF",
                                fontSize: 13,
                                fontWeight: "700",
                              }}
                            >
                              {t("Pay Now")}
                            </Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                {/* 3. Add Items Button - Third Priority */}
                <TouchableOpacity
                  style={[
                    styles.modernButton,
                    styles.addItemsButton,
                    isDark && styles.addItemsButtonDark,
                  ]}
                  disabled={false}
                  onPress={handleAddItemsClick}
                >
                  <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                  <View
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "flex-start",
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      allowFontScaling={false}
                      style={{
                        color: "#FFFFFF",
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {t("Add Items")}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 4. Clear Button OR Cancel Button - Before Payment */}
                {(!activeOrder ||
                  paidItemKeys.size <
                    existingItems.length + pendingItems.length) && (
                  <TouchableOpacity
                    style={[
                      styles.modernButton,
                      styles.cancelButton,
                      isDark && styles.cancelButtonDark,
                    ]}
                    disabled={submitting}
                    onPress={
                      pendingItems.length > 0
                        ? clearPending
                        : activeOrder
                          ? cancelOrder
                          : () => {}
                    }
                  >
                    {pendingItems.length > 0 ? (
                      <>
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                        <View
                          style={{
                            flex: 1,
                            justifyContent: "center",
                            alignItems: "flex-start",
                            marginLeft: 8,
                          }}
                        >
                          <Text
                            allowFontScaling={false}
                            style={{
                              color: "#FFFFFF",
                              fontSize: 13,
                              fontWeight: "700",
                            }}
                          >
                            {t("Clear")}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#FFFFFF"
                        />
                        <View
                          style={{
                            flex: 1,
                            justifyContent: "center",
                            alignItems: "flex-start",
                            marginLeft: 8,
                          }}
                        >
                          <Text
                            allowFontScaling={false}
                            style={{
                              color: "#FFFFFF",
                              fontSize: 13,
                              fontWeight: "700",
                            }}
                          >
                            {t("Cancel")}
                          </Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Close Table Button / Cancel Button - After Payment (all items paid) */}
                {activeOrder &&
                  paidItemKeys.size >=
                    existingItems.length + pendingItems.length &&
                  existingItems.length + pendingItems.length > 0 && (
                    <>
                      {/* Cancel Button - After Payment */}
                      <TouchableOpacity
                        style={[
                          styles.modernButton,
                          styles.cancelButton,
                          isDark && styles.cancelButtonDark,
                        ]}
                        disabled={submitting}
                        onPress={cancelOrder}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#FFFFFF"
                        />
                        <View
                          style={{
                            flex: 1,
                            justifyContent: "center",
                            alignItems: "flex-start",
                            marginLeft: 8,
                          }}
                        >
                          <Text
                            allowFontScaling={false}
                            style={{
                              color: "#FFFFFF",
                              fontSize: 13,
                              fontWeight: "700",
                            }}
                          >
                            Cancel
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Close Table Button */}
                      <TouchableOpacity
                        style={[
                          styles.modernButton,
                          styles.closeTableButton,
                          submitting && styles.modernButtonDisabled,
                          isDark && styles.closeTableButtonDark,
                        ]}
                        disabled={submitting}
                        onPress={closeTable}
                      >
                        {submitting ? (
                          <>
                            <ActivityIndicator color="#FFFFFF" size="small" />
                            <View
                              style={{
                                flex: 1,
                                justifyContent: "center",
                                alignItems: "flex-start",
                                marginLeft: 8,
                              }}
                            >
                              <Text
                                allowFontScaling={false}
                                style={{
                                  color: "#FFFFFF",
                                  fontSize: 13,
                                  fontWeight: "700",
                                }}
                              >
                                Closing...
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark-done"
                              size={18}
                              color="#FFFFFF"
                            />
                            <View
                              style={{
                                flex: 1,
                                justifyContent: "center",
                                alignItems: "flex-start",
                                marginLeft: 8,
                              }}
                            >
                              <Text
                                allowFontScaling={false}
                                style={{
                                  color: "#FFFFFF",
                                  fontSize: 13,
                                  fontWeight: "700",
                                }}
                              >
                                {t("Close Table")}
                              </Text>
                            </View>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* EXTRAS MODAL */}
      <ExtrasModal
        visible={extrasModalVisible}
        onClose={() => setExtrasModalVisible(false)}
        selectedProduct={selectedProductForExtras}
        extrasGroups={extrasGroups}
        isDark={isDark}
        onConfirm={({
          product,
          quantity,
          extras,
          note,
        }: {
          product: any;
          quantity: number;
          extras: any[];
          note: string;
        }) => {
          // Add item with extras to cart
          setPendingItems((prev) => {
            const existing = prev.find((c) => c.productId === product.id);
            if (existing) {
              return prev.map((c) =>
                c.productId === product.id
                  ? {
                      ...c,
                      quantity: c.quantity + quantity,
                      extras: extras,
                      note: note,
                    }
                  : c
              );
            }
            return [
              ...prev,
              {
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: quantity,
                extras: extras,
                note: note,
              } as any,
            ];
          });
          setExtrasModalVisible(false);
          setCartModalVisible(true);
          setSuccess(`${product.name} added to cart!`);
        }}
      />

      {/* CANCEL ORDER MODAL */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContent}
          >
            <View
              style={[
                styles.cancelModalContainer,
                isDark && styles.cancelModalContainerDark,
              ]}
            >
              <View
                style={[
                  styles.cancelModalHeader,
                  isDark && styles.cancelModalHeaderDark,
                ]}
              >
                <Text
                  style={[
                    styles.cancelModalTitle,
                    isDark && styles.cancelModalTitleDark,
                  ]}
                >
                  Cancel Order
                </Text>
                <TouchableOpacity onPress={() => setShowCancelModal(false)}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                  />
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.cancelModalSubtitle,
                  isDark && styles.cancelModalSubtitleDark,
                ]}
              >
                Order #{activeOrder?.id}
              </Text>

              <Text
                style={[
                  styles.cancelModalLabel,
                  isDark && styles.cancelModalLabelDark,
                ]}
              >
                Cancellation Reason
              </Text>

              <TextInput
                style={[
                  styles.cancelModalInput,
                  isDark && styles.cancelModalInputDark,
                ]}
                multiline
                numberOfLines={4}
                placeholder="Why is this order being cancelled?"
                placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                value={cancelReason}
                onChangeText={setCancelReason}
                editable={!submitting}
              />

              {/* REFUND METHOD - Show only if there are paid items */}
              {paidItemKeys.size > 0 && (
                <View
                  style={[
                    styles.refundMethodSection,
                    isDark && styles.refundMethodSectionDark,
                  ]}
                >
                  <Text
                    style={[
                      styles.cancelModalLabel,
                      isDark && styles.cancelModalLabelDark,
                    ]}
                  >
                    Refund Method
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.refundMethodDropdown,
                      isDark && styles.refundMethodDropdownDark,
                    ]}
                    onPress={() => {
                      // Simple selection: cycle through payment methods
                      const currentIndex = paymentMethods.findIndex(
                        (m) => String(m.id) === refundMethodId
                      );
                      const nextIndex =
                        (currentIndex + 1) % paymentMethods.length;
                      setRefundMethodId(String(paymentMethods[nextIndex].id));
                    }}
                  >
                    <Text
                      style={[
                        styles.refundMethodDropdownText,
                        isDark && styles.refundMethodDropdownTextDark,
                      ]}
                    >
                      {paymentMethods.find(
                        (m) => String(m.id) === refundMethodId
                      )?.label || "Select refund method"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={isDark ? "#D1D5DB" : "#6B7280"}
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.refundAmountText,
                      isDark && styles.refundAmountTextDark,
                    ]}
                  >
                    Refund Amount:{" "}
                    {existingItems
                      .reduce(
                        (sum, item) => sum + item.price * item.quantity,
                        0
                      )
                      .toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={styles.cancelModalButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelModalButtonCancel,
                    isDark && styles.cancelModalButtonCancelDark,
                  ]}
                  onPress={() => setShowCancelModal(false)}
                  disabled={submitting}
                >
                  <Text
                    style={[
                      styles.cancelModalButtonText,
                      isDark && styles.cancelModalButtonTextDark,
                    ]}
                  >
                    Back
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cancelModalButtonConfirm,
                    (submitting || !cancelReason.trim()) &&
                      styles.cancelModalButtonDisabled,
                  ]}
                  onPress={handleCancelConfirm}
                  disabled={submitting || !cancelReason.trim()}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.cancelModalButtonConfirmText}>
                      Cancel Order
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },
  containerDark: {
    backgroundColor: "#020617",
  },
  containerHighContrast: {
    backgroundColor: "#000000",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerDark: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
  },
  backButton: {
    marginRight: 12,
    padding: 8,
    borderRadius: 8,
  },
  headerCartBadgeContainer: {
    marginLeft: 12,
    padding: 4,
  },
  headerCartBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 56,
    shadowColor: "#EF4444",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  headerCartBadgeDark: {
    backgroundColor: "#DC2626",
    shadowColor: "#EF4444",
  },
  headerCartBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },

  /* STICKY CATEGORIES */
  stickyCategories: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stickyCategoriesDark: {
    backgroundColor: "#020617",
    borderBottomColor: "#1F2937",
  },

  statusBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: "#4B5563",
  },
  errorText: {
    marginTop: 4,
    fontSize: 13,
    color: "#DC2626",
  },
  successText: {
    marginTop: 4,
    fontSize: 13,
    color: "#16A34A",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 200,
  },

  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  sectionTitleDark: {
    color: "#F9FAFB",
  },

  categoryRow: {
    paddingVertical: 2,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    marginRight: 10,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  categoryChipActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryText: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
  },
  categoryTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  productCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  productCardDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  productImage: {
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#F3F4F6",
  },
  productName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.2,
  },
  productNameDark: {
    color: "#E5E7EB",
  },
  productDescription: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "400",
  },
  productPrice: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "800",
    color: "#4F46E5",
    letterSpacing: -0.3,
  },
  productPriceDark: {
    color: "#60A5FA",
  },

  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },

  cartBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cartBlockTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  cartHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  clearText: {
    fontSize: 12,
    color: "#4F46E5",
    fontWeight: "600",
  },
  cartEmptyText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  cartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cartName: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  cartMeta: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  cartControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  qtyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4F46E5",
  },
  qtyValue: {
    marginHorizontal: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    minWidth: 20,
    textAlign: "center",
  },

  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  footerDark: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
    shadowColor: "#000",
    shadowOpacity: 0.3,
  },
  footerLeft: {
    flexDirection: "column",
  },
  footerLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  footerTotal: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000000",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  footerTotalDark: {
    color: "#60A5FA",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  footerButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    fontWeight: "700",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  footerButtonDisabled: {
    opacity: 0.5,
  },
  footerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  footerButtonGhost: {
    backgroundColor: "#F3F4F6",
    shadowColor: "transparent",
  },
  footerButtonGhostText: {
    color: "#4F46E5",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  paymentButtons: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  paymentChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  paymentChipActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentChipText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },

  /* FOOTER CART LIST */
  footerCartList: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },

  /* CART ITEMS GROUP */
  cartItemsGroup: {
    marginBottom: 16,
  },
  cartItemsGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cartItemsGroupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cartItemsGroupLabelDark: {
    color: "#D1D5DB",
  },
  clearCartText: {
    fontSize: 11,
    color: "#4F46E5",
    fontWeight: "600",
  },
  clearCartTextDark: {
    color: "#60A5FA",
  },

  /* FOOTER CART ITEM */
  footerCartItem: {
    flexDirection: "column",
    alignItems: "stretch",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  footerCartItemDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  /* Main row: name/qty on the left (stacked), price on the right */
  footerCartItemMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  footerCartItemLeft: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    marginRight: 8,
  },
  footerCartItemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    flexShrink: 1,
    lineHeight: 16,
  },
  footerCartItemNameDark: {
    color: "#F9FAFB",
  },
  footerCartItemMeta: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
    lineHeight: 16,
  },
  footerCartItemMetaDark: {
    color: "#9CA3AF",
  },
  footerCartItemPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4F46E5",
    minWidth: 60,
    textAlign: "right",
  },
  footerCartItemPriceDark: {
    color: "#60A5FA",
  },

  /* FOOTER QTY CONTROL */
  footerCartQtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 12,
  },
  footerQtyButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  footerQtyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4F46E5",
  },
  footerQtyTextDark: {
    color: "#60A5FA",
  },
  footerQtyValue: {
    marginHorizontal: 4,
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
    minWidth: 14,
    textAlign: "center",
  },
  footerQtyValueDark: {
    color: "#F9FAFB",
  },

  /* EXTRAS IN CART */
  extrasContainer: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#6366F1",
    marginTop: 4,
  },
  extraRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  extraName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    flex: 1,
  },
  extraNameDark: {
    color: "#9CA3AF",
  },
  extraPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366F1",
    marginLeft: 8,
  },
  extraPriceDark: {
    color: "#818CF8",
  },

  /* CART SUMMARY */
  cartSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  cartSummaryDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  cartSummaryItem: {
    flex: 1,
    alignItems: "center",
  },
  cartSummaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  cartSummaryValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  cartSummaryTotal: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4F46E5",
    letterSpacing: -0.3,
  },
  cartSummaryTotalDark: {
    color: "#60A5FA",
  },
  cartSummaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
  },

  /* FOOTER BUTTON GROUP */
  footerButtonGroup: {
    gap: 10,
  },

  /* ADD ITEMS BUTTON */
  addItemsButton: {
    backgroundColor: "#000000",
    borderWidth: 1.5,
    borderColor: "#000000",
    flexDirection: "row",
    gap: 6,
  },
  addItemsButtonDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  /* SEND ORDER BUTTON */
  sendOrderButton: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    gap: 8,
  },
  sendOrderButtonDark: {
    backgroundColor: "#059669",
  },

  /* MODERN BUTTONS */
  modernButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    gap: 6,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    width: "100%",
  },
  modernButtonDisabled: {
    opacity: 0.5,
  },
  modernButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  modernButtonTextDisabled: {
    color: "#9CA3AF",
  },

  /* PAYMENT SELECTOR */
  paymentSelector: {
    gap: 8,
  },
  paymentMethodButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    justifyContent: "space-between",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  paymentMethodButtonDark: {
    backgroundColor: "#1F2937",
    borderColor: "#374151",
  },
  paymentMethodButtonText: {
    fontSize: 13,
    flex: 1,
    fontWeight: "600",
    color: "#111827",
  },
  paymentMethodButtonTextDark: {
    color: "#F9FAFB",
  },

  /* PAYMENT SELECTOR DROPDOWN CONTAINER */
  paymentSelectorDropdown: {
    gap: 8,
  },

  /* PAYMENT DROPDOWN MENU */
  paymentDropdownMenu: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  paymentDropdownMenuDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },

  /* PAYMENT DROPDOWN OPTION */
  paymentDropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 12,
  },
  paymentDropdownOptionDark: {
    borderBottomColor: "#374151",
  },
  paymentDropdownOptionActive: {
    backgroundColor: "#EEF2FF",
  },
  paymentDropdownOptionActiveDark: {
    backgroundColor: "#1E40AF",
  },
  paymentDropdownOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  paymentDropdownOptionTextDark: {
    color: "#F9FAFB",
  },
  paymentDropdownOptionTextActive: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  paymentDropdownOptionTextActiveDark: {
    color: "#60A5FA",
  },

  /* FOOTER ACTION ROW */
  footerActionRow: {
    flexDirection: "column",
    gap: 10,
  },

  /* CANCEL BUTTON */
  cancelButton: {
    backgroundColor: "#EF4444",
    borderWidth: 1,
    borderColor: "#DC2626",
    minHeight: 48,
  },
  cancelButtonDark: {
    backgroundColor: "#DC2626",
    borderColor: "#991B1B",
  },
  cancelButtonText: {
    color: "#FFFFFF",
  },

  /* PAY BUTTON */
  payButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 56,
    shadowColor: "#3B82F6",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 2,
    borderColor: "#1D4ED8",
  },
  payButtonDark: {
    backgroundColor: "#1D4ED8",
    shadowColor: "#3B82F6",
    borderColor: "#1E40AF",
  },

  /* CLOSE TABLE BUTTON */
  closeTableButton: {
    backgroundColor: "#8B5CF6",
    minHeight: 48,
  },
  closeTableButtonDark: {
    backgroundColor: "#7C3AED",
  },

  /* FLOATING FOOTER WRAPPER - Contains cart bar and bottom nav */
  floatingFooter: {
    backgroundColor: "#FFFFFF",
  },

  /* FIXED CART BAR ABOVE NAV */
  /* FIXED CART BAR ABOVE NAV */
  fixedCartBar: {
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 45,
    borderTopWidth: 0,
    borderTopColor: "#6366F1",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  fixedCartBarDark: {
    backgroundColor: "#4338CA",
    borderTopColor: "#6366F1",
    shadowColor: "#4F46E5",
  },
  cartBarLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cartBarContent: {
    position: "relative",
  },
  cartBarBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4F46E5",
    shadowColor: "#EF4444",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cartBarBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  cartBarInfo: {
    gap: 2,
  },
  cartBarLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  cartBarTotal: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  /* MODAL OVERLAY */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 100,
  },

  /* MODAL CONTENT */
  modalContent: {
    backgroundColor: "#FFFFFF",
    height: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: "hidden",
    flexDirection: "column",
  },
  modalContentDark: {
    backgroundColor: "#020617",
  },

  /* MODAL HEADER */
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalHeaderDark: {
    backgroundColor: "#020617",
    borderBottomColor: "#374151",
  },

  /* MODAL TITLE */
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  modalTitleDark: {
    color: "#F9FAFB",
  },

  /* MODAL HEADER LEFT */
  modalHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 16,
  },

  /* MODAL HEADER INFO */
  modalHeaderInfo: {
    alignItems: "center",
    gap: 4,
  },

  /* MODAL HEADER SUBTITLE */
  modalHeaderSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  modalHeaderSubtitleDark: {
    color: "#6B7280",
  },

  /* MODAL TABLE NUMBER */
  modalTableNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  modalTableNumberDark: {
    color: "#F9FAFB",
  },

  /* MODAL HEADER DIVIDER */
  modalHeaderDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E5E7EB",
  },
  modalHeaderDividerDark: {
    backgroundColor: "#374151",
  },

  /* MODAL HEADER TOTAL */
  modalHeaderTotal: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000000",
    letterSpacing: -0.3,
  },
  modalHeaderTotalDark: {
    color: "#FFFFFF",
  },

  /* MODAL CLOSE BUTTON */
  modalCloseButton: {
    padding: 8,
    marginRight: -8,
  },

  /* MODAL HEADER BUTTON (Print) */
  modalHeaderButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  modalHeaderButtonDark: {
    backgroundColor: "#4F46E5",
  },
  modalHeaderButtonDisabled: {
    opacity: 0.5,
  },

  /* MODAL SCROLL */
  modalScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
  },
  modalScrollDark: {
    backgroundColor: "#020617",
  },

  /* MODAL ACTIONS */
  modalActions: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
    borderTopWidth: 2,
    borderTopColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 5,
  },
  modalActionsDark: {
    backgroundColor: "#020617",
    borderTopColor: "#1F2937",
  },

  /* CART ITEM CHECKBOX */
  cartItemCheckbox: {
    marginRight: 12,
    justifyContent: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  checkboxPaid: {
    borderColor: "#9CA3AF",
    backgroundColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxTick: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  /* CART ITEM PAYMENT SELECTED */
  cartItemPaymentSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },
  cartItemPaymentSelectedDark: {
    backgroundColor: "#1E40AF",
    borderColor: "#1E3A8A",
  },

  /* CART ITEM PAID */
  cartItemPaid: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
    opacity: 0.7,
  },
  cartItemPaidDark: {
    backgroundColor: "#374151",
    borderColor: "#4B5563",
    opacity: 0.6,
  },

  /* PAID ITEM TEXT STYLES */
  footerCartItemNamePaid: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  footerCartItemNamePaidDark: {
    color: "#6B7280",
    textDecorationLine: "line-through",
  },
  footerCartItemMetaPaid: {
    color: "#9CA3AF",
  },
  footerCartItemMetaPaidDark: {
    color: "#6B7280",
  },
  footerCartItemPricePaid: {
    color: "#9CA3AF",
  },
  footerCartItemPricePaidDark: {
    color: "#6B7280",
  },

  /* PAYMENT METHOD BADGE */
  footerCartItemPaymentMethod: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
    marginTop: 4,
  },
  footerCartItemPaymentMethodDark: {
    color: "#6EE7B7",
  },

  /* ITEM NAME + QUANTITY ROW */
  itemNameQuantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  /* NOTE CONTAINER */
  noteContainer: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#F59E0B",
    marginTop: 6,
    paddingVertical: 4,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  noteLabelDark: {
    color: "#FCD34D",
  },
  noteText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    fontStyle: "italic",
    lineHeight: 16,
  },
  noteTextDark: {
    color: "#D1D5DB",
  },

  /* CANCEL MODAL STYLES */
  cancelModalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: "80%",
  },
  cancelModalContainerDark: {
    backgroundColor: "#1F2937",
  },
  cancelModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  cancelModalHeaderDark: {
    borderBottomColor: "#374151",
  },
  cancelModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    letterSpacing: -0.3,
  },
  cancelModalTitleDark: {
    color: "#FFFFFF",
  },
  cancelModalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
    fontWeight: "500",
  },
  cancelModalSubtitleDark: {
    color: "#D1D5DB",
  },
  cancelModalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  cancelModalLabelDark: {
    color: "#F3F4F6",
  },
  cancelModalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
    textAlignVertical: "top",
  },
  cancelModalInputDark: {
    borderColor: "#374151",
    backgroundColor: "#111827",
    color: "#F3F4F6",
  },
  cancelModalButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  cancelModalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelModalButtonCancelDark: {
    backgroundColor: "#374151",
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  cancelModalButtonTextDark: {
    color: "#D1D5DB",
  },
  cancelModalButtonConfirm: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelModalButtonDisabled: {
    backgroundColor: "#FCA5A5",
    opacity: 0.6,
  },
  cancelModalButtonConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  /* REFUND METHOD SECTION */
  refundMethodSection: {
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  refundMethodSectionDark: {
    backgroundColor: "#7F1D1D",
    borderColor: "#DC2626",
  },
  refundMethodDropdown: {
    borderWidth: 1,
    borderColor: "#F87171",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refundMethodDropdownDark: {
    backgroundColor: "#1F2937",
    borderColor: "#EF4444",
  },
  refundMethodDropdownText: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  refundMethodDropdownTextDark: {
    color: "#F3F4F6",
  },
  refundAmountText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },
  refundAmountTextDark: {
    color: "#FCA5A5",
  },

  /* PRINT BUTTON STYLES */
  modalHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalHeaderButtonDark: {
    backgroundColor: "#1E40AF",
  },
  modalHeaderButtonDisabled: {
    backgroundColor: "#BFDBFE",
    opacity: 0.6,
  },
});
