/**
 * useAutoArrival Hook
 * Detects when driver arrives at a stop (< 120m) and auto-updates status
 */

import { useEffect, useCallback, useRef } from "react";
import secureFetch from "../api/secureFetch";
import { calculateDistanceToStop } from "./useMultiStopRoute";

const ARRIVAL_THRESHOLD_METERS = 120; // 120 meters
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

interface UseAutoArrivalProps {
  currentStopId: number | null;
  currentStopLat: number | null;
  currentStopLng: number | null;
  driverLat: number | null;
  driverLng: number | null;
  enabled: boolean;
}

/**
 * Auto-detect arrival and update driver_status to "arrived"
 */
export function useAutoArrival({
  currentStopId,
  currentStopLat,
  currentStopLng,
  driverLat,
  driverLng,
  enabled,
}: UseAutoArrivalProps) {
  const hasArrivedRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkArrival = useCallback(async () => {
    if (!currentStopId || !driverLat || !driverLng || !currentStopLat || !currentStopLng || !enabled) return;

    try {
      // Calculate distance in km then convert to meters
      const distanceKm = calculateDistanceToStop(driverLat, driverLng, currentStopLat, currentStopLng);
      const distanceMeters = distanceKm * 1000;

      console.log(
        `📍 Distance to stop ${currentStopId}: ${distanceMeters.toFixed(0)}m (threshold: ${ARRIVAL_THRESHOLD_METERS}m)`
      );

      // If within arrival threshold and hasn't already arrived
      if (distanceMeters < ARRIVAL_THRESHOLD_METERS && !hasArrivedRef.current) {
        console.log(`✅ Auto-arrival detected for stop ${currentStopId}`);

        try {
          // Update driver_status to "arrived"
          await secureFetch(`/orders/${currentStopId}/driver-status`, {
            method: "PATCH",
            body: JSON.stringify({
              driver_status: "arrived",
            }),
          });

          hasArrivedRef.current = true;
          console.log(`✅ Status updated to "arrived" for order ${currentStopId}`);
        } catch (err) {
          console.error(`❌ Failed to update driver status:`, err);
        }
      }

      // Reset when driver leaves the area
      if (distanceMeters > ARRIVAL_THRESHOLD_METERS * 2) {
        hasArrivedRef.current = false;
      }
    } catch (err) {
      console.error("Auto-arrival check error:", err);
    }
  }, [currentStopId, driverLat, driverLng, currentStopLat, currentStopLng, enabled]);

  useEffect(() => {
    if (!enabled || !currentStopId) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Check immediately
    checkArrival();

    // Then check periodically
    checkIntervalRef.current = setInterval(checkArrival, CHECK_INTERVAL_MS) as any;

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [currentStopId, enabled, checkArrival]);

  return { hasArrived: hasArrivedRef.current };
}

/**
 * Update order driver_status (arrived, picked_up, delivered, etc)
 */
export async function updateDriverStatus(
  orderId: number,
  status: "arrived" | "picked_up" | "delivered"
): Promise<void> {
  try {
    await secureFetch(`/orders/${orderId}/driver-status`, {
      method: "PATCH",
      body: JSON.stringify({ driver_status: status }),
    });
    console.log(`✅ Order ${orderId} status updated to "${status}"`);
  } catch (err) {
    console.error(`❌ Failed to update status for order ${orderId}:`, err);
    throw err;
  }
}

/**
 * Update order status (delivered, closed, etc)
 */
export async function updateOrderStatus(
  orderId: number,
  status: "delivered" | "closed" | "cancelled"
): Promise<void> {
  try {
    await secureFetch(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    console.log(`✅ Order ${orderId} status updated to "${status}"`);
  } catch (err) {
    console.error(`❌ Failed to update order status for ${orderId}:`, err);
    throw err;
  }
}
