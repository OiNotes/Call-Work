/**
 * Product Management Tools for DeepSeek Function Calling
 * Defines available operations for AI-powered product management
 * WITH STRICT MODE for enhanced reliability (DeepSeek Beta)
 */

export const productTools = [
  {
    type: 'function',
    strict: true,  // DeepSeek strict mode for schema validation
    function: {
      name: 'addProduct',
      description: `Add a single product instantly.

Use it for commands вида «добавь iPhone 15 за 999», «появился новый чехол 20$». Если нужно несколько товаров сразу — выбирай bulkAddProducts.

Примеры:
- "добавь iPhone 15 999" → addProduct({ name: "iPhone 15", price: 999, stock: 1 })
- "создай MacBook Air 1299, 3 штуки" → addProduct({ name: "MacBook Air", price: 1299, stock: 3 })

Правила:
- Цена обязательна — если её нет, спроси «Сколько поставить?»
- КРИТИЧНО: Цена ДОЛЖНА быть > 0, НИКОГДА не используй 0 или отрицательные значения
- Минимальная цена: 0.01 USD
- Сток по умолчанию = 1, если пользователь не уточнил (без вопросов).
- Имя должно быть осмысленным (не короче 3 символов).`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Product name (minimum 3 characters). Examples: "iPhone 15 Pro", "Samsung Galaxy S24", "Наушники AirPods". Must be specified by user.'
          },
          price: {
            type: 'number',
            description: 'Product price in USD (must be > 0). Examples: 999, 1299.99, 49.90, 0.01 (minimum). REQUIRED: If user didn\'t mention price, ask before calling function. NEVER use 0 or negative values.',
            minimum: 0.01
          },
          stock: {
            type: 'number',
            description: 'Stock quantity. If missing, treat as 1 automatically. Examples: 1, 5, 100. Must be >= 0.'
          }
        },
        required: ['name', 'price'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'bulkAddProducts',
      description: `Add multiple products at once (2+ items).

УСЛОВИЯ ВЫЗОВА:
- User lists 2 or more products in one message → CALL THIS FUNCTION IMMEDIATELY
- User says "добавь: X, Y, Z" → CALL bulkAddProducts, DON'T describe action in text
- User says "добавь Чехол 20 5шт, Наушники 150 10шт" → CALL bulkAddProducts({products: [...]})

КОГДА ИСПОЛЬЗОВАТЬ:
✅ "добавь: iPhone 999 3шт, Samsung 799 5шт, Xiaomi 399" → CALL bulkAddProducts
✅ "добавь Чехол 20 5шт, Наушники 150 10шт, Зарядка 30" → CALL bulkAddProducts
✅ "новинки: красная кружка $10, зелёная $12" → CALL bulkAddProducts
❌ "добавь iPhone за 999" → use addProduct (single item)

КРИТИЧНО:
- NEVER respond with text when user lists multiple products
- ALWAYS call this function immediately when 2+ products detected
- Extract all product data from user message and call function
- Default stock = 1 if not specified
- DO NOT ask confirmation, DO NOT describe action - just CALL the function`,
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            description: 'Array of products to add. Example: [{name: "iPhone", price: 999, stock: 3}, {name: "AirPods", price: 199}]',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Product name (minimum 3 characters). Extract from user message. Examples: "iPhone 15", "Чехол", "red car"'
                },
                price: {
                  type: 'number',
                  description: 'Product price in USD (must be > 0). Extract from user message: "$500", "1000$", "цена 999". Examples: 999, 49.90, 0.01 (minimum). NEVER use 0 or negative values.',
                  minimum: 0.01
                },
                stock: {
                  type: 'number',
                  description: 'Stock quantity. Defaults to 1 if не указано. Extract from: "5шт", "10 pcs", "2 штуки". Must be >= 0.'
                }
              },
              required: ['name', 'price'],
              additionalProperties: false
            },
            minItems: 2
          }
        },
        required: ['products'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'deleteProduct',
      description: `Delete a single product by name.

Use this when:
- User wants to remove one specific product
- User says "удали iPhone", "delete Samsung", "убери товар"

Don't use if:
- User wants to delete multiple specific products (use bulkDeleteByNames)
- User wants to delete ALL products (use bulkDeleteAll)

IMPORTANT:
- If user didn't specify product name, ask "Какой товар удалить?" BEFORE calling
- If search returns multiple matches, ask user to clarify which one`,
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Product name to delete (fuzzy match supported). REQUIRED: If user didn\'t mention product name, ask before calling. Examples: "iPhone" will match "iPhone 15 Pro", "Чехол" will find "Чехол для Samsung"'
          }
        },
        required: ['productName'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'listProducts',
      description: `Show list of all products in the shop.

Use this when:
- User wants to see all products
- User says "покажи товары", "list products", "что в магазине?", "show all items"

Don't use if:
- User wants to find specific product (use searchProduct)

No parameters needed - returns all products automatically.`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'searchProduct',
      description: `Search for product by name using fuzzy matching.

Use this when:
- User asks about specific product but name is partial/unclear
- You need to confirm which product user means (multiple possible matches)
- User says "найди iPhone", "search for Samsung", "есть ли Чехол?"

Don't use if:
- User wants to see ALL products (use listProducts)
- You already know exact product name (use getProductInfo)

Fuzzy match examples:
- Query "iPhone" will find: "iPhone 15 Pro", "iPhone 14", "Чехол для iPhone"
- Query "Чехол" will find: "Чехол для Samsung", "Чехол кожаный"`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (partial match supported). Examples: "iPhone" will match "iPhone 15 Pro Max", "чехол" will match "Чехол для Samsung". Can be in any language.'
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'bulkUpdateProducts',
      description: `Update MULTIPLE SPECIFIC products (2-5 products) at once by their names.

КОГДА ИСПОЛЬЗОВАТЬ:
✅ User mentions 2+ specific product names → CALL THIS FUNCTION (not updateProduct multiple times)
✅ "скидка 20% на iPhone и MacBook" → bulkUpdateProducts([{productName:"iPhone",updates:{discount_percentage:20}},{productName:"MacBook",updates:{discount_percentage:20}}])
✅ "установи цену 100 для iPhone, iPad, MacBook" → bulkUpdateProducts with 3 products
✅ "переименуй iPhone в iPhone 15 и MacBook в MacBook Pro" → bulkUpdateProducts with name updates
❌ "скидка на всё" → use bulkUpdatePrices (all products)
❌ "скидка на iPhone" → use updateProduct or applyDiscount (single product)

IMPORTANT: When user lists multiple products with same operation (e.g., "скидка 20% на iPhone и MacBook"), DO NOT call updateProduct/applyDiscount multiple times. Instead, call bulkUpdateProducts ONCE with ALL products.

Examples:
- "скидка 20% на iPhone и MacBook" → bulkUpdateProducts({products:[{productName:"iPhone",updates:{discount_percentage:20}},{productName:"MacBook",updates:{discount_percentage:20}}]})
- "установи остаток 5 для iPhone и iPad" → bulkUpdateProducts({products:[{productName:"iPhone",updates:{stock_quantity:5}},{productName:"iPad",updates:{stock_quantity:5}}]})
- "цена 999 для iPhone, 1299 для MacBook" → bulkUpdateProducts({products:[{productName:"iPhone",updates:{price:999}},{productName:"MacBook",updates:{price:1299}}]})`,
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            description: 'Array of products to update with their names and updates',
            items: {
              type: 'object',
              properties: {
                productName: {
                  type: 'string',
                  description: 'Exact name of the product to update'
                },
                updates: {
                  type: 'object',
                  description: 'Fields to update for this product',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'New product name'
                    },
                    price: {
                      type: 'number',
                      description: 'New price in USD'
                    },
                    stock_quantity: {
                      type: 'number',
                      description: 'New stock quantity'
                    },
                    discount_percentage: {
                      type: 'number',
                      description: 'Discount percentage (0-100)',
                      minimum: 0,
                      maximum: 100
                    }
                  },
                  additionalProperties: false
                }
              },
              required: ['productName', 'updates'],
              additionalProperties: false
            },
            minItems: 2
          }
        },
        required: ['products'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'updateProduct',
      description: `Modify an existing product: имя, цена, остаток, скидка.

Применяй при командах "переименуй", "поставь цену", "выстави остаток", "скидка 15%", "сделай нет в наличии".

Примеры:
- "поставь цену 1299" (после обсуждения MacBook) → updateProduct({ productName: "MacBook...", updates: { price: 1299 } })
- "выстави остаток 0" → updates.stock_quantity = 0
- "скидка 25% на iPhone на 3 дня" → updates.discount_percentage = 25, updates.discount_expires_at = "3 дня"
- "отмени скидку на AirPods" → discount_percentage = 0 (backend вернёт цену из original_price)

Правила:
- Если товар не указан и невозможно однозначно понять из контекста — уточни какой именно.
- Если товар единственный или только что обсуждался — используй его без вопросов.
- discount_percentage 0–100. Для таймера можно передать ISO дату или фразу «6 часов».
- Если пользователь даёт несколько изменений сразу, объедини их в один вызов.`,
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Current product name to search (fuzzy match supported). REQUIRED: If user didn\'t mention product name, ask "Какой товар обновить?" before calling. Examples: "iPhone" will match "iPhone 15 Pro", "Чехол" will match "Чехол для Samsung"'
          },
          updates: {
            type: 'object',
            description: 'Fields to update (at least one required). Only include fields that user wants to change.',
            properties: {
              name: {
                type: 'string',
                description: 'New product name. Only include if user wants to rename. Example: user says "переименуй iPhone в iPhone 15 Pro Max" → extract "iPhone 15 Pro Max"'
              },
              price: {
                type: 'number',
                description: 'New price in USD. Only include if user wants to change price. Must be positive. Examples: user says "поставь цену 999" → 999, "change price to $1299" → 1299'
              },
              stock_quantity: {
                type: 'number',
                description: 'New stock count. Use when user says "выстави наличие 10", "поставь остаток 5", "set stock to 20". Must be >= 0. Examples: "5 штук" → 5, "нет в наличии" → 0, "100 pcs" → 100'
              },
              discount_percentage: {
                type: 'number',
                description: 'Discount percentage (0-100). Use to apply or remove a discount for this product. 0 removes the discount.'
              },
              discount_expires_at: {
                type: 'string',
                description: 'Discount expiry for the product. ISO datetime or duration phrase like "6 часов", "24h". Leave empty/null for permanent discount.'
              }
            },
            additionalProperties: false
          }
        },
        required: ['productName', 'updates'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'bulkDeleteAll',
      description: `Delete ALL products from the shop.

Use this when:
- User explicitly wants to delete ALL products
- User says "удали все товары", "delete all products", "очисти магазин"

Don't use if:
- User wants to delete specific products (use deleteProduct or bulkDeleteByNames)

DANGEROUS OPERATION!
- NEVER call this function directly when user first asks
- ALWAYS return error asking for confirmation first (call with confirm: false or without confirm parameter)
- Function will show confirmation buttons to user
- ONLY call with confirm: true after user clicked confirmation button (you'll see "подтвердил" in next message)

Critical rules:
- First call: bulkDeleteAll({ confirm: false }) - shows buttons, returns needsConfirmation: true
- User confirms by clicking button (not by text "да")
- After button click: function executes automatically
- DO NOT call this function multiple times in one conversation
- If function returns needsConfirmation: true - tell user to click button

Example flow:
1. User: "удали все товары"
2. You: Call bulkDeleteAll({ confirm: false })
3. Function: Returns { needsConfirmation: true, message: "..." }
4. You: Tell user "Нажми кнопку для подтверждения"
5. User: *clicks button*
6. System: Executes deletion automatically (you don't call function again)`,
      parameters: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            description: 'Confirmation flag (must be true to proceed). Set to true ONLY after user explicitly confirmed deletion of all products. Never set to true without confirmation.'
          }
        },
        required: ['confirm'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'bulkDeleteByNames',
      description: `Delete multiple specific products by their names.

Use this when:
- User wants to delete 2 or more specific products
- User says "удали iPhone и Samsung", "delete MacBook, iPad, AirPods"
- User provides a list of products to remove

Don't use if:
- User wants to delete only one product (use deleteProduct)
- User wants to delete ALL products (use bulkDeleteAll)

IMPORTANT: DO NOT respond with text explanation. Extract product names from user message and CALL the function immediately.`,
      parameters: {
        type: 'object',
        properties: {
          productNames: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Array of product names to delete (fuzzy match supported for each). Examples: ["iPhone", "Samsung"] will match "iPhone 15 Pro" and "Samsung Galaxy S24". Extract all product names from user message.'
          }
        },
        required: ['productNames'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'bulkDeleteExcept',
      description: `Delete all products EXCEPT specified ones.

УСЛОВИЯ ВЫЗОВА:
- User says "удали всё кроме iPad", "delete all except iPhone", "убери всё кроме MacBook и AirPods" → CALL THIS FUNCTION IMMEDIATELY
- User wants to keep specific products and delete the rest → CALL bulkDeleteExcept
- Extract product names to KEEP from user message → CALL function with excludedProducts

КОГДА ИСПОЛЬЗОВАТЬ:
✅ "удали всё кроме iPad" → CALL bulkDeleteExcept({ excludedProducts: ["iPad"] })
✅ "delete all except iPhone and Samsung" → CALL bulkDeleteExcept({ excludedProducts: ["iPhone", "Samsung"] })
✅ "очисти магазин кроме MacBook" → CALL bulkDeleteExcept({ excludedProducts: ["MacBook"] })
❌ "удали все товары" → use bulkDeleteAll (no exceptions)
❌ "удали iPhone и Samsung" → use bulkDeleteByNames (specific products)

КРИТИЧНО:
- NEVER respond with text when user says "всё кроме X"
- ALWAYS call this function immediately
- Extract names of products to KEEP (not to delete)
- DO NOT ask confirmation - just CALL the function`,
      parameters: {
        type: 'object',
        properties: {
          excludedProducts: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Array of product names to KEEP (not delete). All other products will be deleted. Fuzzy match supported. Examples: ["iPad"] will keep "iPad Pro", ["iPhone", "MacBook"] will keep both. Extract from "кроме X" or "except Y".'
          }
        },
        required: ['excludedProducts'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'recordSale',
      description: `Record a sale - decrease stock quantity.

УСЛОВИЯ ВЫЗОВА:
- User says "купили iPhone", "продали 3 AirPods", "bought 5 Samsung" → CALL THIS FUNCTION IMMEDIATELY
- User reports any sale → CALL recordSale, DON'T respond with text
- Extract product name and quantity from user message → CALL function

КОГДА ИСПОЛЬЗОВАТЬ:
✅ "купили iPhone" → CALL recordSale({ productName: "iPhone", quantity: 1 })
✅ "продали 3 MacBook" → CALL recordSale({ productName: "MacBook", quantity: 3 })
✅ "bought 2 AirPods" → CALL recordSale({ productName: "AirPods", quantity: 2 })
❌ "установи остаток 5" → use updateProduct (manual stock change)

КРИТИЧНО:
- NEVER respond with text when user reports a sale
- ALWAYS call this function immediately when sale is mentioned
- Default quantity = 1 if not specified
- DO NOT describe action - just CALL the function`,
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Product name (fuzzy match supported). REQUIRED: If user didn\'t mention product, ask before calling. Examples: "iPhone" will match "iPhone 15 Pro", "Чехол" will match "Чехол для Samsung"'
          },
          quantity: {
            type: 'number',
            description: 'Number of items sold. If omitted, assume 1 автоматически. Examples: "продал 5 штук" → 5, "продали iPhone" → 1. Must be positive number.'
          }
        },
        required: ['productName'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'getProductInfo',
      description: `Get detailed information about a product (price, stock, etc).

Use this when:
- User asks about specific product details
- User says "сколько стоит iPhone?", "what's the price of Samsung?"
- User says "сколько осталось Чехлов?", "how many AirPods left?"

Don't use if:
- User wants to see all products (use listProducts)
- User wants to search/find products (use searchProduct)

IMPORTANT: If user didn't specify product name, ask "О каком товаре?" before calling.`,
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Product name to get info about (fuzzy match supported). REQUIRED: If user didn\'t mention product, ask before calling. Examples: "iPhone" will find "iPhone 15 Pro", "Наушники" will find "Наушники AirPods"'
          }
        },
        required: ['productName'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'applyDiscount',
      description: `Apply discount to a specific product.

Examples:
- User: "скидка 30% на iPhone" → applyDiscount({ productName: "iPhone", percentage: 30 })
- User: "скидка 15% на AirPods на 6 часов" → applyDiscount({ productName: "AirPods", percentage: 15, duration: "6h" })
- User: "скидка 20% на MacBook на 2 дня" → applyDiscount({ productName: "MacBook", percentage: 20, duration: "2d" })

Duration format:
- "6h" or "6 hours" - expires in 6 hours
- "2d" or "2 days" - expires in 2 days
- "1w" or "1 week" - expires in 1 week
- null - permanent discount`,
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Name of the product to apply discount to'
          },
          percentage: {
            type: 'number',
            description: 'Discount percentage (1-99)'
          },
          duration: {
            type: 'string',
            description: 'Optional: discount duration (e.g. "6h", "2d", "1w"). If not specified - permanent discount.'
          }
        },
        required: ['productName', 'percentage'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'removeDiscount',
      description: `Remove discount from a product.

Examples:
- User: "убери скидку с iPhone" → removeDiscount({ productName: "iPhone" })
- User: "удали скидку MacBook" → removeDiscount({ productName: "MacBook" })`,
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Name of the product to remove discount from'
          }
        },
        required: ['productName'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'bulkUpdatePrices',
      description: `Apply discount or markup to the whole catalog.

Используй, когда пользователь явно говорит «скидка 15% на всё», «подними цены на 5%», «распродажа 20% кроме MacBook». Для одного товара выбирай updateProduct.

Примеры:
- "скидка 20% на все" → bulkUpdatePrices({ percentage: 20, operation: 'decrease', discount_type: 'permanent' })
- "-15% на каталог на 6 часов" → percentage: 15, operation: 'decrease', discount_type: 'timer', duration: '6 часов'
- "подними цены на 7%, кроме аксессуаров" → operation: 'increase', excludedProducts: ['аксессуар']

Правила:
- Процент обязателен (0.1–100). Значения >100 отвергни с подсказкой.
- Если тип не указан, по умолчанию делай постоянную скидку. Таймер требуй только когда пользователь его упоминает.
- excludedProducts — список названий или их частей, которые нужно пропустить.
- Маркап (increase) всегда постоянный, duration в этом случае не отправляй.`,
      parameters: {
        type: 'object',
        properties: {
          percentage: {
            type: 'number',
            description: 'Percentage to change (positive number, 0.1 to 100). Examples: user says "скидка 10%" → 10, "increase by 5%" → 5, "накрутка 15%" → 15. Extract ONLY the number.',
            minimum: 0.1,
            maximum: 100
          },
          operation: {
            type: 'string',
            enum: ['increase', 'decrease'],
            description: 'Operation type. "decrease" = discount/скидка (lower prices). "increase" = накрутка/markup (raise prices). Examples: "скидка" → decrease, "подними цены" → increase, "discount" → decrease.'
          },
          discount_type: {
            type: 'string',
            enum: ['permanent', 'timer'],
            description: 'Optional explicit discount type. Use "timer" together with duration, or "permanent" for indefinite discounts.'
          },
          duration: {
            type: 'string',
            description: 'Duration for timer discount in human-readable format. Examples: "6 часов", "3 дня", "12h", "2 days", "24 hours". Заполняй только если пользователь дал длительность.'
          },
          excludedProducts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Product names to EXCLUDE from discount. Use when user says "кроме X", "except Y", "всем кроме Z", "без X". Example: ["MacBook", "iPhone"]. Supports partial names - "iPhone" will exclude "iPhone 12 Pro", "iPhone 13", etc. Case insensitive.'
          }
        },
        required: ['percentage', 'operation'],
        additionalProperties: false
      }
    }
  }
];

export default productTools;
