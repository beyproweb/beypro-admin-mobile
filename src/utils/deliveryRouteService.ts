/**
 * Delivery Route Service
 * Fetches and calculates multi-stop delivery routes from backend
 */

import secureFetch from "../api/secureFetch";
import { RouteInfo, DeliveryStop } from "../types/delivery";

export interface DeliveryRouteRequest {
  orderId: number;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;
  driverId?: number;
}

export interface MultiStopOrder {
  id: number;
  customer_name?: string;
  customer_address?: string;
  delivery_address?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  estimated_arrival?: number; // minutes from now
  // Pickup info (for multi-order routes)
  pos_location?: string;
  pos_location_lat?: number;
  pos_location_lng?: number;
  restaurant_id?: number;
}

/**
 * Fetch all orders for the current driver (if assigned)
 * Combines orders with the same pickup location into a single pickup stop
 * Returns: A (Pickup), B (Delivery 1), C (Delivery 2), etc.
 * 
 * NOTE: If the backend endpoint /drivers/{id}/active-orders returns 404,
 * this function returns null. The MapModal will then use the route prop passed
 * from the parent component instead.
 */
export async function fetchDriverRoute(
  driverId: number
): Promise<RouteInfo | null> {
  try {
    // Fetch orders assigned to this driver
    // Try multiple possible endpoints in order of preference
    let ordersData: any = null;
    
    // Try primary endpoint first
    try {
      ordersData = await secureFetch(`/drivers/${driverId}/active-orders`);
    } catch (e1) {
      console.log("⚠️ Primary endpoint /drivers/{id}/active-orders not available, skipping");
      // If primary endpoint doesn't exist, we rely on route prop from parent
      return null;
    }

    if (!ordersData || !Array.isArray(ordersData) || ordersData.length === 0) {
      console.log("ℹ️ No active orders found for driver");
      return null;
    }

    const orders: MultiStopOrder[] = ordersData;
    const stops: DeliveryStop[] = [];
    let stopNumber = 0;

    // 🔧 DEBUG: Log first order to see structure
    console.log("🔍 DEBUG: First order from backend:", JSON.stringify(orders[0], null, 2));
    console.log("🔍 DEBUG: Number of orders:", orders.length);
    
    // 🔧 STEP 1: Extract unique pickup location
    // If multiple orders share same restaurant/pickup, we only add it once
    const pickupMap = new Map<string, { address: string; lat: number; lng: number }>();
    
    for (const order of orders) {
      // Log all fields that might contain pickup info
      const lat = Number(order.pos_location_lat);
      const lng = Number(order.pos_location_lng);
      const hasValidPickupCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      
      console.log(`🔍 DEBUG Order ${order.id}:`, {
        pos_location: order.pos_location,
        pos_location_lat: order.pos_location_lat,
        pos_location_lng: order.pos_location_lng,
        parsed_lat: lat,
        parsed_lng: lng,
        hasValidPickupCoords,
        restaurant_id: order.restaurant_id,
      });
      
      // Check if we have valid pickup location (try multiple field names)
      const hasPickupData = (order.pos_location || (order as any).pickup_address) &&
                           hasValidPickupCoords;
      
      if (hasPickupData) {
        // Use restaurant location as key by coordinates
        const key = `${lat},${lng}`;
        if (!pickupMap.has(key)) {
          pickupMap.set(key, {
            address: order.pos_location || (order as any).pickup_address || "Restaurant",
            lat: lat,
            lng: lng,
          });
          console.log(`✅ Added pickup to map: key="${key}", address="${order.pos_location}"`);
        } else {
          console.log(`⏭️  Skipped duplicate pickup: key="${key}"`);
        }
      } else {
        console.warn(`⚠️ Order ${order.id} missing/invalid pickup: pos_location="${order.pos_location}", lat=${lat}, lng=${lng}, valid=${hasValidPickupCoords}`);
      }
    }
    
    console.log(`📊 Pickup dedup result: ${pickupMap.size} unique pickups from ${orders.length} orders`);

    // 🔧 STEP 2: Add pickup stop (single combined stop for all orders)
    // Only add if we have valid pickup info
    if (pickupMap.size > 0) {
      // Take the first (and typically only) pickup location
      const firstPickup = Array.from(pickupMap.values())[0];
      
      if (firstPickup.lat !== 0 && firstPickup.lng !== 0) {
        stops.push({
          id: `pickup-0`,
          orderId: 0, // Placeholder - pickup isn't a specific order
          type: "pickup" as const,
          stopNumber: stopNumber++,
          address: firstPickup.address,
          latitude: firstPickup.lat,
          longitude: firstPickup.lng,
          status: "pending" as const,
          customerName: "Restaurant",
          orderNumber: "Pickup",
          estimatedArrivalTime: undefined,
        });
        
        console.log(`📍 Added single pickup: ${firstPickup.address}`);
      }
    } else {
      console.warn("⚠️ NO PICKUPS FOUND - pickupMap is empty! Backend may not have provided pos_location fields");
    }

    // 🔧 STEP 3: Add delivery stops for each order
    // Delivery stops are separate (not deduped, one per order)
    for (const order of orders) {
      // Skip orders without valid delivery coordinates
      if (!order.delivery_lat || !order.delivery_lng || 
          (order.delivery_lat === 0 && order.delivery_lng === 0)) {
        console.warn(`⚠️ Skipping order ${order.id} - invalid delivery coords`);
        continue;
      }

      stops.push({
        id: `order-${order.id}`,
        orderId: order.id,
        type: "delivery" as const,
        stopNumber: stopNumber++,
        address: order.customer_address || order.delivery_address || "",
        latitude: order.delivery_lat,
        longitude: order.delivery_lng,
        status: "pending" as const,
        customerName: order.customer_name,
        orderNumber: `Order #${order.id}`,
        estimatedArrivalTime: order.estimated_arrival || undefined,
      });
      console.log(`✅ Added delivery: Order ${order.id} - ${order.customer_address || order.delivery_address}`);
    }

    if (stops.length === 0) {
      console.warn("⚠️ No valid stops found after deduplication");
      return null;
    }

    console.log(`✅ Built route with ${stops.length} stops:`);
    stops.forEach((stop, idx) => {
      console.log(`  ${idx}: [${stop.type.toUpperCase()}] ${stop.address} (stopNumber=${stop.stopNumber})`);
    });
    console.log(`📊 Summary: Pickup count=${pickupMap.size}, Delivery count=${stops.length - pickupMap.size}`);

    // Calculate route info (distance & duration)
    const routeInfo = await calculateRoute(stops);

    return routeInfo;
  } catch (error) {
    console.error("❌ Failed to fetch driver route:", error);
    return null;
  }
}

