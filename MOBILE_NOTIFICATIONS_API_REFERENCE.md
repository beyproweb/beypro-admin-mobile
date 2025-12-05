# Mobile Notification Settings API Reference

## Overview

This document outlines the API endpoints required for notification settings management in the mobile app. The notification settings page communicates with the backend to persist user preferences for sounds, channels, and escalation rules.

## Base URL

```
https://hurrypos-backend.onrender.com/api
```

## Endpoints

### 1. Get Notification Settings

**Endpoint:** `GET /settings/notifications`

**Description:** Retrieve the current notification settings for the authenticated restaurant.

**Response:**

```json
{
  "enabled": true,
  "enableToasts": true,
  "enableSounds": true,
  "volume": 0.8,
  "defaultSound": "chime.mp3",
  "channels": {
    "kitchen": "app",
    "cashier": "app",
    "manager": "app"
  },
  "escalation": {
    "enabled": true,
    "delayMinutes": 3
  },
  "stockAlert": {
    "enabled": true,
    "cooldownMinutes": 30
  },
  "eventSounds": {
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
}
```

### 2. Save Notification Settings

**Endpoint:** `POST /settings/notifications`

**Description:** Save notification settings for the authenticated restaurant.

**Request Body:**

```json
{
  "enabled": true,
  "enableToasts": true,
  "enableSounds": true,
  "volume": 0.8,
  "defaultSound": "chime.mp3",
  "channels": {
    "kitchen": "app",
    "cashier": "app",
    "manager": "app"
  },
  "escalation": {
    "enabled": true,
    "delayMinutes": 3
  },
  "stockAlert": {
    "enabled": true,
    "cooldownMinutes": 30
  },
  "eventSounds": {
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
}
```

**Response:**

```json
{
  "success": true,
  "message": "Notification settings saved successfully",
  "data": { ...saved settings... }
}
```

### 3. Reset to Defaults

**Endpoint:** `POST /settings/notifications/reset`

**Description:** Reset notification settings to default values.

**Response:**

```json
{
  "success": true,
  "message": "Notification settings reset to defaults",
  "data": { ...default settings... }
}
```

## Socket Events

### Notification Socket Events

The mobile app listens to these socket events and plays corresponding sounds based on user settings:

#### order_confirmed

```json
{
  "orderId": "123",
  "amount": 50.0,
  "customer": "John Doe"
}
```

#### order_preparing

```json
{
  "orderId": "123",
  "eta": "15 minutes"
}
```

#### order_ready

```json
{
  "orderId": "123",
  "items": ["Pizza", "Salad"]
}
```

#### order_delivered

```json
{
  "orderId": "123",
  "deliveryTime": "2024-01-15T10:30:00Z"
}
```

#### driver_assigned

```json
{
  "orderId": "123",
  "driverName": "Ahmed",
  "driverId": "456",
  "vehicle": "Bike"
}
```

#### payment_made

```json
{
  "orderId": "123",
  "amount": 50.0,
  "paymentMethod": "card"
}
```

#### stock_low

```json
{
  "productId": "789",
  "productName": "Tomato",
  "quantity": 5,
  "threshold": 10
}
```

#### stock_restocked

```json
{
  "productId": "789",
  "productName": "Tomato",
  "quantity": 100
}
```

#### orders_updated

```json
{
  "count": 3,
  "reason": "status_changed"
}
```

## Sound Files Location

All sound files should be stored at:

```
/public/sounds/
```

### Available Sounds

- `new_order.mp3` - Default for new orders
- `alert.mp3` - Generic alert sound
- `chime.mp3` - Gentle notification sound
- `alarm.mp3` - Urgent alert
- `cash.mp3` - Payment received
- `success.mp3` - Order ready
- `horn.mp3` - Driver assigned
- `warning.mp3` - Stock low
- `yemeksepeti.mp3` - Third-party order alert
- `none` - No sound

## Settings Field Descriptions

### enabled (boolean)

Global master switch to enable/disable all notifications

### enableToasts (boolean)

Controls whether toast popups appear for notifications

### enableSounds (boolean)

Controls whether sound alerts are played

### volume (number, 0-1)

Master volume level for all notification sounds

### defaultSound (string)

Default sound to play if no specific event sound is configured

### channels (object)

Notification delivery channel per role:

- `app` - In-app notification
- `email` - Email notification
- `whatsapp` - WhatsApp notification

### escalation (object)

- `enabled` - Whether to repeat unacknowledged notifications
- `delayMinutes` - Minutes before repeating the notification

### stockAlert (object)

- `enabled` - Whether to enable stock alerts
- `cooldownMinutes` - Minimum minutes between duplicate stock alerts for same product

### eventSounds (object)

Specific sound file for each event type. Overrides defaultSound if set.

## Implementation Notes

1. **Settings Persistence**: Settings are stored per restaurant and synced across all devices
2. **Sound Loading**: Sounds load lazily only when needed
3. **Volume Control**: Applies to all notification sounds globally
4. **Event-Specific Sounds**: Can override default sound on per-event basis
5. **Escalation**: Only works if notification not explicitly dismissed
6. **Stock Cooldown**: Prevents notification spam for same product

## Error Handling

### Common Error Responses

**Invalid Settings**

```json
{
  "success": false,
  "message": "Invalid notification settings",
  "errors": ["volume must be between 0 and 1", "delayMinutes must be positive"]
}
```

**Unauthorized**

```json
{
  "success": false,
  "message": "Unauthorized access",
  "code": 401
}
```

**Server Error**

```json
{
  "success": false,
  "message": "Failed to save settings",
  "code": 500
}
```

## Rate Limiting

- Saving settings: 10 requests per minute
- Retrieving settings: 60 requests per minute

## Authentication

All endpoints require authentication via:

- Bearer token in Authorization header, or
- restaurantId in auth payload
