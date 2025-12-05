import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
  PanResponder,
  Animated,
  GestureResponderEvent,
  PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import secureFetch from "../../../src/api/secureFetch";
import { useAuth } from "../../../src/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { WebView } from "react-native-webview";
import { useMultiStopRoute, Stop, MultiStopRoute } from "../../../src/hooks/useMultiStopRoute";
import { useAutoArrival } from "../../../src/hooks/useAutoArrival";
import { LiveRouteMap } from "../../../src/components/LiveRouteMap";
import { StopBottomSheet } from "../../../src/components/StopBottomSheet";

type LatLng = {
  latitude: number;
  longitude: number;
};

const ARRIVAL_THRESHOLD_METERS = 120;

export default function MultiStopLiveMapScreen() {
  console.log("📱 MultiStopLiveMapScreen MOUNTED");
  const router = useRouter();
  const params = useLocalSearchParams() as { driverId?: string };
  const driverId = params.driverId ? Number(params.driverId) : undefined;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const [distanceToCurrentStop, setDistanceToCurrentStop] = useState<number>(0);
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const locationWatchRef = useRef<any | null>(null);

  // Swipe-to-deliver gesture
  const swipeProgressAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only detect horizontal swipes to the right
        return Math.abs(gestureState.dy) < 10 && gestureState.dx > 5;
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > 0 && gestureState.dx < 300) {
          swipeProgressAnim.setValue(gestureState.dx);
          setSwipeProgress(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const threshold = 150; // 150px to complete delivery
        if (gestureState.dx > threshold && !isDelivering && currentStop) {
          handleSwipeDeliver();
        } else {
          // Snap back
          Animated.spring(swipeProgressAnim, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
          setSwipeProgress(0);
        }
      },
    })
  ).current;

  // Fetch multi-stop route
  const { route, loading: routeLoading } = useMultiStopRoute(driverId || user?.id);

  // Auto-arrival detection
  const currentStop = route?.stops?.[route?.currentStopIndex || 0];

  // Handle swipe-to-deliver gesture
  const handleSwipeDeliver = async () => {
    if (!currentStop || isDelivering) return;

    try {
      setIsDelivering(true);
      
      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Update order status
      await secureFetch(`/orders/${currentStop.orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "delivered" }),
      });

      // Animate completion
      Animated.sequence([
        Animated.timing(swipeProgressAnim, {
          toValue: 300,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(swipeProgressAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(() => setSwipeProgress(0));

      console.log(`✅ Order ${currentStop.orderId} delivered via swipe`);
      Alert.alert("✅ Delivered", `Stop ${currentStop.letter} marked as delivered!`);
    } catch (err) {
      console.error("❌ Swipe delivery failed:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to mark delivery. Please try again.");
      
      // Snap back
      Animated.spring(swipeProgressAnim, {
        toValue: 0,
        useNativeDriver: false,
      }).start(() => setSwipeProgress(0));
    } finally {
      setIsDelivering(false);
    }
  };

  useAutoArrival({
    enabled: !!currentStop && !!driverLocation,
    currentStopId: currentStop?.id ?? null,
    currentStopLat: currentStop?.latitude ?? null,
    currentStopLng: currentStop?.longitude ?? null,
    driverLat: driverLocation?.latitude ?? null,
    driverLng: driverLocation?.longitude ?? null,
  });

  // Calculate distance to current stop
  useEffect(() => {
    if (currentStop && driverLocation) {
      const lat1 = driverLocation.latitude;
      const lng1 = driverLocation.longitude;
      const lat2 = currentStop.latitude;
      const lng2 = currentStop.longitude;

      const R = 6371000; // Earth radius in meters
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      setDistanceToCurrentStop(Math.round(distance));
    }
  }, [driverLocation, currentStop]);

  // Start watching device location
  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        const isEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
        if (!isEnabled) {
          setLocationError("Location services disabled");
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError("Location permission denied");
          return;
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 20,
          },
          async (position) => {
            if (!mounted) return;
            const { latitude, longitude } = position.coords;
            setDriverLocation({ latitude, longitude });
            setLocationError(null);

            try {
              await secureFetch("/drivers/location", {
                method: "POST",
                body: JSON.stringify({
                  driver_id: user?.id,
                  lat: latitude,
                  lng: longitude,
                }),
              });
            } catch (err) {
              console.log("Failed to send driver location:", err);
            }
          }
        );

        locationWatchRef.current = sub;
      } catch (err) {
        console.log("Location error:", err);
        setLocationError("Location tracking error");
      }
    };

    start();

    return () => {
      mounted = false;
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
    };
  }, [user?.id]);

  if (routeLoading) {
    console.log("⏳ ROUTE IS LOADING");
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C4FFB" />
        <Text style={{ marginTop: 12, fontSize: 14, color: "#666" }}>Loading route…</Text>
      </View>
    );
  }

  if (!route || !route.stops || route.stops.length === 0) {
    console.log("❌ NO ROUTE DATA - route:", !!route, "stops:", route?.stops?.length || 0);
    return (
      <View style={styles.center}>
        <Ionicons name="map" size={48} color="#999" />
        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: "600", color: "#333" }}>
          No active deliveries
        </Text>
        <TouchableOpacity
          style={[styles.actionButton, { marginTop: 20 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.actionButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const centerLat =
    driverLocation?.latitude || currentStop?.latitude || route.stops[0]?.latitude || 38.423734;
  const centerLng =
    driverLocation?.longitude || currentStop?.longitude || route.stops[0]?.longitude || 27.142826;

  console.log("🎯 ABOUT TO RENDER - currentStop:", currentStop ? currentStop.id : "NULL");

  return (
    <View style={styles.fullscreenContainer}>
      {/* Map Component */}
      <LiveRouteMap
        route={route}
        driverLocation={driverLocation}
        highlightedStopId={selectedStopId}
        onStopSelected={(stop) => setSelectedStopId(stop.id)}
      />

      {/* Header Overlay */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Multi-Stop Delivery</Text>
          <Text style={styles.headerSubtitle}>
            {(route.currentStopIndex || 0) + 1} / {route.stops.length} stops
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Distance Badge */}
      {distanceToCurrentStop > 0 && (
        <View style={styles.distanceBadge}>
          <Ionicons name="navigate-circle" size={16} color="#fff" />
          <Text style={styles.distanceBadgeText}>{distanceToCurrentStop}m</Text>
        </View>
      )}

      {/* Error Badge */}
      {locationError && (
        <View style={[styles.distanceBadge, { backgroundColor: "#EF4444" }]}>
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={styles.distanceBadgeText}>{locationError}</Text>
        </View>
      )}

      {/* Bottom Sheet */}
      <StopBottomSheet
        route={route}
        currentStopIndex={route.currentStopIndex || 0}
        onDeliverStop={async () => {
          if (currentStop) {
            try {
              await secureFetch(`/orders/${currentStop.orderId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: "delivered" }),
              });
              console.log(`✅ Order ${currentStop.orderId} marked as delivered`);
            } catch (err) {
              Alert.alert("Error", "Failed to mark delivery");
            }
          }
        }}
        onNavigate={(stop: Stop) => {
          if (stop && stop.latitude && stop.longitude) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&travelmode=driving`;
            Linking.openURL(url).catch((err) => {
              console.error("❌ Failed to open Google Maps:", err);
              Alert.alert("Error", "Could not open Google Maps. Please check if it's installed.");
            });
          }
        }}
        onCall={(phoneNumber: string) => {
          if (phoneNumber) {
            Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
              console.error("❌ Failed to open phone dialer:", err);
              Alert.alert("Error", "Could not open phone dialer.");
            });
          } else {
            Alert.alert("No phone", "Customer phone not available");
          }
        }}
        selectedStopId={selectedStopId}
        onSelectStop={(stop) => setSelectedStopId(stop.id)}
      />

      {/* DEBUG: Test View */}
      <View style={{ position: 'absolute', bottom: 200, left: 16, backgroundColor: 'red', padding: 10, borderRadius: 5, zIndex: 999 }}>
        <Text style={{ color: 'white', fontSize: 12 }}>currentStop: {currentStop ? 'YES' : 'NO'}</Text>
      </View>

      {/* Swipe-to-Deliver Gesture Area - Rendered Last to Stay On Top */}
      {currentStop && (
        <View
          style={styles.swipeContainer}
          pointerEvents="auto"
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.swipeSlider,
              {
                transform: [
                  {
                    translateX: swipeProgressAnim.interpolate({
                      inputRange: [0, 150],
                      outputRange: [0, 150],
                      extrapolate: "clamp",
                    }),
                  },
                ],
                opacity: swipeProgressAnim.interpolate({
                  inputRange: [0, 150],
                  outputRange: [1, 0.5],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            <Ionicons name="chevron-forward" size={24} color="#fff" />
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
          </Animated.View>

          <Text style={styles.swipeText}>
            {swipeProgress > 75 ? "Release to Deliver" : "Swipe to Deliver"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#6C4FFB",
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 100,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#E5E7EB",
    marginTop: 2,
  },
  distanceBadge: {
    position: "absolute",
    bottom: 280,
    left: 16,
    backgroundColor: "#3B82F6",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  distanceBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  swipeContainer: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    height: 60,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#10B981",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  swipeSlider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swipeText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "600",
  },
});
