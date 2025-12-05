# App Performance Optimization - Test Checklist

## Testing Before & After

### 1. Screen Load Times

```
Tables Screen:
  Before: _____ ms
  After:  _____ ms

Kitchen Screen:
  Before: _____ ms
  After:  _____ ms

Reports Screen:
  Before: _____ ms
  After:  _____ ms
```

### 2. API Call Count (Monitor Network Tab)

```
Over 1 minute on Tables screen:
  Before: _____ requests
  After:  _____ requests

Memory freed by caching: _____ MB
```

### 3. Render Performance

```
Using React DevTools Profiler:

Tables screen filter change:
  Before render time: _____ ms
  After render time:  _____ ms

Tables screen scroll:
  Before FPS: _____
  After FPS:  _____
```

### 4. Memory Usage

```
Tables screen (30 items):
  Before: _____ MB
  After:  _____ MB

With console logs disabled:
  Reduction: _____ %
```

### 5. Battery Impact

```
Run app for 5 minutes on Tables screen:
  Before battery drain: _____ %
  After battery drain:  _____ %
```

## Console Log Check

- [ ] `app/orders/tables.tsx` - ✅ DONE
- [ ] `app/notifications/index.tsx` - Replace 22 logs
- [ ] `app/reports/index.tsx` - Replace 2 logs
- [ ] `app/orders/[id]/live-map.tsx` - Replace 9 logs
- [ ] `app/orders/[id]/live-map.native.tsx` - Replace 9 logs
- [ ] `app/orders/takeaway.tsx` - Replace 1 log
- [ ] `app/orders/kitchen.tsx` - Check for logs
- [ ] All other screens - Search for console.

## Testing Checklist

### Development Build

- [ ] No console errors
- [ ] Logger shows messages in console ✅
- [ ] Caching works (check Network tab for cache hits)
- [ ] Tables filter responsive
- [ ] Auto-refresh works smoothly

### Production Build

- [ ] App launches without errors
- [ ] Tables screen loads fast
- [ ] No console logs in production
- [ ] API calls reduced via caching
- [ ] Battery drain reduced

### Performance Measurements

- [ ] Use React DevTools Profiler
- [ ] Monitor Network tab for API calls
- [ ] Check Chrome DevTools Performance tab
- [ ] Measure memory with Inspector on device

## Deployment Checklist

Before going live:

- [ ] All console logs replaced with logger
- [ ] Logger utility tested in dev and prod
- [ ] Axios caching enabled
- [ ] Tables.tsx optimization verified
- [ ] Performance guide documented
- [ ] No build warnings
- [ ] Test on actual device (not simulator)
- [ ] Monitor error rates post-deployment

## Expected Results

✅ **Performance Improvements:**

- 50-70% fewer API calls (auto-refresh debouncing)
- 2-3x faster screen transitions
- 60% fewer unnecessary re-renders
- 5-15% faster on weak mobile connections
- Offline support with cache
- 0% console overhead in production

## Issues to Watch

⚠️ **Potential Issues:**

- Cache invalidation timing (currently 5 min)
- Stale data with cached responses
- Memory usage with large datasets
- Network latency on slow connections

## Rollback Plan

If performance issues occur:

1. Disable caching: Comment out cache interceptor in axiosClient.ts
2. Revert logger: Use console directly (temporary)
3. Disable debouncing: Change refresh interval back to 1000ms
4. Revert tables.tsx: Restore from git

---

**Last Updated:** 2025-12-01
**Status:** 🟢 Ready for testing
**Deployed:** ❌ Not yet (awaiting full logger implementation)
