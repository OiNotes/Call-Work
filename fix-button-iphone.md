# Fix "Я оплатил" Button Hidden Under TabBar on iPhone

## PROBLEM DESCRIPTION

**Current Issue:**
- The "Я оплатил" (I paid) button in PaymentDetailsModal is **hidden under TabBar on iPhone**
- TabBar renders **on top** of the modal despite z-index fixes
- Button is too low and not visible/clickable on mobile devices

**Expected Behavior:**
- Button should be **fully visible above TabBar**
- Button should have enough spacing from bottom edge on iPhone
- User should be able to click the button without TabBar blocking it

---

## CURRENT CODE

### 1. PaymentDetailsModal.jsx - Modal Structure

**File:** `webapp/src/components/Payment/PaymentDetailsModal.jsx`

**Backdrop z-index (line 325):**
```jsx
<motion.div
  className="fixed inset-0 z-[1000]"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: android ? 0.24 : 0.2 }}
  onClick={handleClose}
  style={overlayStyle}
/>
```

**Modal z-index (line 335):**
```jsx
<motion.div
  className="fixed inset-x-0 bottom-0 z-[1001] flex flex-col"
  style={{ maxHeight: getSheetMaxHeight(platform, ios ? -24 : 32) }}
  initial={{ y: '100%', opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: '100%', opacity: 0 }}
  transition={sheetSpring}
>
  <div
    className="rounded-t-[32px] flex flex-col"
    style={sheetStyle}
  >
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b border-white/10">
      {/* ... header content ... */}
    </div>

    {/* Content - Scrollable */}
    <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: 'calc(var(--tabbar-total) + 32px)' }}>
      {/* QR code, wallet address, amount ... */}
    </div>

    {/* Footer with Button - THIS IS THE PROBLEM */}
    <div 
      className="p-4 border-t border-white/10"
      style={{ paddingBottom: ios ? 'calc(var(--tabbar-total) + 32px)' : 'calc(var(--tabbar-total) + 24px)' }}
    >
      <motion.button
        onClick={handlePaid}
        className="w-full h-12 text-white font-bold rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #FF6B00 0%, #FF8F3D 100%)',
          boxShadow: android
            ? '0 4px 16px rgba(255, 107, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
            : `
                0 4px 12px rgba(255, 107, 0, 0.3),
                0 8px 24px rgba(255, 107, 0, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.2)
              `,
          letterSpacing: '-0.01em'
        }}
        whileTap={{ scale: android ? 0.985 : 0.98 }}
        transition={controlSpring}
      >
        {t('payment.iPaid')}
      </motion.button>
    </div>
  </div>
</motion.div>
```

---

### 2. TabBar.jsx - TabBar Component

**File:** `webapp/src/components/Layout/TabBar.jsx`

**TabBar structure (no z-index in JSX):**
```jsx
const TabBar = memo(function TabBar() {
  // ... component logic ...

  return (
    <div className="tabbar">
      <div className="rounded-t-3xl" style={{ ...containerStyle, paddingBottom: 'var(--safe-bottom)' }}>
        <div className="flex items-center justify-around px-4 py-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className="relative px-2"
              >
                {/* ... tab button content ... */}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
```

---

### 3. globals.css - TabBar CSS Styles

**File:** `webapp/src/styles/globals.css`

**CSS Variables (lines 8-25):**
```css
:root {
  --tg-viewport-height: 100vh;
  --tg-viewport-stable-height: 100vh;
  --tg-safe-area-inset-top: 0px;
  --tg-safe-area-inset-bottom: 0px;
  --tg-safe-area-inset-left: 0px;
  --tg-safe-area-inset-right: 0px;

  /* TabBar & Keyboard management */
  --safe-bottom: max(
    var(--tg-content-safe-area-inset-bottom, 0px),
    var(--tg-safe-area-inset-bottom, 0px),
    env(safe-area-inset-bottom, 0px)
  );
  --tabbar-height: 80px;
  --tabbar-total: calc(var(--tabbar-height) + var(--safe-bottom));
  --tabbar-h: 60px;
  --vh-dynamic: 100dvh;
}
```

**TabBar positioning (lines 281-287):**
```css
/* TabBar positioning - fixed at bottom */
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;  /* ← THIS IS THE PROBLEM! */
}

html.platform-android .tabbar {
  backdrop-filter: none;
}
```

---

### 4. App.jsx - Root Component

**File:** `webapp/src/App.jsx`

**Root container (lines 80-90):**
```jsx
#root {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;

  /* Safe area для iOS (notch/home indicator) через Telegram CSS переменные */
  padding-top: var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px));
  padding-bottom: var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  padding-left: var(--tg-safe-area-inset-left, env(safe-area-inset-left, 0px));
  padding-right: var(--tg-safe-area-inset-right, env(safe-area-inset-right, 0px));
}
```

