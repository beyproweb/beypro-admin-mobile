# Mobile Notifications - Backend Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Understand the Socket.io Room Model

```javascript
// When mobile app connects:
socket.on("connect", () => {
  socket.emit("join_restaurant", "12345"); // restaurant ID
});

// This creates a room: "restaurant_12345"
// Backend should emit ONLY to this room for that restaurant

io.to(`restaurant_${restaurantId}`).emit("event_name", data);
```

### Step 2: Add Event Emission to Your API Routes

```javascript
// Example: When order status changes to "confirmed"
app.post("/api/orders/:orderId/confirm", async (req, res) => {
  const { orderId } = req.params;
  const { restaurantId, amount } = req.body;

  // 1. Update your database
  const order = await Order.findByIdAndUpdate(orderId, {
    status: "confirmed",
  });

  // 2. Emit socket event to that restaurant
  io.to(`restaurant_${restaurantId}`).emit("order_confirmed", {
    orderId: parseInt(orderId),
    amount: amount,
    customerName: order.customer_name,
  });

  // 3. Send response
  res.json({ success: true, order });
});
```

### Step 3: Copy-Paste Template for Each Event

Replace `EVENT_NAME` with the event from the list below:

```javascript
app.post("/api/your-endpoint", async (req, res) => {
  const { restaurantId, orderId } = req.body;

  // Your DB logic here...

  io.to(`restaurant_${restaurantId}`).emit("EVENT_NAME", {
    orderId: orderId,
    // ... required fields from table below
  });

  res.json({ success: true });
});
```

---

## 📋 9 Events Quick Reference

| Event Name        | When to Emit             | Required Fields                        |
| ----------------- | ------------------------ | -------------------------------------- |
| `order_confirmed` | Order status → confirmed | `orderId`, `amount`                    |
| `order_preparing` | Order status → preparing | `orderId`, `eta`                       |
| `order_ready`     | Order status → ready     | `orderId`                              |
| `order_delivered` | Order status → delivered | `orderId`                              |
| `driver_assigned` | Driver assigned to order | `orderId`, `driverName`                |
| `payment_made`    | Payment confirmed        | `orderId`, `amount`                    |
| `stock_critical`  | Stock < threshold        | `productId`, `productName`, `quantity` |
| `stock_restocked` | Stock added              | `productId`, `productName`, `quantity` |
| `orders_updated`  | Bulk order changes       | `count`                                |

---

## 💾 Complete Implementation Examples

### 1. Order Confirmed

