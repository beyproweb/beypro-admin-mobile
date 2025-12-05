# WebSocket Real-Time Location Updates - Testing Guide

## Pre-Testing Checklist

- ✅ Code builds without errors
- ✅ Map modal displays correctly
- ✅ Location tracking is enabled
- ✅ Socket.io is connected
- ✅ Backend emits `driver_location_updated` events

## Test Scenarios

### Scenario 1: Basic Real-Time Update (Happy Path)

**Setup:**

1. Start the app and navigate to Orders > Packet
2. Find an order with an assigned driver
3. Click "View Map" to open the map modal

**Execute:**

1. Verify initial map loads with three markers:

   - 🟢 Green circle = Delivery location (fixed)
   - 🟡 Yellow circle = Pickup location (fixed)
   - 🔵 Blue dot = Driver location (current)

2. Simulate backend sending location update:

   ```json
   {
     "driver_id": "driver_123",
     "lat": 40.7135,
     "lng": -74.006,
     "timestamp": 1704067200000
   }
   ```

3. Observe:
   - Driver marker moves to new position
   - Map pans to show new driver location
   - No page refresh occurs
   - Movement is smooth

**Expected Result:** ✅ Driver marker updates in real-time

---

### Scenario 2: Multiple Driver Updates in Sequence

**Setup:**

1. Keep map modal open
2. Have access to send multiple location updates

**Execute:**

1. Send 3 location updates in rapid succession:
   ```
   Update 1: lat: 40.7135, lng: -74.0060
   Update 2: lat: 40.7140, lng: -74.0055
   Update 3: lat: 40.7145, lng: -74.0050
   ```

**Observe:**

- Each update moves marker smoothly
- No marker duplicates
- No console errors
- Map follows driver path

**Expected Result:** ✅ All updates processed correctly

---

### Scenario 3: Map Modal Close and Reopen

**Setup:**

1. Open map modal with active driver
2. Receive location updates (marker updates)

**Execute:**

1. Close map modal (click "Close Map" button)
2. Wait 5 seconds (simulating driver continued moving)
3. Reopen map modal for same order

**Observe:**

- Map reloads cleanly
- Previous markers cleared
- New marker position is correct
- New updates work immediately

**Expected Result:** ✅ No stale data or duplicates

---

### Scenario 4: Large Location Coordinate Changes

**Setup:**

1. Open map modal
2. Send update with large coordinate change

**Execute:**

1. Initial driver position: lat: 40.7128, lng: -74.0060
2. Update to: lat: 40.7580, lng: -73.9855 (different area)

**Observe:**

- Map zooms out to show both old and new location
- Marker moves to new position
- Map doesn't get stuck or glitchy

**Expected Result:** ✅ Map handles large jumps gracefully

---

### Scenario 5: No Updates (Driver Stopped)

**Setup:**

1. Open map modal
2. Receive initial location update
3. No new updates for 30 seconds

**Execute:**

1. Watch marker behavior
2. Check console for any error loops

**Observe:**

- Marker stays at last known position
- No anxiety/error messages
- Map remains responsive
- Able to manually interact with map

**Expected Result:** ✅ Gracefully handles stale data

---

### Scenario 6: Network Disruption and Recovery

**Setup:**

1. Open map modal with active updates
2. Simulate network disruption

**Execute:**

1. Turn off WiFi/cellular (simulate network loss)
2. Wait 10 seconds
3. Restore network connection
4. Observe Socket.io reconnection

**Observe:**

- Updates stop during network loss
- Marker doesn't jump around
- Connection re-establishes
- Updates resume after reconnect

**Expected Result:** ✅ Graceful degradation and recovery

---

### Scenario 7: Invalid Location Data

**Setup:**

1. Open map modal
2. Prepare invalid location updates

**Execute:**

1. Send update with invalid coordinates:

   ```json
   { "driver_id": "123", "lat": "invalid", "lng": -74.006 }
   ```

2. Send update with missing fields:

   ```json
   { "driver_id": "123" }
   ```

3. Send update with huge numbers:
   ```json
   { "driver_id": "123", "lat": 90000, "lng": 99999 }
   ```

**Observe:**

- App doesn't crash
- Errors logged to console
- Map continues to function
- Previous valid marker remains visible

**Expected Result:** ✅ Robust error handling

---

### Scenario 8: Console Logging Verification

**Setup:**

1. Open React Native debugger console
2. Filter for MapModal logs

**Execute:**

1. Open map modal
2. Receive location update
3. Check console output

**Expected Console Logs:**

```
🗺️ MapModal visible, lat: 40.7128, lng: -74.0060
Generating map HTML: {lat: 40.7128, lng: -74.0060, ...}
📍 Loading...
Creating map
Map ready
✅ Map ready
📍 Real-time update - Driver 123: 40.7135, -74.0060
Marker updated: 123 at 40.7135,-74.0060
```

