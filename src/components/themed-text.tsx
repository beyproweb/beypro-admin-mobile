import React from "react";
import { Text, TextStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface Props {
  children: any;
  type?: "default" | "title" | "link";
  style?: TextStyle | TextStyle[];
}

export function ThemedText({ children, type = "default", style }: Props) {
  const { theme } = useTheme();

  const baseStyle: TextStyle = {
    color: theme === "dark" ? "#fff" : "#000",
    fontSize: type === "title" ? 26 : type === "link" ? 16 : 18,
    fontWeight: type === "title" ? "600" : "400",
  };

  const linkStyle: TextStyle =
    type === "link"
      ? { color: "#4F46E5", textDecorationLine: "underline" }
      : {};

  return <Text style={[baseStyle, linkStyle, style]}>{children}</Text>;
}
