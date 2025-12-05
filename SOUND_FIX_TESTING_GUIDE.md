# 🧪 Sound Events Fix - Testing Guide

## Pre-Testing Checklist

- [ ] Close and reopen the app to ensure fresh audio session
- [ ] Check device is not in silent/mute mode (check physical switch on iOS)
- [ ] Check volume is turned up
- [ ] Open Browser DevTools Console to watch for logs

---

## Testing Steps

### 1. **Verify Audio Session Started**

✅ **Expected Console Logs:**

```
✅ Audio session configured successfully
✅ Audio session configured in notification hook
🔔 Registered listener for: order_confirmed
🔔 Registered listener for: order_preparing
🔔 Registered listener for: order_ready
🔔 Registered listener for: order_delivered
🔔 Registered listener for: driver_assigned
🔔 Registered listener for: payment_made
🔔 Registered listener for: stock_critical
🔔 Registered listener for: stock_restocked
🔔 Registered listener for: orders_updated
```

**Location:** App startup (check console immediately after opening app)

---

### 2. **Test Manual Sound Play (Settings Tab)**

1. Navigate to: **Notifications Settings** (or Dashboard → Notifications)
2. Look for the **"Sound Settings"** or **"Event Sounds"** section
3. Click the **Play button** next to different events:
   - ✅ New Order
   - ✅ Alert
   - ✅ Chime
   - ✅ Success
   - ✅ etc.

**Expected Behavior:**

- Each button click plays the corresponding sound
- Volume slider affects the volume
- You should hear the sound immediately

**Console Logs:**

```
🎵 playNotificationSound called for: order_confirmed
📊 Settings state: { enabled: true, enableSounds: true, volume: 0.8, hasSettings: true }
🔎 Resolved sound file for order_confirmed: new_order.mp3
📥 Getting sound URI for: new_order.mp3
✅ Sound URI loaded: file://...
🎵 Creating audio with URI: file://...
🔊 Setting volume to: 0.8
▶️ Playing sound now...
✅ Playing notification sound for order_confirmed: new_order.mp3
```

---

### 3. **Test Event Sounds (Main Feature)**

#### Option A: Create Test Order (If Available)

1. Go to **POS System** or **Orders** section
2. Create a new order or confirm an order
3. Wait for socket event to trigger

#### Option B: Test via Backend

Ask your backend team to trigger events directly via socket:

```javascript
socket.emit("order_confirmed", { orderId: 123, amount: 50 });
socket.emit("payment_made", { orderId: 123, amount: 50 });
socket.emit("stock_critical", { productId: 1, name: "Item" });
```

#### Option C: Monitor Console While Another Device Completes Action

1. Have app open on your device with console visible
2. Have another person (or device) create order/payment on POS
3. Watch for console logs and listen for sound

**Expected Behavior:**

- Sound plays when event arrives
- Console shows "Playing notification sound for [event]"
- Sound respects volume setting from Notifications Settings

**Console Logs for Event:**

```
📢 Notification received: order_confirmed { ... data ... }
🎵 playNotificationSound called for: order_confirmed
📊 Settings state: { enabled: true, enableSounds: true, volume: 0.8 }
🔊 Playing notification sound for order_confirmed: new_order.mp3
```

---

### 4. **Test Settings Toggles**

#### Test 1: Disable "Enable Sounds"

1. Go to **Notifications Settings**
2. Toggle **"Enable Sounds"** OFF
3. Trigger an event (order, payment, etc.)
4. Sound should NOT play

**Console Logs:**

```
📢 Notification received: order_confirmed
🎵 playNotificationSound called for: order_confirmed
📊 Settings state: { enabled: true, enableSounds: false }  ← false!
⏭️ Sounds disabled, skipping sound
```

#### Test 2: Disable "Enable Notifications"

1. Go to **Notifications Settings**
2. Toggle **"Enable Notifications"** OFF
3. Trigger an event
4. Sound should NOT play

**Console Logs:**

```
🎵 playNotificationSound called for: order_confirmed
⏭️ Notifications disabled, skipping sound
```

#### Test 3: Change Volume

1. Set volume to **Minimum** (0%)
2. Trigger event
3. Sound plays but very quiet (or inaudible)

4. Set volume to **Maximum** (100%)
5. Trigger event
6. Sound plays very loud

---

### 5. **Test Event-Specific Sounds**

In **Notifications Settings**, you can set different sounds for different events:

1. Go to **Event Sounds** section
2. For **"Order Confirmed"** - set to `new_order.mp3`
3. For **"Payment Made"** - set to `cash.mp3`
4. For **"Stock Alert"** - set to `warning.mp3`

**Test:**

- Trigger **Order Confirmed** → Should hear "new_order" sound
- Trigger **Payment Made** → Should hear "cash" sound
- Trigger **Stock Alert** → Should hear "warning" sound

**Console Logs:**

```
🔎 Resolved sound file for order_confirmed: new_order.mp3
🔎 Resolved sound file for payment_made: cash.mp3
🔊 Playing notification sound for order_confirmed: new_order.mp3
🔊 Playing notification sound for payment_made: cash.mp3
```

---

### 6. **Platform-Specific Testing**

#### iOS Testing

- [ ] Test with device **Silent Switch ON** (should still play - we set `playsInSilentModeIOS: true`)
- [ ] Test with device **Silent Switch OFF**
- [ ] Test while app is in background (should continue to play)

#### Android Testing

- [ ] Test with system volume at different levels
- [ ] Test with different audio modes
- [ ] Verify sounds don't interfere with other apps

#### Web Testing

- [ ] Sounds may not work due to browser audio policies
- [ ] Some browsers require user interaction first
- [ ] Check browser console for audio errors

---

## Troubleshooting

### **No Sound But No Errors**

**Possible Causes:**

1. Device in silent mode (iOS) - Fix: Turn off silent switch
2. System volume too low - Fix: Increase volume
3. Audio session not initialized - Check: Look for `✅ Audio session configured` in logs
4. Sound file path wrong - Check: Look for `⚠️ Failed to load sound asset` in logs

**Debug Steps:**

```
// Check in console
1. Look for: "✅ Audio session configured successfully"
2. Look for: "🔔 Registered listener for: [event]"
3. When event triggers, look for: "📢 Notification received"
4. Look for: "🔊 Playing notification sound"
```

---

### **Sound Plays in Settings but Not Events**

**This should be FIXED now!** But if it still happens:

1. Check that `NotificationSoundManager` is imported in `/app/_layout.tsx`
2. Verify audio session logs appear at app startup
3. Check that settings `enableSounds: true` when event arrives

---

### **Wrong Sound Playing**

**Possible Causes:**

1. Event sound mapping is wrong - Check: `EVENT_SOUND_ALIASES` in hook
2. Sound file not found - Check: Look for `⚠️ Sound file not found in assets`

**Fix:**

- Go to Notifications Settings
- Explicitly set the sound for that event
- Test with "Play" button

---

### **Volume Not Changing**

**Debug:**

1. Move volume slider in Notifications Settings
2. Watch console for: `🔊 Setting volume to: [number]`
3. If number doesn't change, setting wasn't saved

**Fix:**

- Try refreshing the page/app
- Re-save the settings
- Check network tab for failed requests

---

## Success Criteria

✅ **All tests should pass:**

1. Audio session initializes at startup
2. Manual play buttons work in Settings
3. Event sounds trigger from socket events
4. Volume control affects sound level
5. Enable/Disable toggles work correctly
6. Per-event sound selection works
7. Platform-specific features work (silent mode, background, etc.)

---

## Console Output Summary

**Healthy console should show these logs in order:**

1. **Startup:**

   ```
   ✅ Audio session configured successfully
   ✅ Audio session configured in notification hook
   ```

2. **Socket Connection:**

   ```
   🔔 Notification sound socket connected [socket-id]
   🔔 Registered listener for: [events...]
   ```

3. **When Event Triggers:**
   ```
   📢 Notification received: order_confirmed { ... }
   🎵 playNotificationSound called for: order_confirmed
   📊 Settings state: {...}
   🔎 Resolved sound file: new_order.mp3
   📥 Getting sound URI for: new_order.mp3
   ✅ Sound URI loaded: file://...
   🎵 Creating audio with URI: file://...
   🔊 Setting volume to: 0.8
   ▶️ Playing sound now...
   ✅ Playing notification sound: new_order.mp3
   ```

**If something is missing from this sequence, you'll know where the issue is!**

---

## Quick Test Command (Backend)

If you have backend access:

```javascript
// Trigger test event via socket
socket.emit("order_confirmed", {
  orderId: "12345",
  amount: 99.99,
});
```

---

## Final Verification

After all tests pass:

✅ Commit with message: "Fix: Enable audio playback for event notifications"
✅ Deploy to production
✅ Monitor user feedback for sound playback issues
✅ Check analytics for notification engagement

---

**🎉 If all these tests pass, the sound fix is working perfectly!**