**Expected Result:** ✅ All expected logs appear

---

### Scenario 9: Multiple Drivers on Map

**Setup:**

1. Modify backend to send updates for multiple drivers
2. Open map modal

**Execute:**

1. Send location for Driver A
2. Send location for Driver B
3. Send location for Driver C
4. Send second update for Driver A

**Observe:**

- All drivers appear as separate markers
- Each update affects correct driver's marker
- Map shows all drivers clearly
- Colors/styling consistent

**Expected Result:** ✅ Multi-driver tracking works

---

### Scenario 10: Performance Under Load

**Setup:**

1. Open map modal
2. Prepare rapid-fire location updates

**Execute:**

1. Send 50 location updates in 5 seconds
2. Monitor performance
3. Check memory usage
4. Verify app responsiveness

**Observe:**

- No frame drops/jank
- Updates process smoothly
- App remains responsive to touch
- No memory leaks
- Console clean (no spam)

**Expected Result:** ✅ Efficient performance

---

## Mobile Device Testing

### iOS Testing

- [ ] Test on iPhone 12+ (physical device)
- [ ] Verify marker animation smoothness
- [ ] Check GPS accuracy with real location
- [ ] Test with different zoom levels
- [ ] Verify touch interactions

### Android Testing

- [ ] Test on Android 10+ device
- [ ] Verify marker rendering quality
- [ ] Check WebView bridge communication
- [ ] Test with Google Play Services
- [ ] Verify notification permissions

---

## Debugging Techniques

### 1. React Native Console Logs

```javascript
// Monitor in Expo console
console.log("📍 Real-time update - Driver 123: 40.7128, -74.0060");
```

### 2. WebView Console Access

```javascript
// In React Native debugger:
// Navigate to WebView tab to see browser console
console.log("Marker updated: 123 at 40.7128,-74.0060");
```

### 3. Network Inspection

```javascript
// Monitor Socket.io events
DEBUG=socket.io* node server.js

// Or in Chrome DevTools:
// Network tab → WS → Check messages
```

### 4. Performance Profiling

```javascript
// React Native profiler
// Menu → "Inspect" → Profiler tab
// Record during location updates
```

### 5. Marker State Inspection

```javascript
// In WebView console:
window.mapMarkers; // See all markers
window.mapInstance; // Access Leaflet map
```

---

## Acceptance Criteria

### Must Have ✅

- [ ] Driver marker updates in real-time
- [ ] No page refresh needed
- [ ] Smooth marker animation
- [ ] Error handling for invalid data
- [ ] Graceful network failure recovery

### Should Have 🟡

- [ ] Multiple drivers tracked
- [ ] Performance under load
- [ ] Clean console (no spam)
- [ ] Memory efficient
- [ ] Visual polish/animations

### Nice to Have 💎

- [ ] Position history/trail
- [ ] Speed indicators
- [ ] Direction arrows
- [ ] ETA calculations
- [ ] Geofence alerts

---

## Regression Testing

Before marking complete, verify existing functionality still works:

- [ ] Map modal opens without errors
- [ ] Static markers (delivery, pickup) display correctly
- [ ] Map gestures work (zoom, pan, rotate)
- [ ] Close button dismisses modal
- [ ] Modal coordinates display correctly
- [ ] Location watch still works (driver's own position)
- [ ] No impact on order list performance

---

## Sign-Off Checklist

### Developer

- [ ] Code reviewed for logic errors
- [ ] No console errors/warnings
- [ ] Proper error boundaries
- [ ] Memory cleanup verified

### QA

- [ ] All scenarios tested ✅
- [ ] Both iOS and Android tested
- [ ] No regressions found
- [ ] Performance acceptable

### Product

- [ ] Feature meets requirements
- [ ] UX is smooth/polished
- [ ] Ready for production

---

## Known Limitations

1. **GPS Latency**: Real GPS updates have 2-5 second delay
2. **Accuracy**: GPS accuracy ±5-20 meters in urban areas
3. **Zoom Behavior**: Auto-pan can interfere with manual zoom
4. **Connection**: Requires active Socket.io connection
5. **Battery**: Continuous GPS tracking drains battery faster

---

## Post-Release Monitoring

Track these metrics:

- Event delivery success rate (target: >99%)
- Average update latency (target: <500ms)
- Socket.io connection stability (target: >99.5%)
- User reported issues
- Performance impact on app

---

## Contact & Support

For issues or questions:

- Check console logs first (see Debugging Techniques)
- Review WEBSOCKET_IMPLEMENTATION.md for architecture
- Check BACKEND_WEBSOCKET_GUIDE.md for backend setup
- Review Socket.io docs for advanced usage
