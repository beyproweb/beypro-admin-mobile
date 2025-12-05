# TSB Order History - Implementation Details

## File Location

`/beypro-admin-mobile/app/orders/tsb-history.tsx`

## Component Overview

### Main Component

`TSBOrderHistoryScreen` - Full-featured order history screen for table service business orders

### Key Features Implemented

1. ✅ Date range filtering with date pickers
2. ✅ Payment method filtering and editing
3. ✅ Real-time search functionality
4. ✅ Order grouping by date
5. ✅ Payment method change tracking
6. ✅ Dark/light theme support
7. ✅ Mobile-optimized UI with Tailwind compatibility
8. ✅ Extras/add-ons calculation for accurate totals

## API Endpoints Used

### Read Operations

```typescript
// Load payment methods
GET /settings/payments

// Load closed/completed orders with date range
GET /reports/history?from={YYYY-MM-DD}&to={YYYY-MM-DD}

// Load items for an order
GET /orders/{orderId}/items

// Load payments for an order
GET /orders/{orderId}/payments
```

### Write Operations

```typescript
// Update payment method for an order
PUT / orders / { orderId };
Body: {
  payment_method: string; // e.g., "Cash", "Credit Card"
}
```

## Data Structures

### TSBOrder Type

```typescript
type TSBOrder = {
  id: number;
  table_number?: number | null; // Table number (TSB identifier)
  customer_name?: string | null; // Optional customer name
  total: number; // Order total amount
  status: string; // "closed", "cancelled", "confirmed"
  created_at: string; // ISO datetime string
  updated_at?: string; // ISO datetime string
  items?: OrderItem[]; // Line items
  payments?: PaymentRecord[]; // Payment records
  payment_method?: string | null; // Primary payment method
  receipt_id?: number; // Associated receipt ID
};
```

### OrderItem Type

```typescript
type OrderItem = {
  id: number;
  product_name: string;
  price: number; // Unit price
  quantity: number; // Quantity ordered
  paid_at?: string | null; // Payment timestamp
  paid?: boolean; // Payment status
  payment_method?: string | null; // Item-level payment method
  extras?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
};
```

### PaymentRecord Type

```typescript
type PaymentRecord = {
  id: number;
  payment_method: string; // "Cash", "Card", etc.
  amount: number; // Payment amount
  timestamp?: string; // Payment time
  created_at?: string; // Record creation time
  previous_payment_method?: string; // Old method (for tracking changes)
};
```

## Key Functions

### loadOrderHistory(from: string, to: string)

Fetches and enriches closed orders within date range

- Filters for table_number (TSB only)
- Enriches with items and payment records
- Extracts available payment methods
- Handles errors gracefully

### calculateGrandTotal(items: OrderItem[])

Calculates order total including extras

- Iterates through items
- Multiplies quantity × price
- Adds extras (including quantity multiplier)
- Returns accurate total

### handleUpdatePaymentMethod(orderId: number, paymentMethodId: string)

Updates payment method for an order

- Validates payment method selection
- Makes API request
- Updates local state immediately
- Shows success/error toast

### normalizePaymentMethods(raw: any)

Deduplicates and normalizes payment methods from API

- Handles various response formats
- Filters enabled methods only
- Removes duplicates (case-insensitive)
- Returns standardized PaymentMethodItem[]

## State Management

### Core State

```typescript
const [loading, setLoading] = useState(true);
const [orders, setOrders] = useState<TSBOrder[]>([]);
const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
```

### Filter State

```typescript
const [fromDate, setFromDate] = useState(formatDateToString(today));
const [toDate, setToDate] = useState(formatDateToString(today));
const [searchQuery, setSearchQuery] = useState("");
const [paymentFilter, setPaymentFilter] = useState("All");
const [showCancellationsOnly, setShowCancellationsOnly] = useState(false);
```

### UI State

```typescript
const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
const [showFromDatePicker, setShowFromDatePicker] = useState(false);
const [showToDatePicker, setShowToDatePicker] = useState(false);
```

## Filtering Logic

### filteredOrders (useMemo)

Multi-stage filtering applied in order:

