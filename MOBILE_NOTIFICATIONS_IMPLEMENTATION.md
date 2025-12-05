# Mobile Notification Center - Implementation Guide

## 📋 Overview

A real-time notification center for the BeyPro admin mobile app that displays all restaurant events and updates through Socket.io WebSocket connection. The notification page mirrors the functionality of the web dashboard while providing a seamless mobile experience.

---

## ✨ Features

### Core Features

✅ **Real-Time Notifications**

- Instant updates via Socket.io WebSocket
- 9 different notification types with custom icons and colors
- Automatic notification creation when events occur

✅ **Notification Types**

- 📦 **Order Confirmed** - New order received
- ⏳ **Order Preparing** - Order being prepared in kitchen
- 🔔 **Order Ready** - Order ready for pickup/delivery
- ✅ **Order Delivered** - Order successfully delivered
- 🚗 **Driver Assigned** - Driver assigned to delivery
- 💳 **Payment Received** - Payment processed
- ⚠️ **Low Stock Alert** - Product stock running low
- 📦 **Stock Replenished** - Product restocked
- 🔄 **Orders Updated** - Generic order updates

✅ **Notification Management**

- Mark individual notifications as read
- Mark all notifications as read
- Delete individual notifications
- Clear all notifications
- Filter by read/unread status

✅ **User Experience**

- Unread badge counter in header
- Visual indicators for unread notifications
- Color-coded notification types
- Relative time display (Just now, 5m ago, etc.)
- Pull-to-refresh functionality
- Empty state UI
- Dark mode support
- Font scaling support

### Socket Events Handled

```typescript
// Order Events
socket.on("order_confirmed", handleOrderConfirmed);
socket.on("order_preparing", handleOrderPreparing);
socket.on("order_ready", handleOrderReady);
socket.on("order_delivered", handleOrderDelivered);

// Driver Events
socket.on("driver_assigned", handleDriverAssigned);

// Payment Events
socket.on("payment_made", handlePaymentMade);

// Stock Events
socket.on("stock_critical", handleStockCritical);
socket.on("stock_restocked", handleStockRestocked);

// Generic Events
socket.on("orders_updated", handleOrdersUpdated);
```

---

## 📁 File Structure

```
app/
├── notifications/
│   └── index.tsx              ← Main notification center component
├── settings/
│   ├── index.tsx              ← Settings hub (modified to include notification link)
│   └── notifications.tsx       ← Settings page placeholder
└── orders/
    └── packet.tsx             ← Existing orders page with socket support
```

---

## 🔧 Technical Details

### Socket Configuration

```typescript
const socket: Socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  auth: { restaurantId },
});

socket.on("connect", () => {
  console.log("📱 Notifications Socket connected:", socket.id);
  socket.emit("join_restaurant", restaurantId);
});
```

**Key Points:**

- Uses same Socket.io setup as existing packet orders page
- Automatic restaurant room joining on connect
- Fallback to polling if WebSocket unavailable
- Credentials included for authentication

### Notification Data Structure

```typescript
interface NotificationItem {
  id: string; // Unique identifier
  type: NotificationEventType; // Notification type
  title: string; // Display title (translated)
  message: string; // Notification message
  timestamp: number; // Unix timestamp
  read: boolean; // Read status
  data?: Record<string, any>; // Additional payload data
  icon: string; // Ionicons icon name
  color: string; // Icon color (hex)
}
```

### Notification Configuration

Each notification type has predefined styling:

```typescript
const NOTIFICATION_CONFIG: Record<
  NotificationEventType,
  {
    icon: string;
    color: string;
    bgColor: string;
  }
> = {
  order_confirmed: {
    icon: "checkmark-circle",
    color: "#22C55E", // Green
    bgColor: "#ECFDF5", // Light green bg
  },
  order_preparing: {
    icon: "hourglass",
    color: "#F59E0B", // Amber
    bgColor: "#FFFBEB", // Light amber bg
  },
  order_ready: {
    icon: "alert-circle",
    color: "#8B5CF6", // Purple
    bgColor: "#F5F3FF", // Light purple bg
  },
  order_delivered: {
    icon: "checkmark-done-circle",
    color: "#0EA5E9", // Sky blue
    bgColor: "#F0F9FF", // Light sky bg
  },
  driver_assigned: {
    icon: "car",
    color: "#EC4899", // Pink
    bgColor: "#FDF2F8", // Light pink bg
  },
  payment_made: {
    icon: "card",
    color: "#10B981", // Emerald
    bgColor: "#ECFDF5", // Light emerald bg
  },
  stock_critical: {
    icon: "warning",
    color: "#EF4444", // Red
    bgColor: "#FEF2F2", // Light red bg
  },
  stock_restocked: {
    icon: "basket",
    color: "#14B8A6", // Teal
    bgColor: "#F0FDFA", // Light teal bg
  },
  orders_updated: {
    icon: "refresh",
    color: "#6B7280", // Gray
    bgColor: "#F9FAFB", // Light gray bg
  },
};
```