```javascript
app.post("/api/orders/:orderId/confirm", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { restaurantId, amount, customerName } = req.body;

    // Update DB
    await Order.updateOne({ id: orderId }, { status: "confirmed" });

    // Emit to mobile app
    io.to(`restaurant_${restaurantId}`).emit("order_confirmed", {
      orderId: parseInt(orderId),
      amount,
      customerName,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 2. Order Preparing

```javascript
app.post("/api/orders/:orderId/preparing", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { restaurantId, eta } = req.body;

    await Order.updateOne(
      { id: orderId },
      { status: "preparing", eta_minutes: eta }
    );

    io.to(`restaurant_${restaurantId}`).emit("order_preparing", {
      orderId: parseInt(orderId),
      eta,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 3. Order Ready

```javascript
app.post("/api/orders/:orderId/ready", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { restaurantId } = req.body;

    await Order.updateOne(
      { id: orderId },
      { status: "ready", ready_at: new Date() }
    );

    io.to(`restaurant_${restaurantId}`).emit("order_ready", {
      orderId: parseInt(orderId),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 4. Order Delivered

```javascript
app.post("/api/orders/:orderId/delivered", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { restaurantId } = req.body;

    await Order.updateOne(
      { id: orderId },
      { status: "delivered", delivered_at: new Date() }
    );

    io.to(`restaurant_${restaurantId}`).emit("order_delivered", {
      orderId: parseInt(orderId),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 5. Driver Assigned

```javascript
app.post("/api/orders/:orderId/assign-driver", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { restaurantId, driverId, driverName } = req.body;

    await Order.updateOne(
      { id: orderId },
      { driver_id: driverId, driver_name: driverName }
    );

    io.to(`restaurant_${restaurantId}`).emit("driver_assigned", {
      orderId: parseInt(orderId),
      driverId,
      driverName,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 6. Payment Made

```javascript
app.post("/api/payments/confirm", async (req, res) => {
  try {
    const { orderId, restaurantId, amount, paymentMethod } = req.body;

    await Payment.create({
      order_id: orderId,
      amount,
      method: paymentMethod,
      status: "completed",
    });

    io.to(`restaurant_${restaurantId}`).emit("payment_made", {
      orderId,
      amount,
      paymentMethod,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 7. Stock Critical

```javascript
app.post("/api/stock/check-critical", async (req, res) => {
  try {
    const { restaurantId } = req.body;

    const criticalProducts = await Product.find({
      restaurant_id: restaurantId,
      quantity: { $lt: "$min_threshold" },
    });

    criticalProducts.forEach((product) => {
      io.to(`restaurant_${restaurantId}`).emit("stock_critical", {
        productId: product.id,
        productName: product.name,
        quantity: product.quantity,
      });
    });

    res.json({ critical: criticalProducts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 8. Stock Restocked

```javascript
app.post("/api/stock/:productId/restock", async (req, res) => {
  try {
    const { productId } = req.params;
    const { restaurantId, quantity } = req.body;

    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { quantity } },
      { new: true }
    );

    io.to(`restaurant_${restaurantId}`).emit("stock_restocked", {
      productId: parseInt(productId),
      productName: product.name,
      quantity,
    });

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 9. Orders Updated (Generic)

```javascript
app.post("/api/orders/bulk-update", async (req, res) => {
  try {
    const { restaurantId, orderIds, status } = req.body;

    await Order.updateMany({ id: { $in: orderIds } }, { status });

    io.to(`restaurant_${restaurantId}`).emit("orders_updated", {
      count: orderIds.length,
      updatedOrderIds: orderIds,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 🔌 Socket.io Connection Setup

### Initialize Socket.io in Your Server

```javascript
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: ["https://your-frontend.com", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// Handle connections
io.on("connection", (socket) => {
  console.log(`✅ New connection: ${socket.id}`);

  // Mobile app joins restaurant room
  socket.on("join_restaurant", (restaurantId) => {
    socket.join(`restaurant_${restaurantId}`);
    console.log(`👥 Socket ${socket.id} joined restaurant_${restaurantId}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Your API routes here...

server.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
```

### Or in Route Handler

```javascript
// In your route handler
app.post("/api/orders/:orderId/confirm", (req, res) => {
  // Your code...

  // Access io from app
  const { io } = require("./app");
  io.to(`restaurant_${restaurantId}`).emit("order_confirmed", data);
});
```

---

## 🧪 Testing Your Events

### Using Socket.io Test Client

```bash
npm install -g socketio-client
socketio-client https://your-backend.com
```

### In Your Code (Manual Test)

```javascript
// This is just for manual testing, not production code
const socket = require("socket.io-client")("https://your-backend.com");

socket.on("connect", () => {
  socket.emit("join_restaurant", "12345");
});

socket.on("order_confirmed", (data) => {
  console.log("📱 Received notification:", data);
});
```

### Using cURL (Just HTTP, not socket test, but can trigger events)

```bash
curl -X POST https://your-backend.com/api/orders/456/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": 12345,
    "amount": "$25.99",
    "customerName": "John"
  }'
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ WRONG: Missing restaurant ID

```javascript
// ❌ DON'T DO THIS - Goes to everyone!
io.emit("order_confirmed", data);

// ❌ Wrong room name
io.to("restaurant").emit("order_confirmed", data);
```

### ✅ CORRECT: Always include restaurant room

```javascript
// ✅ DO THIS - Only to that restaurant
io.to(`restaurant_${restaurantId}`).emit("order_confirmed", data);
```

### ❌ WRONG: Wrong field names

```javascript
// ❌ DON'T DO THIS
io.to(`restaurant_${restaurantId}`).emit("order_confirmed", {
  order_id: 456, // Wrong! Should be orderId
  order_amount: "$25", // Wrong! Should be amount
});
```

### ✅ CORRECT: Match expected fields

```javascript
// ✅ DO THIS
io.to(`restaurant_${restaurantId}`).emit("order_confirmed", {
  orderId: 456, // Correct
  amount: "$25", // Correct
});
```

### ❌ WRONG: Emitting on wrong event

```javascript
// ❌ If order status is "preparing" but you emit "order_ready"
io.to(`restaurant_${restaurantId}`).emit("order_ready", {
  orderId: 456,
});
```

### ✅ CORRECT: Emit event that matches status

```javascript
// ✅ If order status is "preparing", emit order_preparing
io.to(`restaurant_${restaurantId}`).emit("order_preparing", {
  orderId: 456,
  eta: "15 minutes",
});
```

---

## 📊 Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────┘

Order Lifecycle:
  1. POST /orders → order_confirmed
  2. POST /orders/:id/preparing → order_preparing
  3. POST /orders/:id/ready → order_ready
  4. POST /orders/:id/delivered → order_delivered

Parallel Events:
  - POST /payments → payment_made
  - POST /assign-driver → driver_assigned
  - POST /stock/check → stock_critical
  - POST /stock/restock → stock_restocked

┌─────────────────────────────────────────────────────────────────────┐
│                    SOCKET.IO TRANSMISSION                            │
└─────────────────────────────────────────────────────────────────────┘

Backend             Socket.io           Mobile App
  |                    |                    |
  |--emit("event")--->|--broadcast--->|--listener(data)|
  |   restaurant_12345|               |   notification|
  |                    |                    |
  |                    |<--reconnect---|    |
  |                    |   join_room    |    |
  |                    |                    |
```

---

## ✅ Deployment Checklist

- [ ] Socket.io server initialized and running
- [ ] CORS configured to allow mobile domains
- [ ] Restaurant room joining implemented
- [ ] All 9 event emissions added to routes
- [ ] Event payloads match documentation
- [ ] Tested with mobile app in real-time
- [ ] No events leak between restaurants
- [ ] Connection handles network interruptions
- [ ] Logging in place for debugging
- [ ] Performance tested with multiple events/second

---

## 📞 Quick Reference URLs

| What                | URL                                        |
| ------------------- | ------------------------------------------ |
| Mobile App Repo     | `/beypro-admin-mobile`                     |
| Main Docs           | `MOBILE_NOTIFICATIONS_IMPLEMENTATION.md`   |
| Event Details       | `MOBILE_NOTIFICATIONS_SOCKET_REFERENCE.md` |
| Orders Page Example | `app/orders/packet.tsx`                    |
| Socket Utils        | `src/context/AuthContext.tsx`              |

---

## 🆘 Troubleshooting

### Q: Mobile app isn't receiving notifications

**A:** Check:

1. Is socket connected? Check browser console
2. Is restaurantId being sent correctly?
3. Is backend emitting to correct room: `restaurant_${restaurantId}`?
4. Is backend running the socket.io server?

### Q: Notifications going to wrong restaurant

**A:** You're likely missing the restaurant room. Always emit like:

```javascript
io.to(`restaurant_${restaurantId}`).emit(...)
```

### Q: Event payloads have undefined values

**A:** Check that backend is sending all required fields. Compare with examples above.

### Q: Socket keeps disconnecting

**A:** Check:

1. CORS settings on backend
2. Network connectivity
3. Socket.io version compatibility
4. Check for errors in socket connection logs

---

**Last Updated:** December 1, 2025  
**Version:** 1.0.0  
**For:** Backend Implementation Team
