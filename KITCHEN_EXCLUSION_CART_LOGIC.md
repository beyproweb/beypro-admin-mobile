# Kitchen Exclusion Logic for Cart Closing

## Overview

Implemented logic to prevent cart closing based on kitchen item exclusion settings. The system now distinguishes between items that require kitchen delivery and items that bypass the kitchen entirely.

## Logic Flow

### How It Works

```
CART CLOSE ATTEMPT
    ↓
Fetch excluded items from /kitchen/compile-settings
    ↓
Fetch order items
    ↓
SPLIT items into two groups:
├─ Items that require kitchen (NOT in excludedItems)
└─ Items that bypass kitchen (IN excludedItems)
    ↓
Check readiness:
├─ Kitchen-required items: Must be "delivered" or "ready"
└─ Excluded items: Automatically considered ready (skip check)
    ↓
Decision:
├─ IF no kitchen-required items exist → ALLOW CLOSE
├─ IF all kitchen-required items are ready → ALLOW CLOSE
└─ IF any kitchen-required items NOT ready → BLOCK CLOSE (409 error)
```

## Implementation Details

### 1. Fetch Excluded Items

```typescript
let excludedItems: number[] = [];
try {
  const settingsRes = await api.get("/kitchen/compile-settings");
  excludedItems = settingsRes.data?.excludedItems || [];
  console.log("🍽️ [Close Table] Excluded items from kitchen:", excludedItems);
} catch (err) {
  console.log(
    "⚠️ [Close Table] Failed to fetch kitchen settings, proceeding without exclusions:",
    err
  );
  excludedItems = [];
}
```

### 2. Separate Items

```typescript
const kitchenRequiredItems = items.filter(
  (i) => !excludedItems.includes(i.product_id)
);
const kitchenExcludedItems = items.filter((i) =>
  excludedItems.includes(i.product_id)
);
```

### 3. Check Kitchen-Required Items Only

```typescript
if (kitchenRequiredItems.length === 0) {
  // No items require kitchen - ready to close
  kitchenDelivered = true;
} else {
  // Check if ALL kitchen-required items are 'delivered' or 'ready'
  const allKitchenItemsReady = kitchenRequiredItems.every((i) => {
    const s = (i?.kitchen_status || "").toString().toLowerCase();
    return s === "delivered" || s === "ready";
  });

  if (allKitchenItemsReady) {
    kitchenDelivered = true;
  }
}
```

## Test Scenarios

### Scenario A: All Items Require Kitchen

- Order items: Pizza, Burger, Salad
- Excluded items: (empty)
- **Behavior**: Cannot close until kitchen delivers all items
- **Result**: ✅ Correct - waits for kitchen

### Scenario B: All Items Bypass Kitchen

- Order items: Gift Card, Soft Drink (excluded), Dessert (excluded)
- Excluded items: [Gift Card ID, Soft Drink ID, Dessert ID]
- **Behavior**: Can close immediately
- **Result**: ✅ Correct - no kitchen check

### Scenario C: Mixed Items

- Order items: Pizza (require), Salad (require), Soft Drink (excluded), Gift Card (excluded)
- Excluded items: [Soft Drink ID, Gift Card ID]
- **Behavior**:
  - Pizza and Salad must be "delivered" or "ready"
  - Soft Drink and Gift Card are ignored
  - Can only close when Pizza + Salad are ready
- **Result**: ✅ Correct - partial kitchen check

## Console Logging

The implementation includes detailed logging for debugging:

```
🍽️ [Close Table] Excluded items from kitchen: [5, 10, 15]
🔍 [Close Table] Items requiring kitchen: 2, Items bypassing kitchen: 2
   📦 Kitchen Required: "Pizza" (ID: 1)
   📦 Kitchen Required: "Burger" (ID: 2)
   ⏭️  Kitchen Excluded: "Soft Drink" (ID: 5)
   ⏭️  Kitchen Excluded: "Gift Card" (ID: 10)
✅ [Close Table] All kitchen-required items ready? true (2 kitchen items)
```

## File Modified

- `/Users/nurikord/PycharmProjects/beypro-admin-mobile/app/orders/table/[tableNumber].tsx`
  - Updated `closeTable()` function

## API Endpoints Used

- `GET /kitchen/compile-settings` - Fetch excluded items
- `GET /orders/{id}/items` - Fetch order items with kitchen status
- `POST /orders/{id}/close` - Close the order

## Edge Cases Handled

✅ **Kitchen settings fetch fails**: Proceeds without exclusions (all items require kitchen)
✅ **No kitchen-required items**: Allows immediate close
✅ **Item fetch fails**: Falls back to order-level kitchen_delivered_at flag
✅ **Empty order**: Considers ready (no items to deliver)
✅ **Missing product_id**: Treats as requiring kitchen (safe default)

## Backward Compatibility

✅ Fully backward compatible - existing orders without excluded items work as before
✅ If `/kitchen/compile-settings` fails, reverts to original all-items-require-kitchen logic
✅ No changes to API contracts or backend

## Future Enhancements

- Add toast/alert notification when close is blocked due to pending kitchen items
- Show user which specific items are waiting for kitchen
- Add estimated time until kitchen delivery
