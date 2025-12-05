# Driver Multi-Stop Route - Visual Design Guide

## 📱 Screen Layouts

### Layout 1: Multi-Stop Map View

```
┌─────────────────────────────────────┐
│ My Route    A of E • 5 stops        │  ← RouteHeader
│ ⏱ 45 min   🗺 12.5 km              │
├─────────────────────────────────────┤
│                                     │
│          🗺️ MAP CANVAS              │
│                                     │
│  A 🟡 -------- Pickup 1            │  Numbered markers
│      \                              │  with labels A-E
│   B 🟢 -------- Delivery 1         │
│        \                            │
│   C 🟡 -------- Pickup 2           │  Polyline connects
│          \                          │  all stops
│   D 🟢 -------- Delivery 2         │
│            \                        │
│   E 🟢 -------- Delivery 3         │
│                                     │
│   🔵 Driver (blue dot, current)    │
│                                     │
├─────────────────────────────────────┤
│ A - PICKUP (Current)                │  ← StopDetailsSheet
│ 📍 123 Main St, Downtown            │
│ 👤 John Doe                         │
│                                     │
│ [  ✓ Mark as Complete  ] [Skip]   │
│                                     │
│ NEXT STOPS:                         │
│ ┌─────────────────────────────┐   │
│ │ B  📍 456 Oak Ave          │   │
│ │     🚚 Delivery            │   │
│ └─────────────────────────────┘   │
│ ┌─────────────────────────────┐   │
│ │ C  📍 789 Pine Rd           │   │
│ │     📦 Pickup              │   │
│ └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 🗺️ Map Elements

### Marker Styling

```
┌──────────────────────────────────────────────────┐
│ STOP MARKER TYPES                                │
├──────────────────────────────────────────────────┤
│                                                  │
│  Pickup (Pending)         Pickup (Current)      │
│      🟡                        🟠                │
│    Label A              Label B (Animated)      │
│    Radius 14px          Radius 14px             │
│    Opacity 1.0          Opacity 1.0             │
│    #FCD34D yellow       #FB923C orange          │
│                                                  │
│                                                  │
│  Delivery (Pending)       Delivery (Complete)   │
│      🟢                        ✅                │
│    Label C              Label D (Faded)         │
│    Radius 14px          Radius 14px             │
│    Opacity 1.0          Opacity 0.6             │
│    #34D399 green        #10B981 dark green      │
│                                                  │
│                                                  │
│  Driver Position                                │
│      🔵                                          │
│    Current location              Updated every  │
│    Radius 8px                    5 seconds      │
│    #3B82F6 blue                                │
│    Animates smoothly                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Polyline Design

```
Line Appearance:
- Color: #2563EB (blue)
- Width: 3px
- Opacity: 0.7 (semi-transparent)
- Pattern: Dashed (5px dash, 5px gap)
- Connects all stops in sequential order
- Updates on each new route

Example Route:
A (Pickup)
 \
  B (Delivery)
   \
    C (Pickup)
     \
      D (Delivery)
       \
        E (Delivery)
```

---

## 📊 Stop Details Sheet States

### State 1: Pending Stop

```
┌────────────────────────────────┐
│ [A] PICKUP (Current)           │
│ 📍 123 Main St, Downtown       │
│ Downtown District              │
│ 👤 John Doe | Order #5421      │
│                                │
│ [ ✓ Mark as Complete ]        │
│ [ Skip ]                       │
└────────────────────────────────┘

Appearance:
- Yellow background for pickup
- Dark text (high contrast)
- Action buttons enabled
- Clear call-to-action
```

### State 2: In Progress Stop

```
┌────────────────────────────────┐
│ [B] DELIVERY (Current)         │
│ 📍 456 Oak Ave, Midtown        │
│ Midtown Business Center        │
│ 👤 Jane Smith | Order #5422    │
│                                │
│ 🔄 ARRIVING... (5 min away)   │
│                                │
│ [ ✓ Mark as Complete ]        │
│ [ Skip ]                       │
└────────────────────────────────┘

Appearance:
- Green background for delivery
- "Arriving soon" indicator
- Countdown timer
- Location pulses/animates
```

### State 3: Completed Stop (View Only)

