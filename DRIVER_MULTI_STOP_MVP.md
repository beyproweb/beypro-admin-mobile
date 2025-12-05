# Driver Multi-Stop Route - MVP Implementation Guide

## 🎯 Quick Start Implementation (Phase 1)

This guide shows you how to implement the MVP (minimum viable product) for multi-stop route visualization.

---

## 📍 What You'll Build (MVP)

✅ Show all stops on map as numbered markers (A, B, C...)
✅ Draw polyline connecting stops in order
✅ Display total route time and distance
✅ Show current stop details (address, ETA)
✅ Mark stops as completed
❌ Route optimization (Phase 2)
❌ Automatic arrival detection (Phase 2)
❌ Voice guidance (Phase 2)

---

## 🏗️ Step 1: Create Data Types

**File**: `src/types/delivery.ts` (NEW)

```typescript
export interface DeliveryStop {
  id: string;
  orderId: number;
  type: "pickup" | "delivery";
  stopNumber: number; // 0 = A, 1 = B, 2 = C...
  address: string;
  latitude: number;
  longitude: number;
  status: "pending" | "in_progress" | "completed";
  customerName?: string;
  orderNumber?: string;
  notes?: string;
}

export interface RouteInfo {
  totalDistance: number; // km
  totalDuration: number; // minutes
  stops: DeliveryStop[];
}

export interface RouteResponse {
  route: RouteInfo;
  polylinePoints?: string;
}
```

---

## 🔌 Step 2: Create API Service

**File**: `src/api/driverRoutes.ts` (NEW)

```typescript
import secureFetch from "./secureFetch";
import { RouteInfo, DeliveryStop } from "../types/delivery";

/**
 * Get all active orders for a driver
 */
export async function getDriverActiveOrders(
  driverId: string
): Promise<RouteInfo> {
  const response = await secureFetch(`/drivers/${driverId}/active-orders`);

  // Transform backend response to DeliveryStop format
  const stops: DeliveryStop[] = [];
  let stopNumber = 0;

  for (const order of response.orders) {
    // Add pickup
    stops.push({
      id: `pickup-${order.id}`,
      orderId: order.id,
      type: "pickup",
      stopNumber: stopNumber++,
      address: order.pickup_address,
      latitude: order.pickup_lat,
      longitude: order.pickup_lng,
      status: "pending",
      orderNumber: order.order_number,
      customerName: order.customer_name,
    });

    // Add delivery
    stops.push({
      id: `delivery-${order.id}`,
      orderId: order.id,
      type: "delivery",
      stopNumber: stopNumber++,
      address: order.delivery_address,
      latitude: order.delivery_lat,
      longitude: order.delivery_lng,
      status: "pending",
      customerName: order.customer_name,
      orderNumber: order.order_number,
    });
  }

  // Calculate total distance & duration (placeholder - will improve in Phase 2)
  const totalDistance = calculateDistance(stops);
  const totalDuration = calculateDuration(stops);

  return {
    totalDistance,
    totalDuration,
    stops,
  };
}

/**
 * Mark a stop as completed
 */
export async function markStopCompleted(
  orderId: number,
  stopType: "pickup" | "delivery"
): Promise<boolean> {
  const response = await secureFetch(`/orders/${orderId}/stop-event`, {
    method: "PATCH",
    body: JSON.stringify({
      eventType: stopType === "pickup" ? "arrived_pickup" : "arrived_delivery",
      timestamp: Date.now(),
    }),
  });

  return response.success;
}

/**
 * Simple distance calculation (placeholder)
 * TODO: Replace with actual Google Directions API in Phase 2
 */
function calculateDistance(stops: DeliveryStop[]): number {
  if (stops.length < 2) return 0;

  let totalDist = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const dist = haversineDistance(
      stops[i].latitude,
      stops[i].longitude,
      stops[i + 1].latitude,
      stops[i + 1].longitude
    );
    totalDist += dist;
  }
  return Math.round(totalDist * 10) / 10; // km
}

/**
 * Haversine formula for distance between coordinates
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate duration (placeholder)
 * TODO: Use actual Google Directions API in Phase 2
 */
function calculateDuration(stops: DeliveryStop[]): number {
  if (stops.length < 2) return 0;

  // Assume avg 40 km/h + 5 min per stop
  const distance = calculateDistance(stops);
  const drivingTime = (distance / 40) * 60; // minutes
  const stopTime = stops.length * 5; // 5 min per stop

  return Math.round(drivingTime + stopTime);
}
```

