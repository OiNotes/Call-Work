# Memory Leak Prevention Report: Settings Modals
**Date:** 2025-11-06
**Project:** Status Stock 4.0
**Component:** webapp/src/components/Settings/*.jsx

## Overview
Comprehensive audit of 9 Settings modal components for memory leak vulnerabilities during unmount.

### Component Status Summary
| Component | Risk Level | Status | Protection Method |
|-----------|-----------|--------|------------------|
| ProductsModal | HIGH | VULNERABLE | AI chat needs AbortController |
| FollowsModal | HIGH | VULNERABLE | Search needs abort signal |
| WalletsModal | HIGH | VULNERABLE | syncWalletState unprotected |
| OrdersModal | MEDIUM | ✓ PROTECTED | AbortController + abort checks |
| WorkspaceModal | MEDIUM | VULNERABLE | Missing AbortController |
| SubscriptionModal | HIGH | VULNERABLE | Promise.all race condition |
| AnalyticsModal | HIGH | VULNERABLE | setAnalytics not protected |
| MigrationModal | MEDIUM | VULNERABLE | Countdown interval leak |
| LanguageModal | LOW | ✓ PROTECTED | Synchronous-only (safe) |

---

## Detailed Analysis: Protected vs Vulnerable

### ✓ CORRECTLY PROTECTED COMPONENTS

#### OrdersModal.jsx (2025-11-06)
```javascript
✓ Pattern: AbortController + Signal Check

useEffect(() => {
  if (!isOpen) return;

  setLoading(true);
  const controller = new AbortController();

  loadOrders(controller.signal)
    .then(result => {
      // ✓ Check abort BEFORE all setState
      if (!controller.signal.aborted && result?.status === 'error') {
        console.error('[OrdersModal] Failed to load orders');
      }
    })
    .finally(() => {
      // ✓ Check abort in finally block
      if (!controller.signal.aborted) {
        setLoading(false);  // Safe
      }
    });

  // ✓ Cleanup: abort pending requests
  return () => controller.abort();
}, [isOpen, loadOrders]);
```

**Protection Score:** 9/10
- Proper signal passing
- Abort checks before all setState
- Cleanup on unmount

#### LanguageModal.jsx (2025-11-06)
```javascript
✓ Pattern: Synchronous-only (inherently safe)

export default function LanguageModal({ isOpen, onClose }) {
  const handleSelectLanguage = async (languageId) => {
    triggerHaptic('light');
    
    if (languageId === lang) {
      onClose();
      return;
    }

    // Single await, immediate onClose
    await setLanguage(languageId);
    onClose();  // No dangling setState
  };
}
```

**Protection Score:** 10/10
- No async state updates
- Immediate completion or close
- No memory leak vectors

---

### ✗ VULNERABLE COMPONENTS (Need Fixes)

#### ProductsModal.jsx (CRITICAL)
```javascript
✗ Issue: AI chat requests not protected

const handleSendAIMessage = async (text) => {
  const value = text.trim();
  if (!value) return;

  const optimisticHistory = [...aiHistory, { role: 'user', content: value }];
  setAiHistory(optimisticHistory);
  setAiLoading(true);  // ← Will setState even if unmounted
  setAiError(null);

  try {
    const response = await fetchApi('/ai/products/chat', {
      method: 'POST',
      body: JSON.stringify({
        shopId: myShop?.id,
        message: value,
        history: historyPayload
      })
      // ✗ NO SIGNAL HERE - request can't be cancelled!
    });

    if (response?.data) {
      const { reply, history: serverHistory, productsChanged } = response.data;
      if (Array.isArray(serverHistory) && serverHistory.length) {
        setAiHistory(serverHistory);  // ✗ Can fire after unmount
      } else if (reply) {
        setAiHistory((current) => [...current, ...]);  // ✗ Unsafe
      }

      if (productsChanged) {
        await loadData();  // ✗ Another async operation!
      }
    } else {
      throw new Error('Пустой ответ AI-сервиса');
    }
  } catch (error) {
    setAiError(error.message);  // ✗ Fires after unmount
    setAiHistory((current) => [
      ...current,
      { role: 'assistant', content: 'Failed...' }  // ✗ Unsafe
    ]);
  } finally {
    setAiLoading(false);  // ✗ Always fires, even if unmounted
  }
};
```

**Protection Score:** 2/10
- No AbortController
- No mounted checks
- Multiple unprotected setState calls
- Nested async (loadData inside try block)

**Recommended Fix:**
```javascript
// Add ref for AI abort control
const aiControllerRef = useRef(null);

const handleSendAIMessage = async (text) => {
  // Cancel previous request
  if (aiControllerRef.current) {
    aiControllerRef.current.abort();
  }

  aiControllerRef.current = new AbortController();
  const signal = aiControllerRef.current.signal;

  const value = text.trim();
  if (!value) return;

  const optimisticHistory = [...aiHistory, { role: 'user', content: value }];
  setAiHistory(optimisticHistory);
  setAiLoading(true);
  setAiError(null);

  try {
    const response = await fetchApi('/ai/products/chat', {
      method: 'POST',
      body: JSON.stringify({
        shopId: myShop?.id,
        message: value,
        history: optimisticHistory.map(({ role, content }) => ({ role, content }))
      }),
      signal  // ✓ Pass signal
    });

    // ✓ Check abort BEFORE state updates
    if (signal.aborted) return;

    if (response?.data) {
      const { reply, history: serverHistory, productsChanged } = response.data;
      if (Array.isArray(serverHistory) && serverHistory.length) {
        setAiHistory(serverHistory);
      } else if (reply) {
        setAiHistory((current) => [...current, { role: 'assistant', content: reply }]);
      }

      if (productsChanged) {
        // ✓ Add signal to nested loadData too!
        await loadData(signal);
      }
    } else {
      throw new Error('Пустой ответ AI-сервиса');
    }
  } catch (error) {
    // ✓ Check abort before error handling
    if (signal.aborted) return;

    const errorMessage = error.message || 'Не удалось обработать запрос.';
    setAiError(errorMessage);
    setAiHistory((current) => [
      ...current,
      { role: 'assistant', content: 'Не получилось обработать команду. Попробуйте еще раз.' }
    ]);
  } finally {
    // ✓ Check abort before cleanup
    if (signal.aborted) return;
    setAiLoading(false);
  }
};

// ✓ Cleanup: abort on unmount
useEffect(() => {
  return () => {
    if (aiControllerRef.current) {
      aiControllerRef.current.abort();
    }
  };
}, []);
```

#### FollowsModal.jsx (HIGH)
**Issue:** Search requests not protected
```javascript
✗ Problem at Line 289-299:

const handleSearchShop = async () => {
  if (!searchQuery.trim()) {
    await alert('Введите название магазина или @username');
    return;
  }

  setSearching(true);  // ✗ No protection
  try {
    const res = await fetchApi(`/shops/search?q=${encodeURIComponent(searchQuery.trim())}`);
    // ✗ No signal, no abort possible
    setSearchResults(res.data || []);  // ✗ Can fire after unmount
    if (res.data.length === 0) {
      await alert('Магазины не найдены');
    }
  } catch (error) {
    await alert(error.message || 'Ошибка поиска');
  } finally {
    setSearching(false);  // ✗ Can fire after unmount
  }
};
```

**Fix Pattern:** Add AbortController
```javascript
const searchControllerRef = useRef(null);

const handleSearchShop = async () => {
  // Cancel previous search
  if (searchControllerRef.current) {
    searchControllerRef.current.abort();
  }

  if (!searchQuery.trim()) {
    await alert('Введите название магазина или @username');
    return;
  }

  searchControllerRef.current = new AbortController();
  const signal = searchControllerRef.current.signal;

  setSearching(true);
  try {
    const res = await fetchApi(
      `/shops/search?q=${encodeURIComponent(searchQuery.trim())}`,
      { signal }  // ✓ Pass signal
    );

    if (signal.aborted) return;  // ✓ Check abort

    setSearchResults(res.data || []);
    if (res.data.length === 0) {
      await alert('Магазины не найдены');
    }
  } catch (error) {
    if (signal.aborted) return;  // ✓ Check abort
    await alert(error.message || 'Ошибка поиска');
  } finally {
    if (signal.aborted) return;  // ✓ Check abort
    setSearching(false);
  }
};

// ✓ Cleanup
useEffect(() => {
  return () => {
    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
  };
}, []);
```

#### WalletsModal.jsx (HIGH)
**Issue:** syncWalletState not protected
```javascript
✗ Problem at Line 223-240:

const syncWalletState = useCallback((payload) => {
  if (!payload) {
    setWalletMap({ btc: null, eth: null, usdt: null, ltc: null });  // ✗ Unsafe
    setWalletMeta({ updatedAt: null });  // ✗ Unsafe
    return;
  }

  const data = payload.data || payload;
  setWalletMap({  // ✗ Multiple setState calls
    btc: data.wallet_btc ?? data.wallets?.btc ?? null,
    eth: data.wallet_eth ?? data.wallets?.eth ?? null,
    usdt: data.wallet_usdt ?? data.wallets?.usdt ?? null,
    ltc: data.wallet_ltc ?? data.wallets?.ltc ?? null
  });
  setWalletMeta({
    updatedAt: data.updated_at || data.updatedAt || null
  });
}, []);
```

**Issue:** Called from multiple places, including error handlers without signal checks
```javascript
// Line 290-295
.catch(error => {
  if (!controller.signal.aborted) {
    console.error('Failed to load wallets', error);
    setErrorMessage(t('wallet.loadError'));
    syncWalletState(null);  // ✗ Called without signal check!
  }
})
```

**Fix:** Add isMountedRef check to syncWalletState
```javascript
const isMountedRef = useRef(true);

useEffect(() => {
  return () => { isMountedRef.current = false; };
}, []);

const syncWalletState = useCallback((payload) => {
  if (!isMountedRef.current) return;  // ✓ Guard clause

  if (!payload) {
    setWalletMap({ btc: null, eth: null, usdt: null, ltc: null });
    setWalletMeta({ updatedAt: null });
    return;
  }

  const data = payload.data || payload;
  setWalletMap({
    btc: data.wallet_btc ?? data.wallets?.btc ?? null,
    eth: data.wallet_eth ?? data.wallets?.eth ?? null,
    usdt: data.wallet_usdt ?? data.wallets?.usdt ?? null,
    ltc: data.wallet_ltc ?? data.wallets?.ltc ?? null
  });
  setWalletMeta({
    updatedAt: data.updated_at || data.updatedAt || null
  });
}, []);
```

---

## Implementation Checklist

### Phase 1: Critical Fixes (Do Now)
- [ ] ProductsModal - Add aiControllerRef + abort checks
- [ ] FollowsModal - Add searchControllerRef + abort checks
- [ ] AnalyticsModal - Add abort check before setAnalytics

### Phase 2: High Priority (Do Next)
- [ ] WalletsModal - Add isMountedRef to syncWalletState
- [ ] WorkspaceModal - Add AbortController to loadData
- [ ] SubscriptionModal - Improve Promise.all error handling

### Phase 3: Medium Priority (Do After)
- [ ] MigrationModal - Add cleanup to countdown interval

### Verification (After Each Fix)
- [ ] No console warnings about unmounted components
- [ ] Memory usage stable in DevTools
- [ ] Rapid modal toggle doesn't leak memory

---

## Testing Memory Leaks

### Browser DevTools Method
```
1. Open Developer Tools → Memory
2. Take heap snapshot (baseline)
3. Open modal
4. Trigger async operation
5. Close modal mid-operation (critical!)
6. Wait 2 seconds
7. Force garbage collection (trash icon)
8. Take another heap snapshot
9. Compare - detached DOM nodes should be ~0
```

### Console Warning Detection
```javascript
// Bad sign - appears in console:
"Can't perform a React state update on an unmounted component"

// After fix - no warnings
```

### Performance Check
```javascript
// In React DevTools Profiler:
1. Component mounted
2. Generate 10 rapid open/close cycles
3. Check for memory growth in heap
4. Expected: Flat line (no growth)
5. If climbing: Memory leak exists
```

---

## Summary

**Total Components Audited:** 9
**Safe Components:** 2 (22%)
- OrdersModal ✓
- LanguageModal ✓

**Vulnerable Components:** 7 (78%)
- HIGH RISK (3): ProductsModal, FollowsModal, WalletsModal, SubscriptionModal, AnalyticsModal
- MEDIUM RISK (4): WorkspaceModal, MigrationModal

**Estimated Fix Time:** 2-3 hours
**Complexity:** Low-Medium (consistent pattern)
**Impact:** HIGH (app stability, mobile performance)

---

## Key Takeaway

**Pattern:** Most modals already use `AbortController` correctly for main data loading, but secondary operations (AI chat, search, nested requests) are unprotected. The fix is to extend the same pattern to all async operations.

**Golden Rule:** If you `await` something, you MUST check `signal.aborted` before `setState`.
