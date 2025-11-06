# Wallet Address Validation Implementation

## Краткий отчёт

Реализована **валидация крипто-адресов** в двух контроллерах:

### Обновлённые файлы:

1. **`/backend/src/controllers/shopController.js`**
   - Добавлен import: `import { validateAddress } from '../services/walletService.js';`
   - Функция `updateWallets()` теперь валидирует все адреса ДО сохранения в БД
   - Валидация для: BTC, ETH, USDT (как ERC20), LTC

2. **`/backend/src/controllers/walletController.js`**
   - Добавлен import: `import { validateAddress } from '../services/walletService.js';`
   - Функция `updateWallets()` теперь валидирует все адреса ДО сохранения в БД
   - Улучшен HTTP статус для дублей: 400 → 409 (Conflict)
   - Валидация для: BTC, ETH, USDT (как ERC20), LTC

---

## Примеры ошибок валидации

### 1. Invalid Bitcoin Address

**Request:**
```bash
PUT /api/shops/123/wallets
Content-Type: application/json

{
  "wallet_btc": "invalid-bitcoin-address-xyz"
}
```

**Response: 400 Bad Request**
```json
{
  "success": false,
  "error": "Invalid Bitcoin address format: invalid-bitcoin-address-xyz"
}
```

**Логирование:**
```
[Wallet Validation] Invalid BTC address attempt
userId: 456
shopId: 123
address: invalid-...
```

---

### 2. Invalid Ethereum Address

**Request:**
```bash
PUT /api/shops/123/wallets
Content-Type: application/json

{
  "wallet_eth": "0xinvalidaddress"
}
```

**Response: 400 Bad Request**
```json
{
  "success": false,
  "error": "Invalid Ethereum address format: 0xinvalidaddress"
}
```

**Логирование:**
```
[Wallet Validation] Invalid ETH address attempt
userId: 456
shopId: 123
address: 0xinval...
```

---

### 3. Duplicate Wallet Address (409 Conflict)

**Request:**
```bash
PUT /api/shops/123/wallets
Content-Type: application/json

{
  "wallet_eth": "0x742d35Cc6634C0532925a3b844Bc9e7595f42e0e"
}
```

**Response: 409 Conflict**
```json
{
  "success": false,
  "error": "Ethereum address already used by shop \"OtherShop\""
}
```

---

### 4. Invalid Litecoin Address

**Request:**
```bash
PUT /api/shops/456/wallets
Content-Type: application/json

{
  "wallet_ltc": "invalid_ltc_123"
}
```

**Response: 400 Bad Request**
```json
{
  "success": false,
  "error": "Invalid Litecoin address format: invalid_ltc_123"
}
```

---

### 5. Invalid USDT Address (ERC20)

**Request:**
```bash
PUT /api/shops/789/wallets
Content-Type: application/json

{
  "wallet_usdt": "0xbadaddress"
}
```

**Response: 400 Bad Request**
```json
{
  "success": false,
  "error": "Invalid USDT (ERC20) address format: 0xbadaddress"
}
```

---

### 6. Multiple Valid Addresses (Success)

**Request:**
```bash
PUT /api/shops/123/wallets
Content-Type: application/json

{
  "wallet_btc": "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
  "wallet_eth": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  "wallet_usdt": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  "wallet_ltc": "LCvFftp8eGHwPJnz2kt4aecfyNjsAqSTnS"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "wallet_btc": "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
    "wallet_eth": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    "wallet_usdt": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    "wallet_ltc": "LCvFftp8eGHwPJnz2kt4aecfyNjsAqSTnS"
  }
}
```

---

## Валидация Правила

### Bitcoin (BTC)
- Поддерживаемые форматы: P2PKH (1...), P2SH (3...), Bech32 (bc1...)
- Пример валидного адреса: `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2`
- Пример Bech32: `bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4`

### Ethereum (ETH)
- Формат: 42 символа (0x + 40 hex)
- Важно: Адрес должен быть **ВСЕ МАЛЕНЬКИМИ** буквами или **ВСЕ БОЛЬШИМИ** буквами!
- Смешанный регистр (checksum) проходит валидацию только если контрольная сумма верна
- Рекомендация: используй все маленькие буквы для простоты
- Пример валидного адреса: `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` (lowercase)

### USDT (ERC20 Token)
- Использует стандартный Ethereum адрес формат (как ETH)
- Пример валидного адреса: `0xd8da6bf26964af9d7eed9e03e53415d37aa96045`

### Litecoin (LTC)
- Поддерживаемые форматы: P2PKH (L...), P2SH (M...), Bech32 (ltc1...)
- Примечание: Текущая библиотека может быть строга в валидации LTC
- Рекомендуется использовать хорошо известные P2PKH адреса (L...)

---

## Логирование

Все попытки валидации с ошибками логируются в `[Wallet Validation]`:

```javascript
logger.warn(`[Wallet Validation] Invalid BTC address attempt`, {
  userId: req.user.id,
  shopId: id,
  address: wallet_btc.substring(0, 8) + '...'  // Первые 8 символов + ...
});
```

Это позволяет:
- Отследить попытки ввода невалидных адресов
- Обнаружить потенциальные атаки (spam)
- Аудитировать действия пользователя

---

## Тестирование

Валидация работает **до** проверки дублей и **до** сохранения в БД:

```
1. Проверка собственности магазина (403)
   ↓
2. ВАЛИДАЦИЯ АДРЕСОВ (400) ← NEW
   ↓
3. Проверка дублей (409)
   ↓
4. Сохранение в БД (200)
```

---

## Изменения в API

### shopController.js - updateWallets

**Новое поведение:**
- Если адрес невалидный → 400 Bad Request
- Если адрес дублируется → 409 Conflict
- Если адрес валидный и уникальный → 200 OK

**Пример невалидного адреса:**
```
PUT /api/shops/123/wallets
{
  "wallet_btc": "not-a-valid-bitcoin-address"
}

↓

400 Bad Request
{
  "success": false,
  "error": "Invalid Bitcoin address format: not-a-valid-bitcoin-address"
}
```

### walletController.js - updateWallets

**Новое поведение:**
- Если адрес невалидный → 400 Bad Request
- Если адрес дублируется → 409 Conflict (исправлено с 400)
- Если адрес валидный и уникальный → 200 OK

**Улучшение статус-кодов:**
- Было: 400 (Bad Request) для дублей
- Стало: 409 (Conflict) для дублей (более точный семантический код)

---

## Технические детали

### Используемая библиотека

```javascript
import validate from 'wallet-validator';

// Использование
const isValid = validate.validate(address, 'BTC');
// Возвращает: true или false
```

### Версия
- `wallet-validator`: v0.3.18 (уже установлена в `package.json`)

### Цепи
- BTC → Bitcoin
- ETH → Ethereum
- LTC → Litecoin
- USDT → Ethereum (ERC20 token format)

---

## Безопасность

1. **Ранняя валидация** - до БД операций
2. **Защита от spam** - логирование всех попыток
3. **Ненулевые адреса** - пустые адреса разрешены (null)
4. **Trimming** - удаление пробелов перед валидацией
5. **Частичное логирование** - только первые 8 символов для конфиденциальности

---

## Статус

✅ **Реализовано:**
- shopController.js updateWallets()
- walletController.js updateWallets()
- Валидация BTC, ETH, USDT, LTC
- Логирование с маскированием адресов
- Правильные HTTP статус-коды (400, 409)

📝 **Next Steps:**
- Добавить юнит-тесты для валидации
- Добавить интеграционные тесты для обоих endpoint
- Обновить API документацию
