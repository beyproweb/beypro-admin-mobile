/**
 * StopBottomSheet Component
 * Displays list of delivery stops with actions
 * "Slide to Deliver" animation for completing stops
 */

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  PanResponder,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Stop, MultiStopRoute } from "../hooks/useMultiStopRoute";

interface StopBottomSheetProps {
  route: MultiStopRoute;
  currentStopIndex: number;
  onDeliverStop: (stop: Stop) => Promise<void>;
  onNavigate: (stop: Stop) => void;
  onCall: (phoneNumber: string) => void;
  selectedStopId?: number | null;
  onSelectStop?: (stop: Stop) => void;
}

export const StopBottomSheet: React.FC<StopBottomSheetProps> = ({
  route,
  currentStopIndex,
  onDeliverStop,
  onNavigate,
  onCall,
  selectedStopId,
  onSelectStop,
}) => {
  const currentStop = route.stops[currentStopIndex];
  const [isDelivering, setIsDelivering] = useState(false);

  // Slide animation refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) < 10,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0) {
          slideAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const threshold = 200; // px to slide for delivery
        if (gestureState.dx > threshold) {
          handleSlideToDeliver();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const handleSlideToDeliver = async () => {
    if (!currentStop || isDelivering) return;

    try {
      setIsDelivering(true);
      await onDeliverStop(currentStop);

      // Success animation
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start();

      Alert.alert("✅ Delivered", `Stop ${currentStop.letter} marked as delivered!`);
    } catch (error) {
      console.error("Delivery error:", error);
      Alert.alert("❌ Error", "Failed to mark as delivered. Please try again.");
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false }).start();
    } finally {
      setIsDelivering(false);
    }
  };

  const slideButtonTranslateX = slideAnim.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 200],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      {/* Summary Info */}
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>Total Distance</Text>
          <Text style={styles.summaryValue}>{route.totalDistance.toFixed(1)} km</Text>
        </View>
        <View style={{ width: 1, backgroundColor: "#E5E7EB" }} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.summaryLabel}>Total Time</Text>
          <Text style={styles.summaryValue}>{route.totalDuration} min</Text>
        </View>
        <View style={{ width: 1, backgroundColor: "#E5E7EB" }} />
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.summaryLabel}>Stops</Text>
          <Text style={styles.summaryValue}>
            {route.stops.length - currentStopIndex}
          </Text>
        </View>
      </View>

      {/* Current Stop Actions (if there's a current stop) */}
      {currentStop && (
        <View style={styles.currentStopSection}>
          <View style={styles.currentStopHeader}>
            <View style={[styles.badge, styles.badgeCurrent]}>
              <Text style={styles.badgeText}>{currentStop.letter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.currentStopTitle}>Current Stop</Text>
              <Text style={styles.currentStopName}>{currentStop.customerName || currentStop.address}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onNavigate(currentStop)}
              disabled={isDelivering}
            >
              <Ionicons name="navigate" size={18} color="#3B82F6" />
              <Text style={styles.actionBtnText}>Navigate</Text>
            </TouchableOpacity>

            {currentStop.customerPhone && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onCall(currentStop.customerPhone!)}
                disabled={isDelivering}
              >
                <Ionicons name="call" size={18} color="#10B981" />
                <Text style={styles.actionBtnText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Slide to Deliver */}
          <View style={styles.slideContainer}>
            <View style={styles.slideTrack}>
              <Animated.View
                style={[styles.slideButton, { transform: [{ translateX: slideButtonTranslateX }] }]}
                {...panResponder.panHandlers}
              >
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </Animated.View>
              <Text style={styles.slideText}>Slide to Deliver</Text>
            </View>
          </View>
        </View>
      )}

      {/* Stops List */}
      <View style={styles.stopsHeader}>
        <Text style={styles.stopsTitle}>Remaining Stops</Text>
        <Text style={styles.stopsCount}>{route.stops.length - currentStopIndex - 1}</Text>
      </View>

      <ScrollView style={styles.stopsList} showsVerticalScrollIndicator={false}>
        {route.stops.slice(currentStopIndex + 1).map((stop, idx) => {
          const isSelected = stop.id === selectedStopId;
          const actualIndex = currentStopIndex + idx + 1;

          return (
            <TouchableOpacity
              key={stop.id}
              style={[styles.stopItem, isSelected && styles.stopItemSelected]}
              onPress={() => onSelectStop?.(stop)}
            >
              <View style={[styles.stopBadge, stop.type === "pickup" ? styles.badgePickup : styles.badgeDelivery]}>
                <Text style={styles.stopLetter}>{stop.letter}</Text>
              </View>

              <View style={styles.stopInfo}>
                <Text style={styles.stopAddress} numberOfLines={1}>
                  {stop.customerName || stop.address}
                </Text>
                <Text style={styles.stopSubtext} numberOfLines={1}>
                  {stop.address.substring(0, 40)}
                </Text>
              </View>

              {stop.status === "delivered" && (
                <View style={styles.deliveredBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                </View>
              )}

              {stop.status === "pending" && (
                <Text style={styles.stopDistance}>
                  {stop.distance ? `${stop.distance.toFixed(1)}km` : "—"}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: "70%",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
  },
  currentStopSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F0F9FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0F2FE",
  },
  currentStopHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    fontWeight: "700",
  },
  badgeCurrent: {
    backgroundColor: "#34D399",
  },
  badgePickup: {
    backgroundColor: "#FCD34D",
  },
  badgeDelivery: {
    backgroundColor: "#34D399",
  },
  badgeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  currentStopTitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  currentStopName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 4,
  },
  slideContainer: {
    marginBottom: 0,
  },
  slideTrack: {
    height: 56,
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  slideButton: {
    position: "absolute",
    left: 4,
    width: 48,
    height: 48,
    backgroundColor: "#2563EB",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  slideText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  stopsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  stopsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  stopsCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B82F6",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stopsList: {
    paddingHorizontal: 16,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  stopItemSelected: {
    backgroundColor: "#F0F9FF",
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  stopBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stopLetter: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  stopInfo: {
    flex: 1,
  },
  stopAddress: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  stopSubtext: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  stopDistance: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  deliveredBadge: {
    paddingRight: 8,
  },
});
