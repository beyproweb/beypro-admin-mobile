# 🧭 Navigate Button - Quick Test Guide

## What Changed

The **Navigate button** now:

- ✅ Opens Google Maps with exact delivery coordinates
- ✅ Shows error alert if Google Maps is not installed
- ✅ Properly passes Stop data to navigation handler
- ✅ Has error handling and console logging

---

## How to Test

### Step 1: Ensure Google Maps is Installed

**iOS:**

```
App Store → Search "Google Maps" → Install
```

**Android:**

```
Google Play Store → Search "Google Maps" → Install
```

### Step 2: Run the App

```bash
npm run ios
# OR
npm run android
```

### Step 3: Navigate to Multi-Stop Screen

- Open app → Orders → Start Multi-Stop Delivery
- Route: `/orders/[id]/live-map?driverId=1`

### Step 4: Test Navigate Button

1. Swipe up on bottom sheet (or scroll)
2. See "Navigate" button (blue icon + text)
3. Tap "Navigate" button
4. ✅ Google Maps opens with:
   - Current delivery address
   - Route from driver location
   - Turn-by-turn directions

---

## Expected Behavior

### Success Flow

```
User taps "Navigate"
    ↓
OnNavigate handler receives Stop object
    ↓
Extracts latitude & longitude
    ↓
Creates Google Maps URL:
https://www.google.com/maps/dir/?api=1&destination=38.424500,27.143500&travelmode=driving
    ↓
Calls Linking.openURL(url)
    ↓
✅ Google Maps app opens with directions
```

### Error Cases

**Case 1: Google Maps Not Installed**

```
User taps "Navigate"
    ↓
Google Maps not available
    ↓
Alert shown: "Could not open Google Maps. Please check if it's installed."
    ↓
Console logs: ❌ Failed to open Google Maps
```

**Case 2: No Phone Number (for Call button)**

```
User taps "Call"
    ↓
No customerPhone in stop data
    ↓
Alert shown: "Customer phone not available"
```

---

## Console Logs to Watch

When testing, look for these logs in console:

### Success

```
✅ No errors in console
```

### Failures

```
❌ Failed to open Google Maps: Error: ...
❌ Failed to open phone dialer: Error: ...
```

---

## Code Changes Summary

### In `live-map.native.tsx`:

**Old:**

```tsx
onNavigate={() => {
  if (currentStop) {
    const url = `...`;
    Linking.openURL(url);  // No error handling
  }
}}
```

**New:**

```tsx
onNavigate={(stop: Stop) => {
  if (stop && stop.latitude && stop.longitude) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&travelmode=driving`;
    Linking.openURL(url).catch((err) => {
      console.error("❌ Failed to open Google Maps:", err);
      Alert.alert("Error", "Could not open Google Maps. Please check if it's installed.");
    });
  }
}}
```

**Improvements:**

- ✅ Receives Stop object from StopBottomSheet
- ✅ Validates stop has latitude & longitude
- ✅ Has error handling with `.catch()`
- ✅ Shows user-friendly alert on error
- ✅ Logs to console for debugging

---

## Testing Checklist

- [ ] Google Maps installed on device
- [ ] App builds without errors (`npm run ios/android`)
- [ ] Multi-stop screen loads
- [ ] Navigate button is visible in bottom sheet
- [ ] Tap Navigate → Google Maps opens
- [ ] Google Maps shows correct delivery address
- [ ] Route is calculated from current location
- [ ] Directions are turn-by-turn
- [ ] No errors in console

---

## Alternative Navigation Options

If Google Maps is not available, consider fallback options:

### Option 1: Apple Maps (iOS only)

```typescript
const mapsUrl =
  Platform.OS === "ios"
    ? `maps://maps.apple.com/?daddr=${stop.latitude},${stop.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`;
```

### Option 2: Waze (if installed)

```typescript
const wazeUrl = `https://waze.com/ul?navigate=yes&ll=${stop.latitude},${stop.longitude}`;
```

### Option 3: OpenStreetMap

```typescript
const osmUrl = `https://maps.openstreetmap.org/?mlat=${stop.latitude}&mlon=${stop.longitude}&zoom=15`;
```

---

## Troubleshooting

### "Navigate button not showing"

- Scroll up in bottom sheet
- Ensure `currentStop` has `customerName`
- Check if it's the first stop (A)

### "Tap does nothing"

- Ensure Google Maps is installed
- Check console for error messages
- Verify latitude & longitude are valid numbers

### "Wrong location opens"

- Check API returns correct `delivery_lat` & `delivery_lng`
- Coordinates should be numbers, not strings
- Format: latitude (±90), longitude (±180)

### "Navigation works but route is wrong"

- Driver location might be stale
- Ensure location tracking is running (every 5s GPS update)
- Check distance badge is updating

---

## Performance Tips

1. **Lazy Load**: Google Maps is opened in separate app, so no performance impact
2. **Batch Operations**: Can navigate multiple stops in sequence
3. **No Network Required**: Google Maps works offline with cached data

---

## For Production Deployment

Ensure:

- [ ] Google Maps API key configured in backend
- [ ] Deep linking configured for iOS/Android
- [ ] Permissions granted for location access
- [ ] Terms of Service updated (tracking drivers)

See `MULTI_STOP_LIVE_MAP_COMPLETE.md` for full deployment guide.
