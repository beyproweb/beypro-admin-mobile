// src/components/navigation/BottomNav.tsx
import { Tabs } from "expo-router";

export default function BottomNav() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#111827",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 6,
          fontWeight: "600",
        },
      }}
    >

      {/* HOME / DASHBOARD */}
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />

      {/* ORDERS STACK ENTRY */}
      <Tabs.Screen name="orders/index" options={{ title: "Orders" }} />

      {/* SETTINGS */}
      <Tabs.Screen name="settings/index" options={{ title: "Settings" }} />
    </Tabs>
  );
}
