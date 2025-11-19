import React from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface Props {
  children: any;
  style?: ViewStyle | ViewStyle[];
}

export function ThemedView({ children, style }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme === "dark" ? "#000" : "#fff",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