---

## 🗺️ Step 3: Update MapModal

**File**: `src/components/MapModal.tsx` (MODIFIED)

Update the props interface:

```typescript
interface MapModalProps {
  visible: boolean;
  onDismiss: () => void;
  orderId?: number; // Optional - for single order mode
  driverId?: string | number;

  // NEW: Multi-stop mode
  mode?: "single" | "multi-stop"; // Defaults to 'single'
  stops?: DeliveryStop[]; // All stops for multi-stop mode
  routeInfo?: RouteInfo; // Total distance/duration
  onStopCompleted?: (stopId: string) => void; // Callback when stop marked complete

  // Existing single-mode props...
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
}
```

Update the HTML generation for multi-stop mode:

```typescript
const getMapHTML = () => {
  const mode = mode || "single";

  if (mode === "multi-stop" && stops && stops.length > 0) {
    return getMultiStopMapHTML();
  }

  // Existing single-stop logic...
  return getSingleStopMapHTML();
};

const getMultiStopMapHTML = () => {
  const stops = stops || [];
  if (stops.length === 0) return "<html>No stops</html>";

  // Center map on first stop
  const centerLat = stops[0].latitude;
  const centerLng = stops[0].longitude;

  // Generate markers
  const markersCode = stops
    .map((stop, idx) => {
      const label = String.fromCharCode(65 + idx); // A, B, C...
      const color = stop.type === "pickup" ? "#FCD34D" : "#34D399";
      return `
        window.markers['${stop.id}'] = L.circleMarker(
          [${stop.latitude}, ${stop.longitude}],
          {
            radius: 14,
            color: '${color}',
            fillColor: '${color}',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }
        )
        .addTo(map)
        .bindPopup('${label}. ${stop.type.toUpperCase()}<br/>${stop.address}');
        
        // Add label to marker (custom HTML)
        var label = L.divIcon({
          html: '<div style="font-size:12px;font-weight:bold;color:#000;">${label}</div>',
          iconSize: [30, 30],
          className: 'stop-label'
        });
      `;
    })
    .join("\n");

  // Generate polyline
  const points = stops.map((s) => `[${s.latitude},${s.longitude}]`).join(",");
  const polylineCode = `
    window.polyline = L.polyline([${points}], {
      color: '#2563EB',
      weight: 3,
      opacity: 0.7,
      dashArray: '5, 5'
    }).addTo(map);
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
*{margin:0;padding:0}
html,body{width:100%;height:100%;background:#fff;font-family:system-ui}
#map{width:100%;height:100%;background:#eee}
.stop-label{background:none !important;border:none !important}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script>
<script>
window.mapInstance = null;
window.markers = {};
window.polyline = null;

window.addEventListener('load', function(){
  try{
    console.log('Creating multi-stop map');
    var m = L.map('map', {center:[${centerLat},${centerLng}], zoom:14});
    window.mapInstance = m;
    
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {maxZoom:20}).addTo(m);
    
    // Create markers
    ${markersCode}
    
    // Draw polyline
    ${polylineCode}
    
    // Fit bounds to show all markers
    var group = new L.featureGroup(Object.values(window.markers));
    m.fitBounds(group.getBounds(), {padding: [50, 50]});
    
    window.mapReady = true;
    console.log('Multi-stop map ready');
  }catch(e){
    console.error(e);
    document.body.innerHTML='<div style="padding:20px;color:red;">Error: '+e.message+'</div>';
  }
});

// Handle messages from React Native
window.addEventListener('message', function(e){
  try{
    var data = JSON.parse(e.data);
    
    if(data.type === 'UPDATE_DRIVER_LOCATION' && window.mapInstance){
      if(!window.driverMarker){
        window.driverMarker = L.circleMarker([data.lat, data.lng], {
          radius: 8,
          color: '#1D4ED8',
          fillColor: '#3B82F6',
          weight: 2
        }).addTo(window.mapInstance);
      } else {
        window.driverMarker.setLatLng([data.lat, data.lng]);
      }
      window.mapInstance.panTo([data.lat, data.lng]);
    }
    
    if(data.type === 'MARK_STOP_COMPLETED' && window.markers[data.stopId]){
      window.markers[data.stopId].setStyle({
        fillColor: '#10B981',
        color: '#059669',
        opacity: 0.6
      });
    }
  }catch(e){
    console.error('Message error:', e);
  }
});
</script>
</body>
</html>`;

  return html;
};
```

