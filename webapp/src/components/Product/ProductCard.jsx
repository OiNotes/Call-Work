import { motion, AnimatePresence } from 'framer-motion';
import { useState, memo, useMemo, useCallback } from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { useStore } from '../../store/useStore';
import { useToast } from '../../hooks/useToast';
import { usePlatform } from '../../hooks/usePlatform';
import { getSpringPreset, getSurfaceStyle, isAndroid } from '../../utils/platform';
import { gpuAccelStyle } from '../../utils/animationHelpers';

const ProductCard = memo(function ProductCard({ product, onPreorder }) {
  const { triggerHaptic } = useTelegram();
  const addToCart = useStore((state) => state.addToCart);
  const toast = useToast();
  const platform = usePlatform();
  const android = isAndroid(platform);

  const cardSurface = useMemo(() => getSurfaceStyle('glassCard', platform), [platform]);
  const quickSpring = useMemo(() => getSpringPreset('quick', platform), [platform]);
  const pressSpring = useMemo(() => getSpringPreset('press', platform), [platform]);

  const [isHovered, setIsHovered] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const isAvailable = product.isAvailable ?? product.is_available ?? true;
  const stock = product.stock ?? product.stock_quantity ?? 0;
  const availability = product.availability || (isAvailable && stock <= 0 ? 'preorder' : 'stock');
  const isPreorder = availability === 'preorder';
  const isDisabled = !isAvailable || (!isPreorder && stock <= 0);
  const stockLabel = stock > 999 ? '999+' : stock;
  const lowStock = stock > 0 && stock <= 3;

  const handleAddToCart = useCallback((event) => {
    event.stopPropagation();
    if (isDisabled) {
      toast.warning('This product is out of stock', 2000);
      return;
    }
    triggerHaptic('success');
    addToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }, [isDisabled, toast, triggerHaptic, addToCart, product]);

  const handlePreorderClick = useCallback((event) => {
    event.stopPropagation();
    triggerHaptic('light');
    if (onPreorder) {
      onPreorder(product);
    } else {
      toast.info('Предзаказ оформляется напрямую с продавцом. Напишите продавцу, чтобы закрепить товар.', 2600);
    }
  }, [triggerHaptic, onPreorder, product, toast]);

  return (
    <motion.div
      {...(!android && {
        onHoverStart: () => setIsHovered(true),
        onHoverEnd: () => setIsHovered(false),
      })}
      whileHover={!android ? { y: -4 } : undefined}
      whileTap={{ scale: android ? 0.99 : 0.98 }}
      transition={quickSpring}
      className="relative h-[180px] rounded-3xl overflow-hidden group"
      style={{
        ...gpuAccelStyle,
        ...cardSurface,
        background: 'linear-gradient(145deg, rgba(26, 26, 26, 0.9) 0%, rgba(20, 20, 20, 0.95) 100%)'
      }}
    >
      {!android && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(600px circle at center, rgba(255, 107, 0, 0.06), transparent 40%)'
          }}
        />
      )}

      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {product.isPremium && (
          <div className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-100 border border-white/20 bg-white/10 shadow-[0_6px_24px_rgba(0,0,0,0.35)]">
            Premium
          </div>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 items-end">
        {isPreorder ? (
          <div className="px-3 py-1.5 rounded-full border border-orange-400/60 bg-orange-500/20 text-[11px] font-semibold text-orange-200 uppercase tracking-[0.16em] shadow-[0_10px_30px_rgba(255,120,40,0.3)]">
            Предзаказ
          </div>
        ) : stock > 0 && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border ${
              lowStock ? 'border-orange-400/70 bg-orange-500/12' : 'border-white/12 bg-black/35'
            } shadow-[0_8px_24px_rgba(12,12,12,0.35)] backdrop-blur`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${lowStock ? 'bg-orange-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-[11px] font-semibold text-white" style={{ letterSpacing: '0.08em' }}>
              {stockLabel} шт
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center rounded-3xl z-20"
            style={{
              background: android ? 'rgba(0, 0, 0, 0.78)' : 'rgba(0, 0, 0, 0.7)',
              backdropFilter: android ? 'blur(2px)' : 'blur(4px)'
            }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 15 }}
              className="text-5xl"
            >
              ✓
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative p-5 h-full flex flex-col justify-between">
        <h3
          className="text-white font-semibold text-lg leading-tight line-clamp-2"
          style={{ letterSpacing: '-0.01em' }}
        >
          {product.name}
        </h3>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-col">
            <span
              className="text-orange-primary font-bold text-2xl"
              style={{
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              ${product.price}
            </span>
            <span
              className={`text-xs uppercase font-medium ${
                isPreorder ? 'text-orange-200' : 'text-gray-500'
              }`}
              style={{ letterSpacing: '0.05em' }}
            >
              {isPreorder ? 'Предзаказ' : product.currency || 'USD'}
            </span>
          </div>

          <motion.button
            onClick={isPreorder ? handlePreorderClick : handleAddToCart}
            disabled={!isPreorder && isDisabled}
            whileHover={{
              y: android ? -1 : -2,
              scale: android ? 1.03 : 1.05,
              boxShadow: `
                1px 2px 2px hsl(0deg 0% 0% / 0.4),
                4px 8px 8px hsl(0deg 0% 0% / 0.4),
                8px 16px 16px hsl(0deg 0% 0% / 0.3),
                0 0 40px rgba(255, 107, 0, 0.15)
              `
            }}
            whileTap={{
              scale: android ? 0.985 : 0.98,
              y: 0,
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
            }}
            transition={{
              ...pressSpring,
              boxShadow: { duration: 0.18 }
            }}
            className="relative w-[2.75rem] h-[2.75rem] rounded-xl text-white overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
            style={{
              background: isPreorder
                ? 'linear-gradient(135deg, rgba(255, 163, 63, 0.38) 0%, rgba(255, 107, 0, 0.58) 100%)'
                : isDisabled
                  ? 'rgba(74, 74, 74, 0.5)'
                  : 'linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%)',
              boxShadow: isPreorder
                ? '0 4px 14px rgba(255, 140, 66, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                : isDisabled
                  ? 'none'
                  : `
                    0 2px 4px rgba(255, 107, 0, 0.25),
                    0 4px 12px rgba(255, 107, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.25)
                  `
            }}
          >
            {!isDisabled && !isPreorder && !android && (
              <motion.div
                className="absolute inset-0"
                initial={{ x: '-100%', opacity: 0 }}
                whileHover={{ x: '100%', opacity: 0.3 }}
                transition={{ duration: 0.6 }}
                style={{
                  background: 'linear-gradient(90deg, transparent, white, transparent)'
                }}
              />
            )}
            {isPreorder ? (
              <svg
                className="relative w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.2}
              >
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5" />
              </svg>
            ) : (
              <svg
                className="relative w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;