---

## 🎯 API Endpoints

The notification system integrates with these backend endpoints:

### Get All Notifications

```
GET /api/notifications
```

**Response:**

```json
[
  {
    "id": "notif_123",
    "type": "order_confirmed",
    "title": "Order Confirmed",
    "message": "Order #456 has been confirmed",
    "timestamp": 1701388800000,
    "read": false,
    "data": {
      "orderId": 456,
      "amount": "$25.99"
    }
  }
]
```

### Mark Notification as Read

```
PUT /api/notifications/{notificationId}/read
```

### Mark All as Read

```
PUT /api/notifications/read-all
```

### Delete Notification

```
DELETE /api/notifications/{notificationId}
```

### Clear All Notifications

```
DELETE /api/notifications/clear-all
```

---

## 🔌 Socket Event Payloads

### Order Confirmed

```javascript
{
  orderId: 456,
  amount: "$25.99",
  customerName: "John Doe"
}
```

### Order Preparing

```javascript
{
  orderId: 456,
  eta: "15 minutes"
}
```

### Order Ready

```javascript
{
  orderId: 456,
  pickupLocation: "Counter A"
}
```

### Order Delivered

```javascript
{
  orderId: 456,
  deliveryTime: "10:45 AM"
}
```

### Driver Assigned

```javascript
{
  orderId: 456,
  driverId: 789,
  driverName: "Ahmed"
}
```

### Payment Made

```javascript
{
  orderId: 456,
  amount: "$25.99",
  paymentMethod: "Card"
}
```

### Stock Critical

```javascript
{
  productId: 123,
  productName: "Biryani",
  quantity: 2
}
```

### Stock Restocked

```javascript
{
  productId: 123,
  productName: "Biryani",
  quantity: 50
}
```

### Orders Updated

```javascript
{
  count: 3,
  updatedOrderIds: [456, 457, 458]
}
```

---

## 🎨 UI Components

### Header Section

- Title with dynamic font scaling
- Unread notification badge (only shows if unread > 0)
- Subtitle text

### Filter Tabs

- "All" tab - Shows all notifications
- "Unread" tab - Shows only unread notifications with count

### Notification Item

- Icon with colored background
- Title (bold if unread)
- Message (truncated to 2 lines)
- Timestamp (relative format)
- Delete button
- Unread indicator dot

### Empty State

- Icon (notifications-off)
- Title message
- Subtitle message based on current filter

### Action Bar (bottom)

- "Mark all read" button (when unread > 0)
- "Clear All" button (when notifications > 0)

---

## 🚀 Navigation

### From Settings Tab

1. User taps Settings from bottom navigation
2. Finds "Notifications" card in the grid
3. Taps card → Routes to `/notifications`

### From Notification

1. User taps a notification item
2. Notification automatically marked as read
3. Routes to relevant page:
   - If `orderId` exists → `/orders/{orderId}`
   - If `productId` exists → `/products`

---

## 🔄 State Management

### State Variables

```typescript
const [notifications, setNotifications] = useState<NotificationItem[]>([]);
// Main notifications array

const [loading, setLoading] = useState(true);
// Initial load state

const [refreshing, setRefreshing] = useState(false);
// Pull-to-refresh state

const [filter, setFilter] = useState<"all" | "unread">("all");
// Current filter state

const socketRef = useRef<Socket | null>(null);
// Socket reference for cleanup
```

### Computed Values

```typescript
const unreadCount = notifications.filter((n) => !n.read).length;
// Count of unread notifications

const filteredNotifications =
  filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
// Notifications based on current filter
```

---

## 📱 Mobile Experience

### Responsive Design

- Full-width notification items
- Touch-friendly button sizes (min 44pt)
- Proper spacing and padding
- Adapts to all screen sizes

### Dark Mode Support

- All colors have dark mode variants
- Proper contrast ratios maintained
- Smooth transitions between modes

### Accessibility

- Semantic color coding
- Time-based grouping concept
- Clear action buttons
- Icon labels with descriptions

### Performance

- Optimized re-renders (useCallback hooks)
- Lazy FlatList rendering
- Efficient socket cleanup
- No memory leaks on unmount

---

## 🔗 Integration with Existing Systems

### With Packet Orders Page

- Both use identical Socket.io connection setup
- Share same restaurant room concept
- Can work independently or together

### With Settings Page

- Notification center linked from settings hub
- Maintains navigation stack
- Returns to settings on back

### With Authentication

- Uses existing `useAuth` context for `restaurantId`
- Inherits authentication token from `secureFetch`
- Socket auth includes restaurantId

---

## 📋 Backend Requirements

### WebSocket Events to Emit

Your backend should emit these events to the restaurant room:

