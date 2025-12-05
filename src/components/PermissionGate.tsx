import React from "react";
import { View, Text } from "react-native";
import { usePermissions } from "../context/PermissionsContext";
import { useAppearance } from "../context/AppearanceContext";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

type PermissionGateProps = {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function PermissionGate({
  permission,
  children,
  fallback,
}: PermissionGateProps) {
  const { hasPermission } = usePermissions();
  const { isDark } = useAppearance();
  const { t } = useTranslation();

  if (hasPermission(permission as any)) {
    return <>{children}</>;
  }

  return (
    fallback || (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDark ? "#020617" : "#F5F6F7",
          paddingHorizontal: 20,
        }}
      >
        <Ionicons
          name="lock-closed"
          size={48}
          color={isDark ? "#9CA3AF" : "#D1D5DB"}
        />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: isDark ? "#F3F4F6" : "#1F2937",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          {t("Access Denied")}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {t("You don't have permission to access this feature")}
        </Text>
      </View>
    )
  );
}

// Inline permission check component
type ConditionalProps = {
  permission: string | string[];
  children: React.ReactNode;
};

export function Conditional({ permission, children }: ConditionalProps) {
  const { hasPermission } = usePermissions();

  if (hasPermission(permission as any)) {
    return <>{children}</>;
  }

  return null;
}
