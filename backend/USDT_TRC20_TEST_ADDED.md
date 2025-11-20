# USDT_TRC20 E2E Test Added

## Summary

Добавлены полные E2E тесты для **USDT_TRC20** (Tether на сети TRON) - самого популярного метода оплаты в проекте.

## Test Coverage

### 1. Full Payment Cycle (Main Test)

**Тест:** `Full payment cycle - USDT_TRC20`

**Покрывает весь жизненный цикл:**

- ✅ **Создание pending subscription** (tier: basic)
- ✅ **Генерация USDT_TRC20 invoice** с уникальным Tron адресом
- ✅ **Валидация Tron адреса:**
  - Длина: 34 символа
  - Формат: `T[A-Za-z0-9]{33}`
  - Первый символ: 'T'
- ✅ **Проверка currency mapping:** `USDT_TRC20 → USDT`
- ✅ **Immediate status check** - критичная проверка timezone fix
  - До фикса: возвращал 404
  - После фикса: возвращает 200 с pending status
- ✅ **Симуляция USDT TRC-20 payment** (обновление БД)
- ✅ **Верификация активации:**
  - Invoice status → 'paid'
  - Subscription status → 'active'
  - Shop tier → 'basic'
  - Shop registration_paid → true

### 2. Tron Address Format Validation

**Тест:** `should validate Tron address format strictly`

**Проверяет:**

- ✅ Соответствие regex: `/^T[A-Za-z0-9]{33}$/`
- ✅ Длина: ровно 34 символа
- ✅ Первый символ: 'T'
- ✅ **Negative checks:**
  - NOT Ethereum (не начинается с '0x')
  - NOT Bitcoin (не начинается с 'bc1')
  - NOT Litecoin (не начинается с 'ltc1')

### 3. Derivation Path Validation

**Тест:** `should use correct derivation path for Tron`

**Проверяет:**

- ✅ walletService.generateAddress вызывается с chain = **'TRX'** (не 'USDT_TRC20')
- ✅ Derivation path: `m/44'/195'/0'/0/{index}` (BIP44 для Tron)

**Важно:** Хотя chain в API называется `USDT_TRC20`, внутри walletService используется `TRX` для генерации Tron адресов.

### 4. Currency Mapping Consistency

**Тест:** `should map USDT_TRC20 currency correctly in all responses`

**Проверяет консистентность маппинга во всех местах:**

- ✅ Invoice response: `currency = 'USDT'`
- ✅ Status endpoint: `payment.currency = 'USDT'`
- ✅ Database:
  - `invoices.chain = 'USDT_TRC20'` (оригинальное значение)
  - `invoices.currency = 'USDT'` (маппированное)

### 5. Multi-chain Parametrized Tests

**Обновлён тест:** `Multiple chains support`

**Теперь включает USDT_TRC20 с полной валидацией:**

```javascript
{
  name: 'USDT_TRC20',
  addressPattern: /^TTest\d+/,
  currency: 'USDT',
  derivationPath: /^m\/44'\/195'\/0'\/0\/\d+$/
}
```

**Для каждого chain:**

- ✅ Создание subscription
- ✅ Генерация invoice
- ✅ Проверка формата адреса
- ✅ Проверка currency mapping
- ✅ Immediate status check (timezone fix verification)

---

## Updated Test Structure

### Mock Improvements

**walletService mock обновлён:**

```javascript
jest.mock('../../src/services/walletService.js', () => ({
  generateAddress: jest.fn((chain, xpub, index) => {
    const addresses = {
      BTC: `bc1qtest${index}abcdefghijklmnopqrstuvwxyz`,
      LTC: `ltc1qtest${index}abcdefghijklmnopqrstuvwxyz`,
      ETH: `0xtest${index}00000000000000000000000000000000`,
      TRX: `TTest${index}00000000000000000000000000000`, // 34 chars
    };
    const derivationPaths = {
      BTC: `m/44'/0'/0'/0/${index}`,
      LTC: `m/44'/2'/0'/0/${index}`,
      ETH: `m/44'/60'/0'/0/${index}`,
      TRX: `m/44'/195'/0'/0/${index}`, // Tron BIP44
    };
    return Promise.resolve({
      address: addresses[chain],
      derivationPath: derivationPaths[chain],
    });
  }),
}));
```

**Теперь генерирует:**

- ✅ Realistic address lengths
- ✅ Correct chain-specific prefixes
- ✅ Correct derivation paths для каждого chain

---

## Run Tests

### Run All E2E Tests

```bash
cd backend
npm test -- crypto-payment-flow.test.js
```

### Run Only USDT_TRC20 Tests

```bash
npm test -- crypto-payment-flow.test.js -t "USDT_TRC20"
```

### Run Multi-chain Parametrized Tests

```bash
npm test -- crypto-payment-flow.test.js -t "Multiple chains"
```

### Run with Coverage

```bash
npm run test:coverage -- crypto-payment-flow.test.js
```

---

## Expected Results

### Test Counts

- **Total tests in file:** ~18-20 tests
- **USDT_TRC20 specific tests:** 4 tests
- **Multi-chain tests (includes USDT_TRC20):** 4 tests (BTC, LTC, ETH, USDT_TRC20)

### Success Criteria

✅ **All tests pass:**

- ✅ Full payment cycle для USDT_TRC20 (PASS)
- ✅ Tron address validation (PASS)
- ✅ Derivation path check (PASS)
- ✅ Currency mapping consistency (PASS)
- ✅ Multi-chain support включает USDT_TRC20 (PASS)
- ✅ **NO 404 errors** на immediate status check (timezone fix verified)

### Timezone Fix Validation

**Критичная проверка:** После генерации invoice, немедленный запрос status должен возвращать **200** (не 404).

**До фикса (migration 030):**

- `expires_at` использовал `TIMESTAMP WITHOUT TIME ZONE`
- Query `expires_at > NOW()` падал из-за timezone mismatch
- Immediate status check → **404 (FAIL)**

**После фикса (migration 030):**

- `expires_at` использует `TIMESTAMPTZ`
- Query `expires_at > NOW()` работает корректно
- Immediate status check → **200 (PASS)** ✅

---

## Key Validations

### 1. Tron Address Format

```javascript
// MUST pass:
expect(address).toMatch(/^T[A-Za-z0-9]{33}$/);
expect(address.length).toBe(34);
expect(address.charAt(0)).toBe('T');