/**
 * Calculate route distance and duration using backend
 * The backend uses Google Directions API or similar
 */
export async function calculateRoute(stops: DeliveryStop[]): Promise<RouteInfo> {
  if (stops.length === 0) {
    return {
      stops: [],
      totalDistance: 0,
      totalDuration: 0,
    };
  }

  try {
    // If only one stop, use simple distance calculation
    if (stops.length === 1) {
      const stop = stops[0];
      return {
        stops: [stop],
        totalDistance: 0, // No route needed for single stop
        totalDuration: stop.estimatedArrivalTime || 5, // Default 5 min
      };
    }

    // Multi-stop: fetch directions from backend
    const waypoints = stops.map((stop) => ({
      lat: stop.latitude,
      lng: stop.longitude,
      address: stop.address,
    }));

    console.log("🛣️ Calculating route with", waypoints.length, "waypoints");

    try {
      // Try to fetch route info from backend
      const response = await secureFetch("/drivers/calculate-route", {
        method: "POST",
        body: JSON.stringify({ waypoints }),
      });

      if (response && response.distance !== undefined) {
        console.log(
          `✅ Route calculated: ${response.distance.toFixed(1)} km, ${response.duration} min`
        );
        return {
          stops,
          totalDistance: response.distance,
          totalDuration: response.duration,
        };
      }
    } catch (error) {
      console.warn("⚠️ Backend route calculation failed, using fallback");
    }

    // Fallback: estimate based on stop count
    const estimatedDistance =
      (stops.length - 1) * 2 + Math.random() * 3; // 2-5 km per stop
    const estimatedDuration =
      Math.ceil((estimatedDistance / 30) * 60) + stops.length * 3; // Time + 3min per stop

    console.log(
      `📍 Using fallback route estimate: ${estimatedDistance.toFixed(1)} km, ${estimatedDuration} min`
    );

    return {
      stops,
      totalDistance: estimatedDistance,
      totalDuration: estimatedDuration,
    };
  } catch (error) {
    console.error("❌ Route calculation failed:", error);

    // Final fallback: return stops with minimal info
    return {
      stops,
      totalDistance: 0,
      totalDuration: 10,
    };
  }
}

/**
 * Fetch single order delivery info
 */
export async function fetchOrderDeliveryInfo(orderId: number) {
  try {
    const order = await secureFetch(`/orders/${orderId}`);
    return order;
  } catch (error) {
    console.error("❌ Failed to fetch order:", error);
    return null;
  }
}

/**
 * Get driver location from backend
 */
export async function fetchDriverLocation(driverId: number) {
  try {
    const location = await secureFetch(`/drivers/location/${driverId}`);
    return location; // { lat, lng, timestamp }
  } catch (error) {
    console.error("Error fetching driver location:", error);
    return null;
  }
}

/**
 * Post driver location to backend
 */
export async function updateDriverLocation(
  driverId: number,
  lat: number,
  lng: number
) {
  try {
    await secureFetch("/drivers/location", {
      method: "POST",
      body: JSON.stringify({ driver_id: driverId, lat, lng }),
    });
  } catch (error) {
    console.error("❌ Failed to update driver location:", error);
  }
}
