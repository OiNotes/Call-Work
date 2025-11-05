# P1 BOT REMAINING FIXES

## Инструкции для завершения оставшихся 6 P1 issues

Эти исправления требуют ручных изменений в множестве файлов. Ниже приведены точные паттерны для поиска и замены.

---

## ✅ COMPLETED (9/15)

- P1-BOT-001: Token validation middleware → `bot/src/middleware/validateToken.js`
- P1-BOT-002: Retry logic → `bot/src/utils/api.js` (axios-retry)
- P1-BOT-003: Race condition fix → `bot/src/scenes/editFollowMarkup.js`
- P1-BOT-004: Circular dependency validation → `bot/src/utils/api.js` + `createFollow.js`
- P1-BOT-005: Username validation → `bot/src/scenes/manageWorkers.js`
- P1-BOT-006: Pagination debounce → ALREADY EXISTS (verified)
- P1-BOT-012: Analytics middleware → `bot/src/middleware/analytics.js` (registered)
- P1-BOT-014: Rate limiting → `bot/src/middleware/userRateLimit.js` (registered)
- P1-BOT-015: Health command → `bot/src/commands/health.js` (registered)

---

## 🔧 REMAINING (6/15)

### P1-BOT-007: User Message Cleanup in Scenes

**Files needing cleanup:**
- `bot/src/scenes/markOrdersShipped.js`
- `bot/src/scenes/manageWorkers.js`

**Already fixed:**
- `addProduct.js` ✅
- `createFollow.js` ✅
- `editFollowMarkup.js` ✅
- `chooseTier.js` ✅
- `createShop.js` ✅
- `searchShop.js` ✅
- `manageWallets.js` ✅
- `migrateChannel.js` ✅

**Pattern to apply:**

1. Track user messages in wizard state:
```javascript
// In step that receives text input
if (!ctx.wizard.state.userMessageIds) {
  ctx.wizard.state.userMessageIds = [];
}
ctx.wizard.state.userMessageIds.push(ctx.message.message_id);
```

2. Delete on scene leave:
```javascript
sceneInstance.leave(async (ctx) => {
  // Delete user messages
  const userMsgIds = ctx.wizard.state.userMessageIds || [];
  for (const msgId of userMsgIds) {
    try {
      await ctx.deleteMessage(msgId);
    } catch (error) {
      logger.debug(`Could not delete user message ${msgId}:`, error.message);
    }
  }

  ctx.wizard.state = {};
  logger.info(`User ${ctx.from?.id} left ${sceneName} scene`);
});
```

---

### P1-BOT-008: Session Cleanup on /cancel

**All scenes with cancel handlers need:**

```javascript
sceneInstance.action('cancel_scene', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    logger.info('scene_cancelled', { userId: ctx.from.id, scene: 'sceneName' });

    // P1-BOT-008: Clear scene-specific session data
    delete ctx.session.editingFollowId;
    delete ctx.session.pendingModeSwitch;
    delete ctx.session.editingMessageId;
    // Add any other scene-specific session keys

    await ctx.scene.leave();
    // Show menu or reply
  } catch (error) {
    logger.error('Error in cancel_scene handler:', error);
  }
});
```

**Scenes to update:**
- All 11 scenes (`createShop`, `addProduct`, `createFollow`, `editFollowMarkup`, etc.)

---

### P1-BOT-009: User-Friendly Errors

**Utility created:** `bot/src/utils/friendlyErrors.js`

**Usage pattern:**

```javascript
import { toFriendlyError } from '../../utils/friendlyErrors.js';

try {
  await someApiCall();
} catch (error) {
  logger.error('Error in handler:', error);
  const friendlyMessage = toFriendlyError(error);
  await ctx.reply(friendlyMessage);
}
```

**Files to update:**
- All handlers in `bot/src/handlers/` (20+ files)
- All scenes (11 files)

**Search for:** `catch (error)`
**Add:** `const friendlyMessage = toFriendlyError(error);`

---

### P1-BOT-010: Timeout for Long Operations

**Utility created:** `bot/src/utils/withTimeout.js`

**Usage pattern:**

```javascript
import { withTimeout } from '../../utils/withTimeout.js';

// Wrap long operations
await withTimeout(ctx, async () => {
  await productApi.bulkDeleteAll(shopId, token);
}, {
  timeout: 30000,
  message: '⏳ Удаление товаров...'
});
```

**Operations needing timeout:**
- Product sync (bulk operations)
- Payment verification (blockchain queries)
- Bulk order updates
- Channel migration

**Files:**
- `bot/src/handlers/seller/aiProducts.js` (bulk product sync)
- `bot/src/scenes/paySubscription.js` (payment verification)
- `bot/src/scenes/markOrdersShipped.js` (bulk order updates)

