# Token Key Fix - 401 Unauthorized Resolution

## Problem

API requests returned `401 Unauthorized: token missing` even after successful login.

## Root Cause

Token storage key was inconsistent:

- **AuthContext** stored token under key: `"token"`
- **secureFetch** (before fix) tried to retrieve from AsyncStorage with key: `"authToken"` first
- On web, only AsyncStorage exists → looked for non-existent `"authToken"` → no token found → 401 error

## Solution Applied

Updated `src/api/secureFetch.ts` to use the storage wrapper with the correct key `"token"`:

```typescript
// Before:
let token = await AsyncStorage.getItem("authToken");
if (!token) {
  try {
    token = (await SecureStore.getItemAsync("token")) || null;
  } catch {
    token = null;
  }
}

// After:
const token = await getItem("token"); // Uses storage wrapper
```

## Verification

All API layers now consistently use `"token"` key:

- ✅ `src/api/secureFetch.ts:28` → `getItem("token")`
- ✅ `src/utils/secureFetch.ts:8` → `getItem("token")`
- ✅ `src/api/axiosClient.ts:19` → `getItem("token")`
- ✅ `src/context/AuthContext.tsx:36,51,59` → `setItem/getItem/deleteItem("token")`

## How It Works Now

1. **Login** → AuthContext stores token under `"token"` via storage wrapper
2. **Storage Wrapper** → On native: SecureStore | On web: AsyncStorage
3. **API Call** → secureFetch retrieves token under `"token"` from storage wrapper
4. **Authorization** → Token sent as `Authorization: Bearer <token>` header

## Result

- Token is now correctly retrieved on both web and native platforms
- 401 Unauthorized errors should be resolved
- API requests now include valid authentication
