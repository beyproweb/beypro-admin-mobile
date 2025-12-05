// src/components/navigation/BottomNav.tsx
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePathname, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppearance } from "../../context/AppearanceContext";

const ACTIVE_COLOR = "#6366F1"; // indigo (accent)
const INACTIVE_COLOR = "#9CA3AF"; // gray

type TabItem = {
  key: string;
  label: string;
  route: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const TABS: TabItem[] = [
  { key: "dashboard", label: "Home", route: "/", icon: "home" },
  { key: "tables", label: "Tables", route: "/orders/tables", icon: "restaurant" },
  { key: "packet", label: "Packet", route: "/orders/packet", icon: "cube" },
  { key: "phone", label: "Phone", route: "/orders/phone", icon: "call" },
  { key: "more", label: "More", route: "/settings", icon: "ellipsis-horizontal" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isDark } = useAppearance();
  const { t } = useTranslation();

  const getActiveKey = () => {
    if (pathname.startsWith("/orders/packet")) return "packet";
    if (pathname.startsWith("/orders/phone")) return "phone";
    if (pathname.startsWith("/orders/tables") || pathname === "/orders") return "tables";
    if (pathname.startsWith("/settings")) return "more";
    return "dashboard";
  };

  const activeKey = getActiveKey();

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.safe, isDark && styles.safeDark]}>
      <View style={[styles.navContainer, isDark && styles.navContainerDark]}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeKey;

          return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              isActive && styles.tabActive,
              isActive && isDark && styles.tabActiveDark,
            ]}
            onPress={() => router.replace(tab.route as any)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={tab.icon} 
              size={22} 
              color={isActive ? (isDark ? "#818CF8" : ACTIVE_COLOR) : (isDark ? "#6B7280" : INACTIVE_COLOR)} 
            />
            <Text style={[
              styles.label,
              { color: isActive ? (isDark ? "#818CF8" : ACTIVE_COLOR) : (isDark ? "#6B7280" : INACTIVE_COLOR) },
              isActive && styles.labelActive,
            ]}>
              {t(tab.label)}
            </Text>
          </TouchableOpacity>
        );
      })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: "#ffffff",
  },
  safeDark: {
    backgroundColor: "#111827",
  },
  navContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E7FF",
    backgroundColor: "#fff",
  },
  navContainerDark: {
    backgroundColor: "#0B1220",
    borderTopColor: "#4F46E5",
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  tabActiveDark: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
  },
  label: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  labelActive: {
    fontWeight: "700",
  },
});
