# Multi-Stop Pickup Deduplication - Data Flow Trace

## Scenario: Driver with 3 Orders from Same Restaurant

### Input Data (From Backend)

```typescript
GET /orders?driver_id=123&status=on_road

Response: [
  {
    id: 1001,
    customer_name: "Alice",
    delivery_address: "123 Main St",
    delivery_lat: 38.424, delivery_lng: 27.143,
    pos_location: "Acme Pizza",
    pos_location_lat: 38.420, pos_location_lng: 27.140,  // Restaurant
    estimated_arrival: 15
  },
  {
    id: 1002,
    customer_name: "Bob",
    delivery_address: "456 Oak Ave",
    delivery_lat: 38.425, delivery_lng: 27.144,
    pos_location: "Acme Pizza",
    pos_location_lat: 38.420, pos_location_lng: 27.140,  // SAME restaurant
    estimated_arrival: 18
  },
  {
    id: 1003,
    customer_name: "Charlie",
    delivery_address: "789 Pine Ln",
    delivery_lat: 38.426, delivery_lng: 27.145,
    pos_location: "Acme Pizza",
    pos_location_lat: 38.420, pos_location_lng: 27.140,  // SAME restaurant
    estimated_arrival: 22
  }
]
```

---

## Processing in `fetchDriverRoute(driverId: 123)`

### Step 1: Extract Unique Pickups

```
pickupMap = new Map()

Iteration 1 (Order 1001):
  key = "38.420,27.140"
  pickupMap.set("38.420,27.140", {
    address: "Acme Pizza",
    lat: 38.420,
    lng: 27.140
  })
  Size: 1 ✓

Iteration 2 (Order 1002):
  key = "38.420,27.140"
  KEY ALREADY EXISTS → Skip (no duplicate)
  Size: 1 ✓

Iteration 3 (Order 1003):
  key = "38.420,27.140"
  KEY ALREADY EXISTS → Skip (no duplicate)
  Size: 1 ✓

Result: pickupMap has 1 entry
```

### Step 2: Create Single Pickup Stop

```
stops = []
stopNumber = 0

if (pickupMap.size > 0) {
  firstPickup = {
    address: "Acme Pizza",
    lat: 38.420,
    lng: 27.140
  }

  stops.push({
    id: "pickup-0",
    orderId: 0,
    type: "pickup",
    stopNumber: 0,  // Will become letter 'A'
    address: "Acme Pizza",
    latitude: 38.420,
    longitude: 27.140,
    status: "pending",
    customerName: "Restaurant",
    orderNumber: "Pickup"
  })

  stopNumber++ → 1
}

stops.length = 1
```

### Step 3: Create Delivery Stops

```
for each order:

  Order 1001 (Alice):
    stopNumber = 1 → Letter 'B'
    stops.push({
      id: "order-1001",
      orderId: 1001,
      type: "delivery",
      stopNumber: 1,
      address: "123 Main St",
      latitude: 38.424,
      longitude: 27.143,
      customerName: "Alice",
      orderNumber: "Order #1001",
      estimatedArrivalTime: 15
    })
    stopNumber++ → 2

  Order 1002 (Bob):
    stopNumber = 2 → Letter 'C'
    stops.push({
      id: "order-1002",
      orderId: 1002,
      type: "delivery",
      stopNumber: 2,
      address: "456 Oak Ave",
      latitude: 38.425,
      longitude: 27.144,
      customerName: "Bob",
      orderNumber: "Order #1002",
      estimatedArrivalTime: 18
    })
    stopNumber++ → 3

  Order 1003 (Charlie):
    stopNumber = 3 → Letter 'D'
    stops.push({
      id: "order-1003",
      orderId: 1003,
      type: "delivery",
      stopNumber: 3,
      address: "789 Pine Ln",
      latitude: 38.426,
      longitude: 27.145,
      customerName: "Charlie",
      orderNumber: "Order #1003",
      estimatedArrivalTime: 22
    })
    stopNumber++ → 4

stops.length = 4
```

---

## Output from `fetchDriverRoute()`

```typescript
RouteInfo {
  stops: [
    // Index 0 - Letter 'A'
    {
      id: "pickup-0",
      orderId: 0,
      type: "pickup",
      stopNumber: 0,
      address: "Acme Pizza",
      latitude: 38.420,
      longitude: 27.140,
      customerName: "Restaurant",
      orderNumber: "Pickup"
    },
    // Index 1 - Letter 'B'
    {
      id: "order-1001",
      orderId: 1001,
      type: "delivery",
      stopNumber: 1,
      address: "123 Main St",
      latitude: 38.424,
      longitude: 27.143,
      customerName: "Alice",
      orderNumber: "Order #1001",
      estimatedArrivalTime: 15
    },
    // Index 2 - Letter 'C'
    {
      id: "order-1002",
      orderId: 1002,
      type: "delivery",
      stopNumber: 2,
      address: "456 Oak Ave",
      latitude: 38.425,
      longitude: 27.144,
      customerName: "Bob",
      orderNumber: "Order #1002",
      estimatedArrivalTime: 18
    },
    // Index 3 - Letter 'D'
    {
      id: "order-1003",
      orderId: 1003,
      type: "delivery",
      stopNumber: 3,
      address: "789 Pine Ln",
      latitude: 38.426,
      longitude: 27.145,
      customerName: "Charlie",
      orderNumber: "Order #1003",
      estimatedArrivalTime: 22
    }
  ],
  totalDistance: 8.5,  // km
  totalDuration: 28,   // minutes
  driverId: "123"
}

Console Output:
  📍 Added single pickup: Acme Pizza
  ✅ Built route with 4 stops (1 pickup + 3 deliveries)
  🛣️ Calculating route with 4 waypoints
  ✅ Route calculated: 8.5 km, 28 min
```

