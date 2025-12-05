import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { useAppearance } from "../../src/context/AppearanceContext";
import secureFetch from "../../src/api/secureFetch";
import { useAuth } from "../../src/context/AuthContext";
import { useCurrency } from "../../src/context/CurrencyContext";
import { usePermissions } from "../../src/context/PermissionsContext";
import BottomNav from "../../src/components/navigation/BottomNav";
import {
  MapModal,
  MapModalRef,
  DriverLocationUpdate,
} from "../../src/components/MapModal";
import { RouteInfo, DeliveryStop } from "../../src/types/delivery";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

type PacketOrder = {
  id: number;
  total: number;
  status: string;
  order_type?: string | null;
  payment_method?: string | null;
  driver_status?: string | null;
  driver_id?: number | null;
  created_at: string;
  restaurant_id?: number | null;

  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;

  // 🆕 Add all possible address sources coming from backend
  delivery_address?: string | null;
  address?: string | null;
  pos_location?: string | null; // Restaurant pickup location
  pos_location_lat?: number | null; // Restaurant pickup latitude
  pos_location_lng?: number | null; // Restaurant pickup longitude

  kitchen_status?: string | null;
  estimated_ready_at?: string | null;

  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
};

const resolveCustomerAddress = (order: PacketOrder | Record<string, any>) => {
  if (!order) return "";

  return (
    order.customer_address || order.delivery_address || order.address || ""
  );
};

type OrderItemExtra = {
  name: string;
  price?: number;
  extraPrice?: number;
  quantity?: number;
};

type OrderItem = {
  product_id?: number | null;
  external_product_id?: string | null;
  quantity: number;
  price: number;
  note?: string | null;
  extras?: OrderItemExtra[];
  order_item_name?: string | null;
  external_product_name?: string | null;
  product_name?: string | null;
};

type StatusStage = "preparing" | "on_road" | "delivered" | "closed";

const STATUS_FLOW: StatusStage[] = [
  "preparing",
  "on_road",
  "delivered",
  "closed",
];

const STATUS_LABELS: Record<StatusStage, string> = {
  preparing: "Preparing",
  on_road: "On road",
  delivered: "Delivered",
  closed: "Closed",
};

const STATUS_COLORS: Record<StatusStage, string> = {
  preparing: "#FACC15", // yellow
  on_road: "#3B82F6", // blue
  delivered: "#22C55E", // green
  closed: "#9CA3AF", // gray
};

const expoConfig = Constants.expoConfig ?? (Constants as any).manifest;
const API_BASE_URL =
  expoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://hurrypos-backend.onrender.com/api";

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const deriveStage = (order: PacketOrder): StatusStage => {
  if (order.status === "closed") return "closed";

  const driverStatus = (order.driver_status || "").toLowerCase();
  if (driverStatus === "delivered") return "delivered";
  if (
    driverStatus === "on_road" ||
    driverStatus === "picked_up" ||
    driverStatus === "arrived"
  ) {
    return "on_road";
  }

  return "preparing";
};

const getPlatformLabel = (order: PacketOrder) => {
  const type = (order.order_type || "").toLowerCase();
  if (type === "phone") return "Phone";
  if (type === "packet" || type === "online") return "Online";
  return "Other";
};

const formatPaymentLabel = (method?: string | null) => {
  if (!method) return "Not set";
  const clean = String(method).trim().replace(/_/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

type PaymentMethod = {
  id: string;
  label: string;
  icon?: string;
  enabled?: boolean;
};

const normalizePaymentMethods = (payload: any): PaymentMethod[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.methods)) {
    return payload.methods;
  }
  if (payload.enabledMethods && typeof payload.enabledMethods === "object") {
    return Object.entries(payload.enabledMethods).map(([id, enabled]) => ({
      id,
      label: String(id)
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      enabled: Boolean(enabled),
    }));
  }
  return [];
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: "cash", label: "Cash", icon: "💵", enabled: true },
  { id: "card", label: "Card", icon: "💳", enabled: true },
  { id: "online", label: "Online", icon: "🌐", enabled: true },
];

