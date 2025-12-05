# TSB Order History - Mobile Quick Reference Guide

## Overview

The **TSB Order History** feature provides a comprehensive view of all closed table service business (TSB) orders with powerful filtering, search, and payment management capabilities. It mirrors the web dashboard's table order history functionality but is optimized for mobile use.

## Features

### 1. **Order Viewing**

- 📘 View all closed table orders
- 🍽️ Filter by table number
- 👤 Search by customer name
- 📋 View order details including items, quantities, and prices

### 2. **Date Range Filtering**

- **Custom date selection**: Use date pickers to select from and to dates
- **Quick filters**: One-tap access to common date ranges:
  - **Today**: View only today's orders
  - **7 days**: Last 7 days of orders
  - **30 days**: Last 30 days of orders

### 3. **Payment Method Filtering**

- Filter orders by payment method (Cash, Credit Card, etc.)
- View payment breakdown for each order
- See payment method change history with timestamps

### 4. **Advanced Filtering**

- **Search**: Real-time search by:
  - Table number
  - Customer name
  - Order ID
- **Status filtering**: Toggle to show cancelled orders only
- **Grouping**: Orders automatically grouped by date for easy scanning

### 5. **Payment Method Management**

- 📝 Edit payment methods for closed orders
- 🔄 Track payment method changes with before/after labels
- Support for multiple payment methods per order
- Payment amounts clearly displayed

### 6. **Order Details**

Each order card displays:

- 🍽️ Table number
- #️⃣ Order ID
- 👤 Customer name (if available)
- ✅ Order status (Closed, Cancelled)
- 💰 Total amount
- 📊 Item breakdown with quantities and prices
- 💳 Payment method(s) and amount(s)
- ⏰ Timestamp of order creation

## How to Access

### From Dashboard Quick Tabs

1. Open the app and go to the Dashboard
2. Look for the **"TSB History"** tab (📘 icon, purple background)
3. Tap on it to open the Order History screen

### From Orders Menu

1. Navigate to the **Orders** section
2. Look for **TSB History** option (if available in your navigation)

## How to Use

### Basic Viewing

1. **View All Orders**: Open TSB History to see all closed orders from today
2. **Date Range**: Use the date picker buttons to select custom date ranges
3. **Quick Date Filters**: Tap "Today", "7 days", or "30 days" for quick filtering

### Searching Orders

1. **Search by Table**: Enter table number in the search box (e.g., "5" for Table 5)
2. **Search by Customer**: Enter customer name in the search box
3. **Search by Order ID**: Enter order ID number
4. **Clear Search**: Tap the clear (X) button or delete the search text

### Payment Method Filtering

1. **Select Payment Method**: Tap the "Payment:" button and choose from available methods
2. **View All**: Tap "All" to reset filter and see all payment methods
3. **Available Methods**: Cash, Credit Card, Debit Card, Online Transfer, etc. (based on your settings)

### Cancellation Filtering

1. **Show Cancellations Only**: Tap the "Show Cancellations" button
2. **Toggle Back**: Tap again to show all orders including cancelled ones
3. **Status Indicator**: Look for red "Cancelled" status badges for cancelled orders

### Editing Payment Methods

1. **Find Order**: Locate the order you want to edit
2. **Tap Edit Payment**: Press the "Edit Payment" button (✏️ icon)
3. **Select New Method**: Choose payment method from the dropdown list
4. **Confirm**: Tap "Save" to apply the change
5. **History Tracking**: The previous payment method will be shown with a transition indicator (🔄)

## Screen Layout

```
┌─────────────────────────────────────┐
│  ← 📘 Table History                 │
│        {count} orders               │
├─────────────────────────────────────┤
│  🔍 [Search by table/customer/ID] │
├─────────────────────────────────────┤
│  [✓ Cancelled] | [Payment: All...]  │
├─────────────────────────────────────┤
│  From: [2024-12-01] | To: [2024-12-01]
├─────────────────────────────────────┤
│  [Today] [7 days] [30 days]         │
├─────────────────────────────────────┤
│                                     │
│  📅 Monday, December 1, 2024       │
│  ┌───────────────────────────────┐  │
│  │ 🍽️ Table 5               ✅    │  │
│  │ Order #123 • John Doe    ₺450  │  │
│  │                                │  │
│  │ Pasta ×1 - ₺180               │  │
│  │ Salad ×2 - ₺150               │  │
│  │ Drink ×1 - ₺50                │  │
│  │                                │  │
│  │ 💳 Cash ₺450                   │  │
│  │ ⏰ 14:30                [Edit Payment]│
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🍽️ Table 3               ✅    │  │
│  │ Order #122                ₺320  │  │
│  │ ...                            │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

## Tips & Tricks

### 💡 Pro Tips

1. **Fast Navigation**: Use Quick Date filters for common date ranges
2. **Bulk View**: 7-day view gives you a week's worth of orders at a glance
3. **Payment Tracking**: Use payment filter to reconcile specific payment methods
4. **Search as You Type**: Search updates in real-time as you type
5. **Date Range**: Combine custom date range with payment method filter for detailed reconciliation

### ⚠️ Important Notes

1. **Closed Orders Only**: TSB History shows only closed/completed table orders
2. **Read-Only**: Most fields are read-only; only payment methods can be edited
3. **Dark Mode**: Fully supported with automatic theme detection
4. **Offline**: Requires internet connection to load and edit orders
5. **Permissions**: Must have appropriate permissions to edit payment methods

## Troubleshooting

### Orders Not Showing

- ✅ Check date range is correct
- ✅ Verify you selected "All" payment method filter
- ✅ Clear search box if filter applied
- ✅ Pull down to refresh data

### Payment Edit Not Working

- ✅ Check order status is "Closed" (not "Draft")
- ✅ Verify you have edit permissions
- ✅ Ensure internet connection is active
- ✅ Try closing and reopening the screen

### Search Not Finding Orders

- ✅ Check spelling of table number or customer name
- ✅ Try partial match (e.g., "joh" for "John")
- ✅ Clear search and try again
- ✅ Check date range includes target order

## Related Features

- **Order Details**: Tap any order to view full details (if available)
- **Orders Screen**: Access all active orders from Orders tab
- **Reports**: Generate comprehensive sales reports including historical data
- **Settings**: Configure payment methods under Settings → Payment Methods

## Keyboard Shortcuts (Mobile)

- **Search Field**: Start typing to filter orders
- **Back Button**: Return to previous screen
- **Refresh**: Pull down to refresh order data (if available)

## FAQ

**Q: Why can't I edit a cancelled order?**
A: Cancelled orders are typically locked. You can still view them but cannot modify payment information.

**Q: How long is order history stored?**
A: Orders are stored indefinitely. You can view orders from any date in the past using custom date range selection.

**Q: Can I export order history?**
A: Currently, you can view and filter orders. For exports, use the Reports feature on the web dashboard.

**Q: What if I accidentally change a payment method?**
A: The change is saved immediately. Contact your manager or check the payment history log to see who made the change and when.

**Q: Are payments synced with the web dashboard?**
A: Yes! Any changes made in the mobile app are immediately reflected in the web dashboard and vice versa.

## Support

For issues or questions:

1. Check this guide first
2. Review the Troubleshooting section
3. Contact your system administrator
4. Submit a bug report through the app settings

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Compatibility**: iOS/Android with React Native Expo