---

## Map Rendering (`getMultiStopMapHTML`)

```typescript
const stopMarkers = route.stops.map((stop, idx) => {
  const letter = String.fromCharCode(65 + idx); // idx=0→A, idx=1→B, etc
  const isCompleted = stop.status === "completed";
  const color = stop.type === "pickup" ? "#F59E0B" : "#10B981";
  const bgColor = stop.type === "pickup" ? "#FCD34D" : "#34D399";

  return SVG marker HTML...
})

Rendered Markers:
  idx=0 → letter='A' → "A - pickup (Acme Pizza)" → YELLOW marker
  idx=1 → letter='B' → "B - delivery (123 Main St)" → GREEN marker
  idx=2 → letter='C' → "C - delivery (456 Oak Ave)" → GREEN marker
  idx=3 → letter='D' → "D - delivery (789 Pine Ln)" → GREEN marker

Map Display:
  🟨 A: Acme Pizza (38.420, 27.140)
  🟩 B: 123 Main St (38.424, 27.143)
  🟩 C: 456 Oak Ave (38.425, 27.144)
  🟩 D: 789 Pine Ln (38.426, 27.145)

  Polyline: A → B → C → D
```

---

## Footer Rendering

```tsx
(fetchedRoute || route)!.stops.map((stop, idx) => {
  const letter = String.fromCharCode(65 + idx);
  const isPickup = stop.type === "pickup";

  return (
    <TouchableOpacity key={idx}>
      <View style={[stopBadge, { backgroundColor: isPickup ? "#FCD34D" : "#34D399" }]}>
        <Text>{letter}</Text>
      </View>
      <View>
        <Text>{isPickup ? "Restaurant Pickup" : stop.address.split("\n")[0]}</Text>
        <Text>{stop.address.substring(0, 50)}</Text>
      </View>
    </TouchableOpacity>
  );
})

Rendered List:

  ┌─────────────────────────────────────┐
  │ A  Restaurant Pickup                │
  │    Acme Pizza                       │
  │                          [Arrived]  │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ B  123 Main St                      │
  │    123 Main St (Alice)              │
  │                          [15 min]   │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ C  456 Oak Ave                      │
  │    456 Oak Ave (Bob)                │
  │                          [18 min]   │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ D  789 Pine Ln                      │
  │    789 Pine Ln (Charlie)            │
  │                          [22 min]   │
  └─────────────────────────────────────┘

✅ NO DUPLICATE PICKUPS - Perfect!
```

---

## Route Calculation

```typescript
calculateRoute(stops) receives:
  stops = [pickup, delivery1, delivery2, delivery3]

waypoints = [
  { lat: 38.420, lng: 27.140, address: "Acme Pizza" },
  { lat: 38.424, lng: 27.143, address: "123 Main St" },
  { lat: 38.425, lng: 27.144, address: "456 Oak Ave" },
  { lat: 38.426, lng: 27.145, address: "789 Pine Ln" }
]

Backend calculates:
  Route 1: Current → Acme Pizza (orange polyline)
  Route 2: Acme Pizza → 123 Main St (blue polyline)
  Route 3: 123 Main St → 456 Oak Ave (blue polyline)
  Route 4: 456 Oak Ave → 789 Pine Ln (blue polyline)

  Total Distance: 8.5 km
  Total Duration: 28 minutes

Response:
  {
    distance: 8.5,
    duration: 28,
    stops: [...],  // Returned unchanged
    totalDistance: 8.5,
    totalDuration: 28
  }
```

---

## Summary

| Aspect                | Before                         | After                     |
| --------------------- | ------------------------------ | ------------------------- |
| **Pickup Stops**      | 3 (duplicate A for each order) | 1 (single A) ✓            |
| **Delivery Stops**    | 3 (B, C, D)                    | 3 (B, C, D) ✓             |
| **Total Stops**       | 6 (wrong)                      | 4 (correct) ✓             |
| **Map Markers**       | A, B, C, A, D (confusing)      | A, B, C, D (clear) ✓      |
| **Footer Items**      | 6 items (duplicate A)          | 4 items (no duplicates) ✓ |
| **Polyline Segments** | 6 segments (inefficient)       | 4 segments (optimal) ✓    |
| **Route Distance**    | Calculated for 6 stops         | Calculated for 4 stops ✓  |

---

## Verification Points

✅ `pickupMap` correctly deduplicates by coordinates
✅ Single pickup added with `stopNumber: 0`
✅ Deliveries added with sequential `stopNumber: 1, 2, 3`
✅ Array indices match letters (idx 0→A, 1→B, 2→C, 3→D)
✅ Map rendering uses array index for lettering
✅ Footer rendering uses array index for lettering
✅ Route calculation receives 4-stop array (not 6)
✅ No duplicate pickup on UI
