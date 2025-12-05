import { Stack } from "expo-router";

export default function PhoneLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        animation: "fade_from_bottom",
        contentStyle: { backgroundColor: "transparent" },
      }}
    />
  );
}
