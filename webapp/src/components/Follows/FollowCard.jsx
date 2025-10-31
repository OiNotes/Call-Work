import React from 'react';
import { motion } from 'framer-motion';

const FollowCard = ({ follow, onClick }) => {
  const modeLabel = follow.mode === 'monitor' ? 'Мониторинг' : 'Перепродажа';
  const modeEmoji = follow.mode === 'monitor' ? '🔍' : '💰';

  return (
    <motion.div
      className="bg-[#1A1A1A] rounded-2xl p-4 cursor-pointer"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏪</span>
            <h3 className="text-white font-semibold">{follow.source_shop_name}</h3>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>{modeEmoji} {modeLabel}</span>
            {follow.mode === 'resell' && follow.markup_percentage && (
              <span className="text-[#FF6B00]">+{follow.markup_percentage}%</span>
            )}
            <span>•</span>
            <span>{follow.source_products_count || 0} товаров</span>
          </div>
        </div>

        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.div>
  );
};

export default FollowCard;
