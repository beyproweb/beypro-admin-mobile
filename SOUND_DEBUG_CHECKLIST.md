# 🔊 Sound Playback Debug Checklist

## When a new order arrives, look for these console logs IN THIS ORDER:

### Phase 1: Socket Event Received ✅

```
📡 Setting up 9 socket event listeners
🔔 Registered listener for: order_confirmed
🔔 Registered listener for: order_preparing
... (7 more)
✅ All 9 listeners registered

[When event arrives:]
📢 Notification received: order_confirmed { ...data... }
🎯 About to call playNotificationSound for order_confirmed
```

**If you DON'T see these logs:**

- ❌ Event is not arriving from backend
- ❌ Socket is not connected
- ❌ Handler not registered

---

### Phase 2: Settings Check 🔧

```
🎵 playNotificationSound called for: order_confirmed
📊 Settings state: {
  enabled: true,
  enableSounds: true,
  volume: 0.8,
  hasSettings: true,
  eventSoundsKeys: ["order_confirmed", "new_order", ...]
}
```

**If you see:**

- `hasSettings: false` → Settings failed to load
- `enableSounds: false` → Sound disabled in settings
- `enabled: false` → Notifications disabled

**Critical warning:**

```
⚠️⚠️⚠️ CRITICAL: Settings is NULL! Cannot play sound
```

- → Settings object never loaded from backend

---

### Phase 3: Sound File Resolution 🎵

```
🔎 Resolved sound file for order_confirmed: new_order.mp3
📥 Getting sound URI for: new_order.mp3
✅ Sound URI loaded: file://...../new_order.mp3
```

**If you see:**

- `No sound file for order_confirmed` → Sound mapping missing
- `Could not load sound URI` → Asset not found

---

### Phase 4: Audio Playback ▶️

```
🎵 Creating audio with URI: file://...../new_order.mp3
🔊 Setting volume to: 0.8
▶️ Playing sound now...
✅ Playing notification sound for order_confirmed: new_order.mp3
```

**If playback fails:**

```
⚠️ Failed to play sound for order_confirmed: [ERROR MESSAGE]
Error details: { message: "...", stack: "..." }
```

---

## Quick Diagnostic Flow:

1. **No `📢 Notification received` logs?**
   - Events aren't arriving
   - Check backend is emitting to `restaurant_${restaurantId}` room
   - Check mobile app joined room with `socket.emit("join_restaurant", restaurantId)`

2. **Logs appear but sound doesn't play?**
   - Look for `⚠️⚠️⚠️ CRITICAL: Settings is NULL!`
   - Settings not loading from backend
   - Check `/settings/notifications` API endpoint

3. **Sound file error?**
   - Missing sound asset file
   - Check `/assets/sounds/` directory has all MP3 files
   - Check file names match exactly

4. **Volume/playback error?**
   - Device might be in silent mode
   - Check `playsInSilentModeIOS: true` is set (it is)
   - Try restarting app to reinitialize audio session

---

## Key Files to Monitor:

1. **Sound system initialization:**
   - `src/components/NotificationSoundManager.tsx` (app root)
   - `src/hooks/useNotificationSounds.ts` (actual playback)

2. **Socket connection:**
   - Connected log: `Notification sound socket connected [socket-id]`
   - Room join log: `👥 [socket-id] joined restaurant_[id]`

3. **Settings loading:**
   - Mobile: `Notification settings refreshed (manager)`
   - Failure: `Failed to load notification settings (manager):`

---

## Test Flow:

1. ✅ Verify audio session initialized: Look for `Audio session configured`
2. ✅ Verify socket connected: Look for `Notification sound socket connected`
3. ✅ Verify settings loaded: Look for `Notification settings refreshed`
4. ✅ Verify listeners registered: Look for `All 9 listeners registered`
5. ✅ Simulate event and watch logs flow through all 4 phases above