---

## 🎨 Step 4: Create Route Header Component

**File**: `src/components/RouteHeader.tsx` (NEW)

```typescript
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RouteInfo } from "../types/delivery";
import { Ionicons } from "@expo/vector-icons";

interface RouteHeaderProps {
  routeInfo: RouteInfo;
  currentStopNumber: number;
}

export const RouteHeader: React.FC<RouteHeaderProps> = ({
  routeInfo,
  currentStopNumber,
}) => {
  const currentStop = String.fromCharCode(65 + currentStopNumber);
  const totalStops = String.fromCharCode(65 + routeInfo.stops.length - 1);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>My Route</Text>
        <Text style={styles.stops}>
          {currentStop} of {totalStops} • {routeInfo.stops.length} stops
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={16} color="#2563EB" />
          <Text style={styles.statText}>{routeInfo.totalDuration} min</Text>
        </View>

        <View style={styles.stat}>
          <Ionicons name="navigate-outline" size={16} color="#2563EB" />
          <Text style={styles.statText}>{routeInfo.totalDistance} km</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  stops: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
});
```

---

## 📋 Step 5: Create Stop Details Component

**File**: `src/components/StopDetailsSheet.tsx` (NEW)

```typescript
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { DeliveryStop } from "../types/delivery";
import { Ionicons } from "@expo/vector-icons";

interface StopDetailsSheetProps {
  currentStop: DeliveryStop;
  nextStops: DeliveryStop[];
  onMarkCompleted: (stopId: string) => void;
  onSkip?: (stopId: string) => void;
}

export const StopDetailsSheet: React.FC<StopDetailsSheetProps> = ({
  currentStop,
  nextStops,
  onMarkCompleted,
  onSkip,
}) => {
  const stopLabel = String.fromCharCode(65 + currentStop.stopNumber);

  return (
    <View style={styles.container}>
      {/* Current Stop */}
      <View style={styles.currentStop}>
        <View style={styles.stopLabel}>
          <Text style={styles.labelText}>{stopLabel}</Text>
        </View>

        <View style={styles.stopInfo}>
          <Text style={styles.stopType}>{currentStop.type.toUpperCase()}</Text>
          <Text style={styles.address}>{currentStop.address}</Text>
          {currentStop.customerName && (
            <Text style={styles.customer}>📞 {currentStop.customerName}</Text>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={() => onMarkCompleted(currentStop.id)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.completeText}>Mark as Complete</Text>
        </TouchableOpacity>

        {onSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => onSkip(currentStop.id)}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Next Stops */}
      {nextStops.length > 0 && (
        <View style={styles.nextStops}>
          <Text style={styles.nextStopsTitle}>Next Stops</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {nextStops.slice(0, 3).map((stop, idx) => {
              const label = String.fromCharCode(65 + stop.stopNumber);
              return (
                <View key={stop.id} style={styles.nextStopItem}>
                  <Text style={styles.nextStopLabel}>{label}</Text>
                  <View style={styles.nextStopDetails}>
                    <Text style={styles.nextStopAddress}>{stop.address}</Text>
                    <Text style={styles.nextStopType}>
                      {stop.type === "pickup" ? "📦" : "🚚"} {stop.type}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 16,
    maxHeight: "40%",
  },
  currentStop: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  stopLabel: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FCD34D",
    justifyContent: "center",
    alignItems: "center",
  },
  labelText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  stopInfo: {
    flex: 1,
  },
  stopType: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
    textTransform: "uppercase",
  },
  address: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginTop: 2,
  },
  customer: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  actions: {
    gap: 8,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#10B981",
    borderRadius: 8,
  },
  completeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  skipButton: {
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    alignItems: "center",
  },
  skipText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 13,
  },
  nextStops: {
    gap: 8,
  },
  nextStopsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
  },
  nextStopItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginBottom: 6,
  },
  nextStopLabel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FCD34D",
    color: "#000",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 28,
  },
  nextStopDetails: {
    flex: 1,
  },
  nextStopAddress: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  nextStopType: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
});
```

