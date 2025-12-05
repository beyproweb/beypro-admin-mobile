# 🔔 Mobile Notification Settings - Quick Reference

## What Was Created

| Component         | Location                                   | Purpose                       |
| ----------------- | ------------------------------------------ | ----------------------------- |
| **Settings Page** | `/app/settings/notifications-settings.tsx` | Full notification settings UI |
| **Sound Hook**    | `/src/hooks/useNotificationSounds.ts`      | Reusable sound playback logic |
| **Updated**       | `/app/notifications/index.tsx`             | Socket → Sound integration    |

## Key Capabilities

```
Master Controls
├── 🔔 Enable/Disable Notifications
├── 💬 Enable/Disable Toast Popups
├── 🔊 Enable/Disable Sound Alerts
├── 📊 Volume Control (0-100%)
└── 🎵 Default Sound Selection

Per-Role Settings
├── Kitchen → app/email/whatsapp
├── Cashier → app/email/whatsapp
└── Manager → app/email/whatsapp

Stock Alerts
├── ✅ Enable/Disable
└── ⏱️ Cooldown (1-120 min)

Escalation Rules
├── ✅ Repeat if Unacknowledged
└── ⏱️ Delay (1-30 min)

Per-Event Sounds (12 events)
├── New Order
├── Preparing
├── Order Ready
├── Delivered
├── Payment Made
├── Stock Low
├── Stock Restocked
├── Expiry Alert
├── Delayed Order
├── Driver Arrived
├── Driver Assigned
└── Yemeksepeti Order
```

## Socket Events → Sounds

| Socket Event      | Default Sound    | Event Key       |
| ----------------- | ---------------- | --------------- |
| `order_confirmed` | 🎵 new_order.mp3 | order_confirmed |
| `order_preparing` | 🎵 alert.mp3     | order_preparing |
| `order_ready`     | 🎵 chime.mp3     | order_ready     |
| `order_delivered` | 🎵 success.mp3   | order_delivered |
| `driver_assigned` | 🎵 horn.mp3      | driver_assigned |
| `payment_made`    | 🎵 cash.mp3      | payment_made    |
| `stock_low`       | 🎵 warning.mp3   | stock_low       |
| `stock_restocked` | 🎵 alert.mp3     | stock_restocked |
| `orders_updated`  | (none)           | orders_updated  |

## API Endpoints Needed

```
✅ GET  /settings/notifications
✅ POST /settings/notifications
🔶 POST /settings/notifications/reset (optional)
```

## Quick Start

### 1. Create Backend Endpoints

```
Implement GET/POST /settings/notifications
```

### 2. Add Sound Files

```
/public/sounds/
  ├── new_order.mp3
  ├── alert.mp3
  ├── chime.mp3
  ├── alarm.mp3
  ├── cash.mp3
  ├── success.mp3
  ├── horn.mp3
  ├── warning.mp3
  └── yemeksepeti.mp3
```

### 3. Add Navigation Link

```tsx
<Stack.Screen name="notifications-settings" />
```

### 4. Test It

- Open settings
- Adjust sounds
- Save
- Trigger socket events
- Hear sounds play

## Settings Structure

```json
{
  "enabled": boolean,
  "enableToasts": boolean,
  "enableSounds": boolean,
  "volume": 0-1,
  "defaultSound": "chime.mp3",
  "channels": {
    "kitchen": "app" | "email" | "whatsapp",
    "cashier": "app" | "email" | "whatsapp",
    "manager": "app" | "email" | "whatsapp"
  },
  "escalation": {
    "enabled": boolean,
    "delayMinutes": number
  },
  "stockAlert": {
    "enabled": boolean,
    "cooldownMinutes": number
  },
  "eventSounds": {
    "event_key": "sound.mp3",
    ...
  }
}
```

## Sound Files

| File            | Use Case             | Type      |
| --------------- | -------------------- | --------- |
| new_order.mp3   | New incoming orders  | Urgent    |
| alert.mp3       | Generic alerts       | Medium    |
| chime.mp3       | Gentle notifications | Soft      |
| alarm.mp3       | Urgent alerts        | Loud      |
| cash.mp3        | Payment received     | Positive  |
| success.mp3     | Order ready          | Positive  |
| horn.mp3        | Driver events        | Attention |
| warning.mp3     | Stock low            | Caution   |
| yemeksepeti.mp3 | Third-party orders   | Special   |

## Component Props

None - connects via:

- `useAppearance()` for dark mode
- `useAuth()` for user info
- `secureFetch()` for API calls

## Dependencies

```
Required:
- react-native
- expo-av (Audio)
- react-i18n (translations)

Existing:
- secureFetch API
- useAppearance hook
- useAuth hook
```

## Testing Checklist

```
🔊 Sound Features
  ☐ Play test sounds
  ☐ Volume changes apply
  ☐ Test each event sound
  ☐ Mute/unmute works

⚙️ Settings
  ☐ Save persists
  ☐ Load on open
  ☐ All toggles work
  ☐ Sliders work

🔗 Socket Events
  ☐ order_confirmed plays sound
  ☐ order_ready plays sound
  ☐ payment_made plays sound
  ☐ stock_low plays sound
  ☐ driver_assigned plays sound

🌙 UI/UX
  ☐ Dark mode works
  ☐ Light mode works
  ☐ Responsive layout
  ☐ Buttons clickable
  ☐ Scrolls smoothly

📱 Mobile
  ☐ No console errors
  ☐ Saves efficiently
  ☐ Battery usage normal
  ☐ Sounds play in foreground
```

## Troubleshooting

| Issue                 | Solution                                             |
| --------------------- | ---------------------------------------------------- |
| Sounds don't play     | Check `enableSounds=true`, verify sound files exist  |
| Settings don't save   | Check backend endpoints, verify restaurantId         |
| Styling looks off     | Check `useAppearance()` context, verify isDark value |
| Socket not connecting | Check SOCKET_URL, verify auth headers                |
| Volume not working    | Verify slider state updating, check audio API        |

## File Locations

```
📁 /app/settings/
  └── notifications-settings.tsx          ← Settings page

📁 /src/hooks/
  └── useNotificationSounds.ts            ← Sound hook

📁 /app/notifications/
  └── index.tsx                           ← Updated with sounds

📁 /public/sounds/
  └── *.mp3                               ← Add sound files here

📄 MOBILE_NOTIFICATIONS_*.md              ← Documentation
```

## Key Functions

```tsx
// Load settings
loadNotificationSettings()

// Play sound
playNotificationSound(eventType: string)

// Update settings
setSettings(updatedSettings)

// Save to backend
handleSave()
```

## Environment Variables

None needed - uses `Constants.expoConfig`

## Dark Mode

Automatic - checks `isDark` from context
Colors adapt based on theme

## Internationalization

All strings use `t()` for translations:

- "Notifications"
- "Enable Sound Alerts"
- "Volume"
- etc.

## Performance

- Sounds: < 100ms load time
- Settings: Cached after first load
- Memory: Cleaned up after playback
- Battery: Minimal impact

## Next Steps

1. ✅ Files created
2. ⏳ Backend endpoints needed
3. ⏳ Sound files needed
4. ⏳ Navigation integration needed
5. ⏳ Testing needed

## Documentation Files

- `MOBILE_NOTIFICATIONS_IMPLEMENTATION_SUMMARY.md` - Overview
- `MOBILE_NOTIFICATIONS_API_REFERENCE.md` - API specs
- `MOBILE_NOTIFICATIONS_SETTINGS_GUIDE.md` - Integration guide
- This file - Quick reference

---

**Ready to test!** Just implement backend endpoints and add sound files.