1. **Cancellation Filter**: If enabled, show only cancelled orders
2. **Payment Filter**: If not "All", filter by payment method
3. **Search Filter**: Search across table_number, customer_name, order_id

### groupedOrders (useMemo)

Groups filtered orders by date:

- Key: ISO date string (YYYY-MM-DD)
- Value: Array of orders for that date
- Sorted by creation date (newest first within groups)

## Styling

### Theme Support

- Light mode: Default white backgrounds, dark text
- Dark mode: Dark backgrounds (#020617, #0B1020), light text
- All styles have `...Dark` variants

### Component Hierarchy

```
Container (ScrollView)
├── Header
│   ├── Back Button
│   ├── Title & Subtitle
├── Search Bar
├── Filter Buttons
│   ├── Cancellation Toggle
│   ├── Payment Filter Chips
├── Date Range Selectors
├── Quick Date Buttons
├── Order List (ScrollView)
│   ├── Date Group
│   │   ├── Order Card
│   │   │   ├── Header (table, order ID, status, total)
│   │   │   ├── Items List
│   │   │   ├── Payments
│   │   │   └── Footer (time, edit button)
└── Modal: Edit Payment Method
    ├── Header
    ├── Payment Method Dropdown
    └── Action Buttons
```

## Performance Optimizations

1. **useMemo for Filters**: Prevents unnecessary re-renders
2. **Lazy Loading**: Items fetched with Promise.all
3. **Pagination**: Orders grouped by date for faster rendering
4. **Debounced Search**: Search updates trigger filtering
5. **Cached Payment Methods**: Fetched once on mount

## Error Handling

1. **API Failures**: Gracefully fall back to empty state
2. **Payment Method Loading**: Defaults to standard methods if fetch fails
3. **Missing Data**: Maps handle undefined/null safely
4. **Date Picker Errors**: Cancellation resets without effect
5. **Network Issues**: Toast notifications inform user

## Browser/Device Compatibility

- ✅ iOS (10.0+)
- ✅ Android (5.0+)
- ✅ Tablet optimized
- ✅ Dark mode support
- ✅ RTL language support (if needed)

## Dependencies

```json
{
  "react-native": "latest",
  "@react-native-community/datetimepicker": "latest",
  "expo-router": "latest",
  "react-i18next": "latest"
}
```

## Integration Points

### Navigation

- Route: `/orders/tsb-history`
- Added to DASHBOARD_TABS in `/app/index.tsx`
- Accessible via Quick Tab: "📘 TSB History"

### Contexts Used

- `useAppearance`: For dark mode support
- `useCurrency`: For currency formatting

### API Client

- Uses `api` from `../../src/api/axiosClient`
- Handles authentication automatically

## Testing Checklist

- [ ] Load orders for today
- [ ] Load orders for custom date range
- [ ] Search by table number
- [ ] Search by customer name
- [ ] Search by order ID
- [ ] Filter by payment method
- [ ] Toggle cancellation filter
- [ ] Quick date filters (Today, 7 days, 30 days)
- [ ] Edit payment method
- [ ] Verify payment change tracked
- [ ] Dark mode toggle
- [ ] Error handling (network down)
- [ ] Empty state (no results)
- [ ] Multiple items with extras calculation

## Known Limitations

1. **No bulk editing**: Payment methods edited one at a time
2. **No export**: Use Reports feature for data export
3. **No printing**: Use web version for receipt printing
4. **Fixed date format**: Uses locale-specific date strings
5. **No real-time sync**: Requires manual refresh for new orders

## Future Enhancements

1. Real-time order updates via WebSocket
2. Bulk payment method editing
3. Export to CSV/PDF
4. Order receipt printing
5. Refund processing UI
6. Advanced analytics/charts
7. Custom report generation

## Maintenance Notes

- Keep API endpoints in sync with backend
- Monitor performance on large date ranges (1000+ orders)
- Review dark mode colors periodically
- Test with various language settings
- Verify payment method sync with settings

---

**Created**: December 2024  
**Last Modified**: December 2024  
**Component Version**: 1.0