---

### P1-BOT-011: Missing answerCbQuery

**Search for:** `bot.action(`
**Check:** Every callback handler must call `ctx.answerCbQuery()`

**Pattern:**

```javascript
bot.action('some_action', async (ctx) => {
  // P1-BOT-011: MUST answer callback query
  await ctx.answerCbQuery(); // Add if missing

  // ... handler logic
});
```

**Files to audit:**
- `bot/src/handlers/seller/index.js`
- `bot/src/handlers/seller/follows.js`
- `bot/src/handlers/seller/orders.js`
- `bot/src/handlers/seller/aiProducts.js`
- `bot/src/handlers/buyer/index.js`
- `bot/src/handlers/workspace/index.js`
- `bot/src/handlers/common.js`

**Already fixed:**
- `createFollow.js` ✅
- `editFollowMarkup.js` ✅
- `manageWorkers.js` ✅

---

### P1-BOT-013: Scene Leave Missing

**Search for scenes WITHOUT explicit `scene.leave()` call:**

```javascript
// ❌ WRONG
return ctx.scene.leave();

// ✅ CORRECT
scene.leave(async (ctx) => {
  // Cleanup
  ctx.wizard.state = {};
  logger.info(`User ${ctx.from?.id} left scene`);
});
```

**Already have leave handlers:**
- `createFollow.js` ✅
- `editFollowMarkup.js` ✅
- `manageWorkers.js` ✅
- `chooseTier.js` ✅
- `createShop.js` ✅
- `addProduct.js` ✅

**Check:**
- `searchShop.js`
- `manageWallets.js`
- `migrateChannel.js`
- `paySubscription.js`
- `upgradeShop.js`
- `markOrdersShipped.js`

---

## Testing Checklist

После применения всех исправлений:

1. **Test token validation:**
   - Wait 7 days (or mock token expiry)
   - Verify auto-regeneration works

2. **Test retry logic:**
   - Stop backend
   - Trigger bot command
   - Verify 3 retries happen

3. **Test race condition fix:**
   - Click "Edit Markup" multiple times rapidly
   - Verify only one scene opens

4. **Test circular dependency:**
   - Try creating Shop A → follows Shop B → follows Shop A
   - Verify error shown

5. **Test username validation:**
   - Try adding worker with invalid username (e.g., `@a`, `@user-name`)
   - Verify error

6. **Test pagination debounce:**
   - Click pagination rapidly
   - Verify "Please wait" message

7. **Test user message cleanup:**
   - Complete scene with text inputs
   - Verify user messages deleted

8. **Test session cleanup on cancel:**
   - Enter scene, cancel
   - Check `ctx.session` for leftover data

9. **Test friendly errors:**
   - Stop backend → trigger command
   - Verify "Server temporarily unavailable" (not technical error)

10. **Test timeout:**
    - Mock slow blockchain API
    - Verify "Operation took too long" after 30s

11. **Test answerCbQuery:**
    - Click any inline button
    - Verify no infinite spinner

12. **Test scene.leave():**
    - Enter/leave all scenes
    - Check logs for "left scene" messages

13. **Test rate limiting:**
    - Send 11 commands in 60s
    - Verify 11th blocked

14. **Test analytics:**
    - Run `/health` command
    - Verify stats shown

15. **Test /health command:**
    - As admin: verify detailed stats
    - As user: verify "admin only" message

---

## Created Files

### New Middleware
- `bot/src/middleware/validateToken.js` (P1-BOT-001)
- `bot/src/middleware/analytics.js` (P1-BOT-012)
- `bot/src/middleware/userRateLimit.js` (P1-BOT-014)

### New Scenes
- `bot/src/scenes/editFollowMarkup.js` (P1-BOT-003)

### New Commands
- `bot/src/commands/health.js` (P1-BOT-015)

### New Utilities
- `bot/src/utils/friendlyErrors.js` (P1-BOT-009)
- `bot/src/utils/withTimeout.js` (P1-BOT-010)

### Modified Files
- `bot/src/utils/api.js` (retry logic + circular validation API)
- `bot/src/scenes/createFollow.js` (circular dependency check)
- `bot/src/scenes/manageWorkers.js` (username validation)
- `bot/src/handlers/seller/follows.js` (race condition fix)
- `bot/src/bot.js` (middleware + command registration)

---

## Environment Variables

**Add to `.env`:**
```bash
# P1-BOT-015: Admin user IDs for /health command
ADMIN_IDS=123456789,987654321
```

---

## Dependencies Added

```json
{
  "axios-retry": "^4.0.0"
}
```

Already installed via: `npm install axios-retry --save`
