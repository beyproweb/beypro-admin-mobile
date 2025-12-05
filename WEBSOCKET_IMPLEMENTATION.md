# Real-Time WebSocket Location Updates - Implementation Guide

## Overview

Added real-time driver location tracking to the map modal using Socket.io WebSocket events. Drivers' locations now update live on the map without requiring page refreshes.

## Architecture

### 1. **Socket.io Event Listener** (`packet.tsx`)

- **File**: `app/orders/packet.tsx`
- **Event**: `driver_location_updated`
- **Payload**:
  ```typescript
  {
    driver_id: string | number,
    lat: number,
    lng: number,
    timestamp?: number
  }
  ```
- **Handler**: Receives location updates from backend and forwards to MapModal via ref

### 2. **MapModal Component** (`src/components/MapModal.tsx`)

- **Ref Type**: `MapModalRef` with `updateDriverLocation(lat, lng, driverId)` method
- **Communication**: Uses React ref to receive location updates from parent
- **PostMessage Bridge**: Sends location updates to WebView via `postMessage` API

### 3. **Leaflet Map** (WebView)

- **Message Listener**: `window.addEventListener('message', ...)`
- **Marker Management**: Maintains `window.mapMarkers` object for dynamic marker updates
- **Real-time Updates**: Updates marker positions and map center without full refresh
- **Marker Types**:
  - **Driver Marker** (Blue #3B82F6): Updated in real-time via WebSocket
  - **Delivery Marker** (Green #34D399): Static destination
  - **Pickup Marker** (Yellow #FCD34D): Static pickup location

## Data Flow

```
Backend (WebSocket Server)
    ↓ driver_location_updated event
Socket.io Connection (packet.tsx)
    ↓ handleDriverLocationUpdate()
MapModal Ref
    ↓ updateDriverLocation()
WebView.postMessage()
    ↓ window.addEventListener('message')
Leaflet Map
    ↓ L.circleMarker.setLatLng()
Map Display (Real-time marker animation)
```

## Implementation Details

### MapModal Component Changes

#### New Exports

```typescript
export interface MapModalRef {
  updateDriverLocation: (
    lat: number,
    lng: number,
    driverId?: string | number
  ) => void;
}

export interface DriverLocationUpdate {
  driver_id: string | number;
  lat: number;
  lng: number;
  timestamp?: number;
}
```

#### New Props

- `onLocationUpdate?: (lat: number, lng: number) => void` - Optional callback for location changes

#### New Ref Methods

```typescript
mapModalRef.current.updateDriverLocation(lat, lng, driverId);
```

#### mapReadyRef

- Tracks when WebView map has finished loading
- Prevents postMessage errors before map is ready
- Set to `true` in `onLoadEnd` handler

### WebView HTML/JavaScript Changes

#### Global Variables

```javascript
window.mapMarkers = {}; // Stores all marker objects by ID
window.mapInstance = null; // Leaflet map instance
window.mapReady = false; // Ready flag for postMessage
```

#### PostMessage Handler

```javascript
window.addEventListener("message", function (e) {
  var data = JSON.parse(e.data);
  if (data.type === "UPDATE_LOCATION" && window.mapInstance) {
    // Update or create marker at new position
    // Pan map to show updated location
  }
});
```

#### Marker Structure

- Delivery: `L.circle()` - Green 100m radius
- Pickup: `L.circle()` - Yellow 80m radius
- Driver: `L.circleMarker()` - Blue, updates in real-time

### Packet.tsx Socket Integration

#### New Ref

```typescript
const mapModalRef = useRef<MapModalRef>(null);
```

#### Location Update Handler

```typescript
const handleDriverLocationUpdate = (data: DriverLocationUpdate) => {
  console.log(`📍 Driver location update received:`, data);

  if (mapModalRef.current) {
    mapModalRef.current.updateDriverLocation(
      data.lat,
      data.lng,
      data.driver_id
    );
  }
};
```

#### Socket Event Registration

```typescript
socket.on("driver_location_updated", handleDriverLocationUpdate);
```

#### Cleanup

```typescript
socket.off("driver_location_updated", handleDriverLocationUpdate);
```

## Features

### ✅ Implemented

- Real-time driver location marker updates via WebSocket
- Live marker animation without page refresh
- Map pans to show updated driver position
- Automatic marker creation for new drivers
- Multiple driver tracking on same map
- Error handling with fallback UI

### 🚀 Ready for Backend Integration

Backend needs to emit `driver_location_updated` event with:

```json
{
  "driver_id": "driver_123",
  "lat": 40.7128,
  "lng": -74.006,
  "timestamp": 1704067200000
}
```

## Testing Checklist

- [ ] Open map modal for an order with assigned driver
- [ ] Simulate driver location change (manual test with GPS)
- [ ] Verify marker position updates in real-time
- [ ] Verify map pans to follow driver
- [ ] Test with multiple drivers on same restaurant
- [ ] Verify no console errors
- [ ] Test modal close/reopen - map should reinitialize correctly
- [ ] Verify location updates stop when modal is closed

## Performance Considerations

### Update Frequency

- Default: Every 5 seconds (driver's GPS watch interval)
- Optimized: Markers update smoothly without visual jank
- WebSocket events only processed when map is visible (`mapReadyRef.current`)

### Memory Management

- Markers cleaned up when component unmounts
- WebView references cleared on modal close
- Socket listeners properly removed on disconnect

### Network Optimization

- Only processes location updates when map modal is visible
- Uses efficient JSON.stringify/parse
- PostMessage API is lightweight browser IPC

## Browser Compatibility

- ✅ React Native WebView with Leaflet.js
- ✅ Android and iOS (Expo SDK 54+)
- ✅ Google Maps tile layer rendering
- ✅ Smooth marker animations
- ✅ Touch interactions preserved

## Debugging

### Console Logs

- `📍 Real-time update - Driver ${driverId}: ${lat}, ${lng}` - Location received
- `Map ready` - WebView initialized
- `Marker updated: ${markerId} at ${lat},${lng}` - PostMessage processed
- `postMessage error` - Communication failure

### Common Issues

**Markers not updating:**

- Check console for "postMessage error"
- Verify `mapReadyRef.current === true`
- Ensure WebSocket connection is active

**Map not panning:**

- Verify Leaflet map instance exists
- Check marker coordinates are valid
- Ensure zoom level allows panning

**Multiple markers accumulating:**

- Check marker IDs are consistent
- Verify cleanup on modal close
- Monitor window.mapMarkers size in console

## Future Enhancements

1. **Marker Trail**: Show driver's path history on map
2. **Geofencing**: Alert when driver enters delivery zone
3. **ETAssembly**: Calculate ETA based on live driver position
4. **Multi-Driver View**: Track multiple drivers on restaurant level
5. **History Playback**: Replay driver's route from start to delivery
6. **Statistics**: Average speed, time on route, stops

## Related Files

- `src/components/MapModal.tsx` - Main map modal component
- `app/orders/packet.tsx` - Socket integration and event listeners
- `src/components/BottomSheet.tsx` - Modal animations (no longer directly used)
- `/drivers/location` endpoint - Driver location storage API
- `/drivers/geocode` endpoint - Address geocoding service

## Version Info

- **Implementation Date**: 2024
- **React Native**: Expo SDK 54
- **Leaflet.js**: v1.9.4
- **Socket.io**: Latest (from package.json)
- **Google Maps**: Tile layer API (free tier)