```
┌────────────────────────────────┐
│ [A] PICKUP ✓ COMPLETED        │
│ 📍 123 Main St, Downtown       │
│ Downtown District              │
│ 👤 John Doe | Order #5421      │
│ ✓ Completed at 2:34 PM        │
│                                │
│ Showing: Next Stop Details...  │
└────────────────────────────────┘

Appearance:
- Grayed out
- Checkmark indicates completion
- Timestamp shown
- Not interactive
```

---

## 🎨 Color Palette

```
Color Scheme:
─────────────────────────────────

Pickup:         #FCD34D (Amber/Yellow)
Delivery:       #34D399 (Emerald Green)
Driver:         #3B82F6 (Blue)
Current:        #FB923C (Orange - pulsing)
Completed:      #10B981 (Dark Green - faded)
Skipped:        #EF4444 (Red - faded)

Map Elements:
Polyline:       #2563EB (Primary Blue)
Background:     #FFFFFF (White)
Border:         #E5E7EB (Light Gray)
Text Primary:   #111827 (Dark Gray)
Text Secondary: #6B7280 (Medium Gray)
Text Muted:     #9CA3AF (Light Gray)

Buttons:
Success:        #10B981 (Green)
Secondary:      #6B7280 (Gray)
Danger:         #EF4444 (Red)
```

---

## 🔄 Animation Sequences

### Animation 1: Stop Marker Pulse (Current Stop)

```
Frame 1 (0ms):    Scale 1.0, Opacity 1.0
Frame 2 (250ms):  Scale 1.2, Opacity 1.0
Frame 3 (500ms):  Scale 1.0, Opacity 1.0
(Repeat every 800ms)

Effect: Gentle pulse to draw attention
```

### Animation 2: Driver Marker Movement

```
Current Position: [40.7128, -74.0060]
New Position:     [40.7135, -74.0055]

Duration: 500ms (smooth transition)
Easing: Ease-in-out

Path: Shortest line between points
```

### Animation 3: Stop Completion

```
Frame 1: Marker color = #FCD34D (yellow)
Frame 2 (100ms): Marker scale 1.1
Frame 3 (200ms): Marker color → #10B981 (green)
Frame 4 (300ms): Marker scale → 0.9
Frame 5 (400ms): Marker opacity → 0.6

Effect: Brief celebration + fade
```

### Animation 4: Route Progress

```
Polyline Progress Bar:
────────────────────────────
Empty: ░░░░░░░░░░░░░░░░░░░░░░
50%:   ████████████░░░░░░░░░░
100%:  ████████████████████████

Updates: Recalculated every 10 seconds
as driver moves
```

---

## 📐 Layout Dimensions

### Mobile Screen (375px width)

```
Full Height: 812px (iPhone)

RouteHeader:
- Height: 60px
- Padding: 12px horizontal, 8px vertical
- Font sizes: Title 18px, Subtitle 12px

Map Canvas:
- Height: 55% of screen (~447px)
- Zoom level: 14 (default)
- Gesture enabled: Pan, Zoom, Rotate

StopDetailsSheet:
- Height: 45% of screen (~365px)
- Padding: 16px
- Border radius: 16px top
- Shadow: elevation 5

Stop Marker:
- Radius: 14px base, 20px when pulsing
- Label font: 12px bold
- Tap target: 44px (accessibility)

Next Stop Items:
- Height: 56px each
- Margin between: 6px
- Max visible: 3 items (scrollable)
```

---

## 🎯 User Interactions

### Interaction 1: View Stop Details

```
User Action: Tap on marker on map
  ↓
Highlight marker (pulse animation)
  ↓
Scroll bottom sheet to show stop details
  ↓
Display address, customer, actions
```

### Interaction 2: Mark Stop Complete

```
User Action: Tap "Mark as Complete" button
  ↓
Show confirmation dialog (optional)
  ↓
Send PATCH /orders/{id}/stop-event
  ↓
Update marker color to green
  ↓
Reduce opacity (fade out)
  ↓
Auto-scroll to next stop
  ↓
Update bottom sheet to show new current stop
```

### Interaction 3: Skip Stop

```
User Action: Tap "Skip" button
  ↓
Marker color: Yellow → Red (warning)
  ↓
Move stop to "Skipped" list
  ↓
Update next stops list
  ↓
Recalculate route distance/time
```

