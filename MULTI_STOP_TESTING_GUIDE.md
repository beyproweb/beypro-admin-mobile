# Multi-Stop Route Testing & Backend Setup Guide

## 🚨 Current Status

**Error:** `Cannot GET /api/drivers/12321/active-orders`

This is expected! The backend API endpoint needs to be created. Let me show you how to set it up.

---

## 🛠️ Backend Implementation (Node.js/Express)

### Step 1: Create the Driver Routes Endpoint

**File:** `routes/drivers.js` (or similar)

```javascript
// GET all active orders for a driver
router.get("/:driverId/active-orders", async (req, res) => {
  try {
    const { driverId } = req.params;

    // Verify driver exists
    const driver = await db.query("SELECT id FROM drivers WHERE id = ?", [
      driverId,
    ]);

    if (driver.length === 0) {
      return res.status(404).json({ message: "Driver not found" });
    }

    // Get all active orders assigned to this driver
    const orders = await db.query(
      `
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.pickup_address,
        o.pickup_lat,
        o.pickup_lng,
        o.delivery_address,
        o.delivery_lat,
        o.delivery_lng,
        o.status,
        o.driver_status,
        o.created_at,
        o.pickup_notes,
        o.delivery_notes
      FROM orders o
      WHERE o.driver_id = ? 
      AND o.status IN ('preparing', 'ready', 'on_road')
      ORDER BY o.created_at ASC
    `,
      [driverId]
    );

    res.json({
      success: true,
      orders: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Error fetching driver active orders:", error);
    res.status(500).json({
      message: "Failed to fetch active orders",
      error: error.message,
    });
  }
});
```

### Step 2: Create the Stop Completion Endpoint

**File:** `routes/orders.js` (or similar)

```javascript
// PATCH mark a stop as completed
router.patch("/:orderId/stop-event", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { stopId, completedAt, notes, signature } = req.body;

    // Verify order exists
    const order = await db.query("SELECT id, status FROM orders WHERE id = ?", [
      orderId,
    ]);

    if (order.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update stop status in order_stops table (if you have one)
    // OR mark order as completed if all stops done
    const result = await db.query(
      `
      UPDATE orders 
      SET status = 'delivered',
          driver_status = 'delivered',
          delivered_at = NOW()
      WHERE id = ?
    `,
      [orderId]
    );

    res.json({
      success: true,
      message: "Stop marked as completed",
      orderId: orderId,
    });
  } catch (error) {
    console.error("Error marking stop completed:", error);
    res.status(500).json({
      message: "Failed to mark stop as completed",
      error: error.message,
    });
  }
});
```

### Step 3: Verify Routes are Registered

In your main `server.js`:

```javascript
const driverRoutes = require("./routes/drivers");
const orderRoutes = require("./routes/orders");

// Mount routes
app.use("/api/drivers", driverRoutes);
app.use("/api/orders", orderRoutes);
```

---

## ✅ Quick Validation

### Test Endpoint in Terminal

```bash
# Get active orders for driver 12321
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/drivers/12321/active-orders

# Expected response:
{
  "success": true,
  "orders": [
    {
      "id": 1,
      "order_number": "ORD-001",
      "customer_name": "John Doe",
      "pickup_lat": 40.7128,
      "pickup_lng": -74.0060,
      "delivery_lat": 40.7580,
      "delivery_lng": -73.9855,
      "status": "on_road"
    }
  ],
  "count": 1
}
```

---

## 🧪 Frontend Testing (No Backend Changes)

### Option A: Mock the API Response

**File:** `src/api/driverRoutes.ts`

Add mock data at the top of `getDriverActiveOrders()`:

```typescript
export async function getDriverActiveOrders(
  driverId: string
): Promise<RouteInfo> {
  // 🧪 DEVELOPMENT: Use mock data if backend not ready
  const USE_MOCK_DATA = true; // Set to false when backend is ready

  if (USE_MOCK_DATA) {
    console.log("📍 Using mock route data for testing...");

    const mockStops: DeliveryStop[] = [
      {
        id: "pickup-1",
        orderId: 1,
        type: "pickup",
        stopNumber: 0,
        address: "123 Main St, New York, NY 10001",
        latitude: 40.7128,
        longitude: -74.006,
        status: "pending",
        orderNumber: "ORD-001",
        customerName: "John's Restaurant",
      },
      {
        id: "delivery-1",
        orderId: 1,
        type: "delivery",
        stopNumber: 1,
        address: "456 Park Ave, New York, NY 10022",
        latitude: 40.758,
        longitude: -73.9855,
        status: "pending",
        customerName: "Alice Johnson",
      },
      {
        id: "pickup-2",
        orderId: 2,
        type: "pickup",
        stopNumber: 2,
        address: "789 Broadway, New York, NY 10003",
        latitude: 40.7489,
        longitude: -73.968,
        status: "pending",
        orderNumber: "ORD-002",
        customerName: "Pizza Place",
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
      },
    ];

    return {
      totalDistance: 12.5,
      totalDuration: 45,
      stops: mockStops,
      driverId,
      startTime: new Date(),
    };
  }

  // 🔌 PRODUCTION: Call real API
  try {
    const response = await secureFetch(`/drivers/${driverId}/active-orders`, {
      method: "GET",
    });
    // ... rest of code
  } catch (error) {
    console.error("Error fetching driver active orders:", error);
    throw error;
  }
}
```

### Option B: Test with Postman

1. **Open Postman**
2. **Create Request:**
   - Method: `GET`
   - URL: `http://localhost:3000/api/drivers/12321/active-orders`
   - Header: `Authorization: Bearer YOUR_TOKEN`
3. **Click Send**
4. **Verify Response:** Should show orders array

---

