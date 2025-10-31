import React from 'react';
import { motion } from 'framer-motion';
import { CubeIcon } from '@heroicons/react/24/outline';

const ProductList = ({ products, mode }) => {
  // Spring animation preset
  const controlSpring = { type: 'spring', stiffness: 400, damping: 32 };

  const sectionTitle = mode === 'monitor' ? 'ОТСЛЕЖИВАЕМЫЕ ТОВАРЫ' : 'СИНХРОНИЗИРОВАННЫЕ ТОВАРЫ';

  if (!products || products.length === 0) {
    return (
      <div>
        {/* Section Header */}
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-4">
          {sectionTitle}
        </h3>

        {/* Empty State */}
        <motion.div
          className="glass-card rounded-2xl p-12 text-center border border-white/5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={controlSpring}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
            <CubeIcon className="w-8 h-8 text-gray-500" />
          </div>
          <div className="text-white font-medium mb-1">Нет товаров</div>
          <div className="text-gray-400 text-sm">
            {mode === 'monitor'
              ? 'Товары появятся здесь когда магазин добавит их'
              : 'Товары будут синхронизированы автоматически'}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-4">
        {sectionTitle}
      </h3>

      {/* Products List */}
      <div className="space-y-2">
        {products.map((product, index) => {
          if (mode === 'monitor') {
            // Monitor mode: показываем оригинальные товары
            return (
              <motion.div
                key={product.id || index}
                className="glass-card rounded-xl p-4 border border-white/5"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, ...controlSpring }}
                whileHover={{
                  scale: 1.01,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Product Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-gray-500 text-xs font-semibold tabular-nums w-6">
                      #{index + 1}
                    </span>
                    <span className="text-white text-sm font-medium truncate" style={{ letterSpacing: '-0.01em' }}>
                      {product.name}
                    </span>
                  </div>

                  {/* Price & Stock */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-white text-base font-bold tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                      ${product.price}
                    </div>
                    <div className="bg-white/5 px-2.5 py-1 rounded-lg">
                      <span className="text-gray-400 text-xs font-medium">{product.stock_quantity} шт</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          } else {
            // Resell mode: показываем source + synced
            const sourceProduct = product.source_product || {};
            const syncedProduct = product.synced_product || {};
            const markupPercent = sourceProduct.price && syncedProduct.price
              ? (((syncedProduct.price - sourceProduct.price) / sourceProduct.price) * 100).toFixed(0)
              : 0;

            return (
              <motion.div
                key={product.id || index}
                className="glass-card rounded-xl p-4 border border-white/5"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, ...controlSpring }}
                whileHover={{
                  scale: 1.01,
                  borderColor: 'rgba(255, 107, 0, 0.15)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Product Name */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-gray-500 text-xs font-semibold tabular-nums w-6">
                    #{index + 1}
                  </span>
                  <span className="text-white text-sm font-medium truncate" style={{ letterSpacing: '-0.01em' }}>
                    {sourceProduct.name || syncedProduct.name}
                  </span>
                </div>

                {/* Price Comparison */}
                <div className="flex items-center justify-between gap-4">
                  {/* Source Price */}
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                      Их цена
                    </div>
                    <span className="text-gray-400 line-through text-sm tabular-nums">
                      ${sourceProduct.price}
                    </span>
                  </div>

                  {/* Markup Badge */}
                  {markupPercent > 0 && (
                    <div className="bg-orange-primary/10 border border-orange-primary/20 px-2.5 py-1 rounded-lg">
                      <span className="text-orange-primary text-xs font-bold tabular-nums">
                        +{markupPercent}%
                      </span>
                    </div>
                  )}

                  {/* Your Price + Stock */}
                  <div className="flex items-center gap-3">
                    <div className="text-orange-primary text-base font-bold tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                      ${syncedProduct.price}
                    </div>
                    <div className="bg-white/5 px-2.5 py-1 rounded-lg">
                      <span className="text-gray-400 text-xs font-medium">{syncedProduct.stock_quantity} шт</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          }
        })}
      </div>

      {/* Load More indicator (placeholder) */}
      {products.length >= 25 && (
        <motion.div
          className="mt-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-gray-400 text-xs">
            Показано {products.length} товаров
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProductList;
