import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  FlatList,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import { Asset } from "expo-asset";
import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import { useAppearance } from "../../src/context/AppearanceContext";
import secureFetch from "../../src/api/secureFetch";
import { useAuth } from "../../src/context/AuthContext";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { logger } from "../../src/utils/logger";

// ============================================================================
// SOUND ASSETS
// ============================================================================

const SOUND_ASSETS: Record<string, any> = {
  "new_order.mp3": require("../../assets/sounds/new_order.mp3"),
  "alert.mp3": require("../../assets/sounds/alert.mp3"),
  "chime.mp3": require("../../assets/sounds/chime.mp3"),
  "alarm.mp3": require("../../assets/sounds/alarm.mp3"),
  "cash.mp3": require("../../assets/sounds/cash.mp3"),
  "success.mp3": require("../../assets/sounds/success.mp3"),
  "horn.mp3": require("../../assets/sounds/horn.mp3"),
  "warning.mp3": require("../../assets/sounds/warning.mp3"),
  "yemeksepeti.mp3": require("../../assets/sounds/yemeksepeti.mp3"),
};

// ============================================================================
// TYPES
// ============================================================================

type NotificationEventType =
  | "order_confirmed"
  | "order_preparing"
  | "order_ready"
  | "order_delivered"
  | "driver_assigned"
  | "payment_made"
  | "stock_critical"
  | "stock_restocked"
  | "orders_updated";

