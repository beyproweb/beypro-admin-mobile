# Android WebView Tiles - Quick Test Guide

## What Was Fixed

- ✅ WebView now sends proper User-Agent header
- ✅ Tile layer requests include Referer header
- ✅ Content Security Policy allows tile loading
- ✅ Automatic fallback to OpenStreetMap if Google fails
- ✅ Mixed content properly configured

## How to Test

### Step 1: Open Map on Android

1. Open app on Android device/emulator
2. Navigate to an order with delivery location
3. Tap "View Map" button
4. Wait 2-3 seconds

### Step 2: Verify Tiles Loaded

✅ **Should see:**

- Map tiles visible (gray/white with streets)
- Not just blank gray background
- Markers visible (yellow 🟡 pickup, green 🟢 delivery)

❌ **If broken:**

- Blank gray screen
- No street/map details
- Markers but no map tiles

### Step 3: Check Console Logs

Open DevTools and look for:

```
Creating map
📍 Markers - Pickup: ..., Delivery: ...
✅ Map ready
```

### Step 4: Test Fallback (Optional)

To test fallback mechanism:

1. Turn off WiFi/mobile data temporarily
2. Open map (Google tiles will fail)
3. Should see console warning: "🗺️ Google tiles failed, switching to OSM fallback"
4. Map should now show OpenStreetMap tiles instead

## Common Issues & Solutions

### Issue: Blank gray map

**Likely Cause:** Tiles not loading (User-Agent issue)
**Solution:** Check console for errors, verify User-Agent is set

### Issue: Markers visible but no tiles

**Likely Cause:** Tile request blocked by provider
**Solution:** Check if in restricted region, should fallback to OSM

### Issue: Works on WiFi but not 4G

**Likely Cause:** Network-specific blocking
**Solution:** Fallback should trigger, app should work with OSM tiles

## Files to Review

- `src/components/MapModal.tsx` - Main fix implementation
- `ANDROID_WEBVIEW_TILES_FIX.md` - Detailed documentation

## Quick Debug Commands

### Check if tiles are loading

Watch Network tab in DevTools for requests to:

- `mt1.google.com` (primary)
- `tile.openstreetmap.org` (fallback)

### Check User-Agent

Add to console:

```javascript
navigator.userAgent;
// Should show: "Mozilla/5.0 (Linux; Android 10)..."
```

### Force fallback

In browser console:

```javascript
window.mapInstance.removeLayer(window.tileLayer);
// Then manually add OSM layer
```
