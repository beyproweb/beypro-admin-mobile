import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { DeliveryStop } from "../types/delivery";
import { markStopCompleted, calculateETA } from "../api/driverRoutes";

const { height: screenHeight } = Dimensions.get("window");

interface StopDetailsSheetProps {
  visible: boolean;
  stop: DeliveryStop | null;
  onClose: () => void;
  onStopCompleted?: (stop: DeliveryStop) => void;
  currentLat?: number;
  currentLon?: number;
}

/**
 * StopDetailsSheet Component
 * Bottom sheet that displays details for a selected stop
 * Allows driver to mark stop as completed
 */
export const StopDetailsSheet: React.FC<StopDetailsSheetProps> = ({
  visible,
  stop,
  onClose,
  onStopCompleted,
  currentLat,
  currentLon,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const stopLetter = String.fromCharCode(65 + (stop?.stopNumber || 0)); // A, B, C...

  const handleMarkCompleted = useCallback(async () => {
    if (!stop) return;

    Alert.alert(
      "Mark Stop Complete",
      `Are you sure you want to mark stop ${stopLetter} as completed?`,
      [
        {
          text: "Cancel",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "Complete",
          onPress: async () => {
            setIsLoading(true);
            try {
              await markStopCompleted({
                stopId: stop.id,
                orderId: stop.orderId,
                completedAt: new Date(),
                notes: "",
              });

              Alert.alert("Success", `Stop ${stopLetter} marked as completed`);
              onStopCompleted?.(stop);
              onClose();
            } catch (error) {
              console.error("Error marking stop completed:", error);
              Alert.alert(
                "Error",
                "Failed to mark stop as completed. Please try again."
              );
            } finally {
              setIsLoading(false);
            }
          },
          style: "destructive",
        },
      ]
    );
  }, [stop, stopLetter, onStopCompleted, onClose]);

  const calculateEtaMinutes = useCallback(() => {
    if (!currentLat || !currentLon || !stop) return null;
    return calculateETA(currentLat, currentLon, stop.latitude, stop.longitude);
  }, [currentLat, currentLon, stop]);

  if (!stop) return null;

  const eta = calculateEtaMinutes();
  const statusColor = {
    pending: "#F97316",
    in_progress: "#3B82F6",
    completed: "#10B981",
  }[stop.status];

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onClose}
      snapPoints={[screenHeight * 0.5, screenHeight * 0.75]}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.stopBadge}>
            <Text style={styles.stopLetter}>{stopLetter}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.stopType}>
              {stop.type === "pickup" ? "📦 Pickup" : "📍 Delivery"}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>
                {stop.status.charAt(0).toUpperCase() + stop.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <Text style={styles.address}>{stop.address}</Text>
        </View>

        {/* Customer Info */}
        {stop.customerName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Text style={styles.customerName}>{stop.customerName}</Text>
            {stop.orderNumber && (
              <Text style={styles.orderNumber}>Order #{stop.orderNumber}</Text>
            )}
          </View>
        )}

        {/* Time Estimate */}
        {eta !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estimated Time</Text>
            <Text style={styles.eta}>
              ⏱️ {eta} {eta === 1 ? "minute" : "minutes"} away
            </Text>
          </View>
        )}

        {/* Notes */}
        {stop.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <Text style={styles.notes}>{stop.notes}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Close</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.completeButton,
              stop.status === "completed" && styles.completeButtonDisabled,
            ]}
            onPress={handleMarkCompleted}
            disabled={isLoading || stop.status === "completed"}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color="white"
                />
                <Text style={styles.completeButtonText}>
                  {stop.status === "completed" ? "Completed" : "Mark Complete"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  stopBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stopLetter: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F97316",
  },
  headerInfo: {
    flex: 1,
  },
  stopType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  address: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
    lineHeight: 20,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 12,
    color: "#6B7280",
  },
  eta: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  notes: {
    fontSize: 13,
    color: "#4B5563",
    fontStyle: "italic",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  completeButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 12,
    backgroundColor: "#10B981",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  completeButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
});

export default StopDetailsSheet;
