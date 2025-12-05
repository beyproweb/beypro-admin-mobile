# 🔌 Socket Connection Debug Guide

## THE PROBLEM

Your logs show:

```
LOG  ⚙️ useNotificationSounds effect running. socket: false playNotificationSound: true
LOG  ❌ Socket not available, skipping listener setup
```

**The socket is NOT connected when the hook tries to use it!**

---

## Debug Flow - Watch for These Logs

### Step 1: Manager Initialization

```
🔧 NotificationSoundManager render: restaurantId=123, user=true
```

- **Good:** restaurantId is available
- **Bad:** restaurantId is null/undefined → Auth not loaded yet

### Step 2: Socket Creation

```
🔌 NotificationSoundManager render: socket=false, settings=false
[1st render]
🔎 useNotificationSounds render #1: socket=false, settings=false
❌ Socket not available, skipping listener setup
```

This is NORMAL on first render. The socket hasn't been created yet.

### Step 3: Socket Connection (CRITICAL)

Wait for these logs:

```
✅ Socket CONNECTED and listeners should be registered now
👥 [socket-id] joined restaurant_123
```

Once you see these, the socket should emit `📡 [Socket Event Received] order_confirmed: ...`

### Step 4: Hook Re-runs with Socket

After socket connects, you should see:

```
🔌 NotificationSoundManager render: socket=true, settings=true
🎧 useNotificationSounds render #2: socket=true, settings=true
⚙️ useNotificationSounds effect running. socket: true playNotificationSound: true
📡 Setting up 9 socket event listeners
🔔 Registered listener for: order_confirmed
🔔 Registered listener for: order_preparing
... (7 more)
✅ All 9 listeners registered
```

**If you see these logs, the socket IS connected and listeners are ready!**

---

## Troubleshooting

### Issue 1: `restaurantId=null`

```
🔧 NotificationSoundManager render: restaurantId=null, user=false
```

**Solution:** Auth context not initialized or user not logged in

- Check AuthContext is loaded
- Verify user session is active
- Component mounted too early before auth

### Issue 2: Socket Never Connects

If you see `useNotificationSounds render #1` but never `render #2`:

```
🎧 useNotificationSounds render #1: socket=false, settings=false
❌ Socket not available, skipping listener setup
[NO MORE LOGS]
```

**Solution:** Socket state never updates

- Check `setSocket(socketInstance)` is being called
- Check socket connection doesn't fail silently
- Add logs in the socket useEffect

### Issue 3: Socket Connects but No Listeners

```
✅ Socket CONNECTED and listeners should be registered now
[BUT NO "Registered listener for" logs]
```

**Solution:** Hook effect not running after socket updates

- Check `[socket, playNotificationSound]` dependency array
- Verify socket state actually changes
- Check if there's an error in the useEffect

### Issue 4: Listeners Registered but No Events

```
✅ All 9 listeners registered
[New order created but NO "📢 Notification received" logs]
```

**Solution:** Backend events not arriving at this socket

- Backend might be emitting to wrong room
- Mobile not joined to correct `restaurant_${restaurantId}` room
- Socket disconnected after initial connection

Check for:

```
📡 [Socket Event Received] [event-name]: ...
```

This catch-all listener shows ALL events arriving at this socket.

---

## Quick Checklist When Sound Doesn't Play

- [ ] See `🔧 NotificationSoundManager render: restaurantId=...` (user logged in?)
- [ ] See `✅ Socket CONNECTED` (socket connects?)
- [ ] See `👥 joined restaurant_` (room joined?)
- [ ] See `🎧 useNotificationSounds render #2` (hook re-runs?)
- [ ] See `✅ All 9 listeners registered` (listeners attached?)
- [ ] See `📡 [Socket Event Received] order_confirmed` (event arrives?)
- [ ] See `📢 Notification received: order_confirmed` (handler triggered?)
- [ ] See `🔔 playNotificationSound called for: order_confirmed` (function called?)
- [ ] See `✅ Playing notification sound` (playback succeeds?)

If any of these is missing, that's where the problem is.

---

## Key Files

1. **Manager:** `/src/components/NotificationSoundManager.tsx`
   - Creates socket
   - Loads settings
   - Passes both to hook

2. **Hook:** `/src/hooks/useNotificationSounds.ts`
   - Registers event listeners
   - Plays sounds on events

3. **Debug Checklist:** This file (you're reading it!)

---

## Example Healthy Log Sequence

```
🔧 NotificationSoundManager render: restaurantId=456, user=true
Audio session configured successfully
✅ Audio session configured in notification hook
🎧 useNotificationSounds render #1: socket=false, settings=false
❌ Socket not available, skipping listener setup

[Socket initializing...]

✅ Socket CONNECTED and listeners should be registered now
👥 456 joined restaurant_456
Notification settings refreshed (manager)

🔌 NotificationSoundManager render: socket=true, settings=true
🎧 useNotificationSounds render #2: socket=true, settings=true
⚙️ useNotificationSounds effect running. socket: true playNotificationSound: true
📡 Setting up 9 socket event listeners
🔔 Registered listener for: order_confirmed
🔔 Registered listener for: order_preparing
🔔 Registered listener for: order_ready
🔔 Registered listener for: order_delivered
🔔 Registered listener for: driver_assigned
🔔 Registered listener for: payment_made
🔔 Registered listener for: stock_critical
🔔 Registered listener for: stock_restocked
🔔 Registered listener for: orders_updated
✅ All 9 listeners registered

[When new order arrives...]

📡 [Socket Event Received] order_confirmed: { orderId: 789, ... }
📢 Notification received: order_confirmed { orderId: 789, ... }
🎯 About to call playNotificationSound for order_confirmed
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

If you see this sequence, everything is working! 🎉
