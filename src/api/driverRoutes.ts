/**
 * Driver Routes API Service
 * Handles all API calls related to driver routes and multi-stop navigation
 */

import secureFetch from "./secureFetch";
import { RouteInfo, DeliveryStop, StopCompletionEvent } from "../types/delivery";

/**
 * Get all active orders for a driver
 * Returns combined route information with all pickups and deliveries
 */
export async function getDriverActiveOrders(
  driverId: string
): Promise<RouteInfo> {
  // 🧪 DEVELOPMENT: Use mock data if backend not ready
  const USE_MOCK_DATA = true; // Set to false when backend is ready

  if (USE_MOCK_DATA) {
    console.log("📍 Using MOCK route data for testing...");
    
    const mockStops: DeliveryStop[] = [
      {
        id: "pickup-1",
        orderId: 1,
        type: "pickup",
        stopNumber: 0,
        address: "123 Main St, New York, NY 10001",
        latitude: 40.7128,
        longitude: -74.0060,
        status: "pending",
        orderNumber: "ORD-001",
        customerName: "John's Restaurant",
        notes: "Call upon arrival",
      },
      {
        id: "delivery-1",
        orderId: 1,
        type: "delivery",
        stopNumber: 1,
        address: "456 Park Ave, New York, NY 10022",
        latitude: 40.7580,
        longitude: -73.9855,
        status: "pending",
        customerName: "Alice Johnson",
        notes: "Leave at door",
      },
      {
        id: "pickup-2",
        orderId: 2,
        type: "pickup",
        stopNumber: 2,
        address: "789 Broadway, New York, NY 10003",
        latitude: 40.7489,
        longitude: -73.9680,
        status: "pending",
        orderNumber: "ORD-002",
        customerName: "Pizza Palace",
        notes: "Kitchen is 3rd floor",
      },
      {
        id: "delivery-2",
        orderId: 2,
        type: "delivery",
        stopNumber: 3,
        address: "321 5th Ave, New York, NY 10016",
        latitude: 40.7534,
        longitude: -73.9822,
        status: "pending",
        customerName: "Bob Smith",
        notes: "Apartment 5B",
      },
    ];

    const mockRoute: RouteInfo = {
      totalDistance: 12.5,
      totalDuration: 45,
      stops: mockStops,
      driverId,
      startTime: new Date(),
    };

    console.log("✅ Mock route loaded:", mockRoute.stops.length, "stops");
    return mockRoute;
  }

  // 🔌 PRODUCTION: Call real API
  try {
    const response = await secureFetch(
      `/drivers/${driverId}/active-orders`,
      {
        method: "GET",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch driver orders");
    }

    // Transform backend response to DeliveryStop format
    const stops: DeliveryStop[] = [];
    let stopNumber = 0;

    // Iterate through all orders and create stops
    for (const order of data.orders || []) {
      // Add pickup stop
      stops.push({
        id: `pickup-${order.id}`,
        orderId: order.id,
        type: "pickup",
        stopNumber: stopNumber++,
        address: order.pickup_address || "",
        latitude: parseFloat(order.pickup_lat || 0),
        longitude: parseFloat(order.pickup_lng || 0),
        status: "pending",
        orderNumber: order.order_number,
        customerName: order.customer_name,
        notes: order.pickup_notes,
      });

      // Add delivery stop
      stops.push({
        id: `delivery-${order.id}`,
        orderId: order.id,
        type: "delivery",
        stopNumber: stopNumber++,
        address: order.delivery_address || "",
        latitude: parseFloat(order.delivery_lat || 0),
        longitude: parseFloat(order.delivery_lng || 0),
        status: "pending",
        customerName: order.customer_name,
        orderNumber: order.order_number,
        notes: order.delivery_notes,
      });
    }

    // Calculate route totals
    const totalDistance = calculateTotalDistance(stops);
    const totalDuration = calculateTotalDuration(stops);

    return {
      totalDistance,
      totalDuration,
      stops,
      driverId,
      startTime: new Date(),
    };
  } catch (error) {
    console.error("Error fetching driver active orders:", error);
    throw error;
  }
}

/**
 * Calculate total distance between all stops
 * Uses Haversine formula to calculate distance between coordinates
 */
function calculateTotalDistance(stops: DeliveryStop[]): number {
  let totalDistance = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const distance = haversineDistance(
      stops[i].latitude,
      stops[i].longitude,
      stops[i + 1].latitude,
      stops[i + 1].longitude
    );
    totalDistance += distance;
  }

  return Math.round(totalDistance * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate total duration between all stops
 * Assumes 50 km/h average speed + 5 minutes per stop
 */
function calculateTotalDuration(stops: DeliveryStop[]): number {
  const distance = calculateTotalDistance(stops);
  const speed = 50; // km/h
  const travelTime = (distance / speed) * 60; // Convert to minutes
  const stopTime = stops.length * 5; // 5 minutes per stop

  return Math.round(travelTime + stopTime);
}

/**
 * Haversine formula to calculate distance between two coordinates
 * Returns distance in kilometers
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Calculate ETA to a specific stop from current position
 */
export function calculateETA(
  currentLat: number,
  currentLon: number,
  stopLat: number,
  stopLon: number,
  speed: number = 50 // km/h
): number {
  const distance = haversineDistance(currentLat, currentLon, stopLat, stopLon);
  const timeInMinutes = (distance / speed) * 60;
  return Math.round(timeInMinutes);
}

/**
 * Mark a stop as completed
 */
export async function markStopCompleted(
  event: StopCompletionEvent
): Promise<void> {
  try {
    const response = await secureFetch(
      `/orders/${event.orderId}/stop-event`,
      {
        method: "PATCH",
        body: JSON.stringify({
          stopId: event.stopId,
          completedAt: event.completedAt,
          notes: event.notes,
          signature: event.signature,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to mark stop as completed");
    }
  } catch (error) {
    console.error("Error marking stop completed:", error);
    throw error;
  }
}

/**
 * Get polyline for route (encoded Google polyline format)
 * This can be called separately to optimize route
 */
export async function getRoutePolyline(
  stops: DeliveryStop[]
): Promise<string> {
  try {
    // For now, return empty string
    // In Phase 2, this will call Google Directions API
    return "";
  } catch (error) {
    console.error("Error getting route polyline:", error);
    return "";
  }
}

/**
 * Decode polyline string to array of coordinates
 * Used for rendering polyline on map
 */
export function decodePolyline(encoded: string): Array<[number, number]> {
  const poly: Array<[number, number]> = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }

  return poly;
}