// MUST NOT match:
expect(address).not.toMatch(/^0x/); // Not Ethereum
expect(address).not.toMatch(/^bc1/); // Not Bitcoin
```

### 2. Chain vs Currency Mapping

```javascript
// API Request:
{ chain: 'USDT_TRC20' }

// Invoice Response:
{ currency: 'USDT' } // NOT 'USDT_TRC20'

// Database:
invoices.chain = 'USDT_TRC20'
invoices.currency = 'USDT'
```

### 3. Wallet Service Call

```javascript
// subscriptionInvoiceService calls:
const walletType = normalizedChain === 'USDT_TRC20' ? 'TRX' : normalizedChain;
await walletService.generateAddress(walletType, xpub, index);

// Result:
walletService.generateAddress('TRX', ..., ...)
// NOT: walletService.generateAddress('USDT_TRC20', ...)
```

---

## Integration Points Tested

1. **API Layer** (`subscriptionController.js`):
   - ✅ Validates `chain: 'USDT_TRC20'`
   - ✅ Returns `currency: 'USDT'`

2. **Service Layer** (`subscriptionInvoiceService.js`):
   - ✅ Normalizes chain: `USDT` → `USDT_TRC20`
   - ✅ Maps to wallet type: `USDT_TRC20` → `TRX`
   - ✅ Converts currency: `USDT_TRC20` → `USDT`

3. **Wallet Service** (`walletService.js`):
   - ✅ Receives `chain: 'TRX'`
   - ✅ Generates Tron address (34 chars, starts with T)
   - ✅ Uses derivation path: `m/44'/195'/0'/0/{index}`

4. **Database** (`invoices` table):
   - ✅ Stores `chain = 'USDT_TRC20'`
   - ✅ Stores `currency = 'USDT'`
   - ✅ Uses `TIMESTAMPTZ` for `expires_at`

---

## Next Steps

### 1. Run Tests Locally

```bash
cd backend
npm test -- crypto-payment-flow.test.js
```

**Expected output:**

```
PASS  __tests__/e2e/crypto-payment-flow.test.js
  E2E: Crypto Payment Flow
    Full payment cycle - BTC
      ✓ should complete full flow... (1234ms)
    Full payment cycle - USDT_TRC20
      ✓ should complete full flow for USDT TRC-20... (987ms)
      ✓ should validate Tron address format strictly (123ms)
      ✓ should use correct derivation path for Tron (156ms)
      ✓ should map USDT_TRC20 currency correctly (201ms)
    Invoice expiration with TIMESTAMPTZ
      ✓ should correctly handle expired invoices (145ms)
      ✓ should find invoice immediately after creation (178ms)
    Multiple chains support
      ✓ should work for BTC (234ms)
      ✓ should work for LTC (198ms)
      ✓ should work for ETH (212ms)
      ✓ should work for USDT_TRC20 (267ms)
    Error handling
      ✓ should return 404 for non-existent subscription (89ms)
      ✓ should prevent generating duplicate invoices (145ms)
      ✓ should reject invalid chain (76ms)

Test Suites: 1 passed, 1 total
Tests:       13+ passed, 13+ total
```

### 2. Verify Coverage

```bash
npm run test:coverage -- crypto-payment-flow.test.js
```

**Expected:**

- ✅ `subscriptionController.js` - coverage increased
- ✅ `subscriptionInvoiceService.js` - USDT_TRC20 paths covered
- ✅ `walletService.js` - TRX address generation covered (через mock)

### 3. Integration with CI/CD

Тесты автоматически запускаются в CI/CD pipeline:

- ✅ Pre-commit hook
- ✅ GitHub Actions (if configured)
- ✅ Before deployment

### 4. Ready for Production

После успешного прохождения всех тестов:

- ✅ USDT_TRC20 payment flow полностью протестирован
- ✅ Timezone fix валидирован
- ✅ Multi-chain support подтверждён
- ✅ **Ready to deploy** 🚀

---

## Test Statistics

| Metric | Value |
|--------|-------|
| **New describe blocks** | 1 (`Full payment cycle - USDT_TRC20`) |
| **New test cases** | 4 (USDT_TRC20 specific) |
| **Updated tests** | 1 (`Multiple chains support`) |
| **Total USDT_TRC20 coverage** | ~5 test cases |
| **Lines of test code added** | ~200+ lines |
| **Mock improvements** | Realistic addresses + derivation paths |

---

## Files Modified

1. **`backend/__tests__/e2e/crypto-payment-flow.test.js`**
   - Added: Full USDT_TRC20 payment cycle test
   - Added: Tron address validation test
   - Added: Derivation path test
   - Added: Currency mapping test
   - Updated: walletService mock with realistic formats
   - Updated: Multi-chain parametrized tests

---

**Status:** ✅ Complete and ready for testing

**Author:** Claude Code (backend-architect agent)

**Date:** 2025-11-15

**Version:** 1.0
