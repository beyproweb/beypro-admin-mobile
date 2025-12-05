# 🧪 Map Geocoding - Quick Test Guide

## What Changed

- ✅ Created `src/utils/geocoder.ts` - Converts addresses to coordinates
- ✅ Updated `MapModal.tsx` - Uses geocoding fallback when coordinates missing
- ✅ Enhanced logging in `packet.tsx` - Shows what backend returns

## Quick Test Steps

### Step 1: Open an Order

1. App → Packet Orders
2. Select any order with an address
3. Tap "View Map" button
4. **Expected**: Map opens and shows markers

### Step 2: Check Console Logs

Open DevTools and look for:

**If coordinates from backend:**

```
🔍 Backend response for order 12345: { delivery_lat: 38.087, delivery_lng: 27.728 }
📍 Order 12345 enriched with coords: { delivery_lat: 38.087, ... }
```

**If coordinates missing (will geocode):**

```
🔍 Backend response for order 12346: { delivery_lat: null, pickup_lat: null }
🔍 Geocoding delivery address...
✅ Delivery geocoded: (38.0872396, 27.7287161)
🔍 Geocoding pickup address...
✅ Pickup geocoded: (38.0872396, 27.7287161)
```

### Step 3: Verify Map Shows Markers

- 🟡 **Yellow circle** = Pickup location
- 🟢 **Green circle** = Delivery location
- 🔵 **Blue dot** = Your location (driver)

### Step 4: Test Popup

1. Tap the yellow marker
2. **Expected**: Popup shows "📍 Pickup\nAddress text"
3. Tap the green marker
4. **Expected**: Popup shows "📍 Delivery\nAddress text"

## Common Scenarios

### Scenario A: Address Shows But No Markers

**Debug:**

```javascript
// In console, check what was geocoded:
console.log("Geocoded delivery:", window.geocodedDelivery);
console.log("Geocoded pickup:", window.geocodedPickup);
```

**Fix**: Check backend response - coordinates might be completely missing

### Scenario B: Markers Appear But Popup Empty

**Debug:**

```javascript
// Check if address was passed
console.log("Delivery address:", deliveryAddress);
console.log("Pickup address:", pickupAddress);
```

**Fix**: Address not being sent to MapModal

### Scenario C: Very Slow to Open

**Note**: First load geocodes addresses (1-2 sec). Subsequent opens are instant.

**If still slow:**

- Check internet connection
- May be geocoding multiple orders simultaneously

### Scenario D: Wrong Location Shown

1. Copy the address from console logs
2. Search on Google Maps
3. Compare geocoded coordinates
4. If different, address might be ambiguous

**Solutions:**

- Fix address format on backend
- Or provide coordinates directly on backend

## Debug Commands

### Check what geocoder returns

```typescript
import { geocodeAddress } from "./src/utils/geocoder";

// Try geocoding an address
const result = await geocodeAddress(
  "Hürriyet Mahallesi, Atatürk Caddesi No: 56, Tire, İzmir"
);
console.log(result);
// Output: { lat: 38.0872396, lng: 27.7287161, address: "..." }
```

### Force re-geocoding

```javascript
// Clear geocoded state - map will re-geocode on next open
setGeocodedDeliveryLat(null);
setGeocodedDeliveryLng(null);
setGeocodedPickupLat(null);
setGeocodedPickupLng(null);
```

### Test Nominatim API directly

```javascript
// Test if geocoding service is working
fetch(
  "https://nominatim.openstreetmap.org/search?q=Tire%20Izmir&format=json&limit=1"
)
  .then((r) => r.json())
  .then(console.log);
```

## What to Look For

✅ **Good Signs:**

- Markers appear on map within 2-3 seconds
- Popup shows correct address
- Console shows geocoding logs
- Yellow (pickup) and Green (delivery) circles visible
- Blue dot (driver location) updates in real-time

❌ **Bad Signs:**

- Blank map with no markers
- Markers but popup empty
- Wrong location shown
- Geocoding errors in console
- No address text visible

## Performance Expectations

| Action                | Expected Time |
| --------------------- | ------------- |
| Open map (1st time)   | 2-3 seconds   |
| Open map (2nd+ time)  | <1 second     |
| Geocoding per address | 1-2 seconds   |
| Marker render         | <100ms        |
| Popup show            | <50ms         |

## If Tests Fail

### 1. Check Backend Response

```
✅ Ensure /orders/{id} API returns valid data
✅ Check if coordinates are provided
✅ If not, ensure address is correct
```

### 2. Check Geocoding Service

```
✅ Test Nominatim API manually
✅ Verify internet connection
✅ Check for rate limiting (rare)
```

### 3. Check MapModal Props

```typescript
// Should receive non-empty values:
<MapModal
  deliveryAddress="Some Address"  // ✅ Must be here
  pickupAddress="Some Address"    // ✅ Optional but recommended
  deliveryLat={0 | null | number} // Can be anything
  deliveryLng={0 | null | number} // Can be anything
  ...
/>
```

## Next Steps After Testing

1. ✅ Verify markers show on all orders
2. ✅ Test on actual device (emulator may be slower)
3. ✅ Test on slow network (geocoding will be slower)
4. ✅ Check if Android tiles load (see `ANDROID_WEBVIEW_TILES_FIX.md`)
5. ✅ Verify real-time driver location updates

## Files to Review

- `src/utils/geocoder.ts` - Geocoding service
- `src/components/MapModal.tsx` - Geocoding integration
- `app/orders/packet.tsx` - Backend response logging
- `MAP_GEOCODING_FALLBACK.md` - Full documentation
