# 🤖 AI Chat Assistant - Quick Reference

**Status Stock 4.0** | DeepSeek API | Telegram Bot | Quick Guide

---

## 📁 Key Files

| File | Location | Purpose | Size |
|------|----------|---------|------|
| **productAI.js** | `bot/src/services/productAI.js` | Core AI logic, orchestration | 1200 LOC |
| **deepseek.js** | `bot/src/services/deepseek.js` | DeepSeek API client, streaming | 150 LOC |
| **systemPrompts.js** | `bot/src/utils/systemPrompts.js` | System prompts (CRITICAL!) | 2000 LOC |
| **productTools.js** | `bot/src/tools/productTools.js` | Tool/function definitions | 300 LOC |
| **aiProducts.js** | `bot/src/handlers/seller/aiProducts.js` | Telegram handlers | 400 LOC |

---

## 🔄 Request Flow

```
User → [handleAIProductCommand] 
       → [processProductCommand]
         ├─ detectStockUpdateIntent (FAST PATH - no AI)
         ├─ deepseek.chatStreaming (AI #1)
         ├─ [finish_reason = tool_calls?]
         │  └─ executeToolCall
         │     └─ deepseek.chatStreaming (AI #2 - loop-back)
         └─ Return response
       → [User sees streaming message]
```

**Timing:**
- Fast path: 100ms (stock updates)
- Normal path: 2-4 seconds
- With tool execution: 3-5 seconds

---

## 🧠 10 Tool Functions

```javascript
1. addProduct(name, price, stock)
2. bulkAddProducts(products[])
3. deleteProduct(productName)
4. listProducts()
5. searchProduct(query)
6. updateProduct(productName, updates)
7. bulkDeleteAll()
8. bulkDeleteByNames(productNames[])
9. recordSale(productName, quantity)
10. bulkUpdatePrices(percentage, operation, duration?)
```

---

## 💾 Memory Management

```javascript
// Structure
ctx.session.aiConversation = {
  messages: [...],          // OpenAI format
  lastActivity: Date.now(),
  messageCount: N
};

// Constraints
MAX_HISTORY_MESSAGES = 40
CONVERSATION_TIMEOUT = 2 hours

// Auto-cleanup
if (messages.length > 40) {
  messages = messages.slice(-40);  // Sliding window
}

if (Date.now() - lastActivity > timeout) {
  delete ctx.session.aiConversation;  // Expire
}
```

---

## 🎯 System Prompt Structure

```
1. TONE & STYLE (250 words)
   └─ Friendly, natural, Russian

2. CONVERSATION CONTEXT (300 words)
   └─ DON'T repeat greeting!

3. CATALOG (dynamic)
   └─ Last 50 products

4. OPERATIONS (250 words)
   └─ List of 10 functions

5. RULES (1000+ words) ← CRITICAL!
   ├─ Decision logic: command vs question
   ├─ Safety: no system prompt leaks
   ├─ Quantity: ALWAYS ask if missing
   ├─ Bulk: handle multiple items
   ├─ Natural responses: vary phrases
   └─ Anti-patterns: common mistakes

6. EXAMPLES (400 words)
   └─ 15+ concrete examples

7. ANTI-PATTERNS (600 words)
   └─ What NOT to do
```

**Total:** ~4000-5000 tokens | ~15 KB

---

## ⚡ Quick Optimizations Already Done

✅ **Fast-path for stock updates** (detectStockUpdateIntent)
- Regex patterns skip AI completely
- 100ms instead of 2-4 seconds
- Example: "выстави наличие iPhone 10" → instant

✅ **Streaming with throttle**
- Update every 500ms OR 15 words
- 2-4 updates/sec (optimal)
- User sees progress in real-time

✅ **Rate limiting**
- Max 10 commands/minute
- Prevents abuse & API rate limits

✅ **Conversation timeout**
- Clears history after 2 hours
- Fresh start = lower token cost

✅ **Input sanitization**
- Removes role injection ("system:", "assistant:")
- Removes thinking tags ("<think>...")
- Max 500 characters

---

## ⚠️ Main Improvement Areas

### Tier 1: Quick Wins

| Item | Effort | Impact | Status |
|------|--------|--------|--------|
| Extend timeout to 6h | 5 min | Medium | ❌ TODO |
| Add 429 retry logic | 30 min | Medium | ❌ TODO |
| Better error messages | 1 hour | High | ❌ TODO |
| Sentry integration | 2 hours | Medium | ❌ TODO |

### Tier 2: Medium-term

| Item | Effort | Impact | Status |
|------|--------|--------|--------|
| Prompt compression | 4-6 hours | 30% cost savings | ❌ TODO |
| Semantic caching | 6-8 hours | 20% cheaper repeated queries | ❌ TODO |
| Dynamic context | 4 hours | 20% token reduction | ❌ TODO |
| Session summarization | 8 hours | Preserve long-term context | ❌ TODO |

### Tier 3: Long-term

| Item | Effort | Impact | Status |
|------|--------|--------|--------|
| Vector DB memory | 2-3 weeks | Complete context preservation | ❌ TODO |
| Analytics dashboard | 1 week | Operational visibility | ❌ TODO |
| Fine-tuned model | 3 weeks | 50% cost reduction | ❌ TODO |

---

