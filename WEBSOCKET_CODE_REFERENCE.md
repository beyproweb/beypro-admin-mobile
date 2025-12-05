# WebSocket Implementation - Code Reference & Examples

## Table of Contents

1. [MapModal Component API](#mapmodal-component-api)
2. [Backend Integration Examples](#backend-integration-examples)
3. [Socket.io Event Examples](#socketio-event-examples)
4. [JavaScript/WebView Bridge](#javascriptwebview-bridge)
5. [Testing Mock Data](#testing-mock-data)
6. [Troubleshooting Code Snippets](#troubleshooting-code-snippets)

---

## MapModal Component API

### Import

```typescript
import {
  MapModal,
  MapModalRef,
  DriverLocationUpdate,
} from "../../src/components/MapModal";
```

### Type Definitions

```typescript
interface MapModalProps {
  visible: boolean;
  onDismiss: () => void;
  orderId: number;
  driverId?: string | number;
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
  driverName?: string;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

interface MapModalRef {
  updateDriverLocation: (
    lat: number,
    lng: number,
    driverId?: string | number
  ) => void;
}

interface DriverLocationUpdate {
  driver_id: string | number;
  lat: number;
  lng: number;
  timestamp?: number;
}
```

### Component Usage

```typescript
import { useRef } from "react";

export const MyComponent = () => {
  const mapModalRef = useRef<MapModalRef>(null);

  const updateDriverLocation = (lat: number, lng: number) => {
    mapModalRef.current?.updateDriverLocation(lat, lng, "driver_123");
  };

  return (
    <MapModal
      ref={mapModalRef}
      visible={true}
      onDismiss={() => console.log("Map closed")}
      orderId={12345}
      driverId="driver_123"
      deliveryLat={40.7128}
      deliveryLng={-74.006}
      deliveryAddress="123 Main St, New York, NY"
      pickupLat={40.715}
      pickupLng={-74.01}
      pickupAddress="456 Oak Ave, New York, NY"
      driverName="John Doe"
    />
  );
};
```

---

## Backend Integration Examples

### Node.js + Express + Socket.io

#### Installation

```bash
npm install socket.io express
```

#### Basic Server Setup

```javascript
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

#### Location Update Endpoint

```javascript
app.post("/drivers/location", express.json(), async (req, res) => {
  const { driver_id, lat, lng } = req.body;

  // Validate
  if (!driver_id || typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    // 1. Save to database
    const driver = await Driver.findByIdAndUpdate(
      driver_id,
      {
        current_lat: lat,
        current_lng: lng,
        last_location_update: new Date(),
        is_active: true,
      },
      { new: true }
    );

    // 2. Find associated order
    const order = await Order.findOne({
      driver_id: driver_id,
      status: { $in: ["assigned", "picked_up", "in_transit"] },
    });

    // 3. Broadcast to restaurant admins
    if (order) {
      io.to(`restaurant_${order.restaurant_id}`).emit(
        "driver_location_updated",
        {
          driver_id: driver_id,
          lat: lat,
          lng: lng,
          timestamp: Date.now(),
          order_id: order._id,
        }
      );

      console.log(`📍 Broadcasted location for driver ${driver_id}`);
    }

    res.json({ success: true, driver });
  } catch (error) {
    console.error("Location update error:", error);
    res.status(500).json({ error: error.message });
  }
});
```

#### Socket.io Event Handler

```javascript
io.on("connection", (socket) => {
  const { restaurantId, userId } = socket.handshake.auth;

  console.log(`User ${userId} connected for restaurant ${restaurantId}`);

  // Join restaurant room
  socket.join(`restaurant_${restaurantId}`);

  // Listen for admin joining
  socket.on("join_restaurant", (id) => {
    socket.join(`restaurant_${id}`);
    console.log(`Admin joined restaurant ${id}`);
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected`);
    socket.leave(`restaurant_${restaurantId}`);
  });
});
```

#### Emit Location to Multiple Drivers

```javascript
// When tracking multiple drivers
const updateMultipleDrivers = async (restaurantId, drivers) => {
  for (const driver of drivers) {
    io.to(`restaurant_${restaurantId}`).emit("driver_location_updated", {
      driver_id: driver.id,
      lat: driver.latitude,
      lng: driver.longitude,
      timestamp: Date.now(),
    });
  }
};

// Usage
updateMultipleDrivers("rest_123", [
  { id: "driver_1", latitude: 40.7128, longitude: -74.006 },
  { id: "driver_2", latitude: 40.715, longitude: -74.01 },
]);
```

---

## Socket.io Event Examples

### Client-Side (React Native)

```typescript
import { io, Socket } from "socket.io-client";

// Connect
const socket: Socket = io("https://your-backend.com", {
  transports: ["websocket", "polling"],
  withCredentials: true,
  auth: { restaurantId: "rest_123" },
});

// Listen for connection
socket.on("connect", () => {
  console.log("Connected! Socket ID:", socket.id);
  socket.emit("join_restaurant", "rest_123");
});

// Listen for location updates
socket.on("driver_location_updated", (data) => {
  console.log("Driver location:", data);
  // data = { driver_id: "123", lat: 40.7128, lng: -74.0060, timestamp: ... }
});

// Handle errors
socket.on("error", (error) => {
  console.error("Socket error:", error);
});

// Disconnect
socket.on("disconnect", () => {
  console.log("Disconnected from server");
});
```

### Server-Side Broadcast

```javascript
// Emit to all connected clients
io.emit('driver_location_updated', {
  driver_id: '123',
  lat: 40.7128,
  lng: -74.0060
});

// Emit to specific room
io.to('restaurant_rest_123').emit('driver_location_updated', {
  driver_id: '123',
  lat: 40.7128,
  lng: -74.0060
});

// Emit to all except sender
socket.broadcast.emit('driver_location_updated', {...});

// Emit to user in room
io.in('restaurant_rest_123').emit('driver_location_updated', {...});
```

---

## JavaScript/WebView Bridge

### MapModal Update Method

```typescript
// In React Native component
const handleLocationUpdate = (
  lat: number,
  lng: number,
  driverId?: string | number
) => {
  console.log(`📍 Real-time update - Driver ${driverId}: ${lat}, ${lng}`);

  if (webViewRef.current && mapReadyRef.current) {
    const message = JSON.stringify({
      type: "UPDATE_LOCATION",
      driver_id: driverId || "driver",
      lat,
      lng,
      timestamp: Date.now(),
    });
    webViewRef.current.postMessage(message);
  }
};
```

### WebView Message Handler

```javascript
// Inside WebView HTML/JavaScript
window.addEventListener("message", function (event) {
  try {
    const data = JSON.parse(event.data);

    if (data.type === "UPDATE_LOCATION" && window.mapInstance) {
      const markerId = data.driver_id;
      const lat = data.lat;
      const lng = data.lng;

      // Check if marker exists
      if (window.mapMarkers[markerId]) {
        // Update existing marker
        window.mapMarkers[markerId].setLatLng([lat, lng]);
        console.log(`Updated marker: ${markerId}`);
      } else {
        // Create new marker
        window.mapMarkers[markerId] = L.circleMarker([lat, lng], {
          radius: 8,
          color: "#3B82F6",
          fillColor: "#3B82F6",
          weight: 2,
          opacity: 0.7,
        })
          .addTo(window.mapInstance)
          .bindPopup(`Driver ${markerId}`);
        console.log(`Created new marker: ${markerId}`);
      }

      // Pan map to show update
      window.mapInstance.panTo([lat, lng]);
    }
  } catch (error) {
    console.error("Message handling error:", error);
  }
});
```

### Leaflet Marker Operations

```javascript
// Create marker
const marker = L.circleMarker([40.7128, -74.006], {
  radius: 8,
  color: "#3B82F6",
  fillColor: "#3B82F6",
  weight: 2,
  opacity: 0.7,
}).addTo(map);

// Update position
marker.setLatLng([40.7135, -74.0055]);

// Get current position
const position = marker.getLatLng();
console.log(position.lat, position.lng);

// Update appearance
marker.setStyle({
  color: "#FF0000",
  radius: 10,
});

// Pan map to marker
map.panTo(marker.getLatLng());

// Remove marker
map.removeLayer(marker);

// Bind popup
marker.bindPopup("Driver Information");
```

---

## Testing Mock Data

### Postman Request to Send Location

```http
POST http://localhost:3000/drivers/location
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "driver_id": "driver_123",
  "lat": 40.7128,
  "lng": -74.0060
}
```

### JavaScript Test Function

```javascript
// In browser console or Node
async function testLocationUpdate() {
  const locations = [
    { driver_id: "driver_1", lat: 40.7128, lng: -74.006 },
    { driver_id: "driver_1", lat: 40.7135, lng: -74.0055 },
    { driver_id: "driver_1", lat: 40.7142, lng: -74.005 },
  ];

  for (const loc of locations) {
    const response = await fetch("/drivers/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loc),
    });
    console.log(await response.json());
    await new Promise((r) => setTimeout(r, 1000)); // Wait 1s
  }
}

testLocationUpdate();
```

### Socket.io Test Client

```javascript
const { io } = require("socket.io-client");

const socket = io("http://localhost:3000", {
  auth: { restaurantId: "test_rest" },
});

socket.on("connect", () => {
  console.log("Connected!");

  // Simulate receiving location
  socket.on("driver_location_updated", (data) => {
    console.log("Location update:", data);
  });
});

// Send mock updates
setTimeout(() => {
  socket.emit("driver_location_update", {
    driver_id: "driver_123",
    lat: 40.7128,
    lng: -74.006,
  });
}, 1000);
```

### React Native Test Mock

```typescript
// Mock data for testing
const MOCK_LOCATIONS = [
  { driver_id: "driver_1", lat: 40.7128, lng: -74.006 },
  { driver_id: "driver_1", lat: 40.7135, lng: -74.0055 },
  { driver_id: "driver_1", lat: 40.7142, lng: -74.005 },
];

// Test function
const testRealTimeUpdates = () => {
  let index = 0;
  const interval = setInterval(() => {
    if (index < MOCK_LOCATIONS.length) {
      const loc = MOCK_LOCATIONS[index];
      mapModalRef.current?.updateDriverLocation(
        loc.lat,
        loc.lng,
        loc.driver_id
      );
      index++;
    } else {
      clearInterval(interval);
    }
  }, 2000); // Every 2 seconds
};
```

---

## Troubleshooting Code Snippets

### 1. Check Socket Connection

```typescript
if (socketRef.current?.connected) {
  console.log("✅ Socket connected");
  console.log("Socket ID:", socketRef.current.id);
} else {
  console.log("❌ Socket not connected");
}
```

### 2. Verify Map Ready State

```typescript
console.log("Map ready?", mapReadyRef.current);
console.log("WebView ref?", webViewRef.current !== null);
```

### 3. Debug PostMessage

```typescript
const testPostMessage = () => {
  if (webViewRef.current && mapReadyRef.current) {
    const testMessage = JSON.stringify({
      type: "UPDATE_LOCATION",
      driver_id: "test_driver",
      lat: 40.7128,
      lng: -74.006,
      timestamp: Date.now(),
    });

    console.log("Sending test message:", testMessage);
    webViewRef.current.postMessage(testMessage);
  } else {
    console.error("Can't send: WebView or map not ready");
  }
};
```

### 4. Monitor Marker Count

```javascript
// In WebView console
setInterval(() => {
  console.log("Active markers:", Object.keys(window.mapMarkers).length);
  console.log("Markers:", Object.keys(window.mapMarkers));
}, 5000);
```

### 5. Check Event Listeners

```javascript
// Verify listeners are attached
console.log(
  "Message listener attached?",
  window.onmessage !== null || (window.addEventListener && true)
);
```

### 6. Memory Monitoring

```typescript
// React Native profiler
console.log(require("react-native/package.json").version);

// Check component mounting/unmounting
useEffect(() => {
  console.log("MapModal mounted");
  return () => console.log("MapModal unmounted");
}, []);
```

### 7. Error Boundary Wrapper

```typescript
interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
}

class MapErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("MapModal error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <Text>Map Error - Check console</Text>;
    }
    return this.props.children;
  }
}
```

---

## Performance Optimization Tips

### Throttle Updates

```typescript
const throttleLocationUpdate = (() => {
  let lastUpdate = 0;
  const THROTTLE_MS = 1000; // 1 second

  return (lat: number, lng: number, driverId?: string | number) => {
    const now = Date.now();
    if (now - lastUpdate >= THROTTLE_MS) {
      handleLocationUpdate(lat, lng, driverId);
      lastUpdate = now;
    }
  };
})();
```

### Debounce Map Pan

```javascript
const debouncedPan = (() => {
  let timer: any;
  return (lat: number, lng: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (window.mapInstance) {
        window.mapInstance.panTo([lat, lng]);
      }
    }, 500);
  };
})();
```

### Batch Updates

```typescript
const batchUpdates: DriverLocationUpdate[] = [];
let batchTimer: any = null;

const addToBatch = (update: DriverLocationUpdate) => {
  batchUpdates.push(update);

  if (!batchTimer) {
    batchTimer = setTimeout(() => {
      batchUpdates.forEach((update) => {
        mapModalRef.current?.updateDriverLocation(
          update.lat,
          update.lng,
          update.driver_id
        );
      });
      batchUpdates.length = 0;
      batchTimer = null;
    }, 100);
  }
};
```

---

## Production Deployment Checklist

- [ ] Error handling for all edge cases
- [ ] Logging configured appropriately
- [ ] No console.logs left for production
- [ ] Memory leaks prevented (cleanup in useEffect)
- [ ] Socket.io auth properly configured
- [ ] Backend emitting on correct events
- [ ] Rate limiting implemented
- [ ] Performance acceptable (<100ms latency)
- [ ] Graceful degradation if WebSocket fails
- [ ] Tested on physical devices
- [ ] Monitoring/alerting configured
