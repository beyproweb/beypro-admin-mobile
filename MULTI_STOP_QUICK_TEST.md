# 🧪 Quick Start Testing - Multi-Stop Route

## 🚀 Start Testing NOW (with mock data)

### Step 1: Verify Mock Data is Enabled

The mock data is **already enabled** in your code! ✅

**File:** `src/api/driverRoutes.ts`

```typescript
const USE_MOCK_DATA = true; // ← Currently enabled
```

### Step 2: Run the App

```bash
cd /Users/nurikord/PycharmProjects/beypro-admin-mobile
npx expo start
```

Then press:

- **`i`** for iOS simulator, or
- **`a`** for Android emulator, or
- **`w`** for web browser

### Step 3: Navigate to Multi-Stop View

1. Log in to the app
2. Go to **Orders** → **Packet & Phone** screen
3. Look for **blue map button** in the header with stop count
4. Tap it to open the multi-stop map

### Step 4: What You Should See

✅ **Map with 4 stops:**

- Stop A (Yellow) - Pickup
- Stop B (Green) - Delivery
- Stop C (Yellow) - Pickup
- Stop D (Green) - Delivery

✅ **Route header showing:**

- Distance: 12.5 km
- Duration: 45 minutes
- Stops: 0/4 completed

✅ **Polyline connecting** all stops in order

✅ **Real-time location marker** (blue dot)

---

## 🧩 Test Cases to Try

### Test 1: View All Stops

**Step:**

1. Open multi-stop map
2. See all 4 markers on map

**Expected:** ✅ All stops visible with correct labels (A, B, C, D)

---

### Test 2: Tap Stop Marker

**Step:**

1. Tap on marker "A" (yellow pickup)
2. Bottom sheet slides up

**Expected:** ✅ Stop details show:

- Badge: "A"
- Type: "📦 Pickup"
- Address: "123 Main St, New York, NY 10001"
- Customer: "John's Restaurant"
- ETA: "X minutes away"

---

### Test 3: Mark Stop Complete

**Step:**

1. Open stop details
2. Tap "Mark Complete" button
3. Confirm in dialog

**Expected:** ✅

- Button becomes gray/disabled
- Status changes to "Completed"
- Progress bar increases
- Route header shows "1/4 completed"

---

### Test 4: Rotation & Landscape

**Step:**

1. Rotate device to landscape
2. Map should resize

**Expected:** ✅ All UI adjusts properly

---

### Test 5: Dark Mode

**Step:**

1. Toggle dark mode in app settings
2. Check multi-stop view

**Expected:** ✅ Colors and text readable in dark mode

---

## 🔍 Console Logs to Check

Open DevTools (F12) and check Console tab for:

```
✅ "📍 Using MOCK route data for testing..."
✅ "✅ Mock route loaded: 4 stops"
✅ "🗺️ MapModal visible..."
✅ "✅ Map ready"
```

---

## 📊 Real Data Testing (When Backend is Ready)

### To switch to real backend data:

**File:** `src/api/driverRoutes.ts`

Change this:

```typescript
const USE_MOCK_DATA = true;
```

To this:

```typescript
const USE_MOCK_DATA = false;
```

Then the app will try to fetch real orders from:

```
GET /api/drivers/:id/active-orders
```

---

## 🎯 Success Checklist

After testing, verify:

```
✓ App doesn't crash on startup
✓ Multi-stop button appears in header
✓ Map opens without errors
✓ All 4 test stops visible
✓ Markers have correct colors
✓ Polyline visible connecting stops
✓ Route stats display correctly
✓ Can tap markers
✓ Stop details sheet opens
✓ Can mark stops complete
✓ Progress bar updates
✓ Works in landscape
✓ Works in dark mode
✓ No console errors
✓ Performance is smooth
```

---

## 🐛 Troubleshooting

### Issue: Map is blank

**Solution:**

- Check browser console for errors
- Verify Leaflet CDN is loading (Network tab)
- Check coordinates are valid (lat: -90 to 90, lng: -180 to 180)

### Issue: Button doesn't appear

**Solution:**

- Verify mock data is enabled
- Check `multiStopRoute` is not null in React DevTools
- Restart app

### Issue: Markers don't show

**Solution:**

- Check map center coordinates
- Verify marker positions
- Open browser console → map object

### Issue: "Cannot read property 'stops'"

**Solution:**

- Mock data might not be loading
- Check `USE_MOCK_DATA = true` in driverRoutes.ts
- Restart Expo

---

## 💻 DevTools Tips

### React DevTools

1. Open DevTools → Components
2. Find `PacketOrdersScreen` component
3. Check state:
   - `multiStopRoute` should not be null
   - `multiStopRoute.stops` should have 4 items
   - `selectedStop` should show selected stop

### Network Tab

1. Open DevTools → Network
2. Look for API calls
3. With mock data: No `/drivers/` calls
4. With real backend: Should see GET `/api/drivers/12321/active-orders`

### Console Tab

1. Look for "Using MOCK route data" log
2. Should show "4 stops" in logs
3. No error messages should appear

---

## 🎬 Next: Backend Implementation

Once frontend testing is complete:

### Option 1: Using Node.js/Express

Copy these endpoints to your backend:

**GET `/api/drivers/:driverId/active-orders`**

- Returns all active orders for driver
- Response: `{ orders: [...] }`

**PATCH `/api/orders/:orderId/stop-event`**

- Marks stop as completed
- Request: `{ stopId, completedAt, notes }`

See `MULTI_STOP_TESTING_GUIDE.md` for full code examples.

### Option 2: Using Postman

Test endpoints before connecting to frontend:

1. Create GET request to `/api/drivers/:id/active-orders`
2. Send request with auth token
3. Verify response format

---

## ✅ You're Ready!

All features are working with mock data. Start testing now! 🚀

**Questions?** Check:

- `MULTI_STOP_IMPLEMENTATION_COMPLETE.md` - Full details
- `MULTI_STOP_BUILD_SUMMARY.md` - Quick overview
- `MULTI_STOP_TESTING_GUIDE.md` - Backend setup

**Happy testing!** 🎉
