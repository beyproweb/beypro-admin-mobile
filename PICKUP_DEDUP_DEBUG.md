# Pickup Deduplication - Debug Guide

## Current Status: Debug Mode Enabled

The code has been updated with **extensive logging** to help identify the issue.

---

## What to Do Now

### 1. Clear App Cache

```bash
# Stop the app
# Then run:
cd /Users/nurikord/PycharmProjects/beypro-admin-mobile
npx expo start -c  # -c flag clears cache
```

### 2. Open the App and Trigger Multi-Stop Route

- Navigate to a driver with 3+ orders from same restaurant
- Open the multi-stop map modal

### 3. Check React Native Debugger Console

You'll see detailed logs like:

```
🔍 DEBUG: Number of orders: 3

🔍 DEBUG Order 1001:
  pos_location: "Acme Pizza"
  pos_location_lat: 38.420
  pos_location_lng: 27.140
  parsed_lat: 38.42
  parsed_lng: 27.14
  hasValidPickupCoords: true
  restaurant_id: 1

✅ Added pickup to map: key="38.42,27.14", address="Acme Pizza"

🔍 DEBUG Order 1002:
  pos_location: "Acme Pizza"
  pos_location_lat: 38.420
  pos_location_lng: 27.140
  hasValidPickupCoords: true
  restaurant_id: 1

⏭️  Skipped duplicate pickup: key="38.42,27.14"

...

📊 Pickup dedup result: 1 unique pickups from 3 orders

✅ Added single pickup: Acme Pizza

✅ Added delivery: Order 1001 - 123 Main St
✅ Added delivery: Order 1002 - 456 Oak Ave
✅ Added delivery: Order 1003 - 789 Pine Ln

✅ Built route with 4 stops:
  0: [PICKUP] Acme Pizza (stopNumber=0)
  1: [DELIVERY] 123 Main St (stopNumber=1)
  2: [DELIVERY] 456 Oak Ave (stopNumber=2)
  3: [DELIVERY] 789 Pine Ln (stopNumber=3)

📊 Summary: Pickup count=1, Delivery count=3
```

---

## What the Logs Tell Us

### Good Signs ✅

- "✅ Added pickup to map" → Pickup data found
- "⏭️ Skipped duplicate pickup" → Deduplication working
- "📊 Pickup dedup result: 1 unique pickups" → Only 1 pickup created
- "✅ Built route with 4 stops" → Total = 1 pickup + 3 deliveries

### Bad Signs ❌

- "⚠️ NO PICKUPS FOUND - pickupMap is empty" → Backend NOT returning pickup data
- "⚠️ Order {id} missing pickup fields" → Missing pos_location fields
- "📊 Pickup dedup result: 0 unique pickups" → No pickups at all
- "✅ Built route with 3 stops" → Only deliveries, no pickup

---

## If You See Bad Signs

### Problem 1: Backend Not Returning Pickup Fields

**Symptom**: "No pickups found" message

**Solution**: The backend endpoint `/drivers/{id}/active-orders` may not be returning `pos_location`, `pos_location_lat`, `pos_location_lng` fields.

**Check**:

1. Open backend logs
2. Call the endpoint directly:
   ```
   GET /drivers/123/active-orders
   ```
3. Look for fields in response:
   - `pos_location` (string) - Restaurant name/address
   - `pos_location_lat` (number) - Restaurant latitude
   - `pos_location_lng` (number) - Restaurant longitude

**Fix**: Contact backend team to ensure these fields are included in the response

---

### Problem 2: Data Type Mismatch

**Symptom**: "hasValidPickupCoords: false" even though data looks correct

**Solution**: Coordinates might be strings instead of numbers

**Check Console Log**:

```
parsed_lat: "38.420"   // STRING - BAD
parsed_lat: 38.42      // NUMBER - GOOD
```

**Fix**: Backend should return coordinates as numbers, not strings

---

## Share Console Output

Once you see the logs, **copy and paste them here** so I can see:

1. How many orders are being fetched
2. What pickup fields each order has
3. Whether deduplication is working
4. How many stops are being created
5. The final stop list

---

## Expected vs Actual

### Expected (What Should Happen)

```
3 orders from "Acme Pizza":
  Order 1001 → Customer 1 (38.424, 27.143)
  Order 1002 → Customer 2 (38.425, 27.144)
  Order 1003 → Customer 3 (38.426, 27.145)

Deduplication:
  ✅ Pickup: Acme Pizza (38.420, 27.140) → Add once
  ✅ Pickup: Acme Pizza (38.420, 27.140) → Skip (duplicate)
  ✅ Pickup: Acme Pizza (38.420, 27.140) → Skip (duplicate)

Final Stops:
  A) Pickup - Acme Pizza
  B) Delivery - Customer 1
  C) Delivery - Customer 2
  D) Delivery - Customer 3

Footer: 4 items (A, B, C, D)
Map: 4 markers (A, B, C, D)
```

### Actual (What You're Seeing)

```
4 stops shown
Only 3 items in footer
Pickup showing for each delivery
```

This means:

- Either pickups ARE being added (you see 4 stops)
- But footer only shows 3 (missing 1)
- Pickup showing for EACH delivery = each order creating a pickup?

---

## Next Steps

1. **Clear cache and restart app**:

   ```bash
   npx expo start -c
   ```

2. **Trigger multi-stop route** by navigating to driver with 3 orders

3. **Copy console logs** and share them with me

4. **Describe what you see**:
   - How many items in footer?
   - What letters are shown (A, B, C, D)?
   - Are there duplicates?
   - What does each say (Pickup vs Delivery)?

---

## Contact

If logs show issues, attach:

- Console output (full logs)
- Screenshot of footer
- Screenshot of map
- Number of orders in route

This will help identify the exact problem!
