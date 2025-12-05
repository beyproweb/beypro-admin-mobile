# Android Expo Go Debugging Guide

## Issue

App doesn't open when scanning QR code in Expo Go on Android device.

## Recent Fix Applied

✅ Updated `src/utils/storage.ts` to handle Android SecureStore initialization better

- Removed problematic pre-check of `SecureStore` functions at module load time
- Now checks function availability dynamically when actually needed
- Better error handling with console warnings instead of silent failures

## Debugging Steps

### 1. Check Terminal Output for Errors

**What to look for:**

- Red error messages in the dev server terminal
- Stack traces or module loading errors
- Network connection issues

### 2. Verify QR Code Format

The URL should look like: `exp://[YOUR_IP]:8081?platform=android`

**Where to find it:**

- Open dev server terminal
- Look for the tunnel/LAN URL
- Should have `?platform=android` query parameter (added automatically by secureFetch)

### 3. Test Different Connection Methods

Try these in order:

**Option A: Tunnel Mode (recommended for remote testing)**

```bash
cd /Users/nurikord/PycharmProjects/beypro-admin-mobile
npx expo start --tunnel
```

Then scan the QR code with Expo Go camera, or use Expo Go's "Enter URL" feature

**Option B: LAN Mode (for local testing)**

```bash
npx expo start --lan
```

**Option C: Local Mode (if on same computer)**

```bash
npx expo start --localhost
```

### 4. Manual URL Entry in Expo Go

Instead of scanning, you can manually enter the URL:

1. Open Expo Go app on Android
2. Press "Enter URL"
3. Paste: `exp://YOUR_TUNNEL_URL?platform=android`
4. Press "Open"

### 5. Check App Initialization

If the app starts but crashes immediately:

- The most likely culprit is `AuthContext` or storage initialization
- Look at terminal for stack trace
- The new storage wrapper should handle this better now

### 6. Clear Cache and Reinstall Expo Go

Sometimes helps if it's stuck:

```bash
# On Android via adb (if connected):
adb shell pm clear host.exp.exponent

# Or just reinstall Expo Go from Play Store
```

### 7. Check Device Network

Ensure your Android device is on **same WiFi** as your computer if using LAN mode:

```bash
# Get your computer's IP
ifconfig | grep "inet "
```

### 8. Look for These Common Error Messages

**"Cannot find module expo-secure-store"**
→ Not actually fixed if you see this; module loading issue

**"SecureStore.getItemAsync is not a function"**
→ Should be fixed now with the updated storage.ts

**"Network timeout"**
→ Device can't reach dev server; check WiFi

**"Invalid deeplink"**
→ Scheme mismatch; check app.json line 8 (`"scheme": "beyproadminmobile"`)

**"CommandError: Must specify \"expo-platform\" header or \"platform\" query parameter when connecting to Expo Go app on android"**
→ The dev server couldn't tell which platform is trying to connect. Make sure the Expo Go deeplink still contains `?platform=android` (the QR code printed by `expo start` includes it), and if you rely on a tunnel/proxy, verify that it forwards the `expo-platform: android` header or appends the query parameter. Restart the dev server in LAN or tunnel mode (`npx expo start --lan` / `npx expo start --tunnel`) so the URL is generated correctly, and double-check that your proxy/firewall isn’t stripping custom headers.

## Next Steps

1. **Run the dev server with better logging:**

   ```bash
   npx expo start --tunnel --verbose
   ```

2. **Observe the terminal** when you try to open the app - share any error messages

3. **Try manual URL entry** instead of QR code scanning

4. **Check if the app loads on web/iOS** (helps isolate Android-specific issue)

## Expected Behavior

1. QR scan → Expo Go recognizes the link
2. App loading screen appears
3. AuthContext loads, checks for stored token
4. If no token → redirects to `/login`
5. If token exists → loads dashboard and fetches data

If you see a white screen and nothing happens after 5 seconds, there's likely a crash in AuthContext/storage initialization.
