# 🚀 Stock Fetching from Backend - Setup Complete

## Overview

The Stock Management system is now fully configured to fetch data from the backend API.

## ✅ Configuration

### Backend API Endpoint

- **Base URL**: `https://hurrypos-backend.onrender.com/api` (or from environment variable)
- **Stock Endpoint**: `GET /api/stock`
- **Authentication**: Bearer token from SecureStore

### Environment Variables

The API URL is read from (in order of priority):

1. `Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL`
2. `process.env.EXPO_PUBLIC_API_URL`
3. Fallback: `https://hurrypos-backend.onrender.com/api`

### Authentication Flow

1. **Token Storage**: Token is stored in `expo-secure-store` after login
2. **Token Retrieval**: StockContext reads token from SecureStore on mount
3. **API Requests**: All requests include `Authorization: Bearer {token}` header

## 📁 Key Files

### StockContext (`src/context/StockContext.tsx`)

- **fetchStock()**: Fetches all stock items from `/stock` endpoint
- **handleDeleteStock()**: Deletes stock item via `DELETE /stock/:id`
- **handleCriticalChange()**: Updates critical quantity via `PATCH /stock/:id`
- **handleReorderChange()**: Updates reorder quantity via `PATCH /stock/:id`
- **handleAddToCart()**: Adds item to supplier cart

### StockPage (`app/stock/index.tsx`)

- Calls `fetchStock()` on mount via useEffect
- Displays loading state during fetch
- Shows error message if fetch fails
- Renders stock items after successful fetch

### Authentication (`src/context/AuthContext.tsx`)

- Stores token in SecureStore after login
- Loads token on app startup
- Provides useAuth hook with user and token data

## 🔄 Data Flow

```
1. User Logs In
   ↓
2. AuthContext stores token in SecureStore
   ↓
3. StockProvider loads token from SecureStore on mount
   ↓
4. Stock Page calls fetchStock()
   ↓
5. API Request: GET /stock
   Header: Authorization: Bearer {token}
   ↓
6. Backend returns stock array
   ↓
7. StockContext updates state
   ↓
8. Stock Page renders stock items
```

## 📊 API Response Format

Expected response from `/stock` endpoint:

```json
[
  {
    "id": "1",
    "stock_id": "stock_001",
    "name": "Product Name",
    "unit": "kg",
    "quantity": 100,
    "price_per_unit": 25.50,
    "supplier_name": "Supplier Co.",
    "critical_quantity": 10,
    "reorder_quantity": 50,
    "expiry_date": "2025-12-31"
  },
  ...
]
```

Or wrapped in object:

```json
{
  "data": [{ ... }]
}
```

## 🧪 Testing

### Check if Stock is Fetching

1. **Open Expo terminal** and look for logs:

   ```
   Fetching stock from: https://hurrypos-backend.onrender.com/api/stock
   Stock data received: [...]
   ```

2. **Check for errors**:

   - "Missing token or baseUrl" → Token not loaded
   - "Failed to fetch stock: 401" → Invalid or expired token
   - "Failed to fetch stock: 404" → Endpoint not found
   - Network errors → Backend is down

3. **Visual Verification**:
   - Navigate to Stock page
   - Check if loading spinner appears briefly
   - Check if stock items display
   - Verify KPI cards show correct totals

## 🐛 Troubleshooting

### Token Not Loading

- ✅ Check: Is user logged in?
- ✅ Check: Does backend return valid token?
- ✅ Check: Is SecureStore working?

**Solution**: Add console logs in StockProvider:

```typescript
useEffect(() => {
  (async () => {
    const storedToken = await SecureStore.getItemAsync("token");
    console.log("Token loaded:", !!storedToken);
    setToken(storedToken);
  })();
}, []);
```

### Stock Items Not Displaying

- ✅ Check: Is token valid?
- ✅ Check: Is API endpoint correct?
- ✅ Check: Does backend have stock data?

**Solution**: Check console logs for error messages

### Backend Timeout

- ✅ Render's free tier backend might be sleeping
- ✅ First request may take 30+ seconds
- ✅ Subsequent requests should be faster

**Solution**: Wait for backend to wake up or upgrade hosting

## 📈 Performance Notes

- **Token Loading**: Happens once on app startup
- **Stock Fetching**: Can be triggered manually via refresh
- **Caching**: No local caching (always fetches latest)
- **Concurrent Requests**: Token loading happens in parallel with app init

## 🔐 Security Checklist

- ✅ Token stored securely in expo-secure-store
- ✅ Token sent only to verified backend URL
- ✅ Bearer token authentication
- ✅ HTTPS for all API calls
- ✅ No sensitive data logged to console (in production)

## 📝 Next Steps

1. **Test with Real Backend**

   - Ensure backend is running
   - Verify `/stock` endpoint returns data
   - Check token is valid and not expired

2. **Add Pull-to-Refresh**

   - Already implemented in Stock Page
   - Pull down to manually refresh stock

3. **Add Real-time Updates**

   - Consider WebSocket or Socket.io
   - For live stock updates

4. **Add Offline Support**
   - Cache stock data locally
   - Show cached data when offline
   - Sync when connection restored

## 💡 Tips

- Check network tab in Expo DevTools to see API requests
- Use console logs to debug data flow
- Test with different network speeds
- Verify token expiry handling

---

**Status**: ✅ Stock fetching from backend is fully implemented and ready to use!
