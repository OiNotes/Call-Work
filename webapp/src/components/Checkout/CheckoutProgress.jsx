import { motion } from 'framer-motion';

export default function CheckoutProgress({ currentStep, totalSteps }) {
  return (
    <div className="flex items-center gap-2 mb-6 px-4">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <motion.div
          key={i}
          className="h-1 rounded-full flex-1 overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <motion.div
            className="h-full"
            initial={{ scaleX: 0 }}
            animate={{
              scaleX: i <= currentStep ? 1 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
            }}
            style={{
              originX: 0,
              background:
                i <= currentStep
                  ? 'linear-gradient(135deg, #FF6B00 0%, #FF8C42 100%)'
                  : 'rgba(255, 255, 255, 0.1)',
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}
