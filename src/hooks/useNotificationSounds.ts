import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Asset } from "expo-asset";
import { Socket } from "socket.io-client";
import { logger } from "../utils/logger";

export interface NotificationSoundSettings {
  enabled: boolean;
  enableSounds: boolean;
  volume: number;
  defaultSound?: string;
  eventSounds: Record<string, string>;
}

// Sound file mappings - local assets
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

/**
 * Hook to handle notification sounds via socket events
 * Plays appropriate sounds for different notification types based on settings
 */
export function useNotificationSounds(
  socket: Socket | null,
  settings: NotificationSoundSettings | null
) {
  const audioRefs = useRef<Record<string, Audio.Sound>>({});
  const cachedAssets = useRef<Record<string, string>>({});

  // =========================================================================
  // SETUP AUDIO SESSION (ENSURE IT'S CONFIGURED)
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
      } catch (err) {
        logger.warn("Failed to configure audio session:", err);
      }
    };

    if (Platform.OS !== "web") {
      setupAudioSession();
    }
  }, []);

  const getSoundUri = useCallback(async (soundFile: string): Promise<string | null> => {
    if (!soundFile || soundFile === "none") return null;

    // Return cached URI if available
    if (cachedAssets.current[soundFile]) {
      return cachedAssets.current[soundFile];
    }

    try {
      const asset = SOUND_ASSETS[soundFile];
      if (!asset) {
        return null;
      }

      const assetModule = await Asset.fromModule(asset).downloadAsync();
      cachedAssets.current[soundFile] = assetModule.uri;
      return assetModule.uri;
    } catch (err) {
      logger.warn(`Failed to load sound asset ${soundFile}:`, err);
      return null;
    }
  }, []);

  const playNotificationSound = useCallback(
    async (eventType: string) => {
      if (!settings) {
        return;
      }

      const notificationsEnabled = settings.enabled !== false;
      const soundsEnabled = settings.enableSounds !== false;

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
    [settings, getSoundUri]
  );

  // Listen to socket events and play corresponding sounds
  useEffect(() => {
    if (!socket) {
      return;
    }

    const eventTypes = [
      "order_confirmed",
      "order_preparing",
      "order_ready",
      "order_delivered",
      "driver_assigned",
      "payment_made",
      "stock_critical",
      "stock_restocked",
      // NOTE: "orders_updated" is removed to prevent duplicate sounds
      // order_confirmed already handles the notification for new/updated orders
    ];

    // Store handlers in a map to ensure cleanup uses same reference
    const handlers = new Map<string, (data: any) => void>();

    eventTypes.forEach((eventType) => {
      const handler = (data: any) => {
        playNotificationSound(eventType).catch((err) => {
          logger.warn(`Failed to play sound for ${eventType}:`, err);
        });
      };
      handlers.set(eventType, handler);
      socket.on(eventType, handler);
    });

    return () => {
      eventTypes.forEach((eventType) => {
        const handler = handlers.get(eventType);
        if (handler) {
          socket.off(eventType, handler);
        }
      });
    };
  }, [socket, playNotificationSound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(async (sound) => {
        try {
          await sound.unloadAsync();
        } catch (e) {
          // Already unloaded
        }
      });
    };
  }, []);

  return { playNotificationSound };
}
