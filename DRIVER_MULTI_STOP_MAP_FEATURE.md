# Driver Multi-Stop Route Visualization - Feature Implementation Guide

## 📋 Overview

Upgrade the existing map to show all driver's assigned pickup/delivery stops as a complete route with:

- Numbered markers (A, B, C, etc.)
- Polyline connecting all stops
- Total route duration & distance
- ETA for each stop
- Time per delivery calculation
- Route progress animation

---

## 🎯 Feature Architecture

### 1. Data Structure

```typescript
interface DeliveryStop {
  id: string;
  type: "pickup" | "delivery";
  orderId: number;
  position: number; // A=1, B=2, C=3...
  address: string;
  latitude: number;
  longitude: number;
  estimatedArrivalTime?: number; // Unix timestamp
  estimatedDuration?: number; // Minutes
  actualArrivalTime?: number; // When driver arrived
  actualDepartureTime?: number; // When driver left
  status: "pending" | "in_progress" | "completed";
  customerName?: string;
  orderNumber?: string;
}

interface RouteInfo {
  totalDistance: number; // km
  totalDuration: number; // minutes
  stops: DeliveryStop[];
  optimizedRoute?: google.maps.LatLng[];
  polylinePoints?: string; // Encoded polyline
}
```

### 2. API Endpoints Needed

```typescript
// Get all active orders for driver (with coordinates)
GET / drivers / { driverId } / active - orders;
Response: {
  orders: Array<{
    id: number;
    pickup_lat: number;
    pickup_lng: number;
    pickup_address: string;
    delivery_lat: number;
    delivery_lng: number;
    delivery_address: string;
    customer_name: string;
    order_number: string;
  }>;
}

// Get optimized route for multiple stops
POST / directions / optimize - route;
Body: {
  waypoints: Array<{ lat: number; lng: number }>;
  origin: {
    lat: number;
    lng: number;
  }
  destination: {
    lat: number;
    lng: number;
  }
}
Response: {
  routes: Array<{
    distance: number;
    duration: number;
    legs: Array<{ distance: number; duration: number }>;
    polylinePoints: string;
  }>;
}

// Update stop status when driver arrives/leaves
PATCH / orders / { orderId } / stop - event;
Body: {
  eventType: "arrived" | "departed";
  timestamp: number;
  location: {
    lat: number;
    lng: number;
  }
}
```

---

## 🗺️ Map UI Components

### Enhanced MapModal Component

```typescript
interface EnhancedMapModalProps {
  visible: boolean;
  onDismiss: () => void;
  driverId: string;
  mode: "single" | "multi-stop"; // New mode
  // For single order (existing):
  orderId?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  // For multi-stop (new):
  activeOrders?: DeliveryStop[];
  routeInfo?: RouteInfo;
}
```

### HTML/JavaScript Enhancements

```javascript
// In WebView HTML
interface MapState {
  markers: Map<string, L.CircleMarker | L.Marker>; // One per stop
  polyline: L.Polyline;
  currentLocation: L.CircleMarker;
  stops: DeliveryStop[];
  totalDuration: number;
  totalDistance: number;
}

// Marker numbering (A, B, C...)
function getStopLabel(index: number): string {
  return String.fromCharCode(65 + index); // 65 = 'A'
}

// Create numbered marker
function createStopMarker(stop: DeliveryStop, index: number) {
  const label = getStopLabel(index);
  const color = stop.type === "pickup" ? "#FCD34D" : "#34D399";
  const borderColor = stop.status === "completed" ? "#10B981" : color;

  return L.circleMarker([stop.latitude, stop.longitude], {
    radius: 12,
    color: borderColor,
    fillColor: color,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8,
  }).bindPopup(`${label}. ${stop.type.toUpperCase()}\n${stop.address}`);
}

// Draw polyline connecting all stops
function drawRoute(stops: DeliveryStop[]) {
  const points = stops.map((s) => [s.latitude, s.longitude]);
  const polyline = L.polyline(points, {
    color: "#2563EB",
    weight: 3,
    opacity: 0.7,
    dashArray: "5, 5", // Optional: dashed line
  }).addTo(map);

  return polyline;
}

// Update marker appearance as driver progresses
function updateStopStatus(
  stopId: string,
  status: "pending" | "in_progress" | "completed"
) {
  const marker = markers.get(stopId);
  if (marker) {
    marker.setStyle({
      fillColor: status === "completed" ? "#10B981" : "#FCD34D",
      opacity: status === "completed" ? 0.6 : 1,
    });
  }
}
```

---

## 📊 UI Layout - Multi-Stop Map Screen