### Interaction 4: Pan/Zoom Map

```
User Action: Swipe to pan map
  ↓
Update visible area
  ↓
Keep driver marker centered (optional auto-follow)

User Action: Pinch to zoom
  ↓
Zoom in/out (min level 12, max level 18)
  ↓
Redraw markers at new scale
```

---

## 📱 Responsive Design

### Landscape Mode (750px width)

```
┌──────────────────────────────────────┐
│ Route Header (Fixed Top)             │
├──────┬──────────────────────────────┤
│      │                              │
│      │        MAP (60% width)       │
│Stop  │                              │
│Deta- │                              │
│ils   │                              │
│(40%  │                              │
│width)│                              │
│      │                              │
└──────┴──────────────────────────────┘

Changes:
- Details sheet moves to left side
- Map takes 60% of width
- Scroll details vertically
- Improved for landscape drivers
```

### Tablet Mode (1024px width)

```
┌─────────────────────────────────────────────┐
│ Route Header with stats                     │
├──────────────────┬────────────────────────┤
│                  │                        │
│  MAP (50%)       │  Details Sheet (50%)   │
│                  │  - Current Stop        │
│  A•B•C•D•E       │  - Next 5 Stops       │
│                  │  - Stats               │
│  Polyline        │  - Actions             │
│                  │                        │
└──────────────────┴────────────────────────┘

Changes:
- Side-by-side layout
- Both map and details visible
- More info visible at once
- Better for iPad use
```

---

## 🔔 Status Indicators

### Badge Styles

```
┌──────────────────────────────────┐
│ Status Badges                    │
├──────────────────────────────────┤
│                                  │
│ Pending:     🟡 Yellow circle   │
│              No text             │
│                                  │
│ In Progress: 🟠 Orange pulsing  │
│              "Current"           │
│                                  │
│ Completed:   ✅ Green checkmark │
│              Faded opacity       │
│                                  │
│ Skipped:     ⚠️ Red X mark      │
│              Crossed out         │
│                                  │
└──────────────────────────────────┘
```

---

## 🎬 Screen Flow Sequence

```
1. Driver Opens App
   ↓
2. Route Screen Appears
   - Shows header with stats
   - Map loads with all 5 stops (A-E)
   - Polyline connects all stops
   - Bottom sheet shows Stop A (current)
   ↓
3. Driver Taps "Mark as Complete"
   - Stop A marker fades to green
   - Animation plays briefly
   - Sheet scrolls to Stop B (new current)
   ↓
4. Driver Drives to Stop B
   - Blue marker animates as GPS updates
   - Stop B marker pulses (approaching)
   - ETAs recalculate in real-time
   ↓
5. Driver Arrives at Stop B
   - Stop B marker highlights (orange)
   - Notification plays (optional)
   - User taps "Mark as Complete" again
   ↓
6. Process Repeats for C, D, E
   ↓
7. All Stops Complete
   - All markers green with checkmarks
   - Congratulations message
   - Show earnings/performance stats
   - Option to view deliveries made
```

---

## ♿ Accessibility

### Touch Targets

```
Minimum tap target: 44x44px

Markers: 44x44px hit area
Buttons: 48x48px hit area
Labels: 16pt minimum font size

Focus indicators: Clear 2px border
Color blind friendly: Use icons + text
Screen reader labels: All interactive elements named
```

### Dark Mode Support

```
Light Mode:
- Background: White (#FFFFFF)
- Text: Dark Gray (#111827)
- Accent: Blue (#2563EB)

Dark Mode:
- Background: Dark Gray (#1F2937)
- Text: White (#F9FAFB)
- Accent: Light Blue (#60A5FA)

All colors tested for WCAG AA contrast
```

---

## 📊 Performance Targets

```
Map Load: < 2 seconds
Marker Render: < 500ms
Polyline Draw: < 300ms
Scroll Smooth: 60fps
Animation: 60fps

Memory: < 50MB for 10 stops
Battery: < 5% impact per hour
Network: Works offline (cached)
```

---

**Version**: 1.0
**Last Updated**: 2024
**Status**: Design Complete - Ready for Development