export default function PacketOrdersScreen() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [orders, setOrders] = useState<PacketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<number, OrderItem[]>>(
    {}
  );
  const [itemsLoading, setItemsLoading] = useState<Record<number, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    DEFAULT_PAYMENT_METHODS
  );
  const [paymentLoading, setPaymentLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const mapModalRef = useRef<MapModalRef>(null);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState<number | null>(
    null
  );

  // 🗺️ Map modal state
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [mapModalOrder, setMapModalOrder] = useState<PacketOrder | null>(null);
  const [mapModalRoute, setMapModalRoute] = useState<RouteInfo | null>(null);

  const { appearance, isDark, fontScale } = useAppearance();

  const highContrast = appearance.highContrast;
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const restaurantId = user?.restaurant_id;
  const router = useRouter();

  // --- Kitchen timer helper ---
  const getKitchenInfo = (order: PacketOrder) => {
    const rawStatus = (
      order.kitchen_status ||
      order.status ||
      ""
    ).toLowerCase();
    const now = Date.now();
    const createdMs = order.created_at
      ? new Date(order.created_at).getTime()
      : null;

    const estimatedReadyMs = order.estimated_ready_at
      ? new Date(order.estimated_ready_at).getTime()
      : createdMs
        ? createdMs + 10 * 60 * 1000 // fallback: 10 min after creation
        : null;

    if (rawStatus === "preparing") {
      let etaText: string | null = null;
      if (estimatedReadyMs) {
        const diffMin = Math.max(
          0,
          Math.round((estimatedReadyMs - now) / 60000)
        );
        if (diffMin > 0) {
          etaText = `${t("Estimated ready in")} ${diffMin} ${t("min")}`;
        } else {
          etaText = t("Almost ready");
        }
      }
      return { label: t("Kitchen is preparing"), eta: etaText };
    }

    if (rawStatus === "ready") {
      return { label: t("Ready now"), eta: null };
    }

    return null;
  };

  // --- Distance helper (Haversine) ---
  const toRad = (v: number) => (v * Math.PI) / 180;
  const distanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const ARRIVE_RADIUS_KM = 0.12; // ~120m

  const loadPacketOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      if (!refreshing) setLoading(true);
      const data = await secureFetch("/orders?status=open_phone");
      const list: PacketOrder[] = Array.isArray(data) ? data : [];

      const filtered = list.filter(
        (o) => o && (o.order_type === "packet" || o.order_type === "phone")
      );

      filtered.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
      const enriched = await Promise.all(
        filtered.map(async (order) => {
          try {
            // Always fetch detail to get pos_location (restaurant pickup location)
            const detail = await secureFetch(`/orders/${order.id}`);

            const address = resolveCustomerAddress(order);
            const detailAddress = resolveCustomerAddress(detail || {});

            // 🔴 CRITICAL: Backend might send EITHER:
            // Option A: pickup_lat/lng (restaurant) + delivery_lat/lng (customer)
            // Option B: pos_location_lat/lng (restaurant) + delivery_lat/lng (customer)
            // We need to handle BOTH cases and prioritize pos_location_lat/lng if available

            const enrichedOrder = {
              ...order,
              // Pickup coords: Use pos_location_lat/lng FIRST, fallback to pickup_lat/lng
              pos_location_lat: detail?.pos_location_lat
                ? Number(detail.pos_location_lat)
                : detail?.pickup_lat
                  ? Number(detail.pickup_lat)
                  : order.pos_location_lat,
              pos_location_lng: detail?.pos_location_lng
                ? Number(detail.pos_location_lng)
                : detail?.pickup_lng
                  ? Number(detail.pickup_lng)
                  : order.pos_location_lng,
              // Delivery coords stay as is
              delivery_lat: detail?.delivery_lat ?? order.delivery_lat,
              delivery_lng: detail?.delivery_lng ?? order.delivery_lng,
              pos_location: detail?.pos_location || order.pos_location, // Restaurant pickup location from backend
              customer_address: detailAddress || address, // Use detail address if available, fallback to order address
            };

            return enrichedOrder;
          } catch (err) {
            console.log(
              `❌ Failed to fetch detail for order ${order.id}:`,
              err
            );
            // If fetch fails, return order with local address
            const address = resolveCustomerAddress(order);
            return { ...order, customer_address: address };
          }
        })
      );

      setOrders(enriched);

      // 🕒 Initialize offer countdowns for new unassigned orders
      setOfferDeadlines((prev) => {
        const next = { ...prev };
        const now = Date.now();
        enriched.forEach((o) => {
          const isUnassigned = !o.driver_id;
          if (isUnassigned && next[o.id] == null) {
            // 20 seconds from first time we see it
            next[o.id] = now + 20_000;
          }
        });
        return next;
      });
    } catch (err) {
      console.log("❌ Packet orders load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, restaurantId]);
  // 🚦 Auto update driver_status when close to pickup / dropoff
  const handleAutoDriverStatus = useCallback(
    async (driverLat: number, driverLng: number) => {
      if (!user?.id) return;

      const myId = Number(user.id);
      const assigned = orders.filter(
        (o) => o.driver_id && Number(o.driver_id) === myId
      );

      if (!assigned.length) return;

      let shouldReload = false;

      for (const order of assigned) {
        const ds = (order.driver_status || "").toLowerCase();
        const stage = deriveStage(order);

        const pickupLat = order.pickup_lat;
        const pickupLng = order.pickup_lng;
        const dropLat = order.delivery_lat;
        const dropLng = order.delivery_lng;

        try {
          // ✅ Arrived at restaurant (near pickup, still preparing)
          if (
            pickupLat != null &&
            pickupLng != null &&
            stage === "preparing" &&
            ds !== "arrived_restaurant"
          ) {
            const dKm = distanceKm(driverLat, driverLng, pickupLat, pickupLng);
            if (dKm <= ARRIVE_RADIUS_KM) {
              await secureFetch(`/orders/${order.id}/driver-status`, {
                method: "PATCH",
                body: JSON.stringify({ driver_status: "arrived_restaurant" }),
              });
              shouldReload = true;
              continue;
            }
          }

          // ✅ Arrived at delivery (near dropoff, on road / picked up)
          if (
            dropLat != null &&
            dropLng != null &&
            (stage === "on_road" || ds === "picked_up") &&
            ds !== "arrived_customer" &&
            ds !== "delivered"
          ) {
            const dKm = distanceKm(driverLat, driverLng, dropLat, dropLng);
            if (dKm <= ARRIVE_RADIUS_KM) {
              await secureFetch(`/orders/${order.id}/driver-status`, {
                method: "PATCH",
                body: JSON.stringify({ driver_status: "arrived_customer" }),
              });
              shouldReload = true;
            }
          }
        } catch (err) {
          console.log("❌ Auto driver status update failed:", err);
        }
      }

      if (shouldReload) {
        await loadPacketOrders();
      }
    },
    [orders, user, loadPacketOrders]
  );

  useEffect(() => {
    let isMounted = true;

    const startLocation = async () => {
      if (!user?.id) return;

      try {
        // First check if location services are enabled on the device
        const isEnabled = await Location.hasServicesEnabledAsync().catch(
          () => false
        );
        if (!isEnabled) {
          Alert.alert(
            t("Location Services Disabled"),
            t(
              "Please enable location services in your device settings to track driver location."
            ),
            [
              {
                text: t("Open Settings"),
                onPress: () => {
                  if (Platform.OS === "ios") {
                    Linking.openURL("app-settings:");
                  } else {
                    Linking.openSettings();
                  }
                },
              },
              { text: "Cancel", onPress: () => {} },
            ]
          );
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            t("Location Permission Denied"),
            t("Please allow location access to track your location."),
            [
              {
                text: t("Open Settings"),
                onPress: () => {
                  if (Platform.OS === "ios") {
                    Linking.openURL("app-settings:");
                  } else {
                    Linking.openSettings();
                  }
                },
              },
              { text: "Cancel", onPress: () => {} },
            ]
          );
          return;
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15_000,
            distanceInterval: 50,
          },
          async (position) => {
            if (!isMounted) return;
            const { latitude, longitude } = position.coords;

            // Send live location to backend (drivers/location endpoint)
            try {
              await secureFetch("/drivers/location", {
                method: "POST",
                body: JSON.stringify({
                  driver_id: user.id,
                  lat: latitude,
                  lng: longitude,
                }),
              });
            } catch (err) {
              console.log("❌ Failed to send driver location:", err);
            }

            // Auto-flow driver_status
            handleAutoDriverStatus(latitude, longitude);
          }
        );

        locationWatcherRef.current = sub;
      } catch (err) {
        // Silently ignore other location errors
      }
    };

    startLocation();

    return () => {
      isMounted = false;
      if (locationWatcherRef.current) {
        // Some platforms (web) expose different subscription APIs.
        // Be defensive: call whichever removal method exists to avoid
        // `removeSubscription is not a function` errors.
        const sub: any = locationWatcherRef.current;
        try {
          if (typeof sub.remove === "function") {
            sub.remove();
          } else if (typeof sub.removeSubscription === "function") {
            sub.removeSubscription();
          } else if (typeof sub.unsubscribe === "function") {
            sub.unsubscribe();
          }
        } catch (e) {
          // ignore removal errors
        }
        locationWatcherRef.current = null;
      }
    };
  }, [user?.id, handleAutoDriverStatus]);

  const loadItemsForOrder = useCallback(
    async (orderId: number) => {
      if (itemsLoading[orderId]) return;
      setItemsLoading((prev) => ({ ...prev, [orderId]: true }));
      try {
        const data = await secureFetch(`/orders/${orderId}/items`);
        const items: OrderItem[] = Array.isArray(data) ? data : [];
        setItemsByOrder((prev) => ({ ...prev, [orderId]: items }));
      } catch (err) {
        console.log("❌ Packet order items load error:", err);
      } finally {
        setItemsLoading((prev) => ({ ...prev, [orderId]: false }));
      }
    },
    [itemsLoading]
  );

  useEffect(() => {
    if (restaurantId) {
      loadPacketOrders();
    }
  }, [restaurantId, loadPacketOrders]);

  useEffect(() => {
    if (!restaurantId) return;

    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { restaurantId },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_restaurant", restaurantId);
    });

    const handleOrdersUpdate = () => {
      loadPacketOrders();
    };

    // Handle real-time driver location updates
    const handleDriverLocationUpdate = (data: DriverLocationUpdate) => {
      // If map modal is open, update marker in real-time
      if (mapModalRef.current) {
        mapModalRef.current.updateDriverLocation(
          data.lat,
          data.lng,
          data.driver_id
        );
      }
    };

    const events = [
      "orders_updated",
      "order_confirmed",
      "order_preparing",
      "order_ready",
      "order_delivered",
      "driver_assigned",
      "payment_made",
    ];

    events.forEach((event) => socket.on(event, handleOrdersUpdate));

    // Listen for driver location updates
    socket.on("driver_location_updated", handleDriverLocationUpdate);

    return () => {
      events.forEach((event) => socket.off(event, handleOrdersUpdate));
      socket.off("driver_location_updated", handleDriverLocationUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [restaurantId, loadPacketOrders]);

  useEffect(() => {
    let isMounted = true;
    const loadPaymentMethods = async () => {
      setPaymentLoading(true);
      try {
        const data = await secureFetch("/settings/payments");
        if (!isMounted) return;
        let methods = normalizePaymentMethods(data);
        if (!methods.length) {
          methods = DEFAULT_PAYMENT_METHODS;
        }
        const enabledMethods = methods.filter(
          (method) => method.enabled !== false
        );
        const resolvedMethods =
          enabledMethods.length > 0 ? enabledMethods : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(resolvedMethods);
      } catch (err) {
        console.log("❌ Packet payment fetch failed:", err);
      } finally {
        if (isMounted) {
          setPaymentLoading(false);
        }
      }
    };

    loadPaymentMethods();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleExpand = (orderId: number) => {
    setExpandedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
    if (!itemsByOrder[orderId]) {
      loadItemsForOrder(orderId);
    }
  };

  const updatePaymentMethod = async (order: PacketOrder, method: string) => {
    const key = `payment-${order.id}`;
    setBusyKey(key);
    try {
      await secureFetch(`/orders/${order.id}`, {
        method: "PUT",
        body: JSON.stringify({
          payment_method: method,
          changed_by: user?.name || user?.email || "mobile",
        }),
      });
      await loadPacketOrders();
    } catch (err) {
      console.log("❌ Update payment method failed:", err);
    } finally {
      setBusyKey(null);
    }
  };

  const handleTakeOrder = async (order: PacketOrder) => {
    if (!user?.id) return;
    const key = `take-${order.id}`;
    setBusyKey(key);
    try {
      await secureFetch(`/drivers/orders/${order.id}/claim-driver`, {
        method: "POST",
        body: JSON.stringify({ driver_id: user.id }),
      });
      await loadPacketOrders();
    } catch (err) {
      console.log("❌ Take order failed:", err);
    } finally {
      setBusyKey(null);
    }
  };

  const updateDriverStage = async (order: PacketOrder, stage: StatusStage) => {
    // If closing order, first confirm payment method
    if (stage === "closed") {
      const paymentMethod = order.payment_method || "";
      const paymentLabel =
        paymentMethods.find(
          (m) => m.id.toLowerCase() === paymentMethod.toLowerCase()
        )?.label || "Not set";

      return Alert.alert(
        t("Confirm Payment Method"),
        `${t("Close Order")} #${order.id}?\n\n${t("Select Payment")}: ${paymentLabel}`,
        [
          {
            text: "Cancel",
            onPress: () => {},
            style: "cancel",
          },
          {
            text: t("Change Payment"),
            onPress: () => setPaymentDropdownOpen(order.id),
            style: "default",
          },
          {
            text: t("Confirm & Close"),
            onPress: async () => {
              const key = `status-${order.id}`;
              setBusyKey(key);
              try {
                await secureFetch(`/orders/${order.id}/status`, {
                  method: "PUT",
                  body: JSON.stringify({ status: "closed" }),
                });
                await loadPacketOrders();
              } catch (err) {
                console.log("❌ Update driver status failed:", err);
              } finally {
                setBusyKey(null);
              }
            },
            style: "default",
          },
        ]
      );
    }

    const key = `status-${order.id}`;
    setBusyKey(key);
    try {
      await secureFetch(`/orders/${order.id}/driver-status`, {
        method: "PATCH",
        body: JSON.stringify({ driver_status: stage }),
      });
      await loadPacketOrders();
    } catch (err) {
      console.log("❌ Update driver status failed:", err);
    } finally {
      setBusyKey(null);
    }
  };

  // 🕒 Offer timer (Accept/Reject within 20s)
  const [offerDeadlines, setOfferDeadlines] = useState<Record<number, number>>(
    {}
  );
  const [rejectedOffers, setRejectedOffers] = useState<Record<number, boolean>>(
    {}
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  // 📍 Driver GPS watcher
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);

  // Global 1s tick for countdowns
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const renderPaymentChip = (order: PacketOrder, method: PaymentMethod) => {
    const key = `payment-${order.id}`;
    const isBusy = busyKey === key;
    const current = (order.payment_method || "").toLowerCase();
    const target = method.id.toLowerCase();
    const isActive = current === target;
    const isAssignedToMe =
      !!order.driver_id &&
      user?.id &&
      Number(order.driver_id) === Number(user.id);
    const disabled = isBusy || !isAssignedToMe;
    const label = method.icon ? `${method.icon} ${method.label}` : method.label;

    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.paymentChip,
          isActive && styles.paymentChipActive,
          disabled && styles.actionDisabled,
        ]}
        onPress={() => !disabled && updatePaymentMethod(order, method.id)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.paymentChipText,
            isActive && styles.paymentChipTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderStatusChip = (order: PacketOrder, stage: StatusStage) => {
    const key = `status-${order.id}`;
    const isBusy = busyKey === key;
    const currentStage = deriveStage(order);
    const currentIndex = STATUS_FLOW.indexOf(currentStage);
    const targetIndex = STATUS_FLOW.indexOf(stage);
    const isAssignedToMe =
      !!order.driver_id &&
      user?.id &&
      Number(order.driver_id) === Number(user.id);

    if (targetIndex === -1 || currentIndex === -1) return null;

    const isActive = stage === currentStage;
    const isForward = targetIndex === currentIndex + 1;

    const canClose =
      stage === "closed" &&
      (currentStage === "delivered" || currentStage === "closed");

    const canMove =
      !isBusy &&
      isAssignedToMe &&
      !isActive &&
      ((stage === "closed" && canClose) || (stage !== "closed" && isForward));

    const disabled = !canMove;

    return (
      <TouchableOpacity
        key={stage}
        style={[
          styles.statusChip,
          isActive && [
            styles.statusChipActive,
            { borderColor: STATUS_COLORS[stage] },
          ],
          disabled && styles.actionDisabled,
        ]}
        onPress={() => !disabled && updateDriverStage(order, stage)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.statusChipText,
            isActive && styles.statusChipTextActive,
          ]}
        >
          {STATUS_LABELS[stage]}
        </Text>
      </TouchableOpacity>
    );
  };

  // -------------------------------------------------------------
  // 🗺️ MULTI-ORDER ROUTE OPTIMIZATION (if driver has 2-3 orders)
  // -------------------------------------------------------------
  const optimizeMultiRoute = async () => {
    if (!user?.id) return;

    const myOrders = orders.filter(
      (o) => o.driver_id && Number(o.driver_id) === Number(user.id)
    );

    if (myOrders.length <= 1) {
      alert(t("Not enough orders for optimization"));
      return;
    }

    const origin = `${myOrders[0].pickup_lat},${myOrders[0].pickup_lng}`;
    const destination = `${myOrders[myOrders.length - 1].delivery_lat},${myOrders[myOrders.length - 1].delivery_lng}`;

    const waypointList = myOrders
      .slice(1, myOrders.length - 1)
      .map((o) => `${o.delivery_lat},${o.delivery_lng}`)
      .join("|");

    try {
      // Optionally call backend/google directions here to get optimized polyline.
      // For now build a local RouteInfo and open MapModal in multi-stop mode so driver sees all stops.
      const stops: DeliveryStop[] = [];
      let stopNumber = 0;

      // Build stops: pickup then delivery for each order
      myOrders.forEach((o) => {
        stops.push({
          id: `pickup-${o.id}`,
          orderId: o.id,
          type: "pickup",
          stopNumber: stopNumber++,
          address:
            o.pos_location || o.customer_address || resolveCustomerAddress(o),
          latitude: Number(o.pickup_lat) || Number(o.pos_location_lat) || 0,
          longitude: Number(o.pickup_lng) || Number(o.pos_location_lng) || 0,
          status: o.driver_status === "delivered" ? "completed" : "pending",
        });

        stops.push({
          id: `delivery-${o.id}`,
          orderId: o.id,
          type: "delivery",
          stopNumber: stopNumber++,
          address:
            o.delivery_address ||
            o.customer_address ||
            resolveCustomerAddress(o),
          latitude: Number(o.delivery_lat) || 0,
          longitude: Number(o.delivery_lng) || 0,
          status: o.driver_status === "delivered" ? "completed" : "pending",
        });
      });

      const routeInfo: RouteInfo = {
        totalDistance: 0,
        totalDuration: 0,
        stops,
        driverId: String(user.id),
      };

      setMapModalRoute(routeInfo);
      setMapModalOrder(null);
      setMapModalVisible(true);
      return;
    } catch (err) {
      console.log("❌ Optimization failed:", err);
      alert(t("Failed to optimize route"));
    }
  };

  // -------------------------------------------------------------
  // 📍 AUTO-GEOCODE DELIVERY ADDRESS (if no lat/lng in database)
  // -------------------------------------------------------------
  const autoGeocodeOrder = async (order: any) => {
    try {
      if (!order?.customer_address) {
        console.log("❌ Order has no address!");
        return null;
      }

      // 1️⃣ Ask backend to geocode text address
      const geo = await secureFetch(
        `/drivers/geocode?q=${encodeURIComponent(order.customer_address)}`
      );

      if (!geo?.lat || !geo?.lng) {
        console.log("❌ Geocode failed:", geo);
        return null;
      }

      console.log("✅ Auto-geocoded (frontend only):", geo.lat, geo.lng);

      // 2️⃣ Just return the coords (no DB update here)
      return { lat: geo.lat, lng: geo.lng };
    } catch (err) {
      console.log("❌ autoGeocodeOrder error:", err);
      return null;
    }
  };

  // -------------------------------------------------------------
  // 📍 OPEN MAP VIEW FOR ORDER (Bottom sheet modal - stays on screen)
  // -------------------------------------------------------------
  const openMapForOrder = (
    order: PacketOrder,
    overrideLat?: number,
    overrideLng?: number
  ) => {
    const lat = overrideLat || order.delivery_lat;
    const lng = overrideLng || order.delivery_lng;

    if (!lat || !lng) {
      alert(t("Location missing for this order"));
      return;
    }

    // Show map in modal instead of navigating away
    setMapModalOrder(order);
    setMapModalVisible(true);
  };

  const renderStatusStep = (order: PacketOrder, stage: StatusStage) => {
    const currentStage = deriveStage(order);
    const currentIndex = STATUS_FLOW.indexOf(currentStage);
    const targetIndex = STATUS_FLOW.indexOf(stage);

    const isCompleted = targetIndex < currentIndex;
    const isActive = stage === currentStage;
    const isNext =
      targetIndex === currentIndex + 1 ||
      (stage === "closed" && currentStage === "delivered");

    const isAssignedToMe =
      !!order.driver_id &&
      user?.id &&
      Number(order.driver_id) === Number(user.id);

    const canClick = isAssignedToMe && isNext;

    // icons for each stage
    const ICONS: Record<StatusStage, any> = {
      preparing: "restaurant-outline",
      on_road: "car-outline",
      delivered: "checkmark-circle-outline",
      closed: "lock-closed-outline",
    };

    const activeColor = "#4F46E5";
    const completedColor = "#22C55E";
    const idleColor = "#9CA3AF";

    const circleColor = isActive
      ? activeColor
      : isCompleted
        ? completedColor
        : idleColor;

    return (
      <TouchableOpacity
        key={stage}
        disabled={!canClick}
        onPress={() => updateDriverStage(order, stage)}
        style={{ alignItems: "center", width: 70 }}
      >
        {/* circle + icon */}
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#FFFFFF",
            borderWidth: 2,
            borderColor: circleColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={ICONS[stage]} size={18} color={circleColor} />
        </View>

        {/* label */}
        <Text
          style={{
            marginTop: 4,
            fontSize: 11,
            fontWeight: isActive ? "700" : "500",
            color: circleColor,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {STATUS_LABELS[stage]}
        </Text>
      </TouchableOpacity>
    );
  };

  const SmartStatusButton = ({ order }: { order: PacketOrder }) => {
    const stage = deriveStage(order);
    console.log(
      `SmartStatusButton render: order ${order.id}, status=${order.status}, driver_status=${order.driver_status}, stage=${stage}`
    );

    const stageToAction: Partial<
      Record<
        StatusStage,
        {
          next: StatusStage;
          label: string;
          color: string;
        }
      >
    > = {
      preparing: {
        next: "on_road",
        label: "Start Delivery",
        color: "#3B82F6",
      },
      on_road: {
        next: "delivered",
        label: "Mark Delivered",
        color: "#22C55E",
      },
      delivered: {
        next: "closed",
        label: "Close Order",
        color: "#6B7280",
      },
    };

    const cfg = stageToAction[stage];
    if (!cfg) return null;

    const isAssignedToMe =
      !!order.driver_id &&
      user?.id &&
      Number(order.driver_id) === Number(user.id);

    if (!isAssignedToMe) return null;

    return (
      <TouchableOpacity
        style={[styles.sharedActionButton, { backgroundColor: cfg.color }]}
        onPress={() => updateDriverStage(order, cfg.next)}
      >
        <Text style={styles.sharedActionButtonText}>{cfg.label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        highContrast && styles.containerHighContrast,
      ]}
    >
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleArea}>
            <Ionicons
              name="cube"
              size={24}
              color={isDark ? "#818CF8" : "#6366F1"}
            />
            <View>
              <Text
                style={[
                  styles.headerTitle,
                  isDark && styles.headerTitleDark,
                  { fontSize: 26 * fontScale },
                ]}
              >
                Packet Delivery
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  isDark && styles.headerSubtitleDark,
                ]}
              >
                Packet & Phone Deliveries
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadPacketOrders();
              setRefreshing(false);
            }}
          />
        }
      >
        {orders.map((order) => {
          // compute per-order derived values used in the JSX below
          const stage = deriveStage(order);
          const statusColor = STATUS_COLORS[stage] || "#9CA3AF";
          const isAssignedToMe =
            !!order.driver_id &&
            user?.id &&
            Number(order.driver_id) === Number(user.id);
          const isExpanded = expandedIds.includes(order.id);
          const items = itemsByOrder[order.id] || [];
          const itemsLoaded =
            !itemsLoading[order.id] && (items || []).length > 0;
          // Compute items total (base + extras) so we can show a frontend-corrected total
          const computedItemsTotal = itemsLoaded
            ? items.reduce((sum, item) => {
                const base =
                  Number(item.price || 0) * Number(item.quantity || 1);
                const extrasPerUnit = Array.isArray(item.extras)
                  ? item.extras.reduce((s, e) => {
                      const unit = Number(e?.price ?? e?.extraPrice ?? 0) || 0;
                      const qty = Number(e?.quantity ?? 1) || 1;
                      return s + unit * qty;
                    }, 0)
                  : 0;
                const extrasTotal = extrasPerUnit * Number(item.quantity || 1);
                return sum + base + extrasTotal;
              }, 0)
            : 0;
          // If items are loaded and computedItemsTotal differs from backend order.total, prefer computed value so extras are visible
          const displayedTotal =
            itemsLoaded &&
            Math.abs(Number(order.total || 0) - computedItemsTotal) > 0.009
              ? computedItemsTotal
              : Number(order.total || 0);
          const orderAddress = resolveCustomerAddress(order);

          const offerDeadline = offerDeadlines[order.id];
          const offerActive =
            !order.driver_id &&
            offerDeadline != null &&
            !rejectedOffers[order.id] &&
            nowMs < offerDeadline;
          const offerExpired =
            !order.driver_id &&
            offerDeadline != null &&
            !rejectedOffers[order.id] &&
            nowMs >= offerDeadline;
          const remainingSeconds = offerDeadline
            ? Math.max(0, Math.ceil((offerDeadline - nowMs) / 1000))
            : 0;

          return (
            <View
              key={order.id}
              style={[
                styles.orderCard,
                isDark && styles.orderCardDark,
                { borderLeftColor: statusColor },
                stage === "preparing" &&
                  (isDark ? styles.cardPreparingDark : styles.cardPreparing),
                stage === "on_road" &&
                  (isDark ? styles.cardOnRoadDark : styles.cardOnRoad),
                stage === "delivered" &&
                  (isDark ? styles.cardDeliveredDark : styles.cardDelivered),
                stage === "closed" &&
                  (isDark ? styles.cardClosedDark : styles.cardClosed),
              ]}
            >
              {/* HEADER — TAP TO EXPAND */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleExpand(order.id)}
              >
                <View style={styles.headerBlock}>
                  {/* LINE 1: #ID • PLATFORM */}
                  <View style={styles.headerTopLineRow}>
                    <Text
                      style={[
                        styles.orderId,
                        isDark && styles.orderIdDark,
                        highContrast && styles.orderIdHighContrast,
                      ]}
                      numberOfLines={1}
                    >
                      #{order.id} • {getPlatformLabel(order)}
                    </Text>
                  </View>

                  {/* LINE 2: TIME • CUSTOMER */}
                  <View style={styles.headerSecondLineRow}>
                    <Text
                      style={[styles.metaText, isDark && styles.metaTextDark]}
                      numberOfLines={1}
                    >
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>

                    <Text style={styles.metaSeparator}>•</Text>

                    <Text
                      style={[
                        styles.customerName,
                        isDark && styles.orderIdDark,
                      ]}
                      numberOfLines={1}
                    >
                      {order.customer_name || "Customer"}
                    </Text>
                  </View>

                  {/* LINE 3: ADDRESS */}
                  {orderAddress && (
                    <View
                      style={[
                        styles.addressHighlightBox,
                        isDark && styles.addressHighlightBoxDark,
                      ]}
                    >
                      <Text
                        style={[
                          styles.addressHighlightText,
                          isDark && styles.addressHighlightTextDark,
                        ]}
                        numberOfLines={3}
                      >
                        📍 {orderAddress}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* STATUS ROW (DOT + STAGE + ETA) */}
              {(() => {
                const info = getKitchenInfo(order);
                const label = STATUS_LABELS[stage] || "Status";
                return (
                  <View style={styles.statusRow}>
                    <View style={styles.statusLeft}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: statusColor },
                        ]}
                      />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {label}
                      </Text>
                    </View>
                    {info?.eta && (
                      <Text style={styles.statusEtaText}>ETA: {info.eta}</Text>
                    )}
                  </View>
                );
              })()}

              {/* ACTION ROW: CALL + MAP (SAME SIZE BUTTONS) */}
              <View style={styles.actionsRow}>
                {/* CALL CUSTOMER */}
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: order.customer_phone
                        ? "#16A34A"
                        : "#9CA3AF",
                    },
                  ]}
                  disabled={!order.customer_phone}
                  onPress={() => {
                    if (!order.customer_phone) return;
                    const cleaned = String(order.customer_phone).replace(
                      /\s+/g,
                      ""
                    );
                    Linking.openURL(`tel:${cleaned}`);
                  }}
                >
                  <Text style={styles.actionButtonText}>
                    {t("Call Customer")}
                  </Text>
                </TouchableOpacity>

                {/* OPEN MAP */}
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: "#2563EB" }]}
                  onPress={async () => {
                    let lat = order.delivery_lat;
                    let lng = order.delivery_lng;

                    if (!lat || !lng) {
                      const geo = await autoGeocodeOrder(order);
                      if (!geo) {
                        alert(t("Unable to determine delivery location"));
                        return;
                      }
                      lat = geo.lat;
                      lng = geo.lng;
                    }

                    openMapForOrder(order, lat ?? undefined, lng ?? undefined);
                  }}
                >
                  <Text style={styles.actionButtonText}>{t("Open Map")}</Text>
                </TouchableOpacity>
              </View>

              {/* PRIMARY STATUS BUTTON (ONE BIG BUTTON) */}
              <View style={styles.primaryStatusRow}>
                <SmartStatusButton order={order} />
              </View>

              {/* PAYMENT SECTION */}
              <View style={styles.paymentSection}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  {/* Payment Method Dropdown */}
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TouchableOpacity
                      style={[
                        styles.paymentDropdownButton,
                        paymentDropdownOpen === order.id &&
                          styles.paymentDropdownButtonActive,
                      ]}
                      onPress={() =>
                        setPaymentDropdownOpen(
                          paymentDropdownOpen === order.id ? null : order.id
                        )
                      }
                      disabled={!isAssignedToMe || paymentLoading}
                    >
                      <Text style={styles.paymentDropdownLabel}>
                        {paymentMethods.find(
                          (m) =>
                            m.id.toLowerCase() ===
                            (order.payment_method || "").toLowerCase()
                        )?.label || t("Select Payment")}
                      </Text>
                      <Ionicons
                        name={
                          paymentDropdownOpen === order.id
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={18}
                        color="#4F46E5"
                      />
                    </TouchableOpacity>

                    {/* Dropdown Menu */}
                    {paymentDropdownOpen === order.id && isAssignedToMe && (
                      <View style={styles.paymentDropdownMenu}>
                        {paymentMethods.map((method) => (
                          <TouchableOpacity
                            key={method.id}
                            style={styles.paymentDropdownItem}
                            onPress={() => {
                              updatePaymentMethod(order, method.id);
                              setPaymentDropdownOpen(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.paymentDropdownItemText,
                                (order.payment_method || "").toLowerCase() ===
                                  method.id.toLowerCase() &&
                                  styles.paymentDropdownItemTextActive,
                              ]}
                            >
                              {method.icon && `${method.icon} `}
                              {method.label}
                            </Text>
                            {(order.payment_method || "").toLowerCase() ===
                              method.id.toLowerCase() && (
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color="#4F46E5"
                              />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Total Price Display */}
                  <View
                    style={[
                      styles.totalContainer,
                      isDark && styles.totalContainerDark,
                      highContrast && styles.totalContainerHighContrast,
                      stage === "preparing" &&
                        (isDark
                          ? styles.totalPreparingDark
                          : styles.totalPreparing),
                      stage === "on_road" &&
                        (isDark ? styles.totalOnRoadDark : styles.totalOnRoad),
                      stage === "delivered" &&
                        (isDark
                          ? styles.totalDeliveredDark
                          : styles.totalDelivered),
                      stage === "closed" &&
                        (isDark ? styles.totalClosedDark : styles.totalClosed),
                    ]}
                  >
                    <Text
                      style={[
                        styles.total,
                        isDark && styles.totalDark,
                        highContrast && styles.totalHighContrast,
                      ]}
                    >
                      {formatCurrency(displayedTotal)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* EXPANDABLE ARROW INDICATOR */}
              <TouchableOpacity
                style={styles.expandArrowContainer}
                onPress={() => toggleExpand(order.id)}
              >
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={isDark ? "#D1D5DB" : "#6B7280"}
                />
              </TouchableOpacity>

              {/* OFFER / ACCEPT / REJECT */}
              <View style={{ marginTop: 10 }}>
                {!order.driver_id && offerActive && (
                  <View style={styles.offerContainer}>
                    <View style={styles.offerInfoRow}>
                      <Text style={styles.offerTitle}>
                        {t("🚖 New delivery request")}
                      </Text>
                      <View style={styles.offerTimerBubble}>
                        <Text style={styles.offerTimerText}>
                          {remainingSeconds}s
                        </Text>
                      </View>
                    </View>

                    <View style={styles.offerButtonsRow}>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() =>
                          setRejectedOffers((prev) => ({
                            ...prev,
                            [order.id]: true,
                          }))
                        }
                      >
                        <Text style={styles.rejectButtonText}>
                          {t("Reject")}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.takeOrderButton}
                        onPress={() => handleTakeOrder(order)}
                      >
                        <Text style={styles.takeOrderButtonText}>
                          {t("Accept")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {!order.driver_id && offerExpired && (
                  <Text style={styles.offerExpiredText}>
                    {t("Offer expired")}
                  </Text>
                )}
              </View>

              {/* EXPANDED BODY */}
              {isExpanded && (
                <View style={styles.orderBody}>
                  {/* KITCHEN STATUS BUBBLE (OPTIONAL DUPLICATE, BUT NICE) */}
                  {(() => {
                    const info = getKitchenInfo(order);
                    if (!info) return null;
                    return (
                      <View style={styles.kitchenRow}>
                        <Text style={styles.kitchenStatusText}>
                          {info.label}
                        </Text>
                        {info.eta && (
                          <Text style={styles.kitchenEtaText}>{info.eta}</Text>
                        )}
                      </View>
                    );
                  })()}

                  {/* ITEMS */}
                  {itemsLoading[order.id] ? (
                    <View style={styles.itemsLoadingRow}>
                      <ActivityIndicator size="small" color="#4F46E5" />
                      <Text style={styles.itemsLoadingText}>
                        {t("Loading items...")}
                      </Text>
                    </View>
                  ) : (
                    items.length > 0 && (
                      <View style={styles.itemsBlock}>
                        <Text
                          style={[
                            styles.sectionLabel,
                            isDark && styles.sectionLabelDark,
                          ]}
                        >
                          {t("📦 Items")}
                        </Text>
                        {items.map((item, idx) => {
                          const name =
                            item.order_item_name ||
                            item.product_name ||
                            item.external_product_name ||
                            "Item";
                          const baseLineTotal =
                            Number(item.price || 0) *
                            Number(item.quantity || 1);
                          // Extras price per single product unit
                          const extrasPricePerUnit = Array.isArray(item.extras)
                            ? item.extras.reduce((sum, e) => {
                                const unit =
                                  parseFloat(
                                    String(e?.price ?? e?.extraPrice ?? 0)
                                  ) || 0;
                                const qty = Number(e?.quantity ?? 1) || 1;
                                return sum + unit * qty;
                              }, 0)
                            : 0;
                          const extrasTotal =
                            extrasPricePerUnit * Number(item.quantity || 1);
                          const lineTotal = baseLineTotal + extrasTotal;

                          return (
                            <View key={idx} style={styles.itemRowBlock}>
                              <View style={styles.itemRow}>
                                <Text
                                  style={[
                                    styles.itemName,
                                    isDark && styles.itemNameDark,
                                  ]}
                                >
                                  {item.quantity}× {name}
                                </Text>
                                <Text
                                  style={[
                                    styles.itemPrice,
                                    isDark && styles.itemPriceDark,
                                  ]}
                                >
                                  {formatCurrency(lineTotal)}
                                </Text>
                              </View>

                              {/* EXTRAS */}
                              {Array.isArray(item.extras) &&
                                item.extras.length > 0 && (
                                  <View style={styles.extrasBlock}>
                                    {item.extras.map((extra, i) => {
                                      const unitPrice =
                                        parseFloat(
                                          String(
                                            extra?.price ??
                                              extra?.extraPrice ??
                                              0
                                          )
                                        ) || 0;
                                      const extraQtyPerUnit =
                                        Number(extra?.quantity ?? 1) || 1;
                                      const perItemExtra =
                                        unitPrice * extraQtyPerUnit;
                                      const totalExtraForItem =
                                        perItemExtra *
                                        (Number(item.quantity) || 1);
                                      return (
                                        <Text
                                          key={i}
                                          style={[
                                            styles.extraText,
                                            isDark && styles.extraTextDark,
                                          ]}
                                        >
                                          • {extra.name}{" "}
                                          {extraQtyPerUnit > 1
                                            ? `×${extraQtyPerUnit}`
                                            : ""}{" "}
                                          {Number(item.quantity) &&
                                          Number(item.quantity) > 1
                                            ? ` — ₺${perItemExtra.toFixed(2)} ×${Number(item.quantity)} = ₺${totalExtraForItem.toFixed(2)}`
                                            : ` — ₺${perItemExtra.toFixed(2)}`}
                                        </Text>
                                      );
                                    })}
                                  </View>
                                )}

                              {/* NOTE */}
                              {item.note && (
                                <Text
                                  style={[
                                    styles.noteText,
                                    isDark && styles.noteTextDark,
                                  ]}
                                >
                                  Note: {item.note}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )
                  )}
                </View>
              )}
            </View>
          );
        })}

        {orders.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <Ionicons
              name="cube-outline"
              size={64}
              color={isDark ? "#6B7280" : "#D1D5DB"}
            />
            <Text
              style={[
                styles.emptyStateText,
                isDark && styles.emptyStateTextDark,
              ]}
            >
              {t("No orders yet")}
            </Text>
            <Text
              style={[
                styles.emptyStateSubtext,
                isDark && styles.emptyStateSubtextDark,
              ]}
            >
              {t("Packet & phone deliveries will appear here")}
            </Text>
          </View>
        )}
      </ScrollView>

      {orders.filter((o) => o.driver_id === Number(user?.id)).length >= 2 && (
        <View style={{ padding: 16 }}>
          <TouchableOpacity
            onPress={optimizeMultiRoute}
            style={styles.optimizeRouteButton}
          >
            <Text style={styles.optimizeRouteButtonText}>
              {t("Optimize Route (2+ orders)")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 🗺️ MAP MODAL - UBER STYLE BOTTOM SHEET */}
      {(mapModalOrder || mapModalRoute) && (
        <MapModal
          ref={mapModalRef}
          visible={mapModalVisible}
          onDismiss={() => {
            setMapModalVisible(false);
            setMapModalOrder(null);
            setMapModalRoute(null);
          }}
          orderId={mapModalOrder?.id}
          driverId={user?.id}
          deliveryLat={mapModalOrder?.delivery_lat || 0}
          deliveryLng={mapModalOrder?.delivery_lng || 0}
          deliveryAddress={
            mapModalOrder ? resolveCustomerAddress(mapModalOrder) : undefined
          }
          pickupLat={mapModalOrder?.pos_location_lat ?? undefined}
          pickupLng={mapModalOrder?.pos_location_lng ?? undefined}
          pickupAddress={
            mapModalOrder
              ? mapModalOrder.pos_location ||
                mapModalOrder.customer_address ||
                resolveCustomerAddress(mapModalOrder)
              : undefined
          }
          driverName={user?.name}
          orderDriverStatus={mapModalOrder?.driver_status}
          multiStopMode={Boolean(mapModalRoute)}
          route={mapModalRoute ?? undefined}
          onOrderDelivered={(deliveredOrderId: number) => {
            // After swipe delivery, call the backend to update driver_status to "delivered"
            // This uses the same endpoint as the "Mark Delivered" button
            (async () => {
              try {
                await secureFetch(`/orders/${deliveredOrderId}/driver-status`, {
                  method: "PATCH",
                  body: JSON.stringify({ driver_status: "delivered" }),
                });
                console.log(
                  `✅ Updated driver_status to delivered for order ${deliveredOrderId}`
                );
              } catch (err) {
                console.error(
                  `❌ Failed to update driver_status for order ${deliveredOrderId}:`,
                  err
                );
              }

              // Update local state to reflect the change immediately
              setOrders((prev) => {
                const updated = prev.map((o) =>
                  o.id === deliveredOrderId
                    ? { ...o, driver_status: "delivered", status: "delivered" }
                    : o
                );
                return updated;
              });

              // Also update mapModalOrder to force re-render
              if (mapModalOrder?.id === deliveredOrderId) {
                setMapModalOrder({
                  ...mapModalOrder,
                  driver_status: "delivered",
                  status: "delivered",
                });
              }

              // If a multi-stop route is open, mark matching stops as completed in the route
              if (mapModalRoute) {
                setMapModalRoute((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    stops: prev.stops.map((s) =>
                      s.orderId === deliveredOrderId
                        ? { ...s, status: "completed" }
                        : s
                    ),
                  } as RouteInfo;
                });
              }
            })();
          }}
        />
      )}

      {hasPermission("orders") && <BottomNav />}
    </View>
  );
}

/* ------------------------------------------------------------
   Styles — Packet / Phone Orders (Mobile-friendly)
------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F5F7" },
  containerDark: { backgroundColor: "#020617" },
  containerHighContrast: { backgroundColor: "#000000" },

  header: {
    paddingTop: 60,
    paddingBottom: 22,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderColor: "#1F2937",
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTitleArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  headerTitle: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerTitleDark: { color: "#F9FAFB" },
  headerSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },
  headerSubtitleDark: { color: "#9CA3AF" },

  content: { padding: 16, paddingBottom: 160 },

  empty: {
    marginTop: 40,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 15,
  },
  emptyDark: { color: "#9CA3AF" },
  emptyHighContrast: { color: "#FFFFFF", fontWeight: "700" },

  loadingRow: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#6B7280",
  },

  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  orderCardDark: {
    backgroundColor: "#020617",
    borderColor: "#374151",
  },

  // Status-based card backgrounds (Light mode)
  cardPreparing: {
    backgroundColor: "#FFF8DC",
    borderColor: "#FFD700",
  },
  cardOnRoad: {
    backgroundColor: "#E0F2FE",
    borderColor: "#0EA5E9",
  },
  cardDelivered: {
    backgroundColor: "#DCFCE7",
    borderColor: "#22C55E",
  },
  cardClosed: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },

  // Status-based card backgrounds (Dark mode)
  cardPreparingDark: {
    backgroundColor: "#663C00",
    borderColor: "#FFA500",
  },
  cardOnRoadDark: {
    backgroundColor: "#164863",
    borderColor: "#3B82F6",
  },
  cardDeliveredDark: {
    backgroundColor: "#0D3F1F",
    borderColor: "#22C55E",
  },
  cardClosedDark: {
    backgroundColor: "#1F2937",
    borderColor: "#6B7280",
  },

  headerBlock: {
    marginBottom: 6,
  },

  headerTopLineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerSecondLineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  headerAddressRow: {
    marginTop: 4,
  },

  orderHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  orderHeaderRight: {
    alignItems: "flex-end",
  },

  orderId: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  orderIdDark: { color: "#E5E7EB" },
  orderIdHighContrast: { color: "#FFFFFF" },

  customerName: {
    fontSize: 13,
    marginLeft: 4,
    color: "#374151",
    fontWeight: "500",
  },

  addressText: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280",
  },
  addressTextDark: {
    color: "#9CA3AF",
  },

  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  metaTextDark: {
    color: "#9CA3AF",
  },
  metaSeparator: {
    marginHorizontal: 3,
    fontSize: 11,
    color: "#D1D5DB",
  },

  total: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
  },
  totalDark: { color: "#000000" },
  totalHighContrast: { color: "#FFFFFF" },

  totalContainer: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  totalContainerDark: {
    backgroundColor: "#374151",
  },
  totalContainerHighContrast: {
    backgroundColor: "#1F2937",
  },

  // Status-based total container (Light mode)
  totalPreparing: {
    backgroundColor: "#FFE8B3",
    borderColor: "#FFD700",
  },
  totalOnRoad: {
    backgroundColor: "#B3E5FC",
    borderColor: "#0EA5E9",
  },
  totalDelivered: {
    backgroundColor: "#C8E6C9",
    borderColor: "#22C55E",
  },
  totalClosed: {
    backgroundColor: "#E0E0E0",
    borderColor: "#9CA3AF",
  },

  // Status-based total container (Dark mode)
  totalPreparingDark: {
    backgroundColor: "#8B5A00",
    borderColor: "#FFA500",
  },
  totalOnRoadDark: {
    backgroundColor: "#1565C0",
    borderColor: "#3B82F6",
  },
  totalDeliveredDark: {
    backgroundColor: "#1B5E20",
    borderColor: "#22C55E",
  },
  totalClosedDark: {
    backgroundColor: "#424242",
    borderColor: "#6B7280",
  },

  statusBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  paymentText: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
  },
  paymentTextDark: {
    color: "#D1D5DB",
  },

  driverText: {
    marginTop: 4,
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "600",
  },

  expandArrowContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    marginTop: 4,
  },

  orderBody: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
  },

  /* STATUS ROW + ACTIONS */

  statusRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusEtaText: {
    fontSize: 11,
    color: "#6B7280",
  },

  actionsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  primaryStatusRow: {
    marginTop: 8,
  },

  /* KITCHEN */

  kitchenRow: {
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kitchenStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4F46E5",
  },
  kitchenEtaText: {
    fontSize: 12,
    color: "#4B5563",
  },

  /* OFFER */

  offerContainer: {
    flex: 1,
    borderRadius: 12,
    padding: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  offerInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  offerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  offerTimerBubble: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  offerTimerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  offerButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  rejectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DC2626",
    marginRight: 6,
  },
  rejectButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626",
  },
  offerExpiredText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
    marginTop: 6,
  },

  /* ITEMS */

  itemsLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  itemsLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#6B7280",
  },

  itemsBlock: {
    marginBottom: 12,
  },
  itemRowBlock: {
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  itemName: {
    fontSize: 14,
    color: "#111827",
  },
  itemNameDark: {
    color: "#E5E7EB",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  itemPriceDark: {
    color: "#60A5FA",
  },
  extrasBlock: {
    marginLeft: 4,
    marginBottom: 2,
  },
  extraText: {
    fontSize: 12,
    color: "#6B7280",
  },
  extraTextDark: {
    color: "#9CA3AF",
  },
  noteText: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 4,
  },
  noteTextDark: {
    color: "#D1D5DB",
  },

  /* ADDRESS */

  addressBlock: {
    marginTop: 10,
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 13,
    color: "#111827",
  },

  /* SECTIONS / PAYMENT */

  actionsSection: {
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  sectionLabelDark: {
    color: "#E5E7EB",
  },

  paymentSection: {
    marginTop: 10,
  },
  paymentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  paymentRow: {
    marginBottom: 10,
  },
  paymentChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  paymentChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentChipActive: {
    backgroundColor: "#4F46E5",
  },
  paymentChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  paymentChipTextActive: {
    color: "#FFFFFF",
  },

  paymentDropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  paymentDropdownButtonActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#4F46E5",
  },
  paymentDropdownLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  paymentDropdownMenu: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  paymentDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  paymentDropdownItemText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    flex: 1,
  },
  paymentDropdownItemTextActive: {
    fontWeight: "700",
    color: "#4F46E5",
  },

  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },

  takeOrderButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
  },
  takeOrderButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },

  statusChipsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusChipActive: {
    backgroundColor: "#EEF2FF",
  },
  statusChipText: {
    fontSize: 11,
    color: "#4B5563",
  },
  statusChipTextActive: {
    fontWeight: "600",
    color: "#111827",
  },

  actionDisabled: {
    opacity: 0.6,
  },

  mapButton: {
    marginTop: 6,
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  mapButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },

  statusStepperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
  },

  bigButton: {
    marginTop: 16,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  bigButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },

  bigStatusButton: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  bigStatusButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  sharedActionButton: {
    width: "100%",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  sharedActionButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  optimizeRouteButton: {
    backgroundColor: "#4F46E5",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  optimizeRouteButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  addressHighlightBox: {
    marginTop: 4,
    backgroundColor: "#FEF3C7",
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  addressHighlightBoxDark: {
    backgroundColor: "#1E293B",
    borderLeftColor: "#60A5FA",
  },
  addressHighlightText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
    lineHeight: 18,
  },
  addressHighlightTextDark: {
    color: "#E0E7FF",
  },

  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
  },
  emptyStateTextDark: {
    color: "#9CA3AF",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
  },
  emptyStateSubtextDark: {
    color: "#6B7280",
  },
});
