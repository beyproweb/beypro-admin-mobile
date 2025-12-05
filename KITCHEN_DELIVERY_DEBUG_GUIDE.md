# Kitchen Delivery Block - Debug Logging Guide

## Console Log Output Examples

### ✅ Scenario 1: Close Blocked (Kitchen Items Not Ready)

```
🚪 [Close Table] Starting close process...
🍽️ [Close Table] Excluded items from kitchen: [2, 5]
📋 [Close Table] Fresh order: {
  id: 123,
  status: "open",
  kitchen_delivered_at: null,
  is_paid: false
}
🔍 [Close Table] Order-level kitchen_delivered_at set? false
🍽️ [Close Table] Order items: [
  { product_id: 1, kitchen_status: "preparing", name: "Burger", isExcluded: false },
  { product_id: 2, kitchen_status: "new", name: "Fries", isExcluded: true },
  { product_id: 3, kitchen_status: "ready", name: "Drink", isExcluded: false }
]
🔍 [Close Table] Items requiring kitchen: 2, Items bypassing kitchen: 1
   📦 Kitchen Required: "Burger" (ID: 1)
   📦 Kitchen Required: "Drink" (ID: 3)
   ⏭️  Kitchen Excluded: "Fries" (ID: 2)
   - Kitchen Item: "Burger" status="preparing" → normalized="preparing" → ready=false
   ✅ [Close Table] All kitchen-required items ready? false (2 kitchen items)
   ❌ [Close Table] Some kitchen-required items not ready - cannot close
🚪 [Close Table] Final kitchen delivered status before checking: false
❌ [Close Table] Cannot close - kitchen items not yet delivered
```

**Result:** ❌ Alert shown, close blocked

---

### ✅ Scenario 2: Close Allowed (All Kitchen Items Ready)

```
🚪 [Close Table] Starting close process...
🍽️ [Close Table] Excluded items from kitchen: [2, 5]
📋 [Close Table] Fresh order: {
  id: 123,
  status: "open",
  kitchen_delivered_at: null,
  is_paid: false
}
🔍 [Close Table] Order-level kitchen_delivered_at set? false
🍽️ [Close Table] Order items: [
  { product_id: 1, kitchen_status: "delivered", name: "Burger", isExcluded: false },
  { product_id: 2, kitchen_status: "new", name: "Fries", isExcluded: true },
  { product_id: 3, kitchen_status: "ready", name: "Drink", isExcluded: false }
]
🔍 [Close Table] Items requiring kitchen: 2, Items bypassing kitchen: 1
   📦 Kitchen Required: "Burger" (ID: 1)
   📦 Kitchen Required: "Drink" (ID: 3)
   ⏭️  Kitchen Excluded: "Fries" (ID: 2)
   - Kitchen Item: "Burger" status="delivered" → normalized="delivered" → ready=true
   - Kitchen Item: "Drink" status="ready" → normalized="ready" → ready=true
   ✅ [Close Table] All kitchen-required items ready? true (2 kitchen items)
   ✅ [Close Table] Setting kitchenDelivered=true - all kitchen-required items are ready
🚪 [Close Table] Final kitchen delivered status before checking: true
✅ [Close Table] Close successful!
```

**Result:** ✅ Table closed, redirected to tables screen

---

### ✅ Scenario 3: All Items Excluded (Immediate Close)

```
🚪 [Close Table] Starting close process...
🍽️ [Close Table] Excluded items from kitchen: [1, 2, 3]
📋 [Close Table] Fresh order: {
  id: 123,
  status: "open",
  kitchen_delivered_at: null,
  is_paid: false
}
🔍 [Close Table] Order-level kitchen_delivered_at set? false
🍽️ [Close Table] Order items: [
  { product_id: 1, kitchen_status: "new", name: "Pre-made item", isExcluded: true },
  { product_id: 2, kitchen_status: "new", name: "Beverage", isExcluded: true },
  { product_id: 3, kitchen_status: "new", name: "Dessert", isExcluded: true }
]
🔍 [Close Table] Items requiring kitchen: 0, Items bypassing kitchen: 3
   ⏭️  Kitchen Excluded: "Pre-made item" (ID: 1)
   ⏭️  Kitchen Excluded: "Beverage" (ID: 2)
   ⏭️  Kitchen Excluded: "Dessert" (ID: 3)
✅ [Close Table] No items require kitchen - all items are excluded, ready to close
🚪 [Close Table] Final kitchen delivered status before checking: true
✅ [Close Table] Close successful!
```

**Result:** ✅ Table closed immediately (no kitchen wait needed)

---

## What to Look For When Debugging

### ✅ Good Signs:

- `🍽️ Excluded items from kitchen: [...]` - Settings fetched correctly
- `📦 Kitchen Required:` entries - Identifies kitchen items
- `⏭️ Kitchen Excluded:` entries - Identifies bypassed items
- `❌ Cannot close - kitchen items not yet delivered` - Block working
- `✅ Close successful!` - Close proceeded when it should

### ❌ Bad Signs (Indicates Bugs):

- `🍽️ Excluded items from kitchen: []` - Empty list might be wrong config
- No kitchen-required items but close was blocked - Logic bug
- Logs show "not ready" but close still happened - Block not working
- `await api.post(...)` called when `kitchenDelivered === false` - GUARD CLAUSE MISSING

## Key Log Patterns

### Pattern 1: Block in Action

```
❌ Some kitchen-required items not ready - cannot close
❌ Cannot close - kitchen items not yet delivered
→ Alert shown, function returns early
→ NO API call made ✅
```

### Pattern 2: Close Proceeding

```
✅ All kitchen-required items ready? true
✅ Setting kitchenDelivered=true
✅ Close successful!
→ API call made
→ Table closes ✅
```

### Pattern 3: Settings Fetch Error (Graceful Fallback)

```
⚠️ Failed to fetch kitchen settings, proceeding without exclusions
🍽️ Excluded items from kitchen: []
→ All items treated as kitchen-required
→ Normal kitchen delivery check applies
```

## How to Enable Debug Mode

1. Open console/terminal of your mobile device
2. Look for logs starting with:

   - `🚪 [Close Table]` - Main flow
   - `🍽️ [Close Table]` - Item/setting info
   - `❌ [Close Table]` - Errors
   - `✅ [Close Table]` - Success

3. Cross-reference with the patterns above

## Timestamps and Performance

The entire kitchen check should complete in < 500ms:

- Fetch settings: ~50ms
- Fetch order items: ~50ms
- Processing: ~10ms
- User sees alert or close proceeds: ~400ms total
