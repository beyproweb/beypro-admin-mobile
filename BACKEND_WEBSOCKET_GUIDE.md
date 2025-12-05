# WebSocket Real-Time Location Integration - Backend Guide

## Event to Emit

Your backend Socket.io server needs to emit the `driver_location_updated` event to all connected restaurant clients when a driver's location changes.

### Event Name

```
driver_location_updated
```

### Event Payload

```json
{
  "driver_id": "string|number",
  "lat": number,
  "lng": number,
  "timestamp": number (optional - Unix timestamp in ms)
}
```

### Example Broadcast

```javascript
// In your Node.js/Socket.io server
io.to(`restaurant_${restaurantId}`).emit("driver_location_updated", {
  driver_id: driverId,
  lat: 40.7128,
  lng: -74.006,
  timestamp: Date.now(),
});
```

## When to Emit

Send the `driver_location_updated` event when:

1. ✅ **Driver location is received** from driver app/GPS
2. ✅ **Driver is on active delivery** (status: in_transit, delivering)
3. ✅ **Location changes by > 20 meters** (to avoid spam)
4. ✅ **Every 5 seconds** if driver is actively moving

## Don't Emit When

- ❌ Driver is offline or app closed
- ❌ Driver hasn't moved (same coordinates)
- ❌ Driver is idle at restaurant (before pickup)
- ❌ Delivery is completed

## Example Backend Implementation

### Node.js + Socket.io

```javascript
// When receiving driver location update from driver app
app.post("/drivers/location", async (req, res) => {
  const { driver_id, lat, lng } = req.body;

  try {
    // Save location to database
    const driver = await Driver.findByIdAndUpdate(
      driver_id,
      { current_lat: lat, current_lng: lng, last_location_update: Date.now() },
      { new: true }
    );

    // Get driver's assigned order to find restaurant
    const order = await Order.findOne({ driver_id, status: "in_transit" });

    if (order && order.restaurant_id) {
      // Broadcast to all connected admins/managers for this restaurant
      io.to(`restaurant_${order.restaurant_id}`).emit(
        "driver_location_updated",
        {
          driver_id,
          lat,
          lng,
          timestamp: Date.now(),
        }
      );
    }

    res.json({ success: true, driver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Socket.io Room Management

```javascript
// When admin connects
socket.on("connect", () => {
  const { restaurantId } = socket.handshake.auth;
  socket.join(`restaurant_${restaurantId}`);
  console.log(`Admin joined room: restaurant_${restaurantId}`);
});

// When admin disconnects
socket.on("disconnect", () => {
  socket.leave(`restaurant_${socket.handshake.auth.restaurantId}`);
});
```

## Testing

### Using Socket.io Client (Node/Browser)

```javascript
import { io } from "socket.io-client";

const socket = io("https://your-backend.com", {
  auth: { restaurantId: "rest_123" },
});

socket.on("driver_location_updated", (data) => {
  console.log("Location update:", data);
  // Driver marker will update automatically on mobile app
});
```

### Test Data

```bash
# Curl to test location endpoint
curl -X POST http://localhost:3000/drivers/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "driver_id": "driver_123",
    "lat": 40.7128,
    "lng": -74.0060
  }'
```

## Mobile App Integration

The mobile app (React Native) is already set up to:

1. ✅ **Listen** for `driver_location_updated` events
2. ✅ **Update marker** on map in real-time
3. ✅ **Pan map** to show driver's new position
4. ✅ **No refresh** required - smooth animation

### What Happens on Mobile

When backend sends `driver_location_updated`:

```
Backend Event
    ↓
Socket.io Listener (packet.tsx)
    ↓
MapModal.updateDriverLocation()
    ↓
WebView.postMessage()
    ↓
Leaflet Map (Marker animation)
    ↓
User sees live driver position
```

## Performance Tips

1. **Throttle Emissions** - Don't send more than every 2 seconds per driver
2. **Filter Idle Drivers** - Only track drivers with active deliveries
3. **Use Driver Rooms** - Consider creating per-driver rooms for scalability
4. **Compress Data** - Minify payloads where possible
5. **Validate Coordinates** - Check lat/lng are valid before broadcasting

## Monitoring

### Check if Events are Reaching Mobile

**On Mobile:**

- Open console in React Native debugger
- Look for logs: `📍 Real-time update - Driver ${id}: ${lat}, ${lng}`
- If no logs: Check Socket.io connection is active

**On Backend:**

- Monitor Socket.io emissions count
- Track event frequency per driver
- Alert if > 100 events/second per restaurant

## Troubleshooting

| Issue              | Solution                                         |
| ------------------ | ------------------------------------------------ |
| Markers not moving | Verify event is being emitted from backend       |
| Duplicate markers  | Check driver_id consistency in payload           |
| Map not panning    | Ensure lat/lng are valid floats                  |
| Slow updates       | Reduce emission frequency, check network latency |
| Connection drops   | Verify Socket.io auth and room configuration     |

## Compliance & Privacy

- 📍 Only broadcast to authorized restaurant admins
- 🔐 Verify restaurantId in auth before emitting
- 🔒 Don't log exact driver coordinates
- ⏱️ Clean up old location data (e.g., older than 24h)
- 🛑 Stop tracking when delivery complete

## Questions?

- Check WEBSOCKET_IMPLEMENTATION.md for mobile implementation details
- Review Socket.io official docs: https://socket.io/docs/
- Enable Socket.io debug mode: `DEBUG=socket.io*`