interface NotificationItem {
  id: string;
  type: NotificationEventType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, any>;
  icon: string;
  color: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const expoConfig = Constants.expoConfig ?? (Constants as any).manifest;
const API_BASE_URL =
  expoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://hurrypos-backend.onrender.com/api";

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const NOTIFICATION_CONFIG: Record<
  NotificationEventType,
  { icon: string; color: string; bgColor: string }
> = {
  order_confirmed: {
    icon: "checkmark-circle",
    color: "#22C55E",
    bgColor: "#ECFDF5",
  },
  order_preparing: {
    icon: "hourglass",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
  },
  order_ready: {
    icon: "alert-circle",
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
  },
  order_delivered: {
    icon: "checkmark-done-circle",
    color: "#0EA5E9",
    bgColor: "#F0F9FF",
  },
  driver_assigned: {
    icon: "car",
    color: "#EC4899",
    bgColor: "#FDF2F8",
  },
  payment_made: {
    icon: "card",
    color: "#10B981",
    bgColor: "#ECFDF5",
  },
  stock_critical: {
    icon: "warning",
    color: "#EF4444",
    bgColor: "#FEF2F2",
  },
  stock_restocked: {
    icon: "basket",
    color: "#14B8A6",
    bgColor: "#F0FDFA",
  },
  orders_updated: {
    icon: "refresh",
    color: "#6B7280",
    bgColor: "#F9FAFB",
  },
};

const EVENT_SOUND_ALIASES: Record<string, string[]> = {
  order_confirmed: ["order_confirmed", "new_order"],
  order_preparing: ["order_preparing"],
  order_ready: ["order_ready"],
  order_delivered: ["order_delivered"],
  driver_assigned: ["driver_assigned", "driver_arrived"],
  payment_made: ["payment_made"],
  stock_critical: ["stock_critical", "stock_low"],
  stock_restocked: ["stock_restocked"],
  orders_updated: ["orders_updated"],
};

const resolveSoundFile = (
  eventType: string,
  eventSounds?: Record<string, string>,
  defaultSound?: string
): string | null => {
  const candidates = EVENT_SOUND_ALIASES[eventType] ?? [eventType];

  for (const key of candidates) {
    const candidate = eventSounds?.[key];
    if (candidate && candidate !== "none") {
      return candidate;
    }
  }

  if (defaultSound && defaultSound !== "none") {
    return defaultSound;
  }

  return null;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NotificationsScreen() {
  const router = useRouter();
  const { appearance, isDark, fontScale } = useAppearance();
  const { user } = useAuth();
  const { t } = useTranslation();
  // Try multiple possible field names for restaurantId
  const restaurantId =
    user?.restaurantId ||
    user?.restaurant_id ||
    user?.tenantId ||
    user?.tenant_id;

  // State Management
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioRefs = useRef<Record<string, Audio.Sound>>({});
  const cachedAssets = useRef<Record<string, string>>({});
  const playNotificationSoundRef = useRef<
    ((eventType: string) => Promise<void>) | undefined
  >(undefined);

  // =========================================================================
  // INITIALIZE AUDIO SESSION (CRITICAL FOR SOUND PLAYBACK)
  // =========================================================================

  useEffect(() => {
    const setupAudioSession = async () => {
      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
      } catch (err) {
        console.warn("⚠️ Failed to initialize audio session:", err);
      }
    };

    setupAudioSession();
  }, []);

  // =========================================================================
  // LOAD NOTIFICATION SETTINGS
  // =========================================================================

  const loadNotificationSettings = useCallback(async () => {
    try {
      const settings = await secureFetch("/settings/notifications");
      setNotificationSettings(settings);
    } catch (err) {
      logger.warn("Failed to load notification settings:", err);
    }
  }, []);

  // =========================================================================
  // PLAY NOTIFICATION SOUND
  // =========================================================================

  const getSoundUri = useCallback(
    async (soundFile: string): Promise<string | null> => {
      if (!soundFile || soundFile === "none") return null;

      // Return cached URI if available
      if (cachedAssets.current[soundFile]) {
        return cachedAssets.current[soundFile];
      }

      try {
        const asset = SOUND_ASSETS[soundFile];
        if (!asset) {
          console.warn(`⚠️ Sound file not found in assets: ${soundFile}`);
          return null;
        }

        const assetModule = await Asset.fromModule(asset).downloadAsync();
        cachedAssets.current[soundFile] = assetModule.uri;
        return assetModule.uri;
      } catch (err) {
        console.warn(`⚠️ Failed to load sound asset ${soundFile}:`, err);
        return null;
      }
    },
    []
  );

  const playNotificationSound = useCallback(
    async (eventType: string) => {
      // Use default settings if not loaded yet
      const settings = notificationSettings || {
        enabled: true,
        enableSounds: true,
        defaultSound: "chime.mp3",
        volume: 0.8,
        eventSounds: {
          order_confirmed: "new_order.mp3",
          new_order: "new_order.mp3",
          order_preparing: "alert.mp3",
          order_ready: "chime.mp3",
          order_delivered: "success.mp3",
          payment_made: "cash.mp3",
          stock_critical: "warning.mp3",
          stock_low: "warning.mp3",
          stock_restocked: "alert.mp3",
          stock_expiry: "alarm.mp3",
          order_delayed: "alarm.mp3",
          driver_arrived: "horn.mp3",
          driver_assigned: "horn.mp3",
          yemeksepeti_order: "yemeksepeti.mp3",
          orders_updated: "alert.mp3",
        },
      };

      const notificationsEnabled = settings?.enabled !== false;
      const soundsEnabled = settings?.enableSounds !== false;

      if (!notificationsEnabled || !soundsEnabled) {
        return;
      }

      try {
        const soundFile = resolveSoundFile(
          eventType,
          settings.eventSounds,
          settings.defaultSound
        );

        if (!soundFile || soundFile === "none") {
          return;
        }

        // Stop previous sound if playing
        const existingSound = audioRefs.current[eventType];
        if (existingSound) {
          try {
            await existingSound.stopAsync();
            await existingSound.unloadAsync();
          } catch (e) {
            // Already unloaded
          }
        }

        const soundUri = await getSoundUri(soundFile);
        if (!soundUri) {
          console.warn(`⚠️ Could not load sound URI for: ${soundFile}`);
          return;
        }

        const { sound } = await Audio.Sound.createAsync({
          uri: soundUri,
        });

        audioRefs.current[eventType] = sound;
        const volume = settings.volume || 0.8;
        await sound.setVolumeAsync(volume);
        await sound.playAsync();
      } catch (err) {
        logger.warn(`Failed to play sound for ${eventType}:`, err);
      }
    },
    [notificationSettings, getSoundUri]
  );

  // Update ref whenever playNotificationSound changes
  useEffect(() => {
    console.log("📍 Updating playNotificationSoundRef with new function");
    playNotificationSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  // =========================================================================
  // LOAD NOTIFICATIONS FROM API
  // =========================================================================

  const loadNotifications = useCallback(async () => {
    if (!restaurantId) return;

    try {
      const data = await secureFetch("/notifications");
      const notifList: NotificationItem[] = Array.isArray(data)
        ? data.map((n: any, idx: number) => {
            const notifType: NotificationEventType =
              n.type && n.type in NOTIFICATION_CONFIG
                ? n.type
                : "orders_updated";
            return {
              id: n.id || `${n.type}-${idx}-${Date.now()}`,
              type: notifType,
              title: n.title || t(n.type || "Notification"),
              message: n.message || "",
              timestamp: n.timestamp || Date.now(),
              read: n.read || false,
              data: n.data || {},
              icon: NOTIFICATION_CONFIG[notifType].icon,
              color: NOTIFICATION_CONFIG[notifType].color,
            };
          })
        : [];

      setNotifications(notifList);
    } catch (err) {
      logger.warn("Failed to load notifications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId, t]);

  // =========================================================================
  // INITIALIZE SOCKET CONNECTION
  // =========================================================================

  useEffect(() => {
    if (!restaurantId) return;

    // Initialize socket
    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { restaurantId },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      logger.log("Notifications socket connected:", socket.id);
      socket.emit("join_restaurant", restaurantId);
      loadNotificationSettings();
    });

    // =====================================================================
    // NOTIFICATION EVENT HANDLERS
    // =====================================================================

    const handleOrderConfirmed = (data: any) => {
      const notification: NotificationItem = {
        id: `order_confirmed_${data.orderId || Date.now()}`,
        type: "order_confirmed",
        title: t("Order Confirmed"),
        message: `Order #${data.orderId} has been confirmed. Amount: ${data.amount || "N/A"}`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.order_confirmed.icon,
        color: NOTIFICATION_CONFIG.order_confirmed.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      playNotificationSoundRef.current?.("order_confirmed");
    };

    const handleOrderPreparing = (data: any) => {
      const notification: NotificationItem = {
        id: `order_preparing_${data.orderId || Date.now()}`,
        type: "order_preparing",
        title: t("Order Preparing"),
        message: `Order #${data.orderId} is now being prepared. ETA: ${data.eta || "N/A"}`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.order_preparing.icon,
        color: NOTIFICATION_CONFIG.order_preparing.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      console.log(
        "🎵 About to play sound for order_preparing, ref:",
        !!playNotificationSoundRef.current
      );
      playNotificationSoundRef.current?.("order_preparing");
    };

    const handleOrderReady = (data: any) => {
      const notification: NotificationItem = {
        id: `order_ready_${data.orderId || Date.now()}`,
        type: "order_ready",
        title: t("Order Ready"),
        message: `Order #${data.orderId} is ready for pickup or delivery!`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.order_ready.icon,
        color: NOTIFICATION_CONFIG.order_ready.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      playNotificationSoundRef.current?.("order_ready");
    };

    const handleOrderDelivered = (data: any) => {
      const notification: NotificationItem = {
        id: `order_delivered_${data.orderId || Date.now()}`,
        type: "order_delivered",
        title: t("Order Delivered"),
        message: `Order #${data.orderId} has been successfully delivered!`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.order_delivered.icon,
        color: NOTIFICATION_CONFIG.order_delivered.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      playNotificationSoundRef.current?.("order_delivered");
    };

    const handleDriverAssigned = (data: any) => {
      const notification: NotificationItem = {
        id: `driver_assigned_${data.orderId || Date.now()}`,
        type: "driver_assigned",
        title: t("Driver Assigned"),
        message: `Driver ${data.driverName || "Unknown"} assigned to order #${data.orderId}`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.driver_assigned.icon,
        color: NOTIFICATION_CONFIG.driver_assigned.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      playNotificationSoundRef.current?.("driver_assigned");
    };

    const handlePaymentMade = (data: any) => {
      const notification: NotificationItem = {
        id: `payment_made_${data.orderId || Date.now()}`,
        type: "payment_made",
        title: t("Payment Received"),
        message: `Payment of ${data.amount || "N/A"} received for order #${data.orderId}`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.payment_made.icon,
        color: NOTIFICATION_CONFIG.payment_made.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      playNotificationSoundRef.current?.("payment_made");
    };

    const handleStockCritical = (data: any) => {
      const notification: NotificationItem = {
        id: `stock_critical_${data.productId || Date.now()}`,
        type: "stock_critical",
        title: t("Low Stock Alert"),
        message: `Product "${data.productName}" stock is running low (${data.quantity} remaining)`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.stock_critical.icon,
        color: NOTIFICATION_CONFIG.stock_critical.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      playNotificationSoundRef.current?.("stock_critical");
    };

    const handleStockRestocked = (data: any) => {
      const notification: NotificationItem = {
        id: `stock_restocked_${data.productId || Date.now()}`,
        type: "stock_restocked",
        title: t("Stock Replenished"),
        message: `Product "${data.productName}" has been restocked (${data.quantity} units added)`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.stock_restocked.icon,
        color: NOTIFICATION_CONFIG.stock_restocked.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      playNotificationSoundRef.current?.("stock_restocked");
    };

    const handleOrdersUpdated = (data: any) => {
      const notification: NotificationItem = {
        id: `orders_updated_${Date.now()}`,
        type: "orders_updated",
        title: t("Orders Updated"),
        message: `${data.count || 1} order(s) have been updated`,
        timestamp: Date.now(),
        read: false,
        data,
        icon: NOTIFICATION_CONFIG.orders_updated.icon,
        color: NOTIFICATION_CONFIG.orders_updated.color,
      };
      setNotifications((prev) => [notification, ...prev]);
      playNotificationSoundRef.current?.("orders_updated");
    };

    // =====================================================================
    // REGISTER SOCKET EVENT LISTENERS
    // =====================================================================

    socket.on("order_confirmed", handleOrderConfirmed);
    socket.on("order_preparing", handleOrderPreparing);
    socket.on("order_ready", handleOrderReady);
    socket.on("order_delivered", handleOrderDelivered);
    socket.on("driver_assigned", handleDriverAssigned);
    socket.on("payment_made", handlePaymentMade);
    socket.on("stock_critical", handleStockCritical);
    socket.on("stock_restocked", handleStockRestocked);
    socket.on("orders_updated", handleOrdersUpdated);

    socket.on("disconnect", () => {
      console.log("📱 Notifications Socket disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("📱 Socket connection error:", err);
    });

    // Add a catch-all listener to see ALL socket events
    socket.onAny((event, ...args) => {
      console.log(`📡 [Socket Event] ${event}:`, args);
    });

    // =====================================================================
    // CLEANUP
    // =====================================================================

    return () => {
      socket.off("order_confirmed", handleOrderConfirmed);
      socket.off("order_preparing", handleOrderPreparing);
      socket.off("order_ready", handleOrderReady);
      socket.off("order_delivered", handleOrderDelivered);
      socket.off("driver_assigned", handleDriverAssigned);
      socket.off("payment_made", handlePaymentMade);
      socket.off("stock_critical", handleStockCritical);
      socket.off("stock_restocked", handleStockRestocked);
      socket.off("orders_updated", handleOrdersUpdated);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [restaurantId]);

  // =========================================================================
  // LOAD INITIAL NOTIFICATIONS
  // =========================================================================

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await secureFetch(`/notifications/${notificationId}/read`, {
        method: "PUT",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.log("❌ Mark as read error:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await secureFetch("/notifications/read-all", {
        method: "PUT",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.log("❌ Mark all as read error:", err);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await secureFetch(`/notifications/${notificationId}`, {
        method: "DELETE",
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.log("❌ Delete notification error:", err);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      t("Clear All Notifications"),
      t("Are you sure you want to clear all notifications?"),
      [
        {
          text: t("Cancel"),
          onPress: () => {},
          style: "cancel",
        },
        {
          text: t("Clear"),
          onPress: async () => {
            try {
              await secureFetch("/notifications/clear-all", {
                method: "DELETE",
              });
              setNotifications([]);
            } catch (err) {
              console.log("❌ Clear all error:", err);
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const handleNotificationPress = (notification: NotificationItem) => {
    handleMarkAsRead(notification.id);

    // Navigate based on notification type
    if (notification.data?.orderId) {
      router.push(`/orders/${notification.data.orderId}` as any);
    } else if (notification.data?.productId) {
      router.push(`/products`);
    }
  };

  // =========================================================================
  // FILTERED NOTIFICATIONS
  // =========================================================================

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  // =========================================================================
  // RENDER NOTIFICATION ITEM
  // =========================================================================

  const renderNotificationSeparator = () => (
    <View
      style={[
        styles.notificationSeparator,
        isDark && styles.notificationSeparatorDark,
      ]}
    />
  );

  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        isDark && styles.notificationItemDark,
        !item.read && (isDark ? styles.unreadDark : styles.unread),
      ]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: NOTIFICATION_CONFIG[item.type].bgColor },
        ]}
      >
        <Ionicons name={item.icon as any} size={24} color={item.color} />
      </View>

      <View style={styles.contentContainer}>
        <Text
          style={[
            styles.notificationTitle,
            isDark && styles.notificationTitleDark,
            !item.read && styles.notificationTitleBold,
          ]}
        >
          {item.title}
        </Text>
        <Text
          style={[
            styles.notificationMessage,
            isDark && styles.notificationMessageDark,
          ]}
          numberOfLines={2}
        >
          {item.message}
        </Text>
        <Text
          style={[
            styles.notificationTime,
            isDark && styles.notificationTimeDark,
          ]}
        >
          {formatTime(item.timestamp)}
        </Text>
      </View>

      <View style={styles.actionContainer}>
        {!item.read && <View style={styles.unreadDot} />}
        <TouchableOpacity
          onPress={() => handleDeleteNotification(item.id)}
          style={styles.deleteButton}
        >
          <Ionicons
            name="close"
            size={18}
            color={isDark ? "#9CA3AF" : "#6B7280"}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // =========================================================================
  // RENDER EMPTY STATE
  // =========================================================================

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="notifications-off"
        size={64}
        color={isDark ? "#4B5563" : "#D1D5DB"}
      />
      <Text
        style={[
          styles.emptyTitle,
          isDark && styles.emptyTitleDark,
          { fontSize: 18 * fontScale },
        ]}
      >
        {t("No Notifications")}
      </Text>
      <Text
        style={[
          styles.emptySubtitle,
          isDark && styles.emptySubtitleDark,
          { fontSize: 14 * fontScale },
        ]}
      >
        {filter === "unread"
          ? t("You're all caught up!")
          : t("Check back later for updates")}
      </Text>
    </View>
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerContent}>
          <Text
            style={[
              styles.headerTitle,
              isDark && styles.headerTitleDark,
              { fontSize: 26 * fontScale },
            ]}
          >
            {t("Notifications")}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}
        >
          {t("Stay updated with your restaurant")}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View
        style={[styles.filterContainer, isDark && styles.filterContainerDark]}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "all" && styles.filterTabActive,
            filter === "all" && (isDark ? styles.filterTabActiveDark : {}),
          ]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "all" && styles.filterTextActive,
              filter === "all" && (isDark ? styles.filterTextActiveDark : {}),
            ]}
          >
            {t("All")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "unread" && styles.filterTabActive,
            filter === "unread" && (isDark ? styles.filterTabActiveDark : {}),
          ]}
          onPress={() => setFilter("unread")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "unread" && styles.filterTextActive,
              filter === "unread" &&
                (isDark ? styles.filterTextActiveDark : {}),
            ]}
          >
            {t("Unread")} {unreadCount > 0 && `(${unreadCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notification List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={renderNotificationSeparator}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={isDark ? "#9CA3AF" : "#6B7280"}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Action Buttons */}
      {filteredNotifications.length > 0 && (
        <View style={[styles.actionBar, isDark && styles.actionBarDark]}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={handleMarkAllAsRead}
            >
              <Ionicons name="checkmark-done" size={18} color="white" />
              <Text style={styles.actionButtonText}>{t("Mark all read")}</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={handleClearAll}
            >
              <Ionicons
                name="trash"
                size={18}
                color={isDark ? "#EF4444" : "#DC2626"}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  { color: isDark ? "#EF4444" : "#DC2626" },
                ]}
              >
                {t("Clear All")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <BottomNav />
    </View>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  containerDark: {
    backgroundColor: "#020617",
  },
  header: {
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#020617",
    borderBottomColor: "#111827",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
  headerSubtitleDark: {
    color: "#9CA3AF",
  },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "white",
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  filterContainerDark: {
    backgroundColor: "#1F2937",
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: "#4f46e5",
  },
  filterTabActiveDark: {
    backgroundColor: "#6366F1",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterTextActive: {
    color: "white",
  },
  filterTextActiveDark: {
    color: "white",
  },
  listContent: {
    padding: 0,
    minHeight: "100%",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "white",
  },
  notificationSeparator: {
    height: 2,
    backgroundColor: "#F3F4F6",
    marginVertical: 0,
  },
  notificationSeparatorDark: {
    backgroundColor: "#111827",
  },
  notificationItemDark: {
    backgroundColor: "#1F2937",
  },
  unread: {
    backgroundColor: "#F0F9FF",
  },
  unreadDark: {
    backgroundColor: "#0C1929",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  notificationTitleDark: {
    color: "#F9FAFB",
  },
  notificationTitleBold: {
    fontWeight: "700",
  },
  notificationMessage: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
    lineHeight: 18,
  },
  notificationMessageDark: {
    color: "#9CA3AF",
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  notificationTimeDark: {
    color: "#6B7280",
  },
  actionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4f46e5",
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
  },
  emptyTitleDark: {
    color: "#F9FAFB",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  emptySubtitleDark: {
    color: "#9CA3AF",
  },
  actionBar: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  actionBarDark: {
    backgroundColor: "#1F2937",
    borderTopColor: "#111827",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonPrimary: {
    backgroundColor: "#4f46e5",
  },
  actionButtonSecondary: {
    backgroundColor: "#FEE2E2",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "white",
  },
});
