import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  DeviceEventEmitter,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import { Asset } from "expo-asset";
import Constants from "expo-constants";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import secureFetch from "../../src/api/secureFetch";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

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

interface NotificationSettings {
  enabled: boolean;
  enableToasts: boolean;
  enableSounds: boolean;
  volume: number;
  defaultSound: string;
  channels: {
    kitchen: string;
    cashier: string;
    manager: string;
  };
  escalation: {
    enabled: boolean;
    delayMinutes: number;
  };
  stockAlert: {
    enabled: boolean;
    cooldownMinutes: number;
  };
  eventSounds: Record<string, string>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const expoConfig = Constants.expoConfig ?? (Constants as any).manifest;
const API_BASE_URL =
  expoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://hurrypos-backend.onrender.com/api";

const eventLabels = {
  new_order: "New Order",
  order_preparing: "Preparing",
  order_ready: "Order Ready",
  order_delivered: "Delivered",
  payment_made: "Payment Made",
  stock_low: "Stock Low",
  stock_restocked: "New Stock",
  stock_expiry: "Expiry Alert",
  order_delayed: "Delayed Order Alert",
  driver_arrived: "Driver Delivered",
  driver_assigned: "Driver Assigned",
  yemeksepeti_order: "Yemeksepeti Order",
};

const availableSounds = [
  "new_order.mp3",
  "alert.mp3",
  "chime.mp3",
  "alarm.mp3",
  "cash.mp3",
  "success.mp3",
  "horn.mp3",
  "warning.mp3",
  "yemeksepeti.mp3",
  "none",
];

const roles = ["kitchen", "cashier", "manager"];
const options = ["app", "email", "whatsapp"];

const defaultEventSounds: Record<string, string> = {
  new_order: "new_order.mp3",
  order_preparing: "alert.mp3",
  order_ready: "chime.mp3",
  order_delivered: "success.mp3",
  payment_made: "cash.mp3",
  stock_low: "warning.mp3",
  stock_restocked: "alert.mp3",
  stock_expiry: "alarm.mp3",
  order_delayed: "alarm.mp3",
  driver_arrived: "horn.mp3",
  driver_assigned: "horn.mp3",
  yemeksepeti_order: "yemeksepeti.mp3",
};

const defaultConfig: NotificationSettings = {
  enabled: true,
  enableToasts: true,
  enableSounds: true,
  volume: 0.8,
  defaultSound: "chime.mp3",
  channels: {
    kitchen: "app",
    cashier: "app",
    manager: "app",
  },
  escalation: {
    enabled: true,
    delayMinutes: 3,
  },
  stockAlert: {
    enabled: true,
    cooldownMinutes: 30,
  },
  eventSounds: defaultEventSounds,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NotificationsSettingsScreen() {
  const { appearance, isDark, fontScale } = useAppearance();
  const { user } = useAuth();
  const { t } = useTranslation();

  // State Management
  const [settings, setSettings] = useState<NotificationSettings>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const audioRefs = useRef<Record<string, Audio.Sound>>({});
  const cachedAssets = useRef<Record<string, string>>({});

  // =========================================================================
  // LOAD SETTINGS
  // =========================================================================

  const loadSettings = useCallback(async () => {
    try {
      const data = await secureFetch("/settings/notifications");
      const merged: NotificationSettings = {
        ...defaultConfig,
        ...data,
        eventSounds: {
          ...defaultEventSounds,
          ...(data?.eventSounds || {}),
        },
      };
      setSettings(merged);
      setVolume(merged.volume);
      console.log("✅ Notifications settings loaded:", merged);
    } catch (err) {
      console.log("❌ Failed to load notifications settings:", err);
      // Use default settings
      setSettings(defaultConfig);
      setVolume(defaultConfig.volume);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // =========================================================================
  // SAVE SETTINGS
  // =========================================================================

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updatedSettings = { ...settings, volume };
      await secureFetch("/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      });

      // Dispatch event for other screens
      if (Platform.OS === "web") {
        (window as any).notificationSettings = updatedSettings;
        (window as any).dispatchEvent?.(new Event("notification_settings_updated"));
      }

      Alert.alert(t("Success"), t("Notification settings saved successfully"));
      console.log("✅ Settings saved:", updatedSettings);

      if (Platform.OS !== "web") {
        DeviceEventEmitter.emit("notification_settings_updated", updatedSettings);
      }
    } catch (err) {
      console.error("❌ Failed to save settings:", err);
      Alert.alert(t("Error"), t("Failed to save notification settings"));
    } finally {
      setSaving(false);
    }
  }, [settings, volume, t]);

  // =========================================================================
  // PLAY SOUND
  // =========================================================================

  const getSoundUri = useCallback(async (soundFile: string): Promise<string | null> => {
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
  }, []);

  const playSound = useCallback(async (soundFile: string, eventKey: string) => {
    try {
      if (soundFile === "none") return;

      // Stop previous sound if playing
      if (audioRefs.current[eventKey]) {
        try {
          await audioRefs.current[eventKey].stopAsync();
          await audioRefs.current[eventKey].unloadAsync();
        } catch (e) {
          // Sound already stopped
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

      audioRefs.current[eventKey] = sound;
      await sound.setVolumeAsync(volume);
      await sound.playAsync();

      console.log("🔊 Playing sound:", soundFile);
    } catch (err) {
      console.warn("⚠️ Failed to play sound:", err);
    }
  }, [volume, getSoundUri]);

  // =========================================================================
  // CLEANUP
  // =========================================================================

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

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const toggleSetting = (key: keyof Pick<NotificationSettings, 'enabled' | 'enableToasts' | 'enableSounds'>) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateChannelForRole = (role: string, channel: string) => {
    setSettings((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [role]: channel,
      },
    }));
  };

  const updateEventSound = (eventKey: string, sound: string) => {
    setSettings((prev) => ({
      ...prev,
      eventSounds: {
        ...prev.eventSounds,
        [eventKey]: sound,
      },
    }));
  };

  // =========================================================================
  // RENDER LOADING STATE
  // =========================================================================

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
            {t("Loading settings")}...
          </Text>
        </View>
      </View>
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text
          style={[
            styles.headerTitle,
            isDark && styles.headerTitleDark,
            { fontSize: 26 * fontScale },
          ]}
        >
          🔔 {t("Notifications")}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Enable Notifications */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                isDark && styles.sectionTitleDark,
              ]}
            >
              {t("Enable Notifications")}
            </Text>
            <Switch
              value={settings.enabled}
              onValueChange={() => toggleSetting("enabled")}
              trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
              thumbColor={settings.enabled ? "#22C55E" : "#9CA3AF"}
            />
          </View>
        </View>

        {/* Enable Toast Popups */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                isDark && styles.sectionTitleDark,
              ]}
            >
              {t("Enable Toast Popups")}
            </Text>
            <Switch
              value={settings.enableToasts}
              onValueChange={() => toggleSetting("enableToasts")}
              trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
              thumbColor={settings.enableToasts ? "#22C55E" : "#9CA3AF"}
            />
          </View>
        </View>