```javascript
// When order is confirmed
io.to(`restaurant_${restaurantId}`).emit("order_confirmed", {
  orderId: 456,
  amount: "$25.99",
});

// When order starts preparing
io.to(`restaurant_${restaurantId}`).emit("order_preparing", {
  orderId: 456,
  eta: "15 minutes",
});

// When order is ready
io.to(`restaurant_${restaurantId}`).emit("order_ready", {
  orderId: 456,
});

// When order is delivered
io.to(`restaurant_${restaurantId}`).emit("order_delivered", {
  orderId: 456,
});

// When driver is assigned
io.to(`restaurant_${restaurantId}`).emit("driver_assigned", {
  orderId: 456,
  driverName: "Ahmed",
});

// When payment is received
io.to(`restaurant_${restaurantId}`).emit("payment_made", {
  orderId: 456,
  amount: "$25.99",
});

// When stock is low
io.to(`restaurant_${restaurantId}`).emit("stock_critical", {
  productId: 123,
  productName: "Biryani",
  quantity: 2,
});

// When stock is replenished
io.to(`restaurant_${restaurantId}`).emit("stock_restocked", {
  productId: 123,
  productName: "Biryani",
  quantity: 50,
});

// Generic order updates
io.to(`restaurant_${restaurantId}`).emit("orders_updated", {
  count: 3,
});
```

### API Endpoints Implementation

1. **GET /api/notifications** - Return notification history
2. **PUT /api/notifications/{id}/read** - Mark as read
3. **PUT /api/notifications/read-all** - Mark all as read
4. **DELETE /api/notifications/{id}** - Delete notification
5. **DELETE /api/notifications/clear-all** - Clear all notifications

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Notifications appear in real-time via socket
- [ ] Filter between All/Unread works
- [ ] Mark as read updates UI and sends API request
- [ ] Mark all as read updates all notifications
- [ ] Delete removes notification from list
- [ ] Clear all removes all notifications with confirmation
- [ ] Pull-to-refresh reloads notifications
- [ ] Tapping notification navigates to order/product
- [ ] Empty state shows when no notifications
- [ ] Badge count updates correctly
- [ ] Time formatting shows correctly
- [ ] Dark mode colors display properly
- [ ] Socket reconnects on network change
- [ ] No crashes on rapid socket events

### Load Testing

- Test with 100+ notifications
- Rapid socket events don't freeze UI
- Delete/mark operations remain responsive

---

## 🐛 Troubleshooting

### Notifications Not Appearing

1. Check socket connection in console: `socket.connected`
2. Verify backend is emitting events to correct room
3. Ensure `restaurantId` is being passed correctly
4. Check network tab for socket handshake

### Slow Performance

1. Limit notifications to recent 100
2. Implement pagination if needed
3. Check for unnecessary re-renders

### Socket Disconnections

1. Verify CORS settings on backend
2. Check WebSocket availability
3. Fallback to polling works automatically

---

## 📝 Code Examples

### Adding a New Notification Type

```typescript
// 1. Add to type definition
type NotificationEventType = "new_event_type" | /* existing types */;

// 2. Add to NOTIFICATION_CONFIG
new_event_type: {
  icon: "icon-name",
  color: "#HEX_COLOR",
  bgColor: "#HEX_BG_COLOR",
}

// 3. Add handler function
const handleNewEvent = (data: any) => {
  const notification: NotificationItem = {
    id: `new_event_type_${Date.now()}`,
    type: "new_event_type",
    title: t("New Event Title"),
    message: `Your message here`,
    timestamp: Date.now(),
    read: false,
    data,
    icon: NOTIFICATION_CONFIG.new_event_type.icon,
    color: NOTIFICATION_CONFIG.new_event_type.color,
  };
  setNotifications((prev) => [notification, ...prev]);
};

// 4. Register socket listener
socket.on("new_event_type", handleNewEvent);
```

### Customizing Time Format

```typescript
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
```

---

## 📚 Related Documentation

- **WebSocket Implementation**: `WEBSOCKET_IMPLEMENTATION_SUMMARY.md`
- **Backend Socket Guide**: `BACKEND_WEBSOCKET_GUIDE.md`
- **Packet Orders Page**: `app/orders/packet.tsx`
- **Settings Page**: `app/settings/index.tsx`

---

## ✅ Deployment Checklist

- [x] Notifications page component created
- [x] Socket.io integration implemented
- [x] All 9 notification types handled
- [x] API endpoints referenced
- [x] Dark mode supported
- [x] Font scaling implemented
- [x] Navigation integrated
- [x] Empty state UI
- [x] Pull-to-refresh
- [ ] Backend endpoints implemented
- [ ] Backend socket event emissions added
- [ ] Notification history stored in database
- [ ] Testing on real device completed
- [ ] Performance monitoring setup

---

## 🎓 Learning Resources

- [Socket.io Documentation](https://socket.io/docs/)
- [React Native FlatList](https://reactnative.dev/docs/flatlist)
- [React Hooks Guide](https://react.dev/reference/react)
- [Expo Constants](https://docs.expo.dev/versions/latest/sdk/constants/)

---

**Last Updated:** December 1, 2025  
**Version:** 1.0.0  
**Status:** ✅ Ready for Backend Integration
