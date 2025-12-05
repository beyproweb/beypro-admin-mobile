# NativeWind Styling Configuration Flow

## 🎨 How Styles Are Applied

```
┌─────────────────────────────────────────────────────────┐
│         Your React Component with className              │
│  <View className="flex-1 bg-gray-50 rounded-2xl" />     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Babel Plugin (nativewind/babel)                  │
│  Transforms className → React Native StyleSheet        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Tailwind Config Lookups                          │
│  - bg-gray-50 → { backgroundColor: "#f9fafb" }          │
│  - flex-1 → { flex: 1 }                                  │
│  - rounded-2xl → { borderRadius: 16 }                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         React Native Styles Applied                      │
│  { flex: 1, backgroundColor: "#f9fafb", ... }           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Visual Result in App                             │
│  Styled component renders to mobile screen               │
└─────────────────────────────────────────────────────────┘
```

## 📁 Configuration Files

### 1. **app/\_layout.tsx** (Root Provider)

```typescript
import { useColorScheme } from "nativewind";

export default function RootLayout() {
  useColorScheme(); // ← Enables NativeWind system-wide
}
```

### 2. **tailwind.config.js** (Utility Definitions)

```javascript
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}", // ← Scans these files
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: { primary: "#4f46e5" },
    },
  },
};
```

### 3. **babel.config.js** (Build Transform)

```javascript
module.exports = function (api) {
  return {
    presets: ["babel-preset-expo"],
    plugins: ["nativewind/babel"], // ← Transforms className
  };
};
```

### 4. **nativewind.config.js** (NativeWind Config)

```javascript
module.exports = {
  input: "./tailwind.config.js",
};
```

## 🧪 Verification Checklist

- [x] `app/_layout.tsx` has `useColorScheme()` hook
- [x] `tailwind.config.js` exists with content paths
- [x] `babel.config.js` includes `nativewind/babel` plugin
- [x] `nativewind.config.js` points to tailwind config
- [x] `package.json` has `tailwindcss` in devDependencies
- [x] Expo server restarted with `--clear` flag
- [x] No TypeScript errors related to className
- [x] Stock page components use className attributes

## 🎯 Key Takeaways

**Why This Works:**

1. **Babel Plugin** intercepts `className` during build time
2. **Tailwind Config** provides the class→style mappings
3. **useColorScheme** enables proper theme handling
4. **Metro Bundler** (Expo) applies the transformations

**Why It Didn't Work Before:**

- Missing Babel plugin meant `className` was treated as regular props
- NativeWind needs to transform these at compile time, not runtime
- Without the plugin, the className prop was just silently ignored

## 📱 Test the Styling

1. Open Expo app → press `r` to reload
2. Navigate to `/stock` page
3. Look for:
   - ✅ Purple-blue gradient hero section
   - ✅ White background with 4 KPI cards
   - ✅ Properly spaced and styled elements
   - ✅ Rounded corners and shadows
   - ✅ Color-coded status badges

## 🚀 Performance Note

- Babel transformation happens at **build time** (fast)
- No runtime overhead for className processing
- Styles are statically compiled into bundle
- Same performance as traditional React Native StyleSheet

---

**Status**: All configurations applied and Expo server running!
Styles should now display properly on all pages using NativeWind classes.