---

## WHAT WE TRIED (DIDN'T WORK)

### Attempt #1: Increase modal z-index
```jsx
// Changed from z-[60] to z-[1000] and z-[1001]
className="fixed inset-0 z-[1000]"  // backdrop
className="fixed inset-x-0 bottom-0 z-[1001] flex flex-col"  // modal
```
**Result:** ❌ Still doesn't work - TabBar still on top on iPhone

### Attempt #2: Increase padding
```jsx
// Footer padding
style={{ paddingBottom: ios ? 'calc(var(--tabbar-total) + 32px)' : 'calc(var(--tabbar-total) + 24px)' }}
```
**Result:** ❌ Button is still hidden under TabBar

---

## COMPARISON: Working Modal (PaymentHashModal)

**PaymentHashModal works correctly!** Here's its code:

**File:** `webapp/src/components/Payment/PaymentHashModal.jsx`

**Modal z-index (line 217):**
```jsx
<motion.div
  className="fixed inset-0 z-50"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: android ? 0.24 : 0.2 }}
  onClick={handleClose}
  style={overlayStyle}
/>

{/* Modal */}
<motion.div
  className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
  style={{ maxHeight: getSheetMaxHeight(platform, ios ? -20 : 32) }}
  initial={{ y: '100%', scale: 0.95 }}
  animate={{ y: 0, scale: 1 }}
  exit={{ y: '100%', scale: 0.95 }}
  transition={sheetSpring}
>
```

**Footer (line 296):**
```jsx
<div className="p-4 border-t border-white/10" style={{ paddingBottom: 'calc(var(--tabbar-total) + 16px)' }}>
  <motion.button
    onClick={handleSubmit}
    disabled={!isValidTxHash}
    className="w-full h-12 text-white font-bold rounded-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
    {/* ... button styles ... */}
  >
    {t('payment.confirmPayment')}
  </motion.button>
</div>
```

**Note:** PaymentHashModal uses `z-50` (lower than TabBar's 999) but somehow works! Why?

---

## TECHNICAL DETAILS

**Telegram Mini App Environment:**
- Running inside Telegram WebApp iframe
- iOS safe area insets matter
- TabBar is `position: fixed` with `z-index: 999`
- Modal is `position: fixed` with `z-[1001]` (should be higher!)

**CSS Variables Used:**
- `--tabbar-total` = `calc(var(--tabbar-height) + var(--safe-bottom))`
- `--tabbar-height` = `80px`
- `--safe-bottom` = `max(tg-content-safe-area-inset-bottom, tg-safe-area-inset-bottom, env(safe-area-inset-bottom))`

**Platform Detection:**
- `const ios = isIOS(platform)` - used for conditional padding
- `const android = isAndroid(platform)` - used for animations

---

## QUESTIONS FOR GROK 4

1. **Why does `z-[1001]` modal render UNDER `z-index: 999` TabBar on iPhone?**
   - Is there a CSS stacking context issue?
   - Does Telegram WebApp iframe affect z-index behavior?

2. **Why does PaymentHashModal work with `z-50` (lower than TabBar)?**
   - What's different in its implementation?

3. **How to fix the button visibility on iPhone?**
   - Should we hide TabBar when modal is open?
   - Should we use a different positioning approach?
   - Should we use `transform: translateY()` instead of padding?

4. **Is `paddingBottom: calc(var(--tabbar-total) + 32px)` correct for iPhone?**
   - Should we use `env(safe-area-inset-bottom)` directly?
   - Should we add more spacing?

---

## DESIRED SOLUTION

We need the "Я оплатил" button to be:
1. **Fully visible** on iPhone screen
2. **Above TabBar** (not hidden behind it)
3. **Clickable** without TabBar interference
4. **Properly spaced** from bottom edge (accounting for iPhone safe area)

**Preferred approach:** Fix z-index stacking OR hide TabBar when PaymentDetailsModal is open

---

## FILES TO REVIEW

1. `webapp/src/components/Payment/PaymentDetailsModal.jsx` - main modal
2. `webapp/src/components/Layout/TabBar.jsx` - TabBar component
3. `webapp/src/styles/globals.css` - TabBar CSS with z-index: 999
4. `webapp/src/components/Payment/PaymentHashModal.jsx` - working modal example

---

**Environment:** Telegram Mini App (React + Vite + TailwindCSS + Framer Motion)
**Platform:** iPhone (iOS)
**Issue:** z-index stacking context problem in Telegram WebApp iframe
