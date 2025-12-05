import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import BottomNav from "../../src/components/navigation/BottomNav";
import { useAppearance } from "../../src/context/AppearanceContext";
import { useAuth } from "../../src/context/AuthContext";
import { usePermissions } from "../../src/context/PermissionsContext";

export default function SettingsIndex() {
  const router = useRouter();
  const { appearance, isDark, fontScale } = useAppearance();
  const { logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);

  const allTabs = [
    {
      key: "products",
      labelKey: "Products",
      icon: "bag",
      permission: "products",
    },
    { key: "appearance", labelKey: "Appearance", icon: "color-palette" },
    { key: "localization", labelKey: "Localization", icon: "language" },
    {
      key: "notifications-settings",
      labelKey: "Notifications",
      icon: "notifications",
      permission: "settings",
    },
    {
      key: "printers",
      labelKey: "Printers",
      icon: "print",
      permission: "settings",
    },
    {
      key: "payments",
      labelKey: "Payments",
      icon: "card",
      permission: "payments",
    },
    {
      key: "register",
      labelKey: "Register",
      icon: "lock-closed",
      permission: "payments",
    },
    {
      key: "inventory",
      labelKey: "Inventory",
      icon: "cube",
      permission: "inventory",
    },
    {
      key: "integrations",
      labelKey: "Integrations",
      icon: "link",
      permission: "settings",
    },
    {
      key: "subscription",
      labelKey: "Subscription",
      icon: "pricetags",
      permission: "settings",
    },
    {
      key: "shop-hours",
      labelKey: "Shop Hours",
      icon: "time",
      permission: "settings",
    },
    { key: "staff", labelKey: "Staff", icon: "people", permission: "staff" },
    { key: "logout", labelKey: "Logout", icon: "log-out" },
  ] as const;

  // Filter visible tabs by permission
  const tabKeys = allTabs.filter((tab) => {
    if (!("permission" in tab) || !tab.permission) return true; // No permission required
    return hasPermission(tab.permission);
  });

  const handleLogout = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch (err) {
      console.log("❌ Logout failed:", err);
    } finally {
      setSigningOut(false);
    }
  }, [logout]);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text
          style={[
            styles.headerTitle,
            isDark && styles.headerTitleDark,
            { fontSize: 26 * fontScale },
          ]}
        >
          {t("Settings")}
        </Text>
        <Text
          style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}
        >
          {t("Manage account and app preferences")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {tabKeys.map((tab) => {
            const isLogout = tab.key === "logout";
            const label =
              isLogout && signingOut ? t("Signing out…") : t(tab.labelKey);
            const subLabel = isLogout
              ? t("Sign out of this account")
              : `${t("Manage")} ${t(tab.labelKey).toLowerCase()}`;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.card, isDark && styles.cardDark]}
                onPress={() => {
                  if (isLogout) {
                    handleLogout();
                    return;
                  }
                  if (tab.key === "products") {
                    router.push("/products");
                    return;
                  }
                  if (tab.key === "staff") {
                    router.push("/settings/staff" as any);
                    return;
                  }
                  router.push(`/settings/${tab.key}` as any);
                }}
                disabled={isLogout && signingOut}
              >
                <View
                  style={[styles.iconWrapper, isDark && styles.iconWrapperDark]}
                >
                  <Ionicons name={tab.icon} size={26} color="#4f46e5" />
                </View>

                <View>
                  <Text
                    style={[
                      styles.label,
                      isDark && styles.labelDark,
                      { fontSize: 18 * fontScale },
                    ]}
                  >
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.subLabel,
                      isDark && styles.subLabelDark,
                      { fontSize: 13 * fontScale },
                    ]}
                  >
                    {subLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  containerDark: {
    backgroundColor: "#020617",
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 20,
    color: "#111827",
  },
  titleDark: {
    color: "#F9FAFB",
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
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#111827" },
  headerTitleDark: { color: "#F9FAFB" },
  headerSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },
  headerSubtitleDark: { color: "#9CA3AF" },
  grid: {
    gap: 15,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 18,
    backgroundColor: "white",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardDark: {
    backgroundColor: "#020617",
    shadowOpacity: 0.2,
  },
  iconWrapper: {
    backgroundColor: "#eef2ff",
    padding: 12,
    borderRadius: 14,
    marginRight: 14,
  },
  iconWrapperDark: {
    backgroundColor: "#1F2937",
  },
  label: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  labelDark: {
    color: "#E5E7EB",
  },
  subLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 3,
  },
  subLabelDark: {
    color: "#9CA3AF",
  },
});
