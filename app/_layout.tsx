import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { PermissionsProvider } from "../src/context/PermissionsContext";
import { AppearanceProvider } from "../src/context/AppearanceContext";
import { CurrencyProvider } from "../src/context/CurrencyContext";
import { StockProvider } from "../src/context/StockContext";
import { useColorScheme } from "nativewind";
import "../src/translations/i18n";
import NotificationSoundManager from "../src/components/NotificationSoundManager";

export default function RootLayout() {
  useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PermissionsProvider>
            <AppearanceProvider>
              <CurrencyProvider>
                <StockProvider>
                  <NotificationSoundManager />
                  <Stack screenOptions={{ headerShown: false }} />
                </StockProvider>
              </CurrencyProvider>
            </AppearanceProvider>
          </PermissionsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