        {/* Enable Sound Alerts */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                isDark && styles.sectionTitleDark,
              ]}
            >
              {t("Enable Sound Alerts")}
            </Text>
            <Switch
              value={settings.enableSounds}
              onValueChange={() => toggleSetting("enableSounds")}
              trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
              thumbColor={settings.enableSounds ? "#22C55E" : "#9CA3AF"}
            />
          </View>
        </View>

        {/* Volume Control */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            🔊 {t("Volume")}: {(volume * 100).toFixed(0)}%
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={volume}
            onValueChange={setVolume}
            minimumTrackTintColor="#4f46e5"
            maximumTrackTintColor={isDark ? "#374151" : "#E5E7EB"}
            thumbTintColor="#4f46e5"
          />
        </View>

        {/* Default Sound */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            {t("Default Notification Sound")}
          </Text>
          <View style={styles.soundSelectContainer}>
            {availableSounds.map((sound) => (
              <TouchableOpacity
                key={sound}
                style={[
                  styles.soundOption,
                  isDark && styles.soundOptionDark,
                  settings.defaultSound === sound &&
                    styles.soundOptionActive,
                ]}
                onPress={() => {
                  setSettings((prev) => ({
                    ...prev,
                    defaultSound: sound,
                  }));
                  if (sound !== "none") {
                    playSound(sound, "default");
                  }
                }}
              >
                <Text
                  style={[
                    styles.soundOptionText,
                    isDark && styles.soundOptionTextDark,
                    settings.defaultSound === sound &&
                      styles.soundOptionTextActive,
                  ]}
                >
                  {sound === "none"
                    ? t("None")
                    : sound.replace(".mp3", "").replace(/[_-]/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Channel Routing */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            {t("Channel Routing by Role")}
          </Text>
          <View style={styles.rolesContainer}>
            {roles.map((role) => (
              <View key={role} style={styles.roleItem}>
                <Text
                  style={[
                    styles.roleLabel,
                    isDark && styles.roleLabelDark,
                  ]}
                >
                  {t(role.charAt(0).toUpperCase() + role.slice(1))}
                </Text>
                <View style={styles.channelOptions}>
                  {options.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.channelOption,
                        isDark && styles.channelOptionDark,
                        settings.channels[role as keyof typeof settings.channels] ===
                          opt && styles.channelOptionActive,
                      ]}
                      onPress={() => updateChannelForRole(role, opt)}
                    >
                      <Text
                        style={[
                          styles.channelOptionText,
                          isDark && styles.channelOptionTextDark,
                          settings.channels[role as keyof typeof settings.channels] ===
                            opt && styles.channelOptionTextActive,
                        ]}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Stock Alert Settings */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            {t("Stock Alert Settings")}
          </Text>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.subSectionTitle,
                isDark && styles.subSectionTitleDark,
              ]}
            >
              {t("Enable Stock Alerts")}
            </Text>
            <Switch
              value={settings.stockAlert.enabled}
              onValueChange={() =>
                setSettings((prev) => ({
                  ...prev,
                  stockAlert: {
                    ...prev.stockAlert,
                    enabled: !prev.stockAlert.enabled,
                  },
                }))
              }
              trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
              thumbColor={
                settings.stockAlert.enabled ? "#22C55E" : "#9CA3AF"
              }
            />
          </View>
          {settings.stockAlert.enabled && (
            <View style={styles.inputContainer}>
              <Text
                style={[
                  styles.inputLabel,
                  isDark && styles.inputLabelDark,
                ]}
              >
                {t("Cooldown between alerts")}: {settings.stockAlert.cooldownMinutes}{" "}
                {t("minutes")}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={120}
                step={1}
                value={settings.stockAlert.cooldownMinutes}
                onValueChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    stockAlert: {
                      ...prev.stockAlert,
                      cooldownMinutes: value,
                    },
                  }))
                }
                minimumTrackTintColor="#4f46e5"
                maximumTrackTintColor={isDark ? "#374151" : "#E5E7EB"}
                thumbTintColor="#4f46e5"
              />
            </View>
          )}
        </View>

        {/* Escalation Settings */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            {t("Escalation Rules")}
          </Text>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.subSectionTitle,
                isDark && styles.subSectionTitleDark,
              ]}
            >
              {t("Repeat alert if unacknowledged")}
            </Text>
            <Switch
              value={settings.escalation.enabled}
              onValueChange={() =>
                setSettings((prev) => ({
                  ...prev,
                  escalation: {
                    ...prev.escalation,
                    enabled: !prev.escalation.enabled,
                  },
                }))
              }
              trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
              thumbColor={settings.escalation.enabled ? "#22C55E" : "#9CA3AF"}
            />
          </View>
          {settings.escalation.enabled && (
            <View style={styles.inputContainer}>
              <Text
                style={[
                  styles.inputLabel,
                  isDark && styles.inputLabelDark,
                ]}
              >
                {t("Escalation delay")}: {settings.escalation.delayMinutes}{" "}
                {t("minutes")}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={30}
                step={1}
                value={settings.escalation.delayMinutes}
                onValueChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    escalation: {
                      ...prev.escalation,
                      delayMinutes: value,
                    },
                  }))
                }
                minimumTrackTintColor="#4f46e5"
                maximumTrackTintColor={isDark ? "#374151" : "#E5E7EB"}
                thumbTintColor="#4f46e5"
              />
            </View>
          )}
        </View>

        {/* Per-Event Sound Selection */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            {t("Sound Per Event")}
          </Text>
          <View style={styles.eventsContainer}>
            {Object.entries(eventLabels).map(([eventKey, label]) => (
              <View
                key={eventKey}
                style={[
                  styles.eventItem,
                  isDark && styles.eventItemDark,
                ]}
              >
                <Text
                  style={[
                    styles.eventLabel,
                    isDark && styles.eventLabelDark,
                  ]}
                >
                  {t(label)}
                </Text>
                <View style={styles.eventSoundContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={{ flex: 1 }}
                  >
                    {availableSounds.map((sound) => (
                      <TouchableOpacity
                        key={sound}
                        style={[
                          styles.soundOptionSmall,
                          isDark && styles.soundOptionSmallDark,
                          settings.eventSounds[eventKey] === sound &&
                            styles.soundOptionSmallActive,
                        ]}
                        onPress={() => {
                          updateEventSound(eventKey, sound);
                        }}
                      >
                        <Text
                          style={[
                            styles.soundOptionSmallText,
                            isDark && styles.soundOptionSmallTextDark,
                            settings.eventSounds[eventKey] === sound &&
                              styles.soundOptionSmallTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {sound === "none"
                            ? t("None")
                            : sound.replace(".mp3", "").replace(/[_-]/g, " ")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={[
                      styles.playButton,
                      isDark && styles.playButtonDark,
                    ]}
                    onPress={() => {
                      const sound = settings.eventSounds[eventKey];
                      if (sound && sound !== "none") {
                        playSound(sound, eventKey);
                      }
                    }}
                  >
                    <Ionicons
                      name="play"
                      size={16}
                      color={isDark ? "#4CAF50" : "#4f46e5"}
                    />
                    <Text style={[styles.playButtonText, isDark && styles.playButtonTextDark]}>
                      {t("Play")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="white" />
              <Text style={styles.saveButtonText}>
                {t("Save Settings")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
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
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerDark: {
    backgroundColor: "#1F2937",
    borderBottomColor: "#111827",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  headerTitleDark: {
    color: "#F9FAFB",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionDark: {
    backgroundColor: "#1F2937",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: "#F9FAFB",
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  subSectionTitleDark: {
    color: "#D1D5DB",
  },
  slider: {
    width: "100%",
    height: 40,
    marginTop: 12,
  },
  soundSelectContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  soundOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  soundOptionDark: {
    backgroundColor: "#374151",
    borderColor: "#4B5563",
  },
  soundOptionActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  soundOptionText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  soundOptionTextDark: {
    color: "#D1D5DB",
  },
  soundOptionTextActive: {
    color: "white",
    fontWeight: "600",
  },
  rolesContainer: {
    marginTop: 12,
    gap: 12,
  },
  roleItem: {
    marginBottom: 12,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 8,
  },
  roleLabelDark: {
    color: "#F9FAFB",
  },
  channelOptions: {
    flexDirection: "row",
    gap: 8,
  },
  channelOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  channelOptionDark: {
    backgroundColor: "#374151",
    borderColor: "#4B5563",
  },
  channelOptionActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  channelOptionText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  channelOptionTextDark: {
    color: "#D1D5DB",
  },
  channelOptionTextActive: {
    color: "white",
    fontWeight: "600",
  },
  inputContainer: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  inputLabelDark: {
    color: "#D1D5DB",
  },
  eventsContainer: {
    marginTop: 12,
    gap: 10,
  },
  eventItem: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#4f46e5",
  },
  eventItemDark: {
    backgroundColor: "#374151",
  },
  eventLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  eventLabelDark: {
    color: "#F9FAFB",
  },
  eventSoundContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  soundSelectCompact: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  soundOptionSmall: {
    minWidth: 80,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 6,
    borderRadius: 6,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  soundOptionSmallDark: {
    backgroundColor: "#1F2937",
    borderColor: "#4B5563",
  },
  soundOptionSmallActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  soundOptionSmallText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
  },
  soundOptionSmallTextDark: {
    color: "#D1D5DB",
  },
  soundOptionSmallTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  playButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  playButtonDark: {
    backgroundColor: "#374151",
    borderColor: "#4B5563",
  },
  playButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4f46e5",
  },
  playButtonTextDark: {
    color: "#4CAF50",
  },
  saveButton: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#374151",
  },
  loadingTextDark: {
    color: "#9CA3AF",
  },
});