## 🔐 Security Checklist

✅ Input sanitization (role/tag injection)
✅ Rate limiting (10 cmds/min)
✅ Concurrent request guard (prevent race)
✅ System prompt protection (no leaks)
✅ RBAC (buyer vs seller)
✅ Confirmation for dangerous ops (delete all, bulk update)
✅ Fuzzy matching (prevent wrong product)

⚠️ TODO:
- [ ] Error tracking (Sentry)
- [ ] API key rotation
- [ ] Audit logging
- [ ] A/B testing safeguards

---

## 💰 Cost Optimization Tips

### Current Costs

```
Simple operation: ~1000 tokens = $0.002
Tool operation: ~3000 tokens = $0.006
Bulk operation: ~5000 tokens = $0.010

100 users × 5 cmd/day × 30 days × $0.006 avg
= $90/month = $1080/year
```

### Savings Opportunities

```
1. Prompt compression (LLMLingua)
   4000 → 2000 tokens = -50%
   Saving: $0.001/request

2. Semantic caching
   Repeated prompts: $0.27 → $0.068 per M tokens
   Saving: $0.005/cached request

3. Dynamic context
   2000 → 500 tokens for single-product ops
   Saving: $0.001/request

TOTAL: 30-50% cost reduction possible
Target: $400-600/year (from current $1080)
```

---

## 🧪 Testing Patterns

```javascript
// Unit test tool function
describe('addProduct', () => {
  it('should validate price > 0', () => {
    const result = await handleAddProduct(
      { name: 'X', price: -100, stock: 5 },
      shopId, token
    );
    expect(result.success).toBe(false);
    expect(result.data.error.code).toBe('VALIDATION_ERROR');
  });
});

// Integration test conversation
describe('processProductCommand', () => {
  it('should handle bulk add', async () => {
    const result = await processProductCommand(
      "добавь iPhone 1000 и Samsung 800",
      context
    );
    expect(result.success).toBe(true);
    expect(result.data.products.length).toBe(2);
  });
});
```

---

## 📊 Monitoring Checklist

```javascript
// Log these metrics
logger.info('ai_command', {
  userId,
  shopId,
  command: msg.slice(0, 100),
  operation: 'addProduct' || 'text_response',
  success: boolean,
  latencyMs: number,
  tokensUsed: number,
  estimatedCost: number,
  toolCalled: boolean,
  timestamp: Date.now()
});

// Alert on these conditions
❌ Error rate > 5%
❌ API latency > 5s
❌ Rate limit hits > 10/min
❌ Memory usage > 100MB
❌ Token cost > $0.01/request
```

---

## 🎯 Common Scenarios & Solutions

### Scenario 1: User doesn't specify quantity
```
User: "добавь iPhone 1000"
System: Asks "Сколько штук выставить?"
Code: Tool function has required: ['name', 'price', 'stock']
```

### Scenario 2: Multiple products found
```
User: "удали чехол"
System: Shows options (chehol for iPhone, Samsung, etc.)
Stores: ctx.session.pendingAI = { operation, options }
Handler: handleAISelection() on callback
```

### Scenario 3: DeepSeek API overloaded
```
Error: 503 Service Unavailable
Retry: exponential backoff (2s, 4s, 8s, max 3 times)
Message: "⏳ AI перегружен. Попробуйте через минуту"
```

### Scenario 4: Bulk discount with timer
```
User: "скидка 20%"
AI: Calls bulkUpdatePrices() → needsConfirmation: true
Bot: Shows keyboard "Постоянная" vs "С таймером"
User: Chooses "С таймером"
Bot: Shows duration options (1h, 6h, 24h, 3d, 7d)
Execute: bulkPriceUpdate with confirmed duration
```

### Scenario 5: Stock update (fast path!)
```
User: "выстави наличие iPhone 10"
System: detectStockUpdateIntent() = YES!
Speed: Skip AI, call updateProduct() directly
Result: 100ms instead of 2-4 seconds
Saved: API call tokens & cost
```

---

## 🚀 Deployment Checklist

```javascript
Before shipping:
☑️ Test all 10 tool functions
☑️ Test conversation history (40 message limit)
☑️ Test streaming (check throttle working)
☑️ Test rate limiting (10 per minute)
☑️ Test timeout (conversation expires after 2h)
☑️ Test security (no system prompt leaks)
☑️ Test error handling (graceful degradation)
☑️ Load test (100+ concurrent users)
☑️ Cost projection (validate budget)
☑️ Monitoring setup (Sentry, logs)
```

---

## 📚 Further Reading

### Official Docs
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [DeepSeek API Docs](https://api-docs.deepseek.com)
- [Telegraf.js Docs](https://telegraf.js.org)

### Best Practices
- OWASP: Prompt Injection Prevention
- Martin Fowler: Function Calling in LLMs
- Pinecone: Conversation Memory for LLMs

### Research
- "Recursively Summarizing for Long-Term Dialogue Memory" (arxiv)
- "FrugalGPT: How to Use Large Language Models While Reducing Costs" 
- "LLMLingua: Compressing Prompts for Accelerated Inference"

---

**Created:** 2025-11-03  
**Framework:** DeepSeek Chat + Telegraf.js  
**Status:** Production Ready (8/10)  
**Next Update:** After implementing Tier 1 improvements

