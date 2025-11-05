# Remaining Bot P1 Manual Tasks

> 5 paтternов для применения вручную в будущих итерациях

## Статус
- ✅ **Completed:** 10/15 Bot P1 issues (67%)
- ✅ **P1-BOT-007:** User message cleanup (1/2 files done - markOrdersShipped.js)
- ⏳ **Remaining:** 5 patterns (non-critical for production)

---

## TODO #1: P1-BOT-008 - Session Cleanup on Cancel

**Priority:** Medium
**Effort:** 30 minutes
**Files:** 9 scenes with cancel_scene

### Pattern to Apply:

```javascript
sceneInstance.action('cancel_scene', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    logger.info('scene_cancelled', { userId: ctx.from.id, scene: 'sceneName' });

    // P1-BOT-008: Clear scene-specific session data
    delete ctx.session.editingFollowId;
    delete ctx.session.pendingModeSwitch;
    delete ctx.session.editingMessageId;
    delete ctx.session.selectedShopId;
    delete ctx.session.pendingShopName;
    delete ctx.session.pendingTier;
    // Add any other scene-specific session keys

    await ctx.scene.leave();
    // Show appropriate menu
  } catch (error) {
    logger.error('Error in cancel_scene handler:', error);
  }
});
```

### Files to Update:
- [x] markOrdersShipped.js (SKIP - already has leave handler)
- [ ] manageWorkers.js
- [ ] createFollow.js
- [ ] editFollowMarkup.js
- [ ] manageWallets.js
- [ ] createShop.js
- [ ] chooseTier.js
- [ ] addProduct.js
- [ ] searchShop.js

---

## TODO #2: P1-BOT-009 - User-Friendly Errors

**Priority:** Low
**Effort:** 2 hours
**Files:** 20+ handlers in bot/src/handlers/

### Pattern to Apply:

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

### Files to Update:
- All handlers in `bot/src/handlers/seller/*.js` (8 files)
- All handlers in `bot/src/handlers/buyer/*.js` (3 files)
- All handlers in `bot/src/handlers/workspace/*.js` (2 files)
- `bot/src/handlers/common.js`
- All scenes (12 files)

### Utility Already Created:
✅ `bot/src/utils/friendlyErrors.js` - ready to use

---

## TODO #3: P1-BOT-010 - Timeout for Long Operations

**Priority:** Low
**Effort:** 30 minutes
**Files:** 4 operations

### Pattern to Apply:

```javascript
import { withTimeout } from '../../utils/withTimeout.js';

await withTimeout(ctx, async () => {
  await productApi.bulkDeleteAll(shopId, token);
}, {
  timeout: 30000,
  message: '⏳ Удаление товаров...'
});
```

### Files to Update:
1. `bot/src/handlers/seller/aiProducts.js` - bulk product sync
2. `bot/src/scenes/paySubscription.js` - payment verification
3. `bot/src/scenes/markOrdersShipped.js` - bulk order updates
4. `bot/src/scenes/migrateChannel.js` - channel migration

### Utility Already Created:
✅ `bot/src/utils/withTimeout.js` - ready to use

---

## TODO #4: P1-BOT-011 - Missing answerCbQuery

**Priority:** Medium
**Effort:** 1 hour
**Files:** 7 handler files

### Pattern to Apply:

Search for: `bot.action(`
Check: Every callback handler must call `ctx.answerCbQuery()`

```javascript
bot.action('some_action', async (ctx) => {
  // P1-BOT-011: MUST answer callback query
  await ctx.answerCbQuery(); // Add if missing

  // ... handler logic
});
```

### Files to Audit:
- `bot/src/handlers/seller/index.js`
- `bot/src/handlers/seller/follows.js`
- `bot/src/handlers/seller/orders.js`
- `bot/src/handlers/seller/aiProducts.js`
- `bot/src/handlers/buyer/index.js`
- `bot/src/handlers/workspace/index.js`
- `bot/src/handlers/common.js`

### Already Fixed:
- ✅ createFollow.js
- ✅ editFollowMarkup.js
- ✅ manageWorkers.js

---

## TODO #5: P1-BOT-013 - Scene Leave Handlers

**Priority:** Low
**Effort:** 20 minutes
**Files:** 6 scenes

### Pattern to Apply:

```javascript
scene.leave(async (ctx) => {
  // P1-BOT-007: Delete user messages if tracked
  const userMsgIds = ctx.wizard.state.userMessageIds || [];
  for (const msgId of userMsgIds) {
    try {
      await ctx.deleteMessage(msgId);
    } catch (error) {
      logger.debug(`Could not delete user message ${msgId}:`, error.message);
    }
  }

  // Cleanup wizard state
  ctx.wizard.state = {};
  logger.info(`User ${ctx.from?.id} left sceneName scene`);
});
```

### Files to Check:
- [ ] searchShop.js (check if has leave handler)
- [ ] manageWallets.js (check if has leave handler)
- [ ] migrateChannel.js (check if has leave handler)
- [ ] paySubscription.js (check if has leave handler)
- [ ] upgradeShop.js (check if has leave handler)
- [ ] markOrdersShipped.js (✅ DONE)

### Already Have Leave Handlers:
- ✅ createFollow.js
- ✅ editFollowMarkup.js
- ✅ manageWorkers.js
- ✅ chooseTier.js
- ✅ createShop.js
- ✅ addProduct.js
- ✅ markOrdersShipped.js

---

## Testing Checklist

After applying all patterns:

1. **Test session cleanup:**
   - Enter scene, click cancel
   - Check `ctx.session` has no leftover data

2. **Test friendly errors:**
   - Stop backend → trigger bot command
   - Verify "Server temporarily unavailable" (not technical error)

3. **Test timeout:**
   - Mock slow blockchain API
   - Verify "Operation took too long" after 30s

4. **Test answerCbQuery:**
   - Click any inline button
   - Verify no infinite spinner

5. **Test scene.leave():**
   - Enter/leave all scenes
   - Check logs for "left scene" messages

---

## Impact Assessment

**Without these fixes:**
- Users may see technical error messages instead of friendly ones
- Session data may leak between scenes (minor memory impact)
- Long operations may hang without feedback
- Some buttons may show infinite spinner

**Risk Level:** Low
**Production Blocker:** No
**Can Deploy Without:** Yes ✅

---

## Recommendation

These patterns improve UX but are NOT critical for production deployment.

**Phase 2.5 Status:** 49/63 P1 issues fixed (78%)
**Combined P0+P1:** 89/103 issues fixed (86%)
**Production Ready:** Yes ✅ (with documented known limitations)

Apply these patterns in Phase 3 or future iterations.

---

**Created:** 2025-11-05
**Last Updated:** 2025-11-05
**Status:** TODO (non-blocking)
