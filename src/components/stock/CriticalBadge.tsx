import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

interface CriticalBadgeProps {
  quantity: number;
  criticalThreshold?: number;
  reorderQuantity?: number;
}

export default function CriticalBadge({
  quantity,
  criticalThreshold,
  reorderQuantity,
}: CriticalBadgeProps) {
  const { t } = useTranslation();

  // Determine status
  if (
    criticalThreshold !== undefined &&
    criticalThreshold !== null &&
    quantity <= criticalThreshold
  ) {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-red-100 px-3 py-1">
        <MaterialCommunityIcons name="alert-circle" size={14} color="#dc2626" />
        <Text className="text-xs font-bold text-red-600">{t("Critical")}</Text>
      </View>
    );
  }

  if (
    reorderQuantity !== undefined &&
    reorderQuantity !== null &&
    reorderQuantity > 0 &&
    quantity <= reorderQuantity
  ) {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-amber-100 px-3 py-1">
        <MaterialCommunityIcons name="alert" size={14} color="#f59e0b" />
        <Text className="text-xs font-bold text-amber-600">{t("Reorder Soon")}</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1 rounded-full bg-green-100 px-3 py-1">
      <MaterialCommunityIcons name="check-circle" size={14} color="#10b981" />
      <Text className="text-xs font-bold text-green-600">{t("Healthy")}</Text>
    </View>
  );
}