---

## 🔗 Step 6: Integrate into Driver Screen

Update your driver navigation to include multi-stop mode:

```typescript
import { MapModal } from "../../src/components/MapModal";
import { RouteHeader } from "../../src/components/RouteHeader";
import { StopDetailsSheet } from "../../src/components/StopDetailsSheet";
import {
  getDriverActiveOrders,
  markStopCompleted,
} from "../../src/api/driverRoutes";

export const DriverRoute = () => {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const driverId = user?.id;

  useEffect(() => {
    if (!driverId) return;

    // Load active orders
    getDriverActiveOrders(driverId as string)
      .then((route) => setRouteInfo(route))
      .catch((err) => console.error("Failed to load route:", err));
  }, [driverId]);

  const handleMarkCompleted = async (stopId: string) => {
    const stop = routeInfo?.stops.find((s) => s.id === stopId);
    if (!stop) return;

    try {
      await markStopCompleted(stop.orderId, stop.type);

      // Update local state
      setRouteInfo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stops: prev.stops.map((s) =>
            s.id === stopId ? { ...s, status: "completed" } : s
          ),
        };
      });

      // Move to next stop
      setCurrentStopIndex((prev) => prev + 1);
    } catch (err) {
      console.error("Failed to mark stop:", err);
    }
  };

  if (!routeInfo) return <Text>Loading...</Text>;

  const currentStop = routeInfo.stops[currentStopIndex];
  const nextStops = routeInfo.stops.slice(currentStopIndex + 1);

  return (
    <View style={{ flex: 1 }}>
      <RouteHeader routeInfo={routeInfo} currentStopNumber={currentStopIndex} />

      <MapModal
        visible={true}
        mode="multi-stop"
        stops={routeInfo.stops}
        routeInfo={routeInfo}
        onDismiss={() => {}}
        onStopCompleted={handleMarkCompleted}
      />

      <StopDetailsSheet
        currentStop={currentStop}
        nextStops={nextStops}
        onMarkCompleted={handleMarkCompleted}
      />
    </View>
  );
};
```

---

## 🧪 Testing the MVP

```typescript
// Test data
const mockStops: DeliveryStop[] = [
  {
    id: "pickup-1",
    orderId: 1,
    type: "pickup",
    stopNumber: 0,
    address: "123 Main St",
    latitude: 40.7128,
    longitude: -74.006,
    status: "pending",
    customerName: "John Doe",
  },
  {
    id: "delivery-1",
    orderId: 1,
    type: "delivery",
    stopNumber: 1,
    address: "456 Oak Ave",
    latitude: 40.7135,
    longitude: -74.005,
    status: "pending",
    customerName: "Jane Smith",
  },
  // ... more stops
];

// Test render
<MapModal
  visible={true}
  mode="multi-stop"
  stops={mockStops}
  routeInfo={{
    totalDistance: 2.5,
    totalDuration: 15,
    stops: mockStops,
  }}
  onDismiss={() => {}}
/>;
```

---

## ✅ MVP Checklist

- [ ] Create `delivery.ts` types file
- [ ] Create `driverRoutes.ts` API service
- [ ] Update `MapModal.tsx` with multi-stop mode
- [ ] Create `RouteHeader.tsx` component
- [ ] Create `StopDetailsSheet.tsx` component
- [ ] Integrate into driver screen
- [ ] Test with 3-5 stops
- [ ] Test mark completed flow
- [ ] Verify map shows all markers
- [ ] Verify polyline draws correctly
- [ ] Test on iOS and Android

---

## 📈 Next Phase (When MVP Complete)

- [ ] Integrate Google Directions API for real routes
- [ ] Add automatic arrival detection (geofencing)
- [ ] Add route optimization algorithm
- [ ] Add delivery time tracking
- [ ] Add driver performance metrics
- [ ] Add customer notifications

---

**Estimated Time**: 2-3 days for experienced developer
**Complexity**: Medium
**Testing**: Manual + unit tests recommended
