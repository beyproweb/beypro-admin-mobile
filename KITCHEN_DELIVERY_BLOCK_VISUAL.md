# Kitchen Delivery Block - Visual Flow Diagram

## Decision Tree for Cart Closing

```
┌─────────────────────────────────────────────────────────────┐
│ User Clicks "Close Table" Button                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Fetch Kitchen Settings               │
        │ GET /kitchen/compile-settings        │
        │ → excludedItems: [2, 5, 7]          │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Fetch Order Items                    │
        │ GET /orders/{id}/items               │
        │ → [{id:1, status:"new"},             │
        │     {id:2, status:"ready"},          │
        │     {id:3, status:"preparing"}]      │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Separate Items                       │
        │                                      │
        │ Kitchen Required:                    │
        │  - Item 1 (new) ❌                   │
        │  - Item 3 (preparing) ❌             │
        │                                      │
        │ Kitchen Excluded:                    │
        │  - Item 2 (excluded from kitchen)    │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ Check Kitchen Items Status          │
        │                                      │
        │ Are ALL kitchen-required items      │
        │ "delivered" or "ready"?             │
        └──────┬──────────────────────┬────────┘
               │ NO                   │ YES
               │                      │
        ┌──────▼──────┐        ┌──────▼──────────┐
        │ kitchenDelivered     │ kitchenDelivered
        │ = FALSE              │ = TRUE
        │ ❌                   │ ✅
        └──────┬──────┘        └──────┬──────────┘
               │                      │
               ▼                      ▼
        ┌──────────────┐     ┌─────────────────┐
        │ BLOCK CLOSE  │     │ ALLOW CLOSE     │
        │              │     │                 │
        │ Show Alert:  │     │ Call API:       │
        │ "Order Still │     │ POST /orders/   │
        │  Preparing"  │     │   {id}/close    │
        │              │     │                 │
        │ User must    │     │ Close Table ✅  │
        │ wait for     │     │ Redirect to     │
        │ kitchen ⏳   │     │ tables screen   │
        └──────────────┘     └─────────────────┘
```

## Item Classification Logic

```
Order Items
    │
    ├─ Item 1 (Product ID: 1)
    │   ├─ In excludedItems? NO
    │   └─ → KITCHEN REQUIRED ✅
    │       └─ Status check: must be "delivered" or "ready"
    │
    ├─ Item 2 (Product ID: 2)
    │   ├─ In excludedItems? YES
    │   └─ → KITCHEN EXCLUDED (bypasses kitchen)
    │       └─ Status check: SKIPPED ⏭️
    │
    └─ Item 3 (Product ID: 7)
        ├─ In excludedItems? YES
        └─ → KITCHEN EXCLUDED (bypasses kitchen)
            └─ Status check: SKIPPED ⏭️
```

## Example Scenarios

### Scenario 1: All Items in Kitchen ✅ Require Delivery

```
excludedItems = []
Order Items = [
  { id: 1, status: "preparing" },
  { id: 2, status: "new" },
  { id: 3, status: "ready" }
]

Kitchen Required: 3 items
Kitchen Excluded: 0 items
Check: Are all 3 ready? NO (some are "preparing"/"new")

Result: ❌ CLOSE BLOCKED
Alert: "Order Still Preparing - Please wait"
```

### Scenario 2: All Items Excluded from Kitchen

```
excludedItems = [1, 2, 3]
Order Items = [
  { id: 1, status: "new" },
  { id: 2, status: "preparing" },
  { id: 3, status: "new" }
]

Kitchen Required: 0 items (all excluded!)
Kitchen Excluded: 3 items

Result: ✅ CLOSE ALLOWED
Reason: No items require kitchen delivery
```

### Scenario 3: Mixed Items (Some in Kitchen, Some Excluded)

```
excludedItems = [2, 5]
Order Items = [
  { id: 1, status: "ready" },
  { id: 2, status: "preparing" },  ← Excluded (bypasses kitchen)
  { id: 3, status: "ready" },
  { id: 5, status: "new" }          ← Excluded (bypasses kitchen)
]

Kitchen Required: [Item 1, Item 3]
Kitchen Excluded: [Item 2, Item 5]
Check: Are items 1 and 3 ready? YES

Result: ✅ CLOSE ALLOWED
Reason: All kitchen-required items delivered (excluded items ignored)
```

## Key Fix: Guard Clause

```typescript
// THIS IS THE FIX
if (!kitchenDelivered) {
  // EARLY RETURN - prevents API call
  return;
}

// Only reaches here if kitchenDelivered === true
await api.post(`/orders/${activeOrder.id}/close`);
```

Without this guard clause, the code would call the API regardless of `kitchenDelivered` value, causing tables to close prematurely! ❌
