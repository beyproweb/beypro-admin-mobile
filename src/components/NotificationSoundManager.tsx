import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
  Platform,
} from "react-native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import Constants from "expo-constants";
import { io, Socket } from "socket.io-client";
import secureFetch from "../api/secureFetch";
import { useAuth } from "../context/AuthContext";
import {
  useNotificationSounds,
  NotificationSoundSettings,
} from "../hooks/useNotificationSounds";
import { logger } from "../utils/logger";

const expoConfig = Constants.expoConfig ?? (Constants as any).manifest;
const API_BASE_URL =
  expoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://hurrypos-backend.onrender.com/api";

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const DEFAULT_EVENT_SOUNDS: Record<string, string> = {
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
};

const buildSettings = (
  payload?: Partial<NotificationSoundSettings> | null
): NotificationSoundSettings => ({
  enabled: payload?.enabled !== false,
  enableSounds: payload?.enableSounds !== false,
  volume: typeof payload?.volume === "number" ? payload.volume : 0.8,
  defaultSound:
    payload?.defaultSound && payload.defaultSound !== "none"
      ? payload.defaultSound
      : "chime.mp3",
  eventSounds: {
    ...DEFAULT_EVENT_SOUNDS,
    ...(payload?.eventSounds ?? {}),
  },
});

const NotificationSoundManager = () => {
  const { user } = useAuth();
  // Try multiple possible field names for restaurantId
  const restaurantId =
    user?.restaurantId ||
    user?.restaurant_id ||
    user?.tenantId ||
    user?.tenant_id;
  const [settings, setSettings] = useState<NotificationSoundSettings | null>(
    null
  );
  const [socket, setSocket] = useState<Socket | null>(null);

  // =========================================================================
  // SETUP AUDIO SESSION (CRITICAL FOR SOUND PLAYBACK)
  // =========================================================================

  useEffect(() => {
    const setupAudioSession = async () => {
      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
        logger.log("Audio session configured successfully");
      } catch (err) {
        logger.warn("Failed to configure audio session:", err);
      }
    };

    if (Platform.OS !== "web") {
      setupAudioSession();
    }
  }, []);

  const loadSettings = useCallback(async () => {
    if (!restaurantId) {
      return;
    }

    try {
      const data = await secureFetch("/settings/notifications");
      setSettings(buildSettings(data));
      logger.log("Notification settings refreshed (manager)");
    } catch (err) {
      logger.warn("Failed to load notification settings (manager):", err);
      setSettings((prev) => prev ?? buildSettings());
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    loadSettings();
  }, [restaurantId, loadSettings]);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handler = () => loadSettings();
      if (typeof window !== "undefined") {
        window.addEventListener(
          "notification_settings_updated",
          handler as EventListener
        );
        return () => {
          window.removeEventListener(
            "notification_settings_updated",
            handler as EventListener
          );
        };
      }
      return;
    }

    const subscription = DeviceEventEmitter.addListener(
      "notification_settings_updated",
      (payload?: Partial<NotificationSoundSettings>) => {
        if (payload) {
          setSettings(buildSettings(payload));
        } else {
          loadSettings();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [loadSettings]);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        loadSettings();
      }
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppState
    );
    return () => appStateSubscription.remove();
  }, [restaurantId, loadSettings]);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    const socketInstance: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: { restaurantId },
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      logger.log("Notification sound socket connected", socketInstance.id);
      socketInstance.emit("join_restaurant", restaurantId);
      loadSettings();
    });

    socketInstance.on("disconnect", () => {
      logger.log("Notification sound socket disconnected");
    });

    socketInstance.on("connect_error", (error) => {
      logger.warn("Notification sound socket error:", error?.message || error);
    });

    return () => {
      socketInstance.disconnect();
      setSocket((current) => (current === socketInstance ? null : current));
    };
  }, [restaurantId, loadSettings]);

  useNotificationSounds(socket, settings);

  return null;
};

export default NotificationSoundManager;
