# Mobile Notifications - Socket Event Reference

## 🔌 WebSocket Events & Payloads

### Quick Reference

| Event             | Icon     | Color    | Payload                                |
| ----------------- | -------- | -------- | -------------------------------------- |
| `order_confirmed` | ✓ Circle | Green    | `{ orderId, amount, customerName? }`   |
| `order_preparing` | ⏳       | Amber    | `{ orderId, eta? }`                    |
| `order_ready`     | 🔔       | Purple   | `{ orderId, pickupLocation? }`         |
| `order_delivered` | ✓✓       | Sky Blue | `{ orderId, deliveryTime? }`           |
| `driver_assigned` | 🚗       | Pink     | `{ orderId, driverId?, driverName }`   |
| `payment_made`    | 💳       | Emerald  | `{ orderId, amount, paymentMethod? }`  |
| `stock_critical`  | ⚠️       | Red      | `{ productId, productName, quantity }` |
| `stock_restocked` | 📦       | Teal     | `{ productId, productName, quantity }` |
| `orders_updated`  | 🔄       | Gray     | `{ count, updatedOrderIds? }`          |

---

## 📨 Complete Event Examples

### 1. Order Confirmed ✅

**Event:** `order_confirmed`

**Frontend Socket Handler:**

```typescript
socket.on("order_confirmed", (data: any) => {
  const notification: NotificationItem = {
    id: `order_confirmed_${data.orderId || Date.now()}`,
    type: "order_confirmed",
    title: t("Order Confirmed"),
    message: `Order #${data.orderId} has been confirmed. Amount: ${
      data.amount || "N/A"
    }`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "checkmark-circle",
    color: "#22C55E",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit when order status changes to confirmed
io.to(`restaurant_${restaurantId}`).emit("order_confirmed", {
  orderId: 456,
  amount: "$25.99",
  customerName: "John Doe",
  customerPhone: "+1234567890",
});
```

**Notification Display:**

```
✓ Order Confirmed
  Order #456 has been confirmed. Amount: $25.99
  5m ago
```

---

### 2. Order Preparing ⏳

**Event:** `order_preparing`

**Frontend Socket Handler:**

```typescript
socket.on("order_preparing", (data: any) => {
  const notification: NotificationItem = {
    id: `order_preparing_${data.orderId || Date.now()}`,
    type: "order_preparing",
    title: t("Order Preparing"),
    message: `Order #${data.orderId} is now being prepared. ETA: ${
      data.eta || "N/A"
    }`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "hourglass",
    color: "#F59E0B",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit when kitchen starts preparing the order
io.to(`restaurant_${restaurantId}`).emit("order_preparing", {
  orderId: 456,
  eta: "15 minutes",
  kitchenStation: "Station A",
  estimatedReadyTime: "10:30 AM",
});
```

**Notification Display:**

```
⏳ Order Preparing
  Order #456 is now being prepared. ETA: 15 minutes
  3m ago
```

---

### 3. Order Ready 🔔

**Event:** `order_ready`

**Frontend Socket Handler:**

```typescript
socket.on("order_ready", (data: any) => {
  const notification: NotificationItem = {
    id: `order_ready_${data.orderId || Date.now()}`,
    type: "order_ready",
    title: t("Order Ready"),
    message: `Order #${data.orderId} is ready for pickup or delivery!`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "alert-circle",
    color: "#8B5CF6",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit when order is finished and ready
io.to(`restaurant_${restaurantId}`).emit("order_ready", {
  orderId: 456,
  pickupLocation: "Counter A",
  readyTime: "10:30 AM",
  orderType: "delivery", // or "pickup"
});
```

**Notification Display:**

```
🔔 Order Ready
  Order #456 is ready for pickup or delivery!
  2m ago
