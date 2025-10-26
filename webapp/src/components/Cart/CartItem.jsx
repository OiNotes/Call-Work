import { motion } from 'framer-motion';
import { memo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useTelegram } from '../../hooks/useTelegram';

const CartItem = memo(function CartItem({ item }) {
  const { updateCartQuantity, removeFromCart } = useStore(
    useShallow((state) => ({
      updateCartQuantity: state.updateCartQuantity,
      removeFromCart: state.removeFromCart,
    }))
  );
  const { triggerHaptic } = useTelegram();
  const [isDragging, setIsDragging] = useState(false);

  const handleIncrease = () => {
    triggerHaptic('light');
    updateCartQuantity(item.id, item.quantity + 1);
  };

  const handleDecrease = () => {
    triggerHaptic('light');
    if (item.quantity > 1) {
      updateCartQuantity(item.id, item.quantity - 1);
    } else {
      removeFromCart(item.id);
    }
  };

  const handleRemove = () => {
    triggerHaptic('medium');
    removeFromCart(item.id);
  };

  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    
    // Если свайпнули влево больше 80px - удалить
    if (info.offset.x < -80) {
      triggerHaptic('warning');
      removeFromCart(item.id);
    }
  };

  return (
    <motion.div
      className="relative"
      drag="x"
      dragConstraints={{ left: -100, right: 0 }}
      dragElastic={{ left: 0.2, right: 0 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 0.98 }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Delete indicator (показывается при swipe) */}
      <motion.div
        className="absolute right-0 top-0 h-full w-20 flex items-center justify-center rounded-r-xl"
        style={{
          background: 'linear-gradient(90deg, transparent, #EF4444)',
        }}
        animate={{
          opacity: isDragging ? 1 : 0,
        }}
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </motion.div>
      
      {/* Existing CartItem content */}
      <motion.div
        className="glass-card rounded-xl p-4 relative z-10"
        style={{
          background: 'rgba(33, 33, 33, 0.6)',
        }}
      >
      <div className="flex gap-4">
        {/* Product Image */}
        <div className="w-20 h-20 rounded-lg bg-dark-elevated flex-shrink-0 overflow-hidden">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white line-clamp-2">
              {item.name}
            </h4>
            <p className="text-lg font-bold text-orange-primary mt-1">
              ${item.price}
            </p>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleDecrease}
                className="w-8 h-8 rounded-lg bg-dark-elevated flex items-center justify-center text-white"
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </motion.button>

              <span className="text-white font-semibold min-w-[2rem] text-center">
                {item.quantity}
              </span>

              <motion.button
                onClick={handleIncrease}
                className="w-8 h-8 rounded-lg bg-dark-elevated flex items-center justify-center text-white"
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </motion.button>
            </div>

            {/* Remove Button */}
            <motion.button
              onClick={handleRemove}
              className="text-red-500 hover:text-red-400"
              whileTap={{ scale: 0.9 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
      </motion.div>
    </motion.div>
  );
});

export default CartItem;