## 🧩 Testing Checklist

### Frontend Tests (Can do NOW with mock data)

```
✓ App loads without crashing
✓ Multi-stop button appears in header
✓ Click button opens route map
✓ Map displays all stop markers (A, B, C, D)
✓ Markers have correct colors (yellow=pickup, green=delivery)
✓ Polyline connects stops in order
✓ RouteHeader shows distance (12.5 km) and duration (45 min)
✓ Tap stop marker opens StopDetailsSheet
✓ Stop details show correct address and customer
✓ "Mark Complete" button works
✓ Confirmation dialog appears
✓ Stop status changes to completed
✓ Route header progress bar updates
✓ Test landscape orientation
✓ Test dark mode
```

### Backend Tests (After implementing endpoints)

```
✓ GET /api/drivers/:id/active-orders returns 200
✓ Response has "orders" array
✓ Each order has required fields (id, lat, lng, address, etc)
✓ PATCH /api/orders/:id/stop-event returns 200
✓ Stop marked as completed in database
✓ Invalid driver ID returns 404
✓ Unauthorized request returns 401
✓ Request without token returns 401
```

---

## 🚀 Testing Flow

### Phase 1: Frontend Testing (NOW)

1. Enable `USE_MOCK_DATA = true` in `driverRoutes.ts`
2. Open app on device/simulator
3. Navigate to Orders → Packet screen
4. Tap multi-stop button
5. Verify all 4 test stops appear
6. Test all interactions

### Phase 2: Backend Implementation

1. Create API endpoints in Node.js
2. Test with Postman
3. Verify database structure
4. Set `USE_MOCK_DATA = false`

### Phase 3: Full Integration Testing

1. Disable mock data
2. Test with real orders
3. Monitor API logs
4. Performance testing
5. Edge case testing

---

## 🐛 Debugging Tips

### If map doesn't render:

```typescript
// Add this to MapModal.tsx console logs
console.log("🗺️ Map HTML:", getMapHTML());
console.log("📍 Stops:", multiStopRoute?.stops);
```

### If stops don't appear:

```typescript
// Check coordinates are valid
console.log("Marker coords:", stop.latitude, stop.longitude);
// Valid ranges: lat -90 to 90, lng -180 to 180
```

### If API fails:

```typescript
// Check in network tab of DevTools
// Should see GET request to /api/drivers/ID/active-orders
// Status should be 200 (not 404)
```

---

## 📊 Sample Test Data

Use this for manual testing:

```javascript
// Sample order with coordinates in New York area
{
  id: 1,
  order_number: "ORD-12345",
  customer_name: "John Doe",
  customer_phone: "+1-555-0100",
  pickup_address: "123 Main St, New York, NY 10001",
  pickup_lat: 40.7128,
  pickup_lng: -74.0060,
  delivery_address: "456 Park Ave, New York, NY 10022",
  delivery_lat: 40.7580,
  delivery_lng: -73.9855,
  status: "on_road",
  driver_id: 12321,
  created_at: "2025-11-24T10:00:00Z"
}
```

---

## ✅ Next Steps

1. **Choose Testing Path:**

   - Start with mock data (recommended for faster testing)
   - Implement backend endpoints (for real data)

2. **Set Mock Data:**

   ```typescript
   const USE_MOCK_DATA = true; // In driverRoutes.ts
   ```

3. **Run App:**

   ```bash
   npx expo start
   ```

4. **Test on Device:**

   - Open on simulator or physical device
   - Navigate to multi-stop view
   - Verify UI and interactions

5. **Implement Backend (when ready):**
   - Copy endpoint code above
   - Add to your routes
   - Test with Postman
   - Switch `USE_MOCK_DATA = false`

---

## 🎯 Success Criteria

**Frontend Testing SUCCESS:** ✅

- All 4 stops appear on map
- Markers labeled A, B, C, D
- Route shows 12.5 km, 45 min
- Stop details sheet opens
- Interactions work smoothly

**Backend Testing SUCCESS:** ✅

- Endpoint returns 200 status
- Response has correct JSON structure
- Database updated correctly
- No errors in server logs

---

## 💡 Pro Tips

**Tip 1:** Test with multiple markers first

- Easier to verify map rendering
- Can see polyline clearly

**Tip 2:** Use console.log heavily

- Add logs before/after each step
- Check browser DevTools Network tab

**Tip 3:** Test error cases

- What if no orders? (empty array)
- What if invalid driver ID? (404)
- What if network down? (error handling)

**Tip 4:** Test on real device

- Map rendering can differ from simulator
- Performance is more realistic
- Touch interactions feel more natural

---

## 📞 Common Issues & Solutions

| Issue                 | Solution                                 |
| --------------------- | ---------------------------------------- |
| Map doesn't render    | Check Leaflet CDN loading in HTML        |
| Markers not visible   | Verify coordinates are in range          |
| Polyline not showing  | Check stops have valid lat/lng           |
| API 404 error         | Backend endpoint needs to be created     |
| Button doesn't appear | Check multiStopRoute state is not null   |
| Location not updating | Check WebSocket connection in packet.tsx |

---

## 🎬 Ready to Test?

1. **Mock Testing (Recommended First):**

   - ✅ No backend changes needed
   - ✅ Test all UI/UX
   - ✅ Verify component integration
   - Takes: 15-30 minutes

2. **Backend Implementation:**

   - ⏳ Copy endpoints from above
   - ⏳ Create database queries
   - ⏳ Test with Postman
   - Takes: 1-2 hours

3. **Full Integration:**
   - ⏳ Connect frontend to real backend
   - ⏳ Test end-to-end
   - ⏳ Performance testing
   - Takes: 1 hour

**Recommendation:** Start with mock data testing NOW! 🚀
