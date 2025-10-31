import React from 'react';
import { motion } from 'framer-motion';
import { EyeIcon, ArrowPathIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';

const FollowCard = ({ follow, onClick }) => {
  const modeLabel = follow.mode === 'monitor' ? 'Мониторинг' : 'Перепродажа';
  const ModeIcon = follow.mode === 'monitor' ? EyeIcon : ArrowPathIcon;

  // Spring animation preset
  const controlSpring = { type: 'spring', stiffness: 400, damping: 32 };

  return (
    <motion.div
      className="glass-card rounded-2xl p-5 cursor-pointer border border-white/10 group"
      onClick={onClick}
      whileHover={{
        scale: 1.015,
        borderColor: 'rgba(255, 107, 0, 0.25)',
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
      }}
      whileTap={{ scale: 0.985 }}
      transition={controlSpring}
    >
      <div className="flex items-center gap-4">
        {/* Shop Icon */}
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
          <BuildingStorefrontIcon className="w-6 h-6 text-gray-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-base mb-1 truncate" style={{ letterSpacing: '-0.01em' }}>
            {follow.source_shop_name}
          </h3>

          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <ModeIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">{modeLabel}</span>
            </div>

            {follow.mode === 'resell' && follow.markup_percentage && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-primary/10">
                <span className="text-orange-primary font-semibold text-xs">+{follow.markup_percentage}%</span>
              </div>
            )}

            <div className="text-gray-400">
              <span className="font-medium text-white">{follow.source_products_count || 0}</span> товаров
            </div>
          </div>
        </div>

        {/* Arrow */}
        <svg
          className="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.div>
  );
};

export default FollowCard;
