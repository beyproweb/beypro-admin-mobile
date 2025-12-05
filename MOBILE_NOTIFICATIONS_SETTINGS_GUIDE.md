# Mobile Notification Settings - Integration Guide

## Quick Start

### 1. New File Created

**Location:** `/app/settings/notifications-settings.tsx`

This is the complete notification settings page for your mobile app with all the features from the web version:

- ✅ Global notification enable/disable
- ✅ Toast popups toggle
- ✅ Sound alerts toggle with volume control
- ✅ Default sound selection
- ✅ Per-role channel routing (Kitchen, Cashier, Manager)
- ✅ Stock alert configuration
- ✅ Escalation rules
- ✅ Per-event sound selection with test playback

### 2. Socket Sound Integration

**Location:** `/app/notifications/index.tsx` (Updated)

The notifications page now:

- Loads notification settings when socket connects
- Plays appropriate sounds based on event type and user settings
- Respects volume and enable/disable settings
- Handles all notification types: orders, payments, stock alerts

### 3. Sound Playing Hook

**Location:** `/src/hooks/useNotificationSounds.ts`

A reusable hook for playing notification sounds in other screens.

## Navigation Setup

Add this route to your settings navigation:

```tsx
// In app/settings/_layout.tsx or your settings navigation file
import NotificationsSettingsScreen from "./notifications-settings";

// Add to navigation:
<Stack.Screen
  name="notifications-settings"
  options={{
    title: "Notification Settings",
    headerBackTitle: "Back",
  }}
/>;
```

## Backend Integration Checklist

### Required Endpoints

- [ ] `GET /settings/notifications` - Fetch current settings
- [ ] `POST /settings/notifications` - Save settings
- [ ] `POST /settings/notifications/reset` - Reset to defaults (optional)

### Database Schema

Add to your settings table:

```sql
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY,
  restaurantId UUID NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  enableToasts BOOLEAN DEFAULT true,
  enableSounds BOOLEAN DEFAULT true,
  volume DECIMAL(2,2) DEFAULT 0.8,
  defaultSound VARCHAR(50) DEFAULT 'chime.mp3',
  channels JSONB DEFAULT '{"kitchen":"app","cashier":"app","manager":"app"}',
  escalation JSONB DEFAULT '{"enabled":true,"delayMinutes":3}',
  stockAlert JSONB DEFAULT '{"enabled":true,"cooldownMinutes":30}',
  eventSounds JSONB DEFAULT {...},
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (restaurantId) REFERENCES restaurants(id)
);
```

### Default Event Sounds

The app uses these event-sound mappings by default:

```json
{
  "new_order": "new_order.mp3",
  "order_preparing": "alert.mp3",
  "order_ready": "chime.mp3",
  "order_delivered": "success.mp3",
  "payment_made": "cash.mp3",
  "stock_low": "warning.mp3",
  "stock_restocked": "alert.mp3",
  "stock_expiry": "alarm.mp3",
  "order_delayed": "alarm.mp3",
  "driver_arrived": "horn.mp3",
  "driver_assigned": "horn.mp3",
  "yemeksepeti_order": "yemeksepeti.mp3"
}
```

## Sound Files Setup

1. **Location:** Place all sound files in `/public/sounds/`
2. **Format:** MP3 files, compressed for mobile
3. **Recommended:**
   - Quality: 128kbps
   - Mono, 22050Hz sample rate
   - Under 100KB per file

### Available Sounds in App

```typescript
const availableSounds = [
  "new_order.mp3",
  "alert.mp3",
  "chime.mp3",
  "alarm.mp3",
  "cash.mp3",
  "success.mp3",
  "horn.mp3",
  "warning.mp3",
  "yemeksepeti.mp3",
  "none",
];
```

Add more sounds by:

1. Adding files to `/public/sounds/`
2. Adding to `availableSounds` array in both:
   - `/app/settings/notifications-settings.tsx`
   - `/app/notifications/index.tsx`

## Socket Events That Trigger Sounds

These socket events automatically play sounds if enabled:

| Event           | Event Key         | Default Sound         |
| --------------- | ----------------- | --------------------- |
| Order Confirmed | `order_confirmed` | new_order.mp3         |
| Order Preparing | `order_preparing` | alert.mp3             |
| Order Ready     | `order_ready`     | chime.mp3             |
| Order Delivered | `order_delivered` | success.mp3           |
| Payment Made    | `payment_made`    | cash.mp3              |
| Stock Low       | `stock_low`       | warning.mp3           |
| Stock Restocked | `stock_restocked` | alert.mp3             |
| Driver Assigned | `driver_assigned` | horn.mp3              |
| Orders Updated  | `orders_updated`  | (no sound by default) |

## Usage Example

### Access Settings in Another Screen

```tsx
import secureFetch from "../../src/api/secureFetch";

// Load settings
const loadSettings = async () => {
  try {
    const settings = await secureFetch("/settings/notifications");
    console.log("Notification settings:", settings);

    // Use settings
    if (settings.enabled && settings.enableSounds) {
      // Play sounds
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
};
```

### Play Custom Sound

```tsx
import { useNotificationSounds } from "../../src/hooks/useNotificationSounds";

export function MyComponent() {
  const { playNotificationSound } = useNotificationSounds(socket, settings);

  const handleCustomEvent = () => {
    playNotificationSound("new_order");
  };

  return (
    <TouchableOpacity onPress={handleCustomEvent}>
      <Text>Play Sound</Text>
    </TouchableOpacity>
  );
}
```

## Testing Checklist

- [ ] Settings page loads without errors
- [ ] Can toggle all switches
- [ ] Volume slider works (0-100%)
- [ ] Can select different sounds
- [ ] Test button plays selected sound
- [ ] Settings save to backend
- [ ] Settings persist after app close
- [ ] Socket events trigger sounds correctly
- [ ] Sounds respect volume setting
- [ ] Escalation delay works
- [ ] Stock alert cooldown works
- [ ] Dark mode displays correctly

## Dark Mode Support

The settings page automatically adapts to your app's dark mode:

- Colors change for dark/light backgrounds
- Text contrast maintained
- Component backgrounds adapt

No additional configuration needed - just works!

## Performance Notes

1. **Sound Loading**: Lazy loaded on first play
2. **Memory**: Old sounds unloaded after playback
3. **Network**: Settings cached after first load
4. **Battery**: Minimal impact, sounds are compressed

## Future Enhancements

Consider adding:

- [ ] Custom sound upload
- [ ] Sound scheduling (quiet hours)
- [ ] Role-specific settings
- [ ] Sound preview duration limit
- [ ] Settings import/export
- [ ] Sound mixing (multiple sounds at once)

## Support

For issues or questions:

1. Check API Reference: `MOBILE_NOTIFICATIONS_API_REFERENCE.md`
2. Review socket events in notifications screen
3. Check console logs (marked with 🔊, ✅, ❌)