```
┌─────────────────────────────────────┐
│  HEADER: "My Route" | 5 Stops       │
│  Total: 45 min | 12.5 km            │
├─────────────────────────────────────┤
│                                     │
│          🗺️ MAP                     │
│   A 🟡 -- Pickup 1 (15 min)       │
│   B 🟢 -- Delivery 1 (8 min)      │
│   C 🟡 -- Pickup 2 (12 min)       │
│   D 🟢 -- Delivery 2 (5 min)      │
│   E 🟢 -- Delivery 3 (5 min)      │
│                                     │
│   🔵 Driver position (animates)    │
│   Polyline connecting all stops     │
│                                     │
├─────────────────────────────────────┤
│  BOTTOM SHEET: Stop Details         │
│  ┌─────────────────────────────────┐│
│  │ CURRENT STOP (A - Pickup)       ││
│  │ 📍 123 Main St                  ││
│  │ ⏱️ ETA: 5 min                   ││
│  │ ✓ Mark as Arrived [BTN]         ││
│  │                                 ││
│  │ NEXT STOPS:                     ││
│  │ B - Delivery  (15 min away)     ││
│  │ C - Pickup    (25 min away)     ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## 🔄 Data Flow

```
Driver App Opens
    ↓
GET /drivers/{id}/active-orders
    ↓
Response with all pickups/deliveries
    ↓
POST /directions/optimize-route (with all waypoints)
    ↓
Response with polyline & durations
    ↓
MapModal renders:
  - Create stop markers A, B, C...
  - Draw polyline connecting stops
  - Show total time/distance at top
  - Show current stop info in bottom sheet
    ↓
As driver moves (every 5s):
  - Update driver position (blue marker)
  - Check if reached next stop
  - Update stop status (pending → in_progress)
  - Recalculate ETAs for remaining stops
  - Animate polyline progress indicator
    ↓
When driver clicks "Arrived at Stop":
  - PATCH /orders/{id}/stop-event (arrived)
  - Update marker color to grey/completed
  - Move to next stop
  - Recalculate route
```

---

## 🛠️ Implementation Steps

### Phase 1: Backend Setup

1. Create `/drivers/{id}/active-orders` endpoint
2. Integrate Google Directions API for route optimization
3. Create `/directions/optimize-route` endpoint
4. Add `stop-event` tracking endpoint

### Phase 2: Data Types & Models

1. Define `DeliveryStop` and `RouteInfo` types
2. Update MapModal props interface
3. Create utility functions for calculations

### Phase 3: Map Enhancement

1. Extend MapModal to support `multi-stop` mode
2. Update WebView HTML with:
   - Stop marker rendering (A, B, C...)
   - Polyline drawing
   - Stop numbering logic
3. Add postMessage handlers for route updates

### Phase 4: UI Components

1. Create route info header (distance, duration)
2. Create stop details bottom sheet
3. Add action buttons (Mark Arrived, Skip Stop, etc.)

### Phase 5: Real-time Updates

1. Track driver position updates
2. Detect stop arrival (GPS within 50m radius)
3. Auto-update stop status
4. Recalculate ETAs
5. Animate progress

### Phase 6: Testing & Polish

1. Test with 5-10 stops
2. Test route optimization
3. Performance optimization
4. Edge case handling

---

## 💻 Code Structure

```
src/
├── components/
│   ├── MapModal.tsx (ENHANCED)
│   │   ├── Single stop mode (existing)
│   │   └── Multi-stop mode (new)
│   ├── RouteHeader.tsx (NEW)
│   │   ├── Display total duration
│   │   ├── Display total distance
│   │   └── Show stop count
│   └── StopDetailsSheet.tsx (NEW)
│       ├── Current stop info
│       ├── Next stops list
│       ├── Actions (Arrived, Skip)
│       └── ETA display
│
├── types/
│   ├── delivery.ts (NEW)
│   │   ├── DeliveryStop interface
│   │   └── RouteInfo interface
│   └── directions.ts (NEW)
│       └── Google Directions types
│
├── api/
│   ├── deliveries.ts (NEW)
│   │   ├── getActiveOrders()
│   │   ├── updateStopEvent()
│   │   └── getOptimizedRoute()
│   └── directions.ts (NEW)
│       └── calculateRoute()
│
└── utils/
    ├── routeCalculations.ts (NEW)
    │   ├── calculateETA()
    │   ├── calculateDistance()
    │   ├── detectStopArrival()
    │   └── getTimePerDelivery()
    └── mapUtils.ts
        ├── createStopMarker()
        ├── drawPolyline()
        └── updateMarkerStatus()
```

---

## 📱 User Experience Flow

### Driver Perspective

```
1. Driver opens app → "My Route" button
2. See all stops on map with letters A, B, C...
3. Blue line connects all stops in order
4. Header shows: "45 min total | 12.5 km"
5. Bottom sheet shows current stop (A - Pickup)
6. Driver sees: "📍 123 Main St | ETA: 5 min"
7. Driver clicks "Mark as Arrived"
8. Stop A marker turns grey (completed)
9. Bottom sheet updates to show Stop B (current)
10. Blue marker animates as driver drives
11. App alerts when approaching next stop
12. Repeat until all deliveries complete
```

---

## 🎨 Marker States

```
MARKER STATUS                COLOR      OPACITY
──────────────────────────────────────────────
Pending (Not reached)        Yellow     1.0
In Progress (Current)        Orange     1.0 + Pulse animation
Completed                    Green      0.6 (faded)
Skipped                      Red        0.6 (faded)

