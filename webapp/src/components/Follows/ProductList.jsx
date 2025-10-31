import React from 'react';

const ProductList = ({ products, mode }) => {
  if (!products || products.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        Нет товаров
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {products.map((product, index) => {
        if (mode === 'monitor') {
          // Monitor mode: показываем оригинальные товары
          return (
            <div key={product.id || index} className="flex items-center justify-between py-2 px-3 bg-[#0A0A0A] rounded-lg">
              <span className="text-gray-300 text-sm">
                {index + 1}. {product.name}
              </span>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-white">${product.price}</span>
                <span className="text-gray-400">{product.stock_quantity} шт</span>
              </div>
            </div>
          );
        } else {
          // Resell mode: показываем source + synced
          const sourceProduct = product.source_product || {};
          const syncedProduct = product.synced_product || {};

          return (
            <div key={product.id || index} className="py-2 px-3 bg-[#0A0A0A] rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">
                  {index + 1}. {sourceProduct.name || syncedProduct.name}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 line-through">${sourceProduct.price}</span>
                  <span className="text-[#FF6B00]">→</span>
                  <span className="text-white font-semibold">${syncedProduct.price}</span>
                  <span className="text-gray-400">{syncedProduct.stock_quantity} шт</span>
                </div>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default ProductList;
