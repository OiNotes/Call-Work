import { motion } from 'framer-motion';
import { memo } from 'react';

const badgeVariants = {
  gold: {
    background: 'linear-gradient(135deg, #F4D03F 0%, #C5A032 50%, #F4D03F 100%)',
    color: '#000',
    shadow: '0 2px 8px rgba(244, 208, 63, 0.4)',
  },
  silver: {
    background: 'linear-gradient(135deg, #BDC3C7 0%, #7F8C8D 50%, #BDC3C7 100%)',
    color: '#000',
    shadow: '0 2px 8px rgba(189, 195, 199, 0.3)',
  },
  premium: {
    background: 'linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%)',
    color: '#fff',
    shadow: '0 2px 8px rgba(255, 107, 0, 0.4)',
  },
};

const Badge = memo(function Badge({ 
  variant = 'premium', 
  children, 
  shimmer = false,
  className = '' 
}) {
  const styles = badgeVariants[variant];
  
  return (
    <motion.div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold relative overflow-hidden ${className}`}
      style={{
        background: styles.background,
        color: styles.color,
        boxShadow: styles.shadow,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {shimmer && (
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: ['200% 0', '-200% 0']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.div>
  );
});

export default Badge;
