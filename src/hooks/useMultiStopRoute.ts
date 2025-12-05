/**
 * useMultiStopRoute Hook
 * Fetches driver's active orders and builds a sorted multi-stop route
 * Calculates distances between stops and ETAs
 */

import { useEffect, useState, useCallback } from "react";
import secureFetch from "../api/secureFetch";

export interface Stop {
  id: number;
  stopNumber: number; // 0=A, 1=B, 2=C, etc
  letter: string; // A, B, C, D
  type: "pickup" | "delivery";
  address: string;
  latitude: number;
  longitude: number;
  lat: number; // Alias for latitude
  lng: number; // Alias for longitude
  customerName?: string;
  customerPhone?: string;
  orderId: number;
  status: "pending" | "arrived" | "delivered";
  estimatedArrivalTime?: number; // minutes from now
  distance?: number; // km from current location
}

export interface MultiStopRoute {
  stops: Stop[];
  totalDistance: number; // km
  totalDuration: number; // minutes
  currentStopIndex: number; // Index of next stop to deliver
  driverId: number;
  restaurantId: number;
}

/**
 * Fetch driver's active orders and build multi-stop route
 */
export function useMultiStopRoute(driverId: number | null | undefined) {
  const [route, setRoute] = useState<MultiStopRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(async () => {
    if (!driverId) {
      setRoute(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all active orders for this driver
      const ordersData = await secureFetch(`/drivers/${driverId}/active-orders`);

      if (!ordersData || !Array.isArray(ordersData) || ordersData.length === 0) {
        setRoute(null);
        return;
      }

      // Build stops array from orders
      const stops: Stop[] = [];

      // First stop: Pickup from restaurant
      if (ordersData.length > 0 && ordersData[0].pos_location_lat && ordersData[0].pos_location_lng) {
        const lat = Number(ordersData[0].pos_location_lat);
        const lng = Number(ordersData[0].pos_location_lng);
        stops.push({
          id: ordersData[0].restaurant_id || 0,
          stopNumber: 0,
          letter: "A",
          type: "pickup",
          address: ordersData[0].pos_location || "Restaurant",
          latitude: lat,
          longitude: lng,
          lat,
          lng,
          orderId: ordersData[0].id,
          status: "pending",
          customerName: "Restaurant",
        });
      }

      // Add delivery stops
      let stopNumber = 1;
      for (const order of ordersData) {
        if (order.delivery_lat && order.delivery_lng && stopNumber <= 25) {
          // A-Z limit
          const lat = Number(order.delivery_lat);
          const lng = Number(order.delivery_lng);
          stops.push({
            id: order.id,
            stopNumber,
            letter: String.fromCharCode(64 + stopNumber), // B, C, D, etc
            type: "delivery",
            address: order.delivery_address || order.customer_address || "",
            latitude: lat,
            longitude: lng,
            lat,
            lng,
            customerName: order.customer_name,
            customerPhone: order.customer_phone,
            orderId: order.id,
            status: order.driver_status === "delivered" ? "delivered" : "pending",
          });
          stopNumber++;
        }
      }

      if (stops.length === 0) {
        console.warn("⚠️ No valid stops found");
        setError("No valid delivery locations found");
        setRoute(null);
        return;
      }

      // Calculate route metrics (distance and duration)
      let totalDistance = 0;
      let totalDuration = 0;

      // Simple distance calculation between consecutive stops
      for (let i = 0; i < stops.length - 1; i++) {
        const from = stops[i];
        const to = stops[i + 1];
        const dist = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
        totalDistance += dist;
        // Rough estimate: 30 km/h average + 3 min per stop
        totalDuration += Math.ceil((dist / 30) * 60) + 3;
      }

      // Find current stop (first non-delivered)
      const currentStopIndex = stops.findIndex((stop) => stop.status !== "delivered");

      const routeData: MultiStopRoute = {
        stops,
        totalDistance,
        totalDuration,
        currentStopIndex: currentStopIndex >= 0 ? currentStopIndex : stops.length - 1,
        driverId,
        restaurantId: ordersData[0].restaurant_id || 0,
      };

      console.log(`✅ Route built: ${stops.length} stops, ${totalDistance.toFixed(1)} km, ${totalDuration} min`);
      setRoute(routeData);
    } catch (err) {
      console.error("❌ Failed to fetch multi-stop route:", err);
      setError(err instanceof Error ? err.message : "Failed to load route");
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  // Fetch route when driverId changes
  useEffect(() => {
    fetchRoute();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchRoute, 10000);
    return () => clearInterval(interval);
  }, [fetchRoute]);

  return { route, loading, error, refetch: fetchRoute };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate distance from current location to a stop
 */
export function calculateDistanceToStop(
  currentLat: number,
  currentLng: number,
  stopLat: number,
  stopLng: number
): number {
  return calculateDistance(currentLat, currentLng, stopLat, stopLng);
}

/**
 * Calculate ETA to a stop based on distance and average speed
 */
export function calculateETA(distanceKm: number, averageSpeedKmh: number = 30): number {
  return Math.ceil((distanceKm / averageSpeedKmh) * 60); // Return minutes
}
