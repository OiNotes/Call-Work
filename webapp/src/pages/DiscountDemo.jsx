import { useMemo } from 'react';
import ProductCard from '../components/Product/ProductCard';
import Header from '../components/Layout/Header';

/**
 * Демо страница для тестирования discount компонентов
 * Показывает разные варианты скидок и таймеров
 */
export default function DiscountDemo() {
  // Тестовые товары с разными типами скидок
  const demoProducts = useMemo(() => {
    const now = new Date();
    
    return [
      // 1. Товар без скидки (для сравнения)
      {
        id: 1,
        name: 'Обычный товар без скидки',
        price: 100,
        stock: 10,
        availability: 'stock',
        isAvailable: true,
        currency: 'USD'
      },
      
      // 2. Скидка БЕЗ таймера (permanent discount)
      {
        id: 2,
        name: 'Товар с постоянной скидкой 30%',
        price: 70,
        original_price: 100,
        discount_percentage: 30,
        stock: 5,
        availability: 'stock',
        isAvailable: true,
        currency: 'USD'
      },
      
      // 3. Скидка с таймером >3 часа (оранжевый)
      {
        id: 3,
        name: 'Скидка 25% истекает через 5 часов',
        price: 75,
        original_price: 100,
        discount_percentage: 25,
        discount_expires_at: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
        stock: 8,
        availability: 'stock',
        isAvailable: true
      },
      
      // 4. Скидка с таймером 1-3 часа (красный)
      {
        id: 4,
        name: 'Скидка 40% истекает через 2 часа',
        price: 60,
        original_price: 100,
        discount_percentage: 40,
        discount_expires_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        stock: 3,
        availability: 'stock',
        isAvailable: true
      },
      
      // 5. Скидка с таймером <1 час (красный + пульсация)
      {
        id: 5,
        name: 'СРОЧНО! Скидка 50% истекает через 45 минут',
        price: 50,
        original_price: 100,
        discount_percentage: 50,
        discount_expires_at: new Date(now.getTime() + 45 * 60 * 1000).toISOString(),
        stock: 2,
        availability: 'stock',
        isAvailable: true
      },
      
      // 6. Экстремально срочная скидка (<10 минут)
      {
        id: 6,
        name: 'ПОСЛЕДНИЕ МИНУТЫ! Скидка 60%',
        price: 40,
        original_price: 100,
        discount_percentage: 60,
        discount_expires_at: new Date(now.getTime() + 8 * 60 * 1000).toISOString(),
        stock: 1,
        availability: 'stock',
        isAvailable: true
      },
      
      // 7. Premium товар со скидкой
      {
        id: 7,
        name: 'Premium товар со скидкой 35%',
        price: 130,
        original_price: 200,
        discount_percentage: 35,
        discount_expires_at: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        stock: 15,
        availability: 'stock',
        isAvailable: true,
        isPremium: true
      },
      
      // 8. Большая скидка 70%
      {
        id: 8,
        name: 'Мега распродажа! Скидка 70%',
        price: 30,
        original_price: 100,
        discount_percentage: 70,
        discount_expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        stock: 5,
        availability: 'stock',
        isAvailable: true
      }
    ];
  }, []);

  return (
    <div
      className="pb-24"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}
    >
      <Header title="Демо: Скидки и таймеры" />
      
      <div className="px-4 py-6">
        <div className="mb-6 p-4 bg-white/5 rounded-2xl">
          <h2 className="text-white font-bold text-lg mb-2">
            Тестирование компонентов скидок
          </h2>
          <p className="text-gray-400 text-sm">
            Эта страница демонстрирует все варианты отображения скидок:
          </p>
          <ul className="text-gray-400 text-xs mt-2 space-y-1">
            <li>• Товар без скидки (для сравнения)</li>
            <li>• Постоянная скидка без таймера</li>
            <li>• Скидка с таймером &gt;3 часа (оранжевый цвет)</li>
            <li>• Скидка с таймером 1-3 часа (красный цвет)</li>
            <li>• Срочная скидка &lt;1 час (красный + пульсация)</li>
            <li>• Premium товар со скидкой</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {demoProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isWide={product.name.length > 45}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