```

---

### 4. Order Delivered ✅✅

**Event:** `order_delivered`

**Frontend Socket Handler:**

```typescript
socket.on("order_delivered", (data: any) => {
  const notification: NotificationItem = {
    id: `order_delivered_${data.orderId || Date.now()}`,
    type: "order_delivered",
    title: t("Order Delivered"),
    message: `Order #${data.orderId} has been successfully delivered!`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "checkmark-done-circle",
    color: "#0EA5E9",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit when driver confirms delivery
io.to(`restaurant_${restaurantId}`).emit("order_delivered", {
  orderId: 456,
  deliveryTime: "10:35 AM",
  driverId: 789,
  driverName: "Ahmed",
  deliveryLat: 40.7128,
  deliveryLng: -74.006,
  customerSignature: true,
});
```

**Notification Display:**

```
✓✓ Order Delivered
  Order #456 has been successfully delivered!
  Just now
```

---

### 5. Driver Assigned 🚗

**Event:** `driver_assigned`

**Frontend Socket Handler:**

```typescript
socket.on("driver_assigned", (data: any) => {
  const notification: NotificationItem = {
    id: `driver_assigned_${data.orderId || Date.now()}`,
    type: "driver_assigned",
    title: t("Driver Assigned"),
    message: `Driver ${data.driverName || "Unknown"} assigned to order #${
      data.orderId
    }`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "car",
    color: "#EC4899",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit when driver is assigned to an order
io.to(`restaurant_${restaurantId}`).emit("driver_assigned", {
  orderId: 456,
  driverId: 789,
  driverName: "Ahmed Hassan",
  driverPhone: "+1234567890",
  driverRating: 4.8,
  estimatedPickupTime: "5 minutes",
});
```

**Notification Display:**

```
🚗 Driver Assigned
  Driver Ahmed Hassan assigned to order #456
  1m ago
```

---

### 6. Payment Made 💳

**Event:** `payment_made`

**Frontend Socket Handler:**

```typescript
socket.on("payment_made", (data: any) => {
  const notification: NotificationItem = {
    id: `payment_made_${data.orderId || Date.now()}`,
    type: "payment_made",
    title: t("Payment Received"),
    message: `Payment of ${data.amount || "N/A"} received for order #${
      data.orderId
    }`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "card",
    color: "#10B981",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit when payment is confirmed
io.to(`restaurant_${restaurantId}`).emit("payment_made", {
  orderId: 456,
  amount: "$25.99",
  paymentMethod: "credit_card",
  transactionId: "txn_123456789",
  paymentGateway: "stripe",
  timestamp: new Date().toISOString(),
});
```

**Notification Display:**

```
💳 Payment Received
  Payment of $25.99 received for order #456
  Just now
```

---

### 7. Stock Critical ⚠️

**Event:** `stock_critical`

**Frontend Socket Handler:**

```typescript
socket.on("stock_critical", (data: any) => {
  const notification: NotificationItem = {
    id: `stock_critical_${data.productId || Date.now()}`,
    type: "stock_critical",
    title: t("Low Stock Alert"),
    message: `Product "${data.productName}" stock is running low (${data.quantity} remaining)`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "warning",
    color: "#EF4444",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit when product stock falls below threshold
io.to(`restaurant_${restaurantId}`).emit("stock_critical", {
  productId: 123,
  productName: "Biryani",
  quantity: 2,
  minimumThreshold: 10,
  sku: "SKU-123",
  supplier: "Local Supplier Inc",
});
```

**Notification Display:**

```
⚠️ Low Stock Alert
  Product "Biryani" stock is running low (2 remaining)
  15m ago
```

---

### 8. Stock Restocked 📦

**Event:** `stock_restocked`

**Frontend Socket Handler:**

```typescript
socket.on("stock_restocked", (data: any) => {
  const notification: NotificationItem = {
    id: `stock_restocked_${data.productId || Date.now()}`,
    type: "stock_restocked",
    title: t("Stock Replenished"),
    message: `Product "${data.productName}" has been restocked (${data.quantity} units added)`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "basket",
    color: "#14B8A6",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit when new stock is added
io.to(`restaurant_${restaurantId}`).emit("stock_restocked", {
  productId: 123,
  productName: "Biryani",
  quantity: 50,
  totalStock: 52,
  supplier: "Local Supplier Inc",
  purchaseOrder: "PO-456",
  purchaseDate: "2025-12-01",
});
```

**Notification Display:**

```
📦 Stock Replenished
  Product "Biryani" has been restocked (50 units added)
  2h ago
```

---

### 9. Orders Updated 🔄

**Event:** `orders_updated`

**Frontend Socket Handler:**

```typescript
socket.on("orders_updated", (data: any) => {
  const notification: NotificationItem = {
    id: `orders_updated_${Date.now()}`,
    type: "orders_updated",
    title: t("Orders Updated"),
    message: `${data.count || 1} order(s) have been updated`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: "refresh",
    color: "#6B7280",
  };
  setNotifications((prev) => [notification, ...prev]);
});
```

**Backend Emission:**

```javascript
// Emit for generic order updates
io.to(`restaurant_${restaurantId}`).emit("orders_updated", {
  count: 3,
  updatedOrderIds: [456, 457, 458],
  reason: "bulk_status_update",
});
```

**Notification Display:**

```
🔄 Orders Updated
  3 order(s) have been updated
  30m ago
```

---

## 📤 Backend Implementation Template

### Node.js + Express + Socket.io

```javascript
const express = require("express");
const socketIO = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Restaurant room management
io.on("connection", (socket) => {
  const { restaurantId } = socket.handshake.auth;

  if (restaurantId) {
    socket.join(`restaurant_${restaurantId}`);
    console.log(`✅ Socket ${socket.id} joined restaurant_${restaurantId}`);
  }

  socket.on("disconnect", () => {
    console.log(`❌ Socket ${socket.id} disconnected`);
  });
});

// ============================================================================
// ROUTE HANDLERS - Emit socket events when API requests come in
// ============================================================================

// 1. Order Confirmed
app.post("/api/orders/:orderId/confirm", (req, res) => {
  const { orderId } = req.params;
  const { restaurantId, amount, customerName } = req.body;

  // Save to DB...

  io.to(`restaurant_${restaurantId}`).emit("order_confirmed", {
    orderId: parseInt(orderId),
    amount,
    customerName,
  });

  res.json({ success: true });
});

// 2. Order Preparing
app.post("/api/orders/:orderId/preparing", (req, res) => {
  const { orderId } = req.params;
  const { restaurantId, eta } = req.body;

  // Update DB...

  io.to(`restaurant_${restaurantId}`).emit("order_preparing", {
    orderId: parseInt(orderId),
    eta,
  });

  res.json({ success: true });
});

// 3. Order Ready
app.post("/api/orders/:orderId/ready", (req, res) => {
  const { orderId } = req.params;
  const { restaurantId, pickupLocation } = req.body;

  // Update DB...

  io.to(`restaurant_${restaurantId}`).emit("order_ready", {
    orderId: parseInt(orderId),
    pickupLocation,
  });

  res.json({ success: true });
});

// 4. Order Delivered
app.post("/api/orders/:orderId/delivered", (req, res) => {
  const { orderId } = req.params;
  const { restaurantId, deliveryTime } = req.body;

  // Update DB...

  io.to(`restaurant_${restaurantId}`).emit("order_delivered", {
    orderId: parseInt(orderId),
    deliveryTime,
  });

  res.json({ success: true });
});

// 5. Driver Assigned
app.post("/api/orders/:orderId/assign-driver", (req, res) => {
  const { orderId } = req.params;
  const { restaurantId, driverId, driverName } = req.body;

  // Update DB...

  io.to(`restaurant_${restaurantId}`).emit("driver_assigned", {
    orderId: parseInt(orderId),
    driverId,
    driverName,
  });

  res.json({ success: true });
});

// 6. Payment Made
app.post("/api/payments", (req, res) => {
  const { orderId, restaurantId, amount, paymentMethod } = req.body;

  // Process payment...

  io.to(`restaurant_${restaurantId}`).emit("payment_made", {
    orderId,
    amount,
    paymentMethod,
  });

  res.json({ success: true });
});

// 7. Stock Critical
app.post("/api/stock/check", (req, res) => {
  const { restaurantId } = req.body;

  // Check all products...
  const criticalProducts = products.filter((p) => p.quantity < p.minThreshold);

  criticalProducts.forEach((product) => {
    io.to(`restaurant_${restaurantId}`).emit("stock_critical", {
      productId: product.id,
      productName: product.name,
      quantity: product.quantity,
    });
  });

  res.json({ critical: criticalProducts.length });
});

// 8. Stock Restocked
app.post("/api/stock/:productId/restock", (req, res) => {
  const { productId } = req.params;
  const { restaurantId, quantity } = req.body;

  // Update stock...

  io.to(`restaurant_${restaurantId}`).emit("stock_restocked", {
    productId: parseInt(productId),
    productName: "Product Name",
    quantity,
  });

  res.json({ success: true });
});

// 9. Orders Updated (Generic)
app.post("/api/orders/bulk-update", (req, res) => {
  const { restaurantId, orderIds } = req.body;

  // Bulk update...

  io.to(`restaurant_${restaurantId}`).emit("orders_updated", {
    count: orderIds.length,
    updatedOrderIds: orderIds,
  });

  res.json({ success: true });
});

server.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
```

---

## ✅ Checklist for Backend Implementation

- [ ] All 9 events emit to correct restaurant room
- [ ] Payload includes all expected fields
- [ ] Timestamps are Unix milliseconds
- [ ] Order/Product IDs are correct type (number or string as needed)
- [ ] Testing with multiple restaurants doesn't leak events
- [ ] Socket connection uses correct auth/restaurantId
- [ ] Events tested with mobile app in real-time
- [ ] Database notifications stored for history
- [ ] API endpoints for mark-read/delete implemented
- [ ] No rate limiting on socket emissions

---

## 🐛 Common Issues & Solutions

### Issue: Notifications not appearing

**Cause:** Backend not emitting to correct room  
**Solution:** Verify `io.to('restaurant_${restaurantId}')` matches mobile `restaurantId`

### Issue: Payload fields undefined in notification

**Cause:** Backend sending different field names  
**Solution:** Match exact field names from examples above

### Issue: Duplicate notifications

**Cause:** Event listeners registered multiple times  
**Solution:** Ensure cleanup happens on component unmount

### Issue: Notifications appear to everyone

**Cause:** Emitting without restaurant room  
**Solution:** Always use `io.to('restaurant_${restaurantId}').emit()`

---

**Last Updated:** December 1, 2025  
**Version:** 1.0.0
