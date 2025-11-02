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
      description: `Add a new product to the shop.

Use this when:
- User wants to create/add a single new product
- User says "добавь товар", "создай продукт", "add product"

Don't use if:
- User wants to add multiple products at once (use bulkAddProducts)
- User wants to modify existing product (use updateProduct)

IMPORTANT: If user didn't provide price, you MUST ask "Какая цена?" before calling this function. Don't guess the price.`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Product name (minimum 3 characters). Examples: "iPhone 15 Pro", "Samsung Galaxy S24", "Наушники AirPods". Must be specified by user.'
          },
          price: {
            type: 'number',
            description: 'Product price in USD (must be positive). Examples: 999, 1299.99, 49.90. REQUIRED: If user didn\'t mention price, ask before calling function.'
          },
          stock: {
            type: 'number',
            description: 'Stock quantity (defaults to 0 if not provided). Examples: 10, 5, 100. If user says "5 штук", "10 pcs", extract the number. Must be >= 0.'
          }
        },
        required: ['name', 'price', 'stock'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    strict: true,
    function: {
      name: 'bulkAddProducts',
      description: `Add multiple products at once.

Use this when:
- User wants to add 2 or more products in one message
- User says "добавь iPhone $500 10шт и Samsung $400 5шт"
- User provides a list: "add: red car $10, green car $15 2pcs, blue car $20"

Don't use if:
- User wants to add only one product (use addProduct)

IMPORTANT: DO NOT ask clarifying questions. Extract all products from user's message and add them immediately. Parse quantities from phrases like "5шт", "10 pcs", "2 штуки".`,
      parameters: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            description: 'Array of products to add. Each product must have name, price, and stock. Example: [{name: "iPhone", price: 999, stock: 10}, {name: "Samsung", price: 799, stock: 5}]',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Product name (minimum 3 characters). Extract from user message. Examples: "iPhone 15", "Чехол", "red car"'
                },
                price: {
                  type: 'number',
                  description: 'Product price in USD (must be positive). Extract from user message: "$500", "1000$", "цена 999". Examples: 999, 49.90'
                },
                stock: {
                  type: 'number',
                  description: 'Stock quantity (defaults to 10 if not specified). Extract from: "5шт", "10 pcs", "2 штуки". Examples: 5, 10, 100. Must be >= 0.'
                }
              },
              required: ['name', 'price', 'stock'],
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
      name: 'updateProduct',
      description: `Update product price, name, or stock quantity.

Use this when:
- User wants to modify existing product
- User says "измени цену на...", "переименуй...", "выстави наличие..."
- User says "change price", "rename", "set stock to...", "update quantity"
- Keywords: сток, наличие, остаток, stock, quantity, qty

Don't use if:
- User wants to add new product (use addProduct)
- User wants to delete product (use deleteProduct)
- User wants to change prices for ALL products (use bulkUpdatePrices)

IMPORTANT: 
- If user didn't specify which product, you MUST ask "Какой товар?" BEFORE calling this function
- If search returns multiple matches, ask user to clarify which one
- DO NOT respond with text explanation - CALL the function after getting product name`,
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

DANGEROUS OPERATION! Always confirm with user before calling:
- Ask: "Точно удалить ВСЕ товары? Это действие нельзя отменить."
- Only call function after explicit confirmation`,
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
      name: 'recordSale',
      description: `Record a sale - decrease stock quantity.

Use this when:
- User reports a sale/purchase
- User says "продал 5 iPhone", "bought 2 Samsung", "купили Чехол"
- User says "sold out" (quantity = all remaining stock)

Don't use if:
- User wants to manually set stock quantity (use updateProduct with stock_quantity)

IMPORTANT:
- If user didn't specify product name, ask "Какой товар продан?"
- If quantity not mentioned, assume 1 (one item sold)
- If user says "sold out", first check current stock and use that quantity`,
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Product name (fuzzy match supported). REQUIRED: If user didn\'t mention product, ask before calling. Examples: "iPhone" will match "iPhone 15 Pro", "Чехол" will match "Чехол для Samsung"'
          },
          quantity: {
            type: 'number',
            description: 'Number of items sold (defaults to 1 if not specified). Examples: "продал 5 штук" → 5, "bought 10 pcs" → 10, just "продал iPhone" → 1. Must be positive number.'
          }
        },
        required: ['productName', 'quantity'],
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
      name: 'bulkUpdatePrices',
      description: `Apply discount or price increase to ALL products in the shop.

Use this when:
- User wants to change prices for ALL products at once
- User says "скидка 10%", "накрутка 5%", "подними цены на 20%"
- User says "discount 15%", "increase prices by 10%"

Don't use if:
- User wants to change price of ONE product (use updateProduct)

Discount Types (IMPORTANT):
- "permanent" - Discount stays until manually removed by user
- "timer" - Discount auto-expires after specified duration

Behavior:
- If user didn't specify discount type OR duration, leave 'duration' field EMPTY
- System will automatically ask user naturally: "Это постоянная скидка или с таймером?"
- DO NOT ask about discount type yourself - just call function with empty duration
- System handles the conversation flow via needsInput mechanism`,
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
          duration: {
            type: 'string',
            description: 'Duration for timer discount in human-readable format. Examples: "6 часов", "3 дня", "12h", "2 days", "24 hours". LEAVE EMPTY if user didn\'t specify - system will ask. Only fill if user explicitly mentioned time period.'
          }
        },
        required: ['percentage', 'operation'],
        additionalProperties: false
      }
    }
  }
];

export default productTools;
