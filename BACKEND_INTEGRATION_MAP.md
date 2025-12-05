# 🎯 Backend Integration - Delivery Map UI

## Overview

The MapModal component now integrates with your backend to fetch real delivery data and display multi-stop routes with accurate distance/duration calculations.

## 📦 What's Integrated

### 1. **Delivery Route Service** (`src/utils/deliveryRouteService.ts`)

New utility service that provides:

- `fetchDriverRoute(driverId)` - Fetches all orders for a driver
- `calculateRoute(stops)` - Calculates distance and duration using Google Directions API
- `fetchDriverLocation(driverId)` - Gets driver's current location
- `updateDriverLocation(driverId, lat, lng)` - Updates driver location

### 2. **Backend Endpoints**

#### Existing Endpoints (already working)

- `GET /orders?status=open_phone` - Fetch packet/phone orders
- `GET /drivers/geocode?q=address` - Geocode addresses
- `GET /drivers/google-directions` - Get route between two points
- `POST /drivers/location` - Update driver location
- `GET /drivers/location/:driver_id` - Get driver's last known location

#### New Endpoint (added)

- `POST /drivers/calculate-route` - Calculate multi-stop route with distance/duration

  ```
  Request:
  {
    "waypoints": [
      { "lat": 38.123, "lng": 27.456, "address": "..." },
      { "lat": 38.234, "lng": 27.567, "address": "..." },
      ...
    ]
  }

  Response:
  {
    "distance": 12.4,  // km
    "duration": 28     // minutes
  }
  ```

### 3. **MapModal Component Updates**

#### New Props (optional)

Already supported, now enhanced:

- `multiStopMode` - Enable multi-stop route display
- `driverId` - Automatically fetches driver's route from backend
- `route` - Can pass pre-fetched route or let component fetch it

#### New State

- `fetchedRoute` - Stores route fetched from backend

#### Automatic Route Loading

When MapModal opens with `driverId` and `multiStopMode=true`:

```tsx
1. Requests /orders?driver_id={driverId}&status=on_road
2. Converts orders to delivery stops
3. Calls /drivers/calculate-route with all waypoints
4. Updates UI with real distance/duration
5. Renders all stops with accurate ETAs
```

## 🔌 Usage in Packet Orders

### Single Delivery (already working)

```tsx
<MapModal
  visible={mapModalVisible}
  onDismiss={() => setMapModalVisible(false)}
  orderId={order.id}
  deliveryLat={order.delivery_lat}
  deliveryLng={order.delivery_lng}
  deliveryAddress={order.delivery_address}
  pickupLat={order.pickup_lat}
  pickupLng={order.pickup_lng}
  pickupAddress={order.pos_location}
/>
```

### Multi-Stop Route (NEW)

```tsx
<MapModal
  visible={mapModalVisible}
  onDismiss={() => setMapModalVisible(false)}
  driverId={driverId} // Fetches route automatically!
  multiStopMode={true}
  // route prop optional - will fetch if not provided
/>
```

## 📊 Data Flow

```
User clicks "Open Map" on packet order
    ↓
MapModal opens with order details
    ↓
[For multi-stop with driverId]
  ↓ Fetch driver's orders
  ← GET /orders?driver_id={id}&status=on_road
  ↓ Convert to delivery stops
  ↓ Calculate route
  → POST /drivers/calculate-route
  ← Get distance & duration
  ↓
Display enhanced UI with:
  - All stops listed with badges (A, B, C, D...)
  - Total distance and time
  - Real-time driver location updates
  - Polyline connecting all stops on map
```

## 🎨 UI Features (Already Implemented)

### Multi-Stop View

- ✅ Numbered badges (A, B, C, D) with color coding
- ✅ Address truncation for readability
- ✅ ETA display for each stop
- ✅ Status badges ("Arrived" for pickup)
- ✅ Scrollable stops list
- ✅ Real-time location updates

### Single Delivery View

- ✅ Two-stop layout (Pickup → Delivery)
- ✅ Color-coded badges
- ✅ Address and status display
- ✅ Time estimates

### Map Features

- ✅ Leaflet.js with Google tiles (fallback to OSM)
- ✅ Numbered markers for each stop
- ✅ Polyline connecting stops
- ✅ Driver location tracking
- ✅ Auto-zoom to fit all markers

## 🔧 Configuration

### Environment Variables (Backend)

```env
GOOGLE_API_KEY=your_api_key  # Required for route calculation
REDIS_URL=...                # Optional, for distributed driver locations
```

### Environment Variables (Mobile)

```env
EXPO_PUBLIC_API_URL=https://hurrypos-backend.onrender.com/api
```

## 🐛 Error Handling

The service gracefully falls back:

1. **No route calculation API** → Uses distance estimation
2. **No driver location** → Shows route from last known position
3. **Invalid coordinates** → Filters out bad data
4. **Geocoding fails** → Uses provided coordinates

## 📍 Real-Time Updates

Driver location updates are handled via WebSocket:

1. Backend emits location updates via socket.io
2. MapModal receives location in `updateDriverLocation()` method
3. WebView receives update via postMessage
4. Leaflet map animates driver marker to new position

## 🚀 Performance Optimization

- **Lazy loading**: Routes only fetch when component opens
- **Batching**: Single API call for all waypoints
- **Caching**: Route info stays in component state
- **Graceful degradation**: Works without all features

## 📝 Database Schema Requirements

Existing tables work out of the box:

- `orders` table needs:
  - `delivery_lat`, `delivery_lng` - Delivery location
  - `pos_location`, `pos_location_lat`, `pos_location_lng` - Pickup location
  - `driver_id` - Driver assignment
  - `status` - Order status (on_road, delivered, etc)

## 🔄 Future Enhancements

- [ ] Realtime route optimization using TSP algorithm
- [ ] Driver arrival notifications
- [ ] Custom order priority in route
- [ ] Offline mode with cached routes
- [ ] Background tracking when app is minimized
- [ ] Route history analytics

## 🧪 Testing Checklist

- [ ] Single delivery opens map correctly
- [ ] Multi-stop route loads with correct stops
- [ ] Distance/duration displays correctly
- [ ] Driver location updates in real-time
- [ ] Stops list is scrollable
- [ ] Navigate button works
- [ ] Close button dismisses modal
- [ ] Works with both iOS and Android
- [ ] Graceful fallback when backend is slow
