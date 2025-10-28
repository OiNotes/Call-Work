import { motion } from 'framer-motion';
import { memo, useMemo } from 'react';
import ProductCard from './ProductCard';
import { useTranslation } from '../../i18n/useTranslation';
import { usePlatform } from '../../hooks/usePlatform';
import { getSpringPreset } from '../../utils/platform';

// Memoized animation variants (moved outside component to prevent recreation)
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const ProductGrid = memo(function ProductGrid({
  products,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  onPreorder,
}) {
  const { t } = useTranslation();
  const platform = usePlatform();

  const item = useMemo(() => {
    const springPreset = getSpringPreset('quick', platform);
    return {
      hidden: { opacity: 0, y: 20 },
      show: {
        opacity: 1,
        y: 0,
        transition: springPreset || { type: 'spring', stiffness: 400, damping: 30 }
      }
    };
  }, [platform]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">
          {emptyIcon || (
            <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">
          {emptyTitle || t('catalog.empty')}
        </h3>
        <p className="text-sm text-gray-500">
          {emptyDescription || t('catalog.emptyDesc')}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-3 p-4 pb-32"
    >
      {products.map((product) => (
        <motion.div key={product.id} variants={item}>
          <ProductCard product={product} onPreorder={onPreorder} />
        </motion.div>
      ))}
    </motion.div>
  );
});

export default ProductGrid;