PICKUP vs DELIVERY
──────────────────
Pickup:                      🟡 Yellow circle
Delivery:                    🟢 Green circle
```

---

## ⚡ Performance Considerations

- **Limit stops**: Max 20 stops per route (Google Directions limit)
- **Debounce updates**: Only recalculate route every 30 seconds
- **Lazy load**: Don't fetch all orders, only active ones
- **Optimize polyline**: Use encoded polyline string (smaller payload)
- **Cache routes**: Store route for 5 minutes if stops don't change
- **Batch updates**: Send all stop events in single request when possible

---

## 🧪 Testing Scenarios

### Test Case 1: Basic Multi-Stop Route

- Create order with 3 pickups and 3 deliveries
- Verify all 6 stops appear as A-F on map
- Verify polyline connects all in correct order
- Verify total time/distance displayed

### Test Case 2: Route Progress

- Start with driver 1km away from first stop
- Simulate GPS movement towards stop A
- Verify ETA counts down
- Verify arrival detection triggers at 50m radius
- Verify marker color changes to completed

### Test Case 3: Route Optimization

- Send 5 stops in random order
- Call optimize-route API
- Verify polyline shows optimal sequence
- Verify ETAs reflect optimized route

### Test Case 4: Real-time Updates

- Have driver move in real-time
- Verify blue marker updates every 5 seconds
- Verify ETAs recalculate as driver moves
- Verify no lag or stuttering

### Test Case 5: Edge Cases

- Test with 1 stop (should work like current)
- Test with 20 stops (max)
- Test with stops very close together
- Test with driver offline (graceful degradation)

---

## 🔗 Integration Points

### With Existing Features

- Reuse current GPS location tracking
- Reuse WebSocket for real-time updates
- Reuse secureFetch for API calls
- Extend BottomSheet for stop details
- Extend MapModal for multi-stop

### New Integrations

- Google Directions API (route optimization)
- Geofencing library (arrival detection)
- Notification system (approach alerts)

---

## 📊 Metrics to Track

- Average route completion time
- Number of stops per route
- Route optimization efficiency (actual vs optimal time)
- Arrival detection accuracy
- User engagement (how often drivers view route)

---

## 🚀 MVP vs Full Features

### MVP (Phase 1)

- ✅ Show all stops on map (A, B, C...)
- ✅ Draw connecting polyline
- ✅ Display total time/distance
- ✅ Show current stop details
- ✅ Mark stop as complete

### Full Features (Phase 2+)

- 🔄 Route optimization algorithm
- 🔄 Automatic arrival detection
- 🔄 Route progress animation
- 🔄 ETA recalculation
- 🔄 Skip/reorder stops
- 🔄 Delivery photo/signature
- 🔄 Customer SMS notifications
- 🔄 Performance analytics

---

## 💡 Enhancement Ideas

1. **Swipe through stops** - Swipe on bottom sheet to navigate stops
2. **Drag to reorder** - Allow drivers to reorder stops on map
3. **Quick actions** - One-tap buttons for common actions
4. **Voice guidance** - Turn-by-turn navigation for each leg
5. **Stop history** - Timeline view of completed stops
6. **Performance stats** - Show driver's avg delivery time
7. **Customer notifications** - Auto SMS when driver arrives
8. **Proof of delivery** - Photo/signature capture per stop
9. **Tip tracking** - Show accumulated tips as day progresses
10. **Route sharing** - Share route with manager for tracking

---

## 📚 Related Documentation

- Current MapModal: `src/components/MapModal.tsx`
- WebSocket setup: `WEBSOCKET_IMPLEMENTATION.md`
- Backend guide: `BACKEND_WEBSOCKET_GUIDE.md`
- Google Directions API: https://developers.google.com/maps/documentation/directions/overview
- Leaflet routing: https://www.liedman.net/leaflet-routing-machine/

---

## ✅ Rollout Checklist

- [ ] Backend APIs implemented and tested
- [ ] Google Directions API integrated
- [ ] Frontend components created
- [ ] WebView JavaScript updated
- [ ] Real-time updates working
- [ ] QA testing complete
- [ ] Performance testing passed
- [ ] Edge cases handled
- [ ] Documentation updated
- [ ] Driver user testing
- [ ] Production deployment

---

**Status**: 📋 Design Complete - Ready for Implementation
**Complexity**: Medium-High (3-4 sprint effort)
**Priority**: High (Major UX improvement for drivers)
**Impact**: Drivers can see full route at a glance, better time management
